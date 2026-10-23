/**
 * @aimata-dsl/core — src/index.js
 *
 * Public API barrel export.
 */

export { compressToDSL, expandFromDSL, compile } from './compiler.js';
export { parse, tokenize, TOKEN_TYPES } from './parser.js';
