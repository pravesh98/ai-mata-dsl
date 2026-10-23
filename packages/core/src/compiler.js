/**
 * @aimata-dsl/core — src/compiler.js
 *
 * Bi-directional compiler engine.
 *
 * Micro-DSL format:
 *   [tag#id.cls1.cls2{prop1=val1,prop2=val2}|children]
 *
 * Rules:
 *  - tag      → HTML tag or PascalCase component name
 *  - #id      → element id (optional)
 *  - .cls     → dot-separated class list (optional)
 *  - {k=v}    → comma-separated prop map (optional)
 *  - |...     → children (text or nested [DSL] nodes) (optional)
 *
 * Example:
 *   Input:  <button className="px-4 py-2 bg-blue-500" onClick={handleClick}>Submit</button>
 *   Output: [button.px-4.py-2.bg-blue-500{onClick=handleClick}|Submit]
 */

import { parse } from './parser.js';

// ─── AST → DSL (Compression) ──────────────────────────────────────────────────

/**
 * Serialize a single AST node into Aimata micro-DSL notation.
 *
 * @param {import('./parser.js').ASTNode} node
 * @returns {string}
 */
function nodeTosDSL(node) {
  if (node.type === 'text') {
    return node.value;
  }

  let dsl = '[' + node.tag;

  // #id
  if (node.id) dsl += '#' + node.id;

  // .class1.class2
  if (node.classes && node.classes.length > 0) {
    dsl += '.' + node.classes.join('.');
  }

  // {prop1=val1,prop2=val2}
  if (node.props && Object.keys(node.props).length > 0) {
    const propStr = Object.entries(node.props)
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    dsl += '{' + propStr + '}';
  }

  // |children
  if (node.children && node.children.length > 0) {
    const childrenDSL = node.children.map(nodeTosDSL).join('');
    dsl += '|' + childrenDSL;
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
  // If multiple root nodes, wrap in a fragment-like notation
  if (ast.length === 1) return nodeTosDSL(ast[0]);
  return ast.map(nodeTosDSL).join('\n');
}

// ─── DSL → Source (Expansion) ─────────────────────────────────────────────────

/**
 * Parse a single DSL token string into a structured object.
 * Handles nested brackets by tracking depth.
 *
 * @param {string} dsl - A complete DSL token starting with '['
 * @returns {{ tag, id, classes, props, childrenRaw }}
 */
function parseDSLNode(dsl) {
  // Strip outer [ ]
  let inner = dsl.slice(1, -1);

  // Extract children (after first unescaped '|' at depth 0)
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

  // Extract props block {k=v,...}
  let propsRaw = '';
  const propsMatch = inner.match(/\{([^}]*)\}$/);
  if (propsMatch) {
    propsRaw = propsMatch[1];
    inner = inner.slice(0, inner.lastIndexOf('{'));
  }

  // Now inner is: tag#id.cls1.cls2
  const idMatch = inner.match(/#([^.]+)/);
  const id = idMatch ? idMatch[1] : null;
  if (idMatch) inner = inner.replace(/#[^.]+/, '');

  const dotParts = inner.split('.');
  const tag = dotParts[0];
  const classes = dotParts.slice(1).filter(Boolean);

  // Parse props
  const props = {};
  if (propsRaw) {
    // Split on commas that are NOT inside nested brackets
    const entries = splitProps(propsRaw);
    for (const entry of entries) {
      const eqIdx = entry.indexOf('=');
      if (eqIdx === -1) {
        props[entry.trim()] = 'true';
      } else {
        const k = entry.slice(0, eqIdx).trim();
        const v = entry.slice(eqIdx + 1).trim();
        props[k] = v;
      }
    }
  }

  return { tag, id, classes, props, childrenRaw };
}

/**
 * Split a props string on commas, respecting nested brackets/parens.
 * @param {string} str
 * @returns {string[]}
 */
function splitProps(str) {
  const parts = [];
  let depth = 0;
  let current = '';
  for (const ch of str) {
    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current) parts.push(current);
  return parts;
}

/**
 * Split a children string into top-level DSL nodes and text segments.
 * Handles nested brackets at arbitrary depth.
 *
 * @param {string} childrenRaw
 * @returns {Array<{type: 'dsl'|'text', value: string}>}
 */
function splitChildren(childrenRaw) {
  const parts = [];
  let i = 0;
  let text = '';

  while (i < childrenRaw.length) {
    if (childrenRaw[i] === '[') {
      if (text) { parts.push({ type: 'text', value: text }); text = ''; }
      // Find matching ]
      let depth = 0;
      let start = i;
      while (i < childrenRaw.length) {
        if (childrenRaw[i] === '[') depth++;
        else if (childrenRaw[i] === ']') { depth--; if (depth === 0) { i++; break; } }
        i++;
      }
      parts.push({ type: 'dsl', value: childrenRaw.slice(start, i) });
    } else {
      text += childrenRaw[i++];
    }
  }
  if (text.trim()) parts.push({ type: 'text', value: text.trim() });
  return parts;
}

/**
 * Recursively expand a DSL node into JSX source.
 *
 * @param {string} dsl - Single DSL token
 * @param {number} indent - Current indentation level
 * @returns {string}
 */
function dslNodeToJSX(dsl, indent = 0) {
  const pad = '  '.repeat(indent);
  const childPad = '  '.repeat(indent + 1);

  const { tag, id, classes, props, childrenRaw } = parseDSLNode(dsl);

  // Build JSX opening tag
  let jsx = `${pad}<${tag}`;

  if (id) jsx += ` id="${id}"`;
  if (classes.length > 0) jsx += ` className="${classes.join(' ')}"`;

  for (const [k, v] of Object.entries(props)) {
    if (v === 'true') {
      jsx += ` ${k}`;
    } else if (/^[a-zA-Z_$]/.test(v) && !/["']/.test(v)) {
      // Looks like a JS identifier/expression — use {}
      jsx += ` ${k}={${v}}`;
    } else {
      jsx += ` ${k}="${v}"`;
    }
  }

  if (!childrenRaw) {
    jsx += ' />';
    return jsx;
  }

  jsx += '>';

  const children = splitChildren(childrenRaw);
  const hasComplexChildren = children.some(c => c.type === 'dsl');

  if (!hasComplexChildren) {
    // Inline text children
    const text = children.map(c => c.value).join('');
    jsx += text + `</${tag}>`;
  } else {
    jsx += '\n';
    for (const child of children) {
      if (child.type === 'dsl') {
        jsx += dslNodeToJSX(child.value, indent + 1) + '\n';
      } else if (child.value.trim()) {
        jsx += childPad + child.value.trim() + '\n';
      }
    }
    jsx += pad + `</${tag}>`;
  }

  return jsx;
}

/**
 * Recursively expand a DSL node into plain HTML.
 *
 * @param {string} dsl - Single DSL token
 * @param {number} indent - Current indentation level
 * @returns {string}
 */
function dslNodeToHTML(dsl, indent = 0) {
  const pad = '  '.repeat(indent);
  const childPad = '  '.repeat(indent + 1);

  const { tag, id, classes, props, childrenRaw } = parseDSLNode(dsl);

  // For HTML, PascalCase tags become lowercase (component → div fallback)
  const htmlTag = /^[A-Z]/.test(tag) ? 'div' : tag;

  let html = `${pad}<${htmlTag}`;

  if (id) html += ` id="${id}"`;
  if (classes.length > 0) html += ` class="${classes.join(' ')}"`;

  // In HTML, event handlers become data attributes for portability
  for (const [k, v] of Object.entries(props)) {
    if (k.startsWith('on')) {
      html += ` data-${k.toLowerCase()}="${v}"`;
    } else if (v === 'true') {
      html += ` ${k}`;
    } else {
      html += ` ${k}="${v}"`;
    }
  }

  // Void elements
  const voidElements = new Set(['area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr']);
  if (voidElements.has(htmlTag)) {
    html += ' />';
    return html;
  }

  if (!childrenRaw) {
    html += `></${htmlTag}>`;
    return html;
  }

  html += '>';

  const children = splitChildren(childrenRaw);
  const hasComplexChildren = children.some(c => c.type === 'dsl');

  if (!hasComplexChildren) {
    const text = children.map(c => c.value).join('');
    html += text + `</${htmlTag}>`;
  } else {
    html += '\n';
    for (const child of children) {
      if (child.type === 'dsl') {
        html += dslNodeToHTML(child.value, indent + 1) + '\n';
      } else if (child.value.trim()) {
        html += childPad + child.value.trim() + '\n';
      }
    }
    html += pad + `</${htmlTag}>`;
  }

  return html;
}

/**
 * Expand a micro-DSL string back into production-ready JSX or HTML.
 *
 * @param {string} dsl - Aimata micro-DSL string
 * @param {'react' | 'html'} targetFramework - Output format
 * @returns {string} - Expanded source code
 *
 * @example
 * expandFromDSL('[button.px-4.bg-blue-500{onClick=handleClick}|Submit]', 'react')
 * // → '<button className="px-4 bg-blue-500" onClick={handleClick}>Submit</button>'
 */
export function expandFromDSL(dsl, targetFramework = 'react') {
  if (typeof dsl !== 'string' || !dsl.trim()) {
    throw new TypeError('expandFromDSL expects a non-empty DSL string');
  }
  if (targetFramework !== 'react' && targetFramework !== 'html') {
    throw new TypeError(`targetFramework must be 'react' or 'html', got '${targetFramework}'`);
  }

  // Handle multiple top-level nodes (newline-separated)
  const topLevelNodes = splitTopLevelNodes(dsl.trim());
  const expand = targetFramework === 'react' ? dslNodeToJSX : dslNodeToHTML;

  return topLevelNodes.map(n => expand(n, 0)).join('\n');
}

/**
 * Split a DSL string into top-level nodes (handles multi-root DSL).
 * @param {string} dsl
 * @returns {string[]}
 */
function splitTopLevelNodes(dsl) {
  const nodes = [];
  const lines = dsl.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('[')) nodes.push(trimmed);
  }
  return nodes.length > 0 ? nodes : [dsl];
}

// ─── compile() — AST → string ────────────────────────────────────────────────

/**
 * Compile an AST produced by `parse()` into a target output format.
 *
 * @param {import('./parser.js').ASTNode[]} ast
 * @param {{ target: 'dsl' | 'react' | 'html' }} options
 * @returns {string}
 */
export function compile(ast, options = { target: 'dsl' }) {
  const { target = 'dsl' } = options;

  if (target === 'dsl') {
    return ast.map(nodeTosDSL).join('\n');
  }

  // Compile AST → DSL → target expansion
  const dsl = ast.map(nodeTosDSL).join('\n');
  return expandFromDSL(dsl, target === 'react' ? 'react' : 'html');
}
