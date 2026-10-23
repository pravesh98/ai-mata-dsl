/**
 * @aimata-dsl/mcp-server — src/index.js
 *
 * Model Context Protocol (MCP) integration server.
 * Exposes the Aimata DSL compiler as HTTP endpoints callable by AI assistants.
 *
 * Endpoints:
 *   GET  /health              → { status: 'ok', version: '0.1.0' }
 *   GET  /manifest            → MCP tool manifest JSON
 *   POST /compress            → { code: string } → { dsl: string, stats: {...} }
 *   POST /expand              → { dsl: string, target?: 'react'|'html' } → { code: string }
 *
 * Run: node src/index.js
 * Port: $PORT or 3100
 */

import { createServer } from 'node:http';
import { compressToDSL, expandFromDSL } from '@aimata-dsl/core';

const PORT = Number(process.env.PORT ?? 3100);
const VERSION = '0.1.0';

// ─── MCP Tool Manifest ────────────────────────────────────────────────────────

const MCP_MANIFEST = {
  schema_version: '1.0',
  name: 'aimata-dsl',
  description: 'Token-optimized DSL compiler for AI-assisted UI generation',
  version: VERSION,
  tools: [
    {
      name: 'compress',
      description: 'Compress verbose JSX/HTML/Tailwind into dense Aimata micro-DSL notation',
      input_schema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'JSX or HTML source code to compress' },
        },
        required: ['code'],
      },
      output_schema: {
        type: 'object',
        properties: {
          dsl: { type: 'string', description: 'Aimata micro-DSL string' },
          stats: {
            type: 'object',
            properties: {
              inputLength: { type: 'number' },
              outputLength: { type: 'number' },
              compressionRatio: { type: 'number' },
            },
          },
        },
      },
    },
    {
      name: 'expand',
      description: 'Expand Aimata micro-DSL back into production JSX or HTML',
      input_schema: {
        type: 'object',
        properties: {
          dsl: { type: 'string', description: 'Aimata micro-DSL string to expand' },
          target: {
            type: 'string',
            enum: ['react', 'html'],
            description: 'Output format (default: react)',
          },
        },
        required: ['dsl'],
      },
      output_schema: {
        type: 'object',
        properties: {
          code: { type: 'string', description: 'Expanded source code' },
        },
      },
    },
  ],
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse the request body as JSON.
 * @param {import('node:http').IncomingMessage} req
 * @returns {Promise<unknown>}
 */
async function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk.toString(); });
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch { reject(new SyntaxError('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}

/**
 * Send a JSON response.
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {unknown} body
 */
function json(res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  });
  res.end(payload);
}

/**
 * Count approximate tokens (split on whitespace/punctuation).
 * @param {string} str
 * @returns {number}
 */
function countTokens(str) {
  return str.split(/\s+|(?=[^a-zA-Z0-9])|(?<=[^a-zA-Z0-9])/).filter(Boolean).length;
}

// ─── Route Handlers ───────────────────────────────────────────────────────────

async function handleCompress(req, res) {
  let body;
  try { body = await parseBody(req); }
  catch (e) { return json(res, 400, { error: e.message }); }

  if (typeof body.code !== 'string' || !body.code.trim()) {
    return json(res, 400, { error: '`code` field is required and must be a non-empty string' });
  }

  try {
    const dsl = compressToDSL(body.code);
    const stats = {
      inputLength: body.code.length,
      outputLength: dsl.length,
      compressionRatio: Number((body.code.length / dsl.length).toFixed(2)),
      inputTokens: countTokens(body.code),
      outputTokens: countTokens(dsl),
      tokenReduction: `${Math.round((1 - countTokens(dsl) / countTokens(body.code)) * 100)}%`,
    };
    return json(res, 200, { dsl, stats });
  } catch (e) {
    return json(res, 422, { error: e.message });
  }
}

async function handleExpand(req, res) {
  let body;
  try { body = await parseBody(req); }
  catch (e) { return json(res, 400, { error: e.message }); }

  if (typeof body.dsl !== 'string' || !body.dsl.trim()) {
    return json(res, 400, { error: '`dsl` field is required and must be a non-empty string' });
  }

  const target = body.target ?? 'react';
  if (target !== 'react' && target !== 'html') {
    return json(res, 400, { error: '`target` must be "react" or "html"' });
  }

  try {
    const code = expandFromDSL(body.dsl, target);
    return json(res, 200, { code });
  } catch (e) {
    return json(res, 422, { error: e.message });
  }
}

// ─── Server ───────────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const method = req.method?.toUpperCase();

  // CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  // Routes
  if (method === 'GET' && url.pathname === '/health') {
    return json(res, 200, { status: 'ok', version: VERSION, uptime: process.uptime() });
  }

  if (method === 'GET' && url.pathname === '/manifest') {
    return json(res, 200, MCP_MANIFEST);
  }

  if (method === 'POST' && url.pathname === '/compress') {
    return handleCompress(req, res);
  }

  if (method === 'POST' && url.pathname === '/expand') {
    return handleExpand(req, res);
  }

  return json(res, 404, { error: `Route ${method} ${url.pathname} not found` });
});

server.listen(PORT, () => {
  console.log(`\n🚀 Aimata MCP Server v${VERSION}`);
  console.log(`   Listening on http://localhost:${PORT}`);
  console.log(`   Manifest:  http://localhost:${PORT}/manifest`);
  console.log(`   Health:    http://localhost:${PORT}/health\n`);
});

export default server;
