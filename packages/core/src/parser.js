/**
 * @aimata-dsl/core — src/parser.js
 *
 * Tokenizer and AST parser for JSX/HTML source code.
 * Produces a lightweight AST (plain JS objects) that the compiler consumes.
 *
 * AST Node shape:
 * {
 *   type: 'element' | 'text' | 'component',
 *   tag: string,             // e.g. 'div', 'Button'
 *   id: string | null,
 *   classes: string[],       // className / class values split by space
 *   props: Record<string, string>,  // all other props (excluding className/id)
 *   children: ASTNode[],
 *   raw: string,             // original source slice (for debugging)
 * }
 */

// ─── Tokenizer ───────────────────────────────────────────────────────────────

const TOKEN_TYPES = {
  TAG_OPEN_START: 'TAG_OPEN_START',   // <tagName
  TAG_OPEN_END: 'TAG_OPEN_END',       // > or />
  TAG_CLOSE: 'TAG_CLOSE',             // </tagName>
  ATTR: 'ATTR',                       // key="value" or key={expr}
  TEXT: 'TEXT',                       // raw text between tags
  EOF: 'EOF',
};

/**
 * Tokenize a JSX/HTML string into a flat array of tokens.
 * This is a simplified tokenizer sufficient for well-formed JSX.
 *
 * @param {string} source
 * @returns {Array<{type: string, value: string, raw: string}>}
 */
export function tokenize(source) {
  const tokens = [];
  let i = 0;

  while (i < source.length) {
    // Skip leading whitespace between tags
    if (i < source.length && source[i] === '<') {
      if (source[i + 1] === '/') {
        // Closing tag
        const end = source.indexOf('>', i);
        if (end === -1) throw new SyntaxError(`Unclosed closing tag at pos ${i}`);
        const raw = source.slice(i, end + 1);
        const tagName = raw.slice(2, raw.length - 1).trim();
        tokens.push({ type: TOKEN_TYPES.TAG_CLOSE, value: tagName, raw });
        i = end + 1;
      } else if (source[i + 1] === '!') {
        // Comment or DOCTYPE — skip
        const end = source.indexOf('>', i);
        i = end === -1 ? source.length : end + 1;
      } else {
        // Opening tag — extract tag name + attributes
        const tagStart = i;
        i++; // skip <
        let tagName = '';
        while (i < source.length && !/[\s\/>]/.test(source[i])) {
          tagName += source[i++];
        }

        const attrs = [];
        // Parse attributes until we hit > or />
        while (i < source.length && source[i] !== '>' && !(source[i] === '/' && source[i + 1] === '>')) {
          // Skip whitespace
          while (i < source.length && /\s/.test(source[i])) i++;
          if (source[i] === '>' || (source[i] === '/' && source[i + 1] === '>')) break;

          // Read attr name
          let attrName = '';
          while (i < source.length && !/[\s=\/>]/.test(source[i])) {
            attrName += source[i++];
          }
          if (!attrName) { i++; continue; }

          // Skip whitespace
          while (i < source.length && /\s/.test(source[i])) i++;

          if (source[i] === '=') {
            i++; // skip =
            while (i < source.length && /\s/.test(source[i])) i++;

            let attrValue = '';
            if (source[i] === '"' || source[i] === "'") {
              const quote = source[i++];
              while (i < source.length && source[i] !== quote) attrValue += source[i++];
              i++; // closing quote
            } else if (source[i] === '{') {
              // JSX expression — find matching closing brace
              let depth = 0;
              while (i < source.length) {
                if (source[i] === '{') depth++;
                else if (source[i] === '}') { depth--; if (depth === 0) { i++; break; } }
                attrValue += source[i++];
              }
              attrValue = attrValue.slice(1); // strip leading {
            } else {
              while (i < source.length && !/[\s\/>]/.test(source[i])) attrValue += source[i++];
            }
            attrs.push({ type: TOKEN_TYPES.ATTR, name: attrName, value: attrValue });
          } else {
            // Boolean attribute
            attrs.push({ type: TOKEN_TYPES.ATTR, name: attrName, value: 'true' });
          }
        }

        let selfClosing = false;
        if (source[i] === '/' && source[i + 1] === '>') {
          selfClosing = true;
          i += 2;
        } else if (source[i] === '>') {
          i++;
        }

        const raw = source.slice(tagStart, i);
        tokens.push({ type: TOKEN_TYPES.TAG_OPEN_START, value: tagName, attrs, raw });
        tokens.push({ type: TOKEN_TYPES.TAG_OPEN_END, value: selfClosing ? '/>' : '>', raw: selfClosing ? '/>' : '>' });
      }
    } else {
      // Text node — collect until next tag
      let text = '';
      while (i < source.length && source[i] !== '<') text += source[i++];
      const trimmed = text.trim();
      if (trimmed) tokens.push({ type: TOKEN_TYPES.TEXT, value: trimmed, raw: text });
    }
  }

  tokens.push({ type: TOKEN_TYPES.EOF, value: '', raw: '' });
  return tokens;
}

// ─── AST Builder ─────────────────────────────────────────────────────────────

/**
 * Build an AST from a token array.
 * Returns an array of top-level AST nodes (usually one root element).
 *
 * @param {ReturnType<typeof tokenize>} tokens
 * @returns {ASTNode[]}
 */
function buildAST(tokens) {
  let cursor = 0;

  function peek() { return tokens[cursor]; }
  function consume() { return tokens[cursor++]; }

  function parseNode() {
    const token = peek();

    if (token.type === TOKEN_TYPES.TEXT) {
      consume();
      return { type: 'text', value: token.value };
    }

    if (token.type === TOKEN_TYPES.TAG_OPEN_START) {
      consume(); // TAG_OPEN_START
      const openEnd = consume(); // TAG_OPEN_END
      const selfClosing = openEnd.value === '/>';

      const tagName = token.value;
      const isComponent = /^[A-Z]/.test(tagName);

      // Extract id, classes, and other props from attrs
      let id = null;
      const classes = [];
      const props = {};

      for (const attr of (token.attrs || [])) {
        if (attr.name === 'id') {
          id = attr.value;
        } else if (attr.name === 'className' || attr.name === 'class') {
          classes.push(...attr.value.split(/\s+/).filter(Boolean));
        } else {
          props[attr.name] = attr.value;
        }
      }

      const children = [];
      if (!selfClosing) {
        // Parse children until matching close tag
        while (
          peek().type !== TOKEN_TYPES.EOF &&
          !(peek().type === TOKEN_TYPES.TAG_CLOSE && peek().value === tagName)
        ) {
          const child = parseNode();
          if (child) children.push(child);
        }
        if (peek().type === TOKEN_TYPES.TAG_CLOSE) consume(); // consume </tagName>
      }

      return {
        type: isComponent ? 'component' : 'element',
        tag: tagName,
        id,
        classes,
        props,
        children,
        raw: token.raw,
      };
    }

    // Unexpected token — skip
    consume();
    return null;
  }

  const nodes = [];
  while (peek().type !== TOKEN_TYPES.EOF) {
    const node = parseNode();
    if (node) nodes.push(node);
  }
  return nodes;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Parse a JSX/HTML string into an AST.
 *
 * @param {string} source - JSX or HTML source code
 * @returns {ASTNode[]} - Array of top-level AST nodes
 */
export function parse(source) {
  const trimmed = source.trim();
  const tokens = tokenize(trimmed);
  return buildAST(tokens);
}

export { TOKEN_TYPES };
