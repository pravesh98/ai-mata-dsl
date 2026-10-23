# Zero-Config Aimata Demo

This example shows the fastest way to use Aimata-DSL with Cursor or Claude Code for AI-assisted UI work.

## Install

```bash
npm i @aimata-dsl/core
```

## Quick setup

1. Add the repo rule in your project root:

```text
When generating or reading UI code and schemas in this repository, always use Aimata-DSL shorthand syntax to conserve context tokens.
```

2. Start the MCP proxy or run the compiler directly.

3. Paste a large component into your IDE and let your AI assistant work in compressed Aimata-DSL.

## Example

```js
import { compressToDSL, expandFromDSL } from '@aimata-dsl/core';

const source = `
  <form class="space-y-4">
    <label class="text-sm font-bold">Email</label>
    <input type="text" placeholder="Email" class="border p-2 rounded" />
  </form>
`;

const dsl = compressToDSL(source);
console.log(dsl);

const react = expandFromDSL(dsl, 'react');
console.log(react);
```

## Why this helps

Aimata-DSL compresses verbose JSX/Tailwind into a smaller structure so agent prompts send fewer tokens while retaining deterministic expansion back to clean code.

> Setup once in 30 seconds, enjoy 75% token savings automatically on every AI prompt.
