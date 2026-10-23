/**
 * @aimata-dsl/core — src/compiler.js
 *
 * Bi-directional compiler engine.
 *
 * Micro-DSL format:
 *   [tag#id.cls1.cls2{prop1=val1,prop2=val2}|children]
 *
 * Supported expansion targets:
 *   'react'   → className, onClick={fn}, JSX self-closing
 *   'html'    → class, data-onclick, standard HTML
 *   'vue'     → class, @click="fn", :prop="val", Vue template syntax
 *   'angular' → class, (click)="fn()", [prop]="val", Angular template
 *   'svelte'  → class, on:click={fn}, Svelte template syntax
 *   'solid'   → class, onClick={fn}, SolidJS (same as React surface, different runtime)
 *
 * Example:
 *   Input:  <button className="px-4 py-2 bg-blue-500" onClick={handleClick}>Submit</button>
 *   Output: [button.px-4.py-2.bg-blue-500{onClick=handleClick}|Submit]
 */

import { parse } from './parser.js';

// ─── Supported targets ────────────────────────────────────────────────────────

/** @type {Set<string>} */
const SUPPORTED_TARGETS = new Set(['react', 'html', 'vue', 'angular', 'svelte', 'solid', 'sql', 'prisma', 'ts']);

const TAG_ALIASES = {
  div: 'box',
  button: 'btn',
};

const DSL_TAG_ALIASES = {
  box: 'div',
  btn: 'button',
};

function splitCommaSeparated(value) {
  const parts = [];
  let current = '';
  let quote = null;
  let depth = 0;

  for (const ch of value) {
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      current += ch;
      continue;
    }
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;

    if (ch === ',' && depth === 0) {
      if (current.trim()) parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }

  if (current.trim()) parts.push(current.trim());
  return parts.filter(Boolean);
}

