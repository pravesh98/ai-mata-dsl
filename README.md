# Aimata DSL 🧬

> **Token-optimized micro-DSL for AI-assisted UI generation** — compress verbose JSX/HTML/Tailwind into a dense, lossless intermediate representation and expand it back on demand.

---

## Architecture

```
aimata-dsl/
├── packages/
│   ├── core/          # @aimata-dsl/core  — AST compiler & token compression engine
│   ├── ui/            # @aimata-dsl/ui    — Token-optimized component library primitives
│   └── mcp-server/    # @aimata-dsl/mcp-server — MCP integration server
└── apps/
    └── studio/        # aimata-studio — Interactive web playground & benchmark studio
```

## Micro-DSL Syntax

The Aimata micro-DSL encodes component trees in a compact bracket notation:

```
[tag#id.class1.class2{prop=val,data-x=y}|child text or [nested]]
```

| Part | Meaning |
|------|---------|
| `tag` | HTML tag or component name |
| `#id` | Element ID (optional) |
| `.cls` | CSS/Tailwind class(es), dot-separated |
| `{k=v}` | Props/attributes as `key=value` pairs |
| `\|...` | Children — text or nested DSL nodes |

**Example:** A Tailwind button:

```jsx
// Verbose JSX (82 tokens)
<button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" onClick={handleClick}>
  Submit
</button>
```

Compresses to Aimata DSL (18 tokens):
```
[button.px-4.py-2.bg-blue-500.text-white.rounded.hover:bg-blue-600{onClick=handleClick}|Submit]
```

---

## Packages

### `@aimata-dsl/core`
The compiler engine. Provides:
- `compressToDSL(code)` — Converts JSX/HTML → micro-DSL
- `expandFromDSL(dsl, targetFramework)` — Expands micro-DSL → JSX or HTML
- `parse(code)` — Returns an AST for a JSX/HTML string
- `compile(ast, options)` — Compiles an AST to a target output

### `@aimata-dsl/ui`
Primitive React components built DSL-first. All components expose their DSL signature via `Component.dsl` for introspection and tooling.

### `@aimata-dsl/mcp-server`
An MCP-compatible HTTP server that exposes the compiler as a tool callable by AI assistants (Claude, Gemini, GPT-4, etc.).

**Endpoints:**
- `POST /compress` — `{ code: string }` → `{ dsl: string }`
- `POST /expand` — `{ dsl: string, target: "react"|"html" }` → `{ code: string }`
- `GET /health`

### `apps/studio`
A browser-based split-pane playground where you can paste any JSX/HTML and see the compressed DSL in real time, and vice versa.

---

## Getting Started

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9 (or pnpm)

### Install
```bash
npm install
```

### Run Tests
```bash
npm test
# or just the core package
cd packages/core && node src/test.js
```

### Start the MCP Server
```bash
npm run dev:server
```

### Open the Studio
```bash
npm run dev:studio
```

---

## License

MIT © Pravesh Shukla
