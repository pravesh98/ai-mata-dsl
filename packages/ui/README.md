# @aimata-dsl/ui

> DSL-first React component primitives for the Aimata ecosystem.

[![npm version](https://img.shields.io/npm/v/@aimata-dsl/ui.svg)](https://www.npmjs.com/package/@aimata-dsl/ui)
[![license](https://img.shields.io/npm/l/@aimata-dsl/ui.svg)](../../LICENSE)

## Overview

`@aimata-dsl/ui` provides framework-agnostic component metadata built on top of `@aimata-dsl/core`. Each component exposes:

- **`.dsl`** — its Aimata micro-DSL signature (for AI prompts / tooling)
- **`.resolveClassName(props)`** — Tailwind class resolver
- **`.toDSL(props)`** — compress a usage instance to DSL

## Installation

```bash
npm install @aimata-dsl/ui @aimata-dsl/core
```

> **Peer deps:** React ≥ 18 is required for rendering. The metadata itself is framework-agnostic.

## Components

### Button

```js
import { Button } from '@aimata-dsl/ui';

// Get the DSL signature (for AI context)
Button.dsl
// → '[Button.btn{variant=primary,size=md}|children]'

// Resolve className for given props
Button.resolveClassName({ variant: 'primary', size: 'lg' })
// → 'inline-flex items-center ... bg-blue-600 text-white px-6 py-3 text-lg'

// Compress a usage instance to DSL
Button.toDSL({ variant: 'danger', size: 'sm', children: 'Delete', onClick: 'handleDelete' })
// → '[button.inline-flex.items-center...bg-red-600...px-3.py-1.5{onClick=handleDelete}|Delete]'
```

**Variants:** `primary` · `secondary` · `ghost` · `danger`  
**Sizes:** `sm` · `md` · `lg`

### Card

```js
import { Card } from '@aimata-dsl/ui';

Card.dsl
// → '[Card.card{padding=md}|[CardHeader|title][CardBody|children]]'

Card.resolveClassName({ padding: 'lg' })
// → 'rounded-2xl border border-gray-200 bg-white shadow-md p-8'
```

## Packages in this monorepo

| Package | Description |
|---------|-------------|
| [`@aimata-dsl/core`](../core) | Core compiler & DSL engine |
| [`@aimata-dsl/ui`](../ui) | Component library primitives ← you are here |
| [`@aimata-dsl/mcp-server`](../mcp-server) | MCP HTTP integration server |

## License

MIT © Pravesh Shukla