function parseAttributeList(raw) {
  const list = raw || '';
  const props = {};
  const classes = [];

  for (const item of splitCommaSeparated(list)) {
    const trimmed = item.trim();
    if (!trimmed) continue;

    if (trimmed.includes('=')) {
      const eqIndex = trimmed.indexOf('=');
      const key = trimmed.slice(0, eqIndex).trim();
      let value = trimmed.slice(eqIndex + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      props[key] = value;
      continue;
    }

    if (/^class$/i.test(trimmed)) {
      props.class = '';
      continue;
    }

    if (/^(required|disabled|checked|multiple|readonly|selected|autofocus|hidden)$/i.test(trimmed)) {
      props[trimmed] = 'true';
      continue;
    }

    classes.push(...trimmed.split(/\s+/).filter(Boolean));
  }

  return { props, classes };
}

function parseClassTokens(raw) {
  return String(raw || '').split(/\s+/).filter(Boolean);
}

function stripSurroundingQuotes(value) {
  if (!value) return value;
  const trimmed = String(value).trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function renderPropValue(value) {
  const str = stripSurroundingQuotes(value);
  return str;
}

function renderAttributeMap(attrs, target, includeClass = true) {
  const entries = [];

  for (const [key, value] of Object.entries(attrs)) {
    const normal = String(key).trim();
    if (!normal || normal === 'className') continue;
    if (!includeClass && normal === 'class') continue;
    if (value === 'true') {
      entries.push(normal);
      continue;
    }

    const renderedValue = stripSurroundingQuotes(value);
    entries.push(`${normal}="${renderedValue}"`);
  }

  if (includeClass && attrs.class !== undefined) {
    const className = stripSurroundingQuotes(attrs.class);
    const attrName = target === 'react' || target === 'solid' ? 'className' : 'class';
    entries.push(`${attrName}="${className}"`);
  }

  return entries.join(' ');
}

function parseStructuralNode(raw) {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('[')) return null;

  if (/^state\[/.test(trimmed)) {
    const m = trimmed.match(/^state\[(.+)\]$/);
    if (!m) return null;
    const [key, value] = m[1].split(':').map(v => v.trim());
    return { kind: 'state', key, value };
  }

  if (/^on\[/.test(trimmed)) {
    const m = trimmed.match(/^on\[(.+)\]$/);
    if (!m) return null;
    const [eventName, handler] = m[1].split(':').map(v => v.trim());
    return { kind: 'event', eventName, handler };
  }

  if (/^tbl\[/.test(trimmed)) {
    const m = trimmed.match(/^tbl\[(.+?)\]\s*\{\s*(.*)\s*\}$/s);
    if (!m) return null;
    return {
      kind: 'table',
      name: m[1].trim(),
      columns: (m[2] || '').split(/,(?=(?:[^\[\]]|\[[^\]]*\])*?$)/).map(v => v.trim()).filter(Boolean),
    };
  }

  if (/^col\[/.test(trimmed)) {
    const m = trimmed.match(/^col\[(.+)\]$/);
    if (!m) return null;
    const parts = splitCommaSeparated(m[1]);
    return { kind: 'column', name: parts[0], meta: parts.slice(1) };
  }

  const model = trimmed.match(/^([A-Za-z][A-Za-z0-9_-]*)\[(.*)\](?:\s*(.*))?$/s);
  if (!model) return null;

  const tag = model[1];
  const body = (model[2] || '').trim();
  const suffix = (model[3] || '').trim();
  const rawProps = body.includes('=') || body.includes('"') || body.includes("'") ? parseAttributeList(body) : { props: {}, classes: parseClassTokens(body) };

  return {
    kind: 'element',
    tag,
    props: rawProps.props,
    classes: rawProps.classes,
    suffix,
  };
}

function expandSchemaColumn(column, target = 'sql') {
  const cleaned = column.trim();
  const name = cleaned.replace(/^col\[/, '').replace(/\]$/, '').trim();
  const parts = splitCommaSeparated(name);
  const fieldName = (parts[0] || 'id').trim();
  const modifiers = parts.slice(1).map(v => v.trim()).filter(Boolean);

  if (target === 'sql') {
    const type = modifiers.find(v => !['PK','UK','UNIQUE','NOTNULL','NULL','DEFAULT','INDEX'].includes(v.toUpperCase())) || 'TEXT';
    const isPrimary = modifiers.some(v => /PK/i.test(v));
    const isUnique = modifiers.some(v => /UNIQUE|UK/i.test(v));
    const baseClause = `${fieldName} ${type.toUpperCase()}`;
    const suffix = `${isPrimary ? ' PRIMARY KEY' : ''}${isUnique ? ' UNIQUE' : ''}`;
    return `${baseClause}${suffix}`;
  }

  if (target === 'prisma') {
    const type = modifiers.find(v => !['PK','UK','UNIQUE','NOTNULL','NULL','DEFAULT','INDEX'].includes(v.toUpperCase())) || 'String';
    const mappedType = type.toLowerCase() === 'timestamp' ? 'DateTime' : type.toLowerCase() === 'int' ? 'Int' : 'String';
    const unique = modifiers.some(v => /UNIQUE|UK/i.test(v)) ? ' @unique' : '';
    const primary = modifiers.some(v => /PK/i.test(v)) ? ' @id' : '';
    return `${fieldName} ${mappedType}${primary}${unique}`;
  }

  if (target === 'ts') {
    const type = modifiers.find(v => !['PK','UK','UNIQUE','NOTNULL','NULL','DEFAULT','INDEX'].includes(v.toUpperCase())) || 'string';
    const mappedType = type.toLowerCase() === 'timestamp' ? 'Date' : type.toLowerCase() === 'int' ? 'number' : 'string';
    return `${fieldName}: ${mappedType};`;
  }

  return `${fieldName}: ${modifiers.join(' ') || 'string'}`;
}

function expandSchemaTable(dsl, target='sql') {
  const match = dsl.trim().match(/^tbl\[(.+?)\]\s*\{\s*(.*)\s*\}$/s);
  if (!match) return null;

  const tableName = match[1].trim();
  const rawColumns = (match[2] || '').split(/,(?=(?:[^\[\]]|\[[^\]]*\])*?$)/).map(v => v.trim()).filter(Boolean);
  const columns = rawColumns.map(col => col.replace(/^col\[/, '').replace(/\]$/, '').trim());

  if (target === 'sql') {
    return `CREATE TABLE ${tableName} (\n  ${columns.map(c => expandSchemaColumn(`col[${c}]`, 'sql')).join(',\n  ')}\n);`;
  }

  if (target === 'prisma') {
    return `model ${tableName} {\n  ${columns.map(c => expandSchemaColumn(`col[${c}]`, 'prisma')).join('\n  ')}\n}`;
  }

  if (target === 'ts') {
    return `export interface ${tableName} {\n  ${columns.map(c => expandSchemaColumn(`col[${c}]`, 'ts')).join('\n  ')}\n}`;
  }

  return `tbl[${tableName}] { ${rawColumns.join(', ')} }`;
}

function renderClassAttribute(target, classes) {
  const classValue = Array.isArray(classes) ? classes.join(' ') : String(classes || '').trim();
  if (!classValue) return '';
  return target === 'react' || target === 'solid' ? `className="${classValue}"` : `class="${classValue}"`;
}

function renderAttributeText(attrs, target) {
  const entries = [];
  for (const [key, value] of Object.entries(attrs || {})) {
    const normal = String(key).trim();
    if (!normal || normal === 'className' || normal === 'class') continue;
    if (value === 'true') entries.push(normal);
    else entries.push(`${normal}="${stripSurroundingQuotes(value)}"`);
  }
  return entries.join(' ');
}

function expandStructuralNode(raw, target, indent = 0) {
  const trimmed = raw.trim();
  if (!trimmed) return '';

  if (/^state\[/.test(trimmed)) {
    const m = trimmed.match(/^state\[(.+)\]$/);
    if (!m) return '';
    const [key, value] = m[1].split(':').map(v => v.trim());
    return `${'  '.repeat(indent)}const ${key} = ${value};`;
  }

  if (/^on\[/.test(trimmed)) {
    const m = trimmed.match(/^on\[(.+)\]$/);
    if (!m) return '';
    const [eventName, handler] = m[1].split(':').map(v => v.trim());
    const eventKey = eventName.charAt(0).toUpperCase() + eventName.slice(1);
    return `${'  '.repeat(indent)}on${eventKey}={${handler}}`;
  }

  if (/^tbl\[/.test(trimmed)) {
    return expandSchemaTable(trimmed, target);
  }

  if (/^form\[/.test(trimmed)) {
    const m = trimmed.match(/^form\[(.+?)\]\s*\{\s*(.*)\s*\}$/s);
    if (!m) return '';
    const classes = parseClassTokens(m[1]);
    const body = m[2].trim();
    const children = body ? splitCommaSeparated(body) : [];
    const attrs = [];
    const renderedChildren = [];
    let stateText = '';
    for (const item of children) {
      const ti = item.trim();
      if (!ti) continue;
      if (/^state\[/.test(ti)) {
        const state = expandStructuralNode(ti, target, indent + 1);
        if (state) stateText += `${state}\n`;
      } else if (/^on\[/.test(ti)) {
        const event = expandStructuralNode(ti, target, indent + 1);
        if (event) attrs.push(event);
      } else if (/^label\[/.test(ti)) {
        renderedChildren.push(expandStructuralNode(ti, target, indent + 1));
      } else if (/^input\[|^select\[|^textarea\[/.test(ti)) {
        renderedChildren.push(expandStructuralNode(ti, target, indent + 1));
      } else {
        renderedChildren.push(ti);
      }
    }
    const renderedAttrs = [renderClassAttribute(target, classes), ...attrs, renderAttributeText({}, target)].filter(Boolean).join(' ');
    const bodyString = renderedChildren.length ? `\n${renderedChildren.map(x => `${'  '.repeat(indent + 1)}${x}`).join('\n')}\n${'  '.repeat(indent)}` : '';
    const out = `${'  '.repeat(indent)}<form${renderedAttrs ? ` ${renderedAttrs}` : ''}>${bodyString}</form>`;
    return stateText ? `${out}\n${stateText.trimEnd()}` : out;
  }

  if (/^label\[/.test(trimmed)) {
    const m = trimmed.match(/^label\[(.+?)\]\s*(.*)$/s);
    if (!m) return '';
    const classes = parseClassTokens(m[1]);
    const text = stripSurroundingQuotes(m[2].trim());
    const attrs = [renderClassAttribute(target, classes)].filter(Boolean).join(' ');
    return `${'  '.repeat(indent)}<label${attrs ? ` ${attrs}` : ''}>${text}</label>`;
  }

  if (/^(input|select|textarea)\[/.test(trimmed)) {
    const tagMatch = trimmed.match(/^([a-zA-Z]+)\[(.*)\]$/s);
    if (!tagMatch) return '';
    const tag = tagMatch[1];
    const raw = tagMatch[2];
    const list = parseAttributeList(raw);
    const attrs = { ...list.props };
    if (list.classes.length) attrs.class = list.classes.join(' ');
    const classPart = renderClassAttribute(target, attrs.class || '');
    const otherParts = renderAttributeText(attrs, target).trim();
    const fullAttrs = [classPart, otherParts].filter(Boolean).join(' ');
    return `${'  '.repeat(indent)}<${tag}${fullAttrs ? ` ${fullAttrs}` : ''} />`;
  }

  const parsed = parseStructuralNode(trimmed);
  if (!parsed || parsed.kind !== 'element') return raw;

  const { tag, props, classes, suffix } = parsed;
  const actualTag = tag === 'box' ? 'div' : tag === 'btn' ? 'button' : tag;
  const renderTag = (target === 'html' && /^[A-Z]/.test(actualTag)) ? 'div' : actualTag;
  const isInputLike = ['input', 'select', 'textarea'].includes(renderTag);
  const isLabelLike = renderTag === 'label';
  const isFormLike = renderTag === 'form';

  if (isInputLike) {
    const attrs = { ...props };
    if (classes.length > 0) attrs.class = classes.join(' ');
    const attrString = renderAttributeMap(attrs, target, true).trim();
    return `${'  '.repeat(indent)}<${renderTag}${attrString ? ` ${attrString}` : ''} />`;
  }

  if (isLabelLike) {
    const text = stripSurroundingQuotes(suffix || '');
    const attrs = { ...props };
    if (classes.length > 0) attrs.class = classes.join(' ');
    const attrString = renderAttributeMap(attrs, target, true).trim();
    return `${'  '.repeat(indent)}<${renderTag}${attrString ? ` ${attrString}` : ''}>${text || ''}</${renderTag}>`;
  }

  if (isFormLike) {
    const attrs = { ...props };
    if (classes.length > 0) attrs.class = classes.join(' ');
    const childBody = suffix && suffix.startsWith('{') && suffix.endsWith('}') ? suffix.slice(1, -1).trim() : '';
    const body = childBody ? `\n${expandFromDSL(childBody, target).split('\n').map(line => `${'  '.repeat(indent + 1)}${line}`).join('\n')}\n${'  '.repeat(indent)}` : '';
    const attrString = renderAttributeMap(attrs, target, true).trim();
    return `${'  '.repeat(indent)}<${renderTag}${attrString ? ` ${attrString}` : ''}>${body}</${renderTag}>`;
  }

  const attrs = { ...props };
  if (classes.length > 0) attrs.class = classes.join(' ');
  const attrString = renderAttributeMap(attrs, target, true).trim();
  return `${'  '.repeat(indent)}<${renderTag}${attrString ? ` ${attrString}` : ''}>${stripSurroundingQuotes(suffix || '')}</${renderTag}>`;
}

/**
 * Map of event handler prefixes by target framework.
 * Key: camelCase event name portion after 'on' (e.g. 'click' from 'onClick')
 */
const EVENT_PATTERNS = {
  // React/Solid: keep full camelCase key (onClick, onChange, etc.)
  react:   { wrapper: (key, v) => `${key}={${v}}` },
  solid:   { wrapper: (key, v) => `${key}={${v}}` },
  // Vue: strip 'on' prefix, lowercase → @click="val"
  vue:     { wrapper: (key, v) => `@${key.slice(2).toLowerCase()}="${v}"` },
  // Angular: strip 'on', lowercase → (click)="val()"
  angular: { wrapper: (key, v) => `(${key.slice(2).toLowerCase()})="${v}()"` },
  // Svelte: strip 'on', lowercase → on:click={val}
  svelte:  { wrapper: (key, v) => `on:${key.slice(2).toLowerCase()}={${v}}` },
  // HTML: strip 'on', lowercase → data-onclick="val"
  html:    { wrapper: (key, v) => `data-on${key.slice(2).toLowerCase()}="${v}"` },
};

/** Class attribute name per target */
const CLASS_ATTR = {
  react: 'className',
  // SolidJS templates use 'class' (not className) unlike React
  solid: 'class',
  vue: 'class', angular: 'class', svelte: 'class', html: 'class',
};

/** Whether a target supports JSX-style expressions `{val}` for non-event props */
const USES_JSX_EXPR = new Set(['react', 'solid']);

// ─── Void elements (self-closing in HTML) ─────────────────────────────────────
const VOID_ELEMENTS = new Set([
  'area','base','br','col','embed','hr','img','input',
  'link','meta','param','source','track','wbr',
]);

// ─── AST → DSL (Compression) ──────────────────────────────────────────────────

/**
 * Serialize a single AST node into Aimata micro-DSL notation.
 * @param {import('./parser.js').ASTNode} node
 * @returns {string}
 */
function nodeToStructuredDSL(node) {
  if (node.type === 'text') return node.value;

  const tag = node.tag;
  const classes = (node.classes || []).join(' ');

  if (tag === 'form') {
    const children = (node.children || []).map(nodeToStructuredDSL).join(', ');
    return `form[${classes}] { ${children} }`;
  }

  if (tag === 'input' || tag === 'select' || tag === 'textarea') {
    const attrs = [];
    if (node.props && node.props.type) attrs.push(`type="${node.props.type}"`);
    if (node.props && node.props.placeholder) attrs.push(`placeholder="${node.props.placeholder}"`);
    if (classes) attrs.push(`class="${classes}"`);
    for (const [key, value] of Object.entries(node.props || {})) {
      if (['type', 'placeholder', 'className', 'class'].includes(key)) continue;
      attrs.push(`${key}="${value}"`);
    }
    return `${tag}[${attrs.join(', ')}]`;
  }

  if (tag === 'label') {
    const text = (node.children || []).map(child => child.type === 'text' ? child.value : nodeToStructuredDSL(child)).join('');
    return `label[${classes}] "${text.trim()}"`;
  }

  const dslTag = TAG_ALIASES[tag] || tag;
  let dsl = '[' + dslTag;
  if (node.id) dsl += '#' + node.id;
  if (node.classes && node.classes.length > 0) dsl += '.' + node.classes.join('.');
  if (node.props && Object.keys(node.props).length > 0) {
    dsl += '{' + Object.entries(node.props).map(([k, v]) => `${k}=${v}`).join(',') + '}';
  }
  if (node.children && node.children.length > 0) {
    dsl += '|' + node.children.map(nodeToDSL).join('');
  }
  dsl += ']';
  return dsl;
}

function nodeToDSL(node) {
  if (node.type === 'text') return node.value;

  const tag = TAG_ALIASES[node.tag] || node.tag;
  let dsl = '[' + tag;
  if (node.id) dsl += '#' + node.id;
  if (node.classes && node.classes.length > 0) dsl += '.' + node.classes.join('.');
  if (node.props && Object.keys(node.props).length > 0) {
    dsl += '{' + Object.entries(node.props).map(([k, v]) => `${k}=${v}`).join(',') + '}';
  }
  if (node.children && node.children.length > 0) {
    dsl += '|' + node.children.map(nodeToDSL).join('');
  }
  dsl += ']';
  return dsl;
}

/**
 * Compress verbose JSX/HTML/Tailwind source into dense Aimata micro-DSL.
 *
 * @param {string} code - JSX or HTML source string
 * @returns {string} - Aimata micro-DSL string
 *
 * @example
 * compressToDSL('<div className="flex gap-4"><span>Hello</span></div>')
 * // → '[div.flex.gap-4|[span|Hello]]'
 */
export function compressToDSL(code) {
  if (typeof code !== 'string' || !code.trim()) {
    throw new TypeError('compressToDSL expects a non-empty string');
  }
  const ast = parse(code);
  if (ast.length === 0) return '';
  const content = ast.length === 1 ? nodeToStructuredDSL(ast[0]) : ast.map(nodeToStructuredDSL).join('\n');
  return content;
}

// ─── DSL Parsing Helpers ──────────────────────────────────────────────────────

/**
 * Parse a DSL token string into a structured object.
 * @param {string} dsl
 */
function parseDSLNode(dsl) {
  let inner = dsl.slice(1, -1);
  let childrenRaw = '';
  let depth = 0;
  let pipeIdx = -1;
  for (let i = 0; i < inner.length; i++) {
    if (inner[i] === '[') depth++;
    else if (inner[i] === ']') depth--;
    else if (inner[i] === '|' && depth === 0) { pipeIdx = i; break; }
  }
  if (pipeIdx !== -1) {
    childrenRaw = inner.slice(pipeIdx + 1);
    inner = inner.slice(0, pipeIdx);
  }

  let propsRaw = '';
  const propsMatch = inner.match(/\{([^}]*)\}$/);
  if (propsMatch) {
    propsRaw = propsMatch[1];
    inner = inner.slice(0, inner.lastIndexOf('{'));
  }

  const idMatch = inner.match(/#([^.]+)/);
  const id = idMatch ? idMatch[1] : null;
  if (idMatch) inner = inner.replace(/#[^.]+/, '');

  const dotParts = inner.split('.');
  const tag = (DSL_TAG_ALIASES[dotParts[0]] || dotParts[0]);
  const classes = dotParts.slice(1).filter(Boolean);

  const props = {};
  if (propsRaw) {
    splitProps(propsRaw).forEach(entry => {
      const eqIdx = entry.indexOf('=');
      if (eqIdx === -1) props[entry.trim()] = 'true';
      else { props[entry.slice(0, eqIdx).trim()] = entry.slice(eqIdx + 1).trim(); }
    });
  }

  return { tag, id, classes, props, childrenRaw };
}

/** Split comma-separated props respecting nested brackets */
function splitProps(str) {
  const parts = []; let depth = 0; let current = '';
  for (const ch of str) {
    if ('([{'.includes(ch)) depth++;
    else if (')]}'.includes(ch)) depth--;
    if (ch === ',' && depth === 0) { parts.push(current); current = ''; }
    else current += ch;
  }
  if (current) parts.push(current);
  return parts;
}

/** Split childrenRaw into top-level DSL nodes and text segments */
function splitChildren(childrenRaw) {
  const parts = []; let i = 0; let text = '';
  while (i < childrenRaw.length) {
    if (childrenRaw[i] === '[') {
      if (text) { parts.push({ type: 'text', value: text }); text = ''; }
      let depth = 0; const start = i;
      while (i < childrenRaw.length) {
        if (childrenRaw[i] === '[') depth++;
        else if (childrenRaw[i] === ']') { depth--; if (depth === 0) { i++; break; } }
        i++;
      }
      parts.push({ type: 'dsl', value: childrenRaw.slice(start, i) });
    } else { text += childrenRaw[i++]; }
  }
  if (text.trim()) parts.push({ type: 'text', value: text.trim() });
  return parts;
}

// ─── DSL → Source (Expansion) ─────────────────────────────────────────────────

/**
 * Render a single prop key=value pair for a given target.
 * @param {string} key
 * @param {string} value
 * @param {string} target
 * @returns {string}
 */
function renderProp(key, value, target) {
  const isEvent = /^on[A-Z]/.test(key);

  if (isEvent) {
    return EVENT_PATTERNS[target].wrapper(key, value);
  }

  if (value === 'true') return key;

  const renderedValue = stripSurroundingQuotes(value);
  return `${key}="${renderedValue}"`;
}

/**
 * Recursively expand a DSL node into framework-specific source.
 * @param {string} dsl
 * @param {string} target
 * @param {number} indent
 * @returns {string}
 */
function expandNode(dsl, target, indent = 0) {
  const pad = '  '.repeat(indent);
  const childPad = '  '.repeat(indent + 1);
  const { tag, id, classes, props, childrenRaw } = parseDSLNode(dsl);

  const actualTag = DSL_TAG_ALIASES[tag] || tag;
  // For HTML-family targets, PascalCase components become div
  const isComponent = /^[A-Z]/.test(actualTag);
  const renderTag = (target === 'html' && isComponent) ? 'div' : actualTag;

  // Build opening tag
  let out = `${pad}<${renderTag}`;
  if (id) out += ` id="${id}"`;
  if (classes.length > 0) out += ` ${CLASS_ATTR[target]}="${classes.join(' ')}"`;
  for (const [k, v] of Object.entries(props)) {
    out += ' ' + renderProp(k, v, target);
  }

  // Self-closing void elements
  if (VOID_ELEMENTS.has(renderTag)) {
    out += ' />';
    return out;
  }

  // No children
  if (!childrenRaw) {
    out += USES_JSX_EXPR.has(target) ? ' />' : `></${renderTag}>`;
    return out;
  }

  out += '>';
  const children = splitChildren(childrenRaw);
  const hasComplexChildren = children.some(c => c.type === 'dsl');

  if (!hasComplexChildren) {
    out += children.map(c => c.value).join('') + `</${renderTag}>`;
  } else {
    out += '\n';
    for (const child of children) {
      if (child.type === 'dsl') out += expandNode(child.value, target, indent + 1) + '\n';
      else if (child.value.trim()) out += childPad + child.value.trim() + '\n';
    }
    out += pad + `</${renderTag}>`;
  }

  return out;
}

/**
 * Split a multi-root DSL string into individual top-level nodes.
 * @param {string} dsl
 * @returns {string[]}
 */
function splitTopLevelNodes(dsl) {
  const nodes = dsl.trim().split('\n')
    .map(l => l.trim()).filter(l => l.startsWith('['));
  return nodes.length > 0 ? nodes : [dsl];
}

/**
 * Expand a micro-DSL string back into production-ready source code.
 *
 * @param {string} dsl - Aimata micro-DSL string
 * @param {'react'|'html'|'vue'|'angular'|'svelte'|'solid'} [targetFramework='react']
 * @returns {string}
 *
 * @example
 * expandFromDSL('[button.px-4.bg-blue-500{onClick=handleClick}|Submit]', 'vue')
 * // → '<button class="px-4 bg-blue-500" @click="handleClick">Submit</button>'
 */
export function expandFromDSL(dsl, targetFramework = 'react') {
  if (typeof dsl !== 'string' || !dsl.trim()) {
    throw new TypeError('expandFromDSL expects a non-empty DSL string');
  }
  if (!SUPPORTED_TARGETS.has(targetFramework)) {
    throw new TypeError(
      `targetFramework must be one of: ${[...SUPPORTED_TARGETS].join(', ')}. Got '${targetFramework}'`
    );
  }

  const trimmed = dsl.trim();
  if (/^(form|label|input|select|textarea|tbl|state|on)\[/.test(trimmed)) {
    const structural = expandStructuralNode(trimmed, targetFramework, 0);
    if (structural) return structural;
  }

  const nodes = splitTopLevelNodes(trimmed);
  return nodes.map(n => expandNode(n, targetFramework, 0)).join('\n');
}

// ─── compile() — AST → string ────────────────────────────────────────────────

/**
 * Compile an AST produced by `parse()` into a target output format.
 *
 * @param {import('./parser.js').ASTNode[]} ast
 * @param {{ target: 'dsl'|'react'|'html'|'vue'|'angular'|'svelte'|'solid' }} options
 * @returns {string}
 */
export function compile(ast, options = { target: 'dsl' }) {
  const { target = 'dsl' } = options;
  if (target === 'dsl') return ast.map(nodeToDSL).join('\n');
  const dsl = ast.map(nodeToDSL).join('\n');
  return expandFromDSL(dsl, target);
}

/** Expose supported targets for tooling */
export { SUPPORTED_TARGETS };
