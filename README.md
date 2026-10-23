# Aimata DSL 🧬

> Project-wide micro-DSL for AI-assisted frontend work: compress verbose JSX, HTML, Tailwind, and component-heavy UI structures into a compact, semantic shorthand, then expand them back into production-ready code.

Aimata DSL is more than a compiler. It is a full compression workflow for UI systems: buttons, cards, forms, tables, data schemas, component state, and repeated frontend patterns that are expensive to send through AI prompts and memory. Instead of pushing large JSX blocks around, you compress them into a compact DSL, then expand back to React, HTML, Vue, Angular, Svelte, or Solid on demand.

- Reduce token waste across AI-driven UI workflows
- Preserve AST structure and round-trip determinism
- Work with JSX, HTML, Tailwind, and component-heavy UI graphs
- Support forms, tables, schemas, and stateful UI logic
- Integrate with Cursor, Claude Code, MCP clients, Vite, and a guided init flow

Live site: https://pravesh98.github.io/ai-mata-dsl/

Additional project pages:
- Landing page: https://pravesh98.github.io/ai-mata-dsl/
- Guide: https://pravesh98.github.io/ai-mata-dsl/apps/landing/guide.html
- Studio: https://pravesh98.github.io/ai-mata-dsl/apps/studio/index.html

---

## Install

```bash
npm install @aimata-dsl/core
```

---

## The core value: project-level setup

This is the primary value of Aimata DSL: set it up once at the repository level and let AI coding assistants work in the compact format by default.

```bash
npx aimata-dsl init
```

This creates the repo instructions for tools like Cursor and Claude, adds the Vite integration, and makes the project default to Aimata shorthand without needing manual per-file configuration. That is the real advantage over a one-off per-component usage pattern.

This is the recommended setup for product teams and AI-driven frontend workflows.

### How the project-level flow works

The repo-level setup does not lock the project into a single compressed format forever. Instead, it tells the AI to prefer Aimata shorthand while still understanding and producing normal React/HTML/TS code when needed.

```text
1. run: npx aimata-dsl init
2. repo gets .cursorrules + CLAUDE.md guidance
3. your AI agent prefers Aimata shorthand in this project
4. UI/schema code is generated in compact DSL form for context efficiency
5. final output expands back to regular JSX / HTML / TS for the app
```

Example:

```text
Compressed working form:
form[space-y-4] { label[text-sm.font-bold] "Email", input[type="text", class="border p-2 rounded"] }

Expanded final JSX:
<form className="space-y-4">
  <label className="text-sm font-bold">Email</label>
  <input type="text" className="border p-2 rounded" />
</form>
```

This means the AI works in a smaller, more efficient shorthand when reading or generating UI structure, but the actual app code remains normal framework code.

---

## Quick start

```js
import { compressToDSL, expandFromDSL } from '@aimata-dsl/core';

const dsl = compressToDSL(`
  <button className="px-4 py-2 bg-blue-500 text-white rounded" onClick={handleClick}>
    Submit
  </button>
`);

console.log(dsl);
// [button.px-4.py-2.bg-blue-500.text-white.rounded{onClick=handleClick}|Submit]

const react = expandFromDSL(dsl, 'react');
console.log(react);
// <button className="px-4 py-2 bg-blue-500 text-white rounded" onClick={handleClick}>Submit</button>
```

---

## Why it exists

Modern AI coding tools are expensive because they spend tokens on repetitive UI syntax. Aimata DSL gives you a lossless, compact representation for UI structure:

```text
[tag#id.class1.class2{prop=value,other=value}|children]
```

That means:
- tags are compact
- classes are dot-separated
- props are encoded as key=value pairs
- nested structure stays explicit
- expansion is deterministic and reversible

### Why this is different from minified JS

Normal JavaScript minification is about reducing bundle size for runtime delivery in production. It removes whitespace, shortens variable names, and optimizes code for browsers or bundlers.

Aimata DSL is different: it is a semantic compression layer for UI structure, designed for AI workflows and human-to-AI exchange, not for shipping final JavaScript to the browser.

In practice:
- minified JS makes code smaller at runtime
- Aimata DSL makes UI definitions smaller in prompts, memory, and model context
- minification is lossy in a developer sense and aimed at performance
- Aimata DSL is structured, reversible, and designed to expand back into readable source code

