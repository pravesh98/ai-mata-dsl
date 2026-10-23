# Aimata Studio

> Interactive web playground for the Aimata DSL compiler.

## What it does

The Studio is a zero-build, single-page playground that lets you:

- **Paste** any JSX, HTML, or Tailwind component
- **See** the compressed Aimata micro-DSL in real time
- **Toggle** output between React JSX and plain HTML
- **Copy** either side to clipboard

## Run locally

```bash
# Just open the file — no build step needed
open apps/studio/index.html

# Or serve with any static server:
npx serve apps/studio
```

## Architecture

- Zero dependencies, zero build step
- The `@aimata-dsl/core` compiler is inlined directly in `src/main.js`
- Works in any modern browser via native ES modules

## Live demo

Deployed at: **[pravesh98.github.io/ai-mata-dsl](https://pravesh98.github.io/ai-mata-dsl)**
