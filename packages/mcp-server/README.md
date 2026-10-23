# @aimata-dsl/mcp-server

> Model Context Protocol (MCP) HTTP server for the Aimata DSL compiler.

[![license](https://img.shields.io/npm/l/@aimata-dsl/mcp-server.svg)](../../LICENSE)

## Overview

`@aimata-dsl/mcp-server` exposes the `@aimata-dsl/core` compiler as a local HTTP server that AI assistants (Claude, GPT-4, Gemini, etc.) can call as an MCP tool. This lets AI models compress and expand UI components without bundling the compiler themselves.

## Installation & Start

```bash
npm install @aimata-dsl/mcp-server
node node_modules/@aimata-dsl/mcp-server/src/index.js

# Or clone the monorepo:
git clone https://github.com/pravesh98/ai-mata-dsl.git
cd ai-mata-dsl
npm install
node packages/mcp-server/src/index.js
```

Default port: **3100** (override with `PORT=8080 node src/index.js`)

## Endpoints

### `GET /health`
```json
{ "status": "ok", "version": "0.1.0", "uptime": 3.2 }
```

### `GET /manifest`
Returns the full MCP tool manifest JSON for AI assistant discovery.

### `POST /compress`
Compress JSX/HTML/Tailwind to Aimata micro-DSL.

**Request:**
```json
{ "code": "<button className=\"px-4 py-2 bg-blue-500\" onClick={fn}>Submit</button>" }
```

**Response:**
```json
{
  "dsl": "[button.px-4.py-2.bg-blue-500{onClick=fn}|Submit]",
  "stats": {
    "inputLength": 72,
    "outputLength": 42,
    "compressionRatio": 1.71,
    "inputTokens": 8,
    "outputTokens": 5,
    "tokenReduction": "37%"
  }
}
```

### `POST /expand`
Expand micro-DSL back to source code.

**Request:**
```json
{
  "dsl": "[button.px-4.py-2.bg-blue-500{onClick=fn}|Submit]",
  "target": "react"
}
```

`target` options: `react` · `html` · `vue` · `angular` · `svelte` · `solid`

**Response:**
```json
{ "code": "<button className=\"px-4 py-2 bg-blue-500\" onClick={fn}>Submit</button>" }
```

## MCP Tool Integration (Claude Desktop example)

Add to your `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "aimata-dsl": {
      "command": "node",
      "args": ["/path/to/packages/mcp-server/src/index.js"]
    }
  }
}
```

## License

MIT © Pravesh Shukla