This means Aimata DSL is useful for:
- AI agents and model context compression
- UI generation pipelines
- prompt/token optimization
- component-heavy UI workflows
- preserving structure while reducing payload size

---

## Micro-DSL syntax

```text
[tag#id.class1.class2{prop=value,other=value}|child text or [nested]]
```

| Part | Meaning | Example |
| --- | --- | --- |
| `tag` | HTML tag or component name | `button`, `div`, `Card` |
| `#id` | Element ID | `#hero-card` |
| `.cls` | Tailwind or CSS classes | `.px-4.py-2.bg-blue-500` |
| `{k=v}` | Props / attributes | `{onClick=handleClick,type=submit}` |
| `|...` | Children content | `|Submit` or `|[span.text-sm|Hello]` |

Example:

```text
[button.px-4.py-2.bg-blue-500.text-white.rounded.hover:bg-blue-600{onClick=handleClick,type=submit}|Submit]
```

This compresses a verbose JSX button into a dense, machine-readable shorthand that is easy to pass to models and easy to re-expand when needed.

---

## Packages

### Core compiler
Package: `@aimata-dsl/core`

The main engine for parsing, compressing, and expanding UI syntax.

Included APIs:
- `compressToDSL(code)`
- `expandFromDSL(dsl, target)`
- `parse(source)`
- `compile(ast, options)`

See [packages/core](packages/core) and [packages/core/README.md](packages/core/README.md).

### UI primitives
Package: `@aimata-dsl/ui`

DSL-first metadata and utility primitives for React component usage and token-friendly component contracts.

See [packages/ui](packages/ui).

### MCP server
Package: `@aimata-dsl/mcp-server`

An MCP-compatible HTTP server that exposes compression and expansion as AI tool endpoints for Claude, Cursor, and other AI workflows.

See [packages/mcp-server](packages/mcp-server).

### Vite plugin
Package: `@aimata-dsl/vite-plugin`

A Vite transform hook that auto-expands Aimata DSL during local development or build workflows.

See [packages/vite-plugin](packages/vite-plugin).

### Studio
App: [apps/studio](apps/studio)

A browser-based playground for compressing and expanding JSX/HTML with a split-pane interface.

### Landing + guide
- [apps/landing](apps/landing)
- [apps/landing/guide.html](apps/landing/guide.html)

The landing page explains the project and the guide walks through the syntax and usage flow.

---

## Developer workflow

### Install the repo

```bash
npm install
```

### Run the core tests

```bash
cd packages/core && node src/test.js
```

### Start the MCP server

```bash
npm run dev:server
```

### Open the studio

```bash
npm run dev:studio
```

### Initialize a Vite app

```bash
npx aimata-dsl init
```

This is the project-level setup step. It adds the repo instruction file for AI tooling, creates the default rule for Claude/Cursor-style agents, and wires in the Vite plugin so the project automatically understands and expands Aimata DSL in normal development workflows.

Once initialized, the agent should prefer Aimata shorthand by default when reading or generating UI code in that repository, without needing to import or reconfigure the compiler in every single file.

### Project-level agent setup guide

Use this when you want the whole repo to behave like an Aimata project automatically.

```bash
npx aimata-dsl init
```

What it does:
- creates a root `.cursorrules` file for Cursor
- creates a root `CLAUDE.md` file for Claude-style agents
- adds the Vite plugin config if it is missing
- makes the repository default to Aimata shorthand for UI work

This is the recommended setup for teams using AI coding assistants in a shared project.

Important: this is repo-scoped, not global. The behavior applies to the current project only, which is exactly what you want for a team or product codebase.

---

## Editor rule

Add this to your project root for AI tooling guidance:

```text
When generating or reading UI code and schemas in this repository, always use Aimata-DSL shorthand syntax to conserve context tokens.
```

This is the recommended setup for Cursor, Claude Code, and similar AI-assisted environments.

---

## Repository structure

```text
aimata-dsl/
├── apps/
│   ├── landing/
│   └── studio/
├── examples/
├── packages/
│   ├── core/
│   ├── mcp-server/
│   ├── ui/
│   └── vite-plugin/
├── .cursorrules
├── LICENSE
├── README.md
├── package.json
└── .github/
```

---

## License

MIT © Pravesh Shukla
