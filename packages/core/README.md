# @aimata-dsl/core

> **Token-optimized micro-DSL compiler** — compress verbose JSX/HTML/Tailwind into a dense, lossless intermediate representation and expand it back on demand.

[![npm version](https://img.shields.io/npm/v/@aimata-dsl/core.svg)](https://www.npmjs.com/package/@aimata-dsl/core)
[![npm downloads](https://img.shields.io/npm/dm/@aimata-dsl/core.svg)](https://www.npmjs.com/package/@aimata-dsl/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

---

## Install

```bash
npm install @aimata-dsl/core
```

---

## Quick Start

```js
import { compressToDSL, expandFromDSL } from '@aimata-dsl/core';

// Compress JSX → micro-DSL
const dsl = compressToDSL(`
  <button className="px-4 py-2 bg-blue-500 text-white rounded" onClick={handleClick}>
    Submit
  </button>
`);
// → [button.px-4.py-2.bg-blue-500.text-white.rounded{onClick=handleClick}|Submit]

// Expand back to React JSX
const jsx = expandFromDSL(dsl, 'react');
// → <button className="px-4 py-2 bg-blue-500 text-white rounded" onClick={handleClick}>Submit</button>

// Expand to plain HTML
const html = expandFromDSL(dsl, 'html');
// → <button class="px-4 py-2 bg-blue-500 text-white rounded" data-onclick="handleClick">Submit</button>
```

---

## Micro-DSL Syntax

```
[tag#id.class1.class2{prop1=val1,prop2=val2}|children]
```

| Part | Meaning | Example |
|------|---------|---------|
| `tag` | HTML tag or PascalCase component | `div`, `Button` |
| `#id` | Element ID | `#hero-card` |
| `.cls` | CSS/Tailwind classes, dot-separated | `.flex.gap-4.text-white` |
| `{k=v}` | Props/attributes as key=value pairs | `{onClick=handleClick,type=submit}` |
| `\|...` | Children — text or nested `[DSL]` nodes | `\|Submit` or `\|[span\|text]` |

### Nested Example

```js
compressToDSL(`
  <div id="card" className="rounded-xl shadow-lg p-6">
    <h2 className="text-2xl font-bold">Title</h2>
    <p className="text-gray-600">Description</p>
  </div>
`);
// → [div#card.rounded-xl.shadow-lg.p-6|[h2.text-2xl.font-bold|Title][p.text-gray-600|Description]]
```

---

## API Reference

### `compressToDSL(code: string): string`

Converts a JSX or HTML string into Aimata micro-DSL notation.

**Parameters:**
- `code` — A JSX or HTML source string (must be non-empty)

**Returns:** A compact micro-DSL string.

**Throws:** `TypeError` if `code` is not a non-empty string; `SyntaxError` on malformed tags.

```js
import { compressToDSL } from '@aimata-dsl/core';

compressToDSL('<div className="flex">Hello</div>');
// → '[div.flex|Hello]'
```

---

### `expandFromDSL(dsl: string, targetFramework?: 'react' | 'html'): string`

Expands an Aimata micro-DSL string back into production-ready source code.

**Parameters:**
- `dsl` — An Aimata micro-DSL string
- `targetFramework` — Output format: `'react'` (default) or `'html'`

**Returns:** Expanded source code string.

**Differences by target:**

| Feature | `'react'` | `'html'` |
|---------|-----------|----------|
| Class attr | `className="..."` | `class="..."` |
| Event handlers | `onClick={handler}` | `data-onclick="handler"` |
| Components (`Button`) | Kept as-is | Rendered as `<div>` |

```js
import { expandFromDSL } from '@aimata-dsl/core';

expandFromDSL('[nav.flex.px-8|[a.font-bold{href=/}|Brand]]', 'react');
// → <nav className="flex px-8"><a className="font-bold" href="/">Brand</a></nav>

expandFromDSL('[nav.flex.px-8|[a.font-bold{href=/}|Brand]]', 'html');
// → <nav class="flex px-8"><a class="font-bold" href="/">Brand</a></nav>
```

---

### `parse(source: string): ASTNode[]`

Parse a JSX/HTML string into an array of AST nodes.

```js
import { parse } from '@aimata-dsl/core';

const ast = parse('<div className="flex"><span>Hello</span></div>');
// → [{ type: 'element', tag: 'div', classes: ['flex'], children: [...], ... }]
```

**ASTNode shape:**
```ts
{
  type: 'element' | 'component' | 'text',
  tag: string,
  id: string | null,
  classes: string[],
  props: Record<string, string>,
  children: ASTNode[],
  raw: string,
}
```

---

### `compile(ast: ASTNode[], options?: { target: 'dsl' | 'react' | 'html' }): string`

Compile an AST (from `parse()`) directly to a target format.

```js
import { parse, compile } from '@aimata-dsl/core';

const ast = parse('<button className="btn">Click</button>');

compile(ast, { target: 'dsl' });
// → '[button.btn|Click]'

compile(ast, { target: 'react' });
// → '<button className="btn">Click</button>'

compile(ast, { target: 'html' });
// → '<button class="btn">Click</button>'
```

---

## Use Cases

### 1. AI Prompt Compression
Send compressed DSL to your LLM instead of full JSX — dramatically reduces token usage:

```js
import { compressToDSL, expandFromDSL } from '@aimata-dsl/core';

// Before sending to AI — compress
const prompt = `Modify this component: ${compressToDSL(myComponent)}`;

// After AI responds with DSL — expand back
const updatedCode = expandFromDSL(aiResponse, 'react');
```

### 2. Design Token Extraction
```js
import { parse } from '@aimata-dsl/core';

const ast = parse(myComponent);
const allClasses = ast[0].classes; // ['flex', 'gap-4', 'bg-blue-500', ...]
```

### 3. Cross-Framework Output
```js
const dsl = compressToDSL(reactComponent);
const html = expandFromDSL(dsl, 'html'); // Pure HTML — no React needed
```

---

## Zero Dependencies

`@aimata-dsl/core` uses **zero external dependencies**. The tokenizer, parser, and compiler are all hand-rolled and work in:
- ✅ Node.js ≥ 18 (ESM)
- ✅ Modern browsers (ESM via `<script type="module">`)
- ✅ Deno
- ✅ Bun

---

## License

MIT © [Pravesh Shukla](https://github.com/pravesh98)
