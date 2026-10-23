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
const SUPPORTED_TARGETS = new Set(['react', 'html', 'vue', 'angular', 'svelte', 'solid']);

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
function nodeToDSL(node) {
  if (node.type === 'text') return node.value;

  let dsl = '[' + node.tag;
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
  return ast.length === 1 ? nodeToDSL(ast[0]) : ast.map(nodeToDSL).join('\n');
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
  const tag = dotParts[0];
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
    // Pass the full camelCase key — each target's wrapper handles stripping
    return EVENT_PATTERNS[target].wrapper(key, value);
  }

  if (value === 'true') return key; // boolean attribute

  // Framework-specific binding for non-event props
  if (target === 'vue' && key !== 'class' && key !== 'id') {
    // Use :prop binding only for obvious dynamic values (identifiers)
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(value)) return `:${key}="${value}"`;
    return `${key}="${value}"`;
  }
  if (target === 'angular' && key !== 'class' && key !== 'id') {
    if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(value)) return `[${key}]="${value}"`;
    return `${key}="${value}"`;
  }
  if (USES_JSX_EXPR.has(target) && /^[a-zA-Z_$][a-zA-Z0-9_$.]*$/.test(value) && !/"'/.test(value)) {
    return `${key}={${value}}`;
  }
  return `${key}="${value}"`;
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

  // For HTML-family targets, PascalCase components become div
  const isComponent = /^[A-Z]/.test(tag);
  const renderTag = (target === 'html' && isComponent) ? 'div' : tag;

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
  const nodes = splitTopLevelNodes(dsl.trim());
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
