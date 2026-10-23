/**
 * @aimata-dsl/core — src/test.js
 *
 * Round-trip test suite (no external test runner required).
 * Run with: node src/test.js
 *
 * Tests:
 *  1. Simple element compression
 *  2. Nested structure compression
 *  3. Full Tailwind button round-trip (compress → expand → structurally equivalent)
 *  4. React card component round-trip
 *  5. HTML expansion mode
 *  6. Self-closing / void element handling
 *  7. Props encoding (event handlers, data attrs)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { compressToDSL, expandFromDSL, parse, compile } from './index.js';
import { ensureProjectAgentFiles } from '../bin/cli.js';

// ─── Minimal test harness ─────────────────────────────────────────────────────

let passed = 0;
let failed = 0;
const errors = [];

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
    errors.push(message);
  }
}

function assertContains(haystack, needle, message) {
  assert(haystack.includes(needle), `${message} [expected to contain: "${needle}"]`);
}

function assertNotContains(haystack, needle, message) {
  assert(!haystack.includes(needle), `${message} [expected NOT to contain: "${needle}"]`);
}

function section(name) {
  console.log(`\n📦 ${name}`);
}

// ─── Test Cases ───────────────────────────────────────────────────────────────

section('1. Simple element compression');
{
  const input = `<div className="flex gap-4">Hello</div>`;
  const dsl = compressToDSL(input);
  assert(dsl.startsWith('[box'), 'DSL starts with [box');
  assertContains(dsl, '.flex.gap-4', 'Classes encoded with dots');
  assertContains(dsl, '|Hello]', 'Text children encoded after pipe');
  console.log(`     Input : ${input}`);
  console.log(`     DSL   : ${dsl}`);
}

section('2. Nested structure compression');
{
  const input = `<div className="container"><span className="text-sm">World</span></div>`;
  const dsl = compressToDSL(input);
  assertContains(dsl, '[span', 'Nested span present');
  assertContains(dsl, '.text-sm', 'Nested class present');
  assertContains(dsl, '|World]', 'Nested text child present');
  console.log(`     DSL: ${dsl}`);
}

section('3. Tailwind button round-trip (React)');
{
  const original = `<button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" onClick={handleClick}>Submit</button>`;
  const dsl = compressToDSL(original);

  assertContains(dsl, '.px-4.py-2.bg-blue-500.text-white.rounded', 'All Tailwind classes compressed');
  assertContains(dsl, 'onClick=handleClick', 'Event handler encoded in props');
  assertContains(dsl, '|Submit]', 'Button text preserved');

  const expanded = expandFromDSL(dsl, 'react');
  assertContains(expanded, '<button', 'Expanded has <button');
  assertContains(expanded, 'className="px-4 py-2 bg-blue-500 text-white rounded', 'className restored');
  assertContains(expanded, 'onClick={handleClick}', 'onClick handler restored as JSX expression');
  assertContains(expanded, 'Submit', 'Button text restored');
  assertNotContains(expanded, 'class=', 'No stray class= in React output');

  console.log(`     Original : ${original}`);
  console.log(`     DSL      : ${dsl}`);
  console.log(`     Expanded : ${expanded}`);
}

section('3b. Structural box/btn DSL round-trip');
{
  const original = `
<div class="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
  <button type="button" class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500">Save changes</button>
</div>`.trim();

  const dsl = compressToDSL(original);
  assertContains(dsl, '[box', 'Wrapper compresses to the box shorthand');
  assertContains(dsl, '[btn', 'Button compresses to the btn shorthand');

  const expanded = expandFromDSL(dsl, 'react');
  assertContains(expanded, '<div', 'Expanded box alias restores div');
  assertContains(expanded, 'className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"', 'Expanded box wrapper retains classes');
  assertContains(expanded, '<button', 'Expanded btn alias restores button');
  assertContains(expanded, 'type="button"', 'Button type attribute preserved');
  assertContains(expanded, 'Save changes', 'Nested button text preserved');

  console.log(`     DSL: ${dsl}`);
  console.log(`     Expanded: ${expanded}`);
}

section('4. Card component round-trip (React)');
{
  const original = `
<div id="card" className="rounded-xl shadow-lg p-6 bg-white">
  <h2 className="text-2xl font-bold">Title</h2>
  <p className="text-gray-600 mt-2">Description text</p>
</div>`.trim();

  const dsl = compressToDSL(original);
  assertContains(dsl, '#card', 'ID encoded with #');
  assertContains(dsl, '.rounded-xl.shadow-lg', 'Card classes compressed');
  assertContains(dsl, '[h2', 'h2 child present');
  assertContains(dsl, '[p', 'p child present');

  const expanded = expandFromDSL(dsl, 'react');
  assertContains(expanded, 'id="card"', 'ID restored');
  assertContains(expanded, 'className="rounded-xl shadow-lg', 'Card classes restored');
  assertContains(expanded, '<h2', 'h2 restored');
  assertContains(expanded, '<p', 'p restored');
  assertContains(expanded, 'Title', 'h2 text restored');
  assertContains(expanded, 'Description text', 'p text restored');

  console.log(`     DSL: ${dsl}`);
}

section('5. HTML expansion mode');
{
  const input = `<button className="btn-primary" onClick={doSomething}>Click</button>`;
  const dsl = compressToDSL(input);
  const html = expandFromDSL(dsl, 'html');

  assertContains(html, 'class="btn-primary"', 'Uses class= not className= in HTML');
  assertNotContains(html, 'className', 'No className in HTML output');
  assertContains(html, 'data-onclick', 'onClick encoded as data- attr in HTML');
  assertContains(html, 'Click', 'Text content preserved in HTML');

  console.log(`     HTML: ${html}`);
}

section('6. Self-closing element (img)');
{
  const input = `<img className="w-full" src="/hero.png" alt="Hero image" />`;
  const dsl = compressToDSL(input);
  assertContains(dsl, '[img', 'img tag in DSL');
  assertContains(dsl, 'src=/hero.png', 'src prop encoded');

  const expanded = expandFromDSL(dsl, 'react');
  assertContains(expanded, '<img', 'img tag in expanded JSX');
  console.log(`     DSL     : ${dsl}`);
  console.log(`     Expanded: ${expanded}`);
}

section('7. compile() API (AST path)');
{
  const input = `<section className="hero"><h1 className="title">Hello World</h1></section>`;
  const ast = parse(input);
  assert(Array.isArray(ast), 'parse() returns an array');
  assert(ast.length === 1, 'parse() returns one root node');
  assert(ast[0].tag === 'section', 'Root tag is section');
  assert(ast[0].children.length === 1, 'Root has one child');

  const dsl = compile(ast, { target: 'dsl' });
  assertContains(dsl, '[section', 'compile() to DSL works');

  const jsx = compile(ast, { target: 'react' });
  assertContains(jsx, '<section', 'compile() to react works');
}

// ─── Determinism check ────────────────────────────────────────────────────────

section('8. Determinism — compress → expand → compress produces identical DSL');
{
  const original = `<nav className="flex items-center justify-between px-8 py-4 bg-gray-900">
  <a href="/" className="text-white font-bold text-xl">Brand</a>
</nav>`;

  const dsl1 = compressToDSL(original);
  const expanded = expandFromDSL(dsl1, 'react');
  const dsl2 = compressToDSL(expanded);

  assert(dsl1 === dsl2, 'DSL is identical after round-trip (compress → expand → compress)');
  console.log(`     DSL1: ${dsl1}`);
  console.log(`     DSL2: ${dsl2}`);
}

section('9. Multi-framework expansion from single DSL');
{
  const input = `<button className="px-4 py-2 bg-blue-500 text-white rounded" onClick={handleClick}>Submit</button>`;
  const dsl = compressToDSL(input);

  // React
  const react = expandFromDSL(dsl, 'react');
  assertContains(react, 'className=', 'React: uses className');
  assertContains(react, 'onClick={handleClick}', 'React: onClick JSX expression');

  // Vue
  const vue = expandFromDSL(dsl, 'vue');
  assertContains(vue, 'class=', 'Vue: uses class (not className)');
  assertContains(vue, '@click="handleClick"', 'Vue: @click binding');
  assertNotContains(vue, 'className', 'Vue: no className');

  // Angular
  const angular = expandFromDSL(dsl, 'angular');
  assertContains(angular, 'class=', 'Angular: uses class');
  assertContains(angular, '(click)="handleClick()"', 'Angular: (click) binding');
  assertNotContains(angular, 'className', 'Angular: no className');

  // Svelte
  const svelte = expandFromDSL(dsl, 'svelte');
  assertContains(svelte, 'class=', 'Svelte: uses class');
  assertContains(svelte, 'on:click={handleClick}', 'Svelte: on:click binding');
  assertNotContains(svelte, 'className', 'Svelte: no className');

  // SolidJS
  const solid = expandFromDSL(dsl, 'solid');
  assertContains(solid, 'class=', 'Solid: uses class');
  assertContains(solid, 'onClick={handleClick}', 'Solid: onClick JSX expression');

  // HTML
  const html = expandFromDSL(dsl, 'html');
  assertContains(html, 'class=', 'HTML: uses class');
  assertContains(html, 'data-onclick="handleClick"', 'HTML: data-onclick attribute');

  console.log(`     React  : ${react}`);
  console.log(`     Vue    : ${vue}`);
  console.log(`     Angular: ${angular}`);
  console.log(`     Svelte : ${svelte}`);
  console.log(`     Solid  : ${solid}`);
  console.log(`     HTML   : ${html}`);
}

section('10. Invalid target throws TypeError');
{
  let threw = false;
  try { expandFromDSL('[div|test]', 'ember'); }
  catch (e) { threw = e instanceof TypeError; }
  assert(threw, 'Unsupported target throws TypeError');
}

section('11. Project init merges with existing Claude and Cursor files');
{
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aimata-init-'));

  fs.writeFileSync(path.join(tempDir, 'CLAUDE.md'), '# Existing project notes\n\nKeep this repo stable.\n', 'utf8');
  fs.writeFileSync(path.join(tempDir, '.cursorrules'), 'Existing cursor guidance\n', 'utf8');

  const cursorDir = path.join(tempDir, '.cursor', 'rules');
  fs.mkdirSync(cursorDir, { recursive: true });
  fs.writeFileSync(path.join(cursorDir, 'existing.mdc'), '---\ndescription: Existing\nalwaysApply: true\n---\n\nKeep existing rules.\n', 'utf8');

  ensureProjectAgentFiles(tempDir);

  const claudeText = fs.readFileSync(path.join(tempDir, 'CLAUDE.md'), 'utf8');
  const cursorText = fs.readFileSync(path.join(tempDir, '.cursorrules'), 'utf8');
  const cursorRuleText = fs.readFileSync(path.join(cursorDir, 'aimata-dsl.mdc'), 'utf8');

  assert(claudeText.includes('Existing project notes'), 'Existing Claude guidance is preserved');
  assert(claudeText.includes('Aimata-DSL'), 'Claude file includes Aimata rule');
  assert(cursorText.includes('Existing cursor guidance'), 'Existing Cursor guidance is preserved');
  assert(cursorText.includes('Aimata-DSL'), 'Cursor file includes Aimata rule');
  assert(cursorRuleText.includes('Aimata-DSL'), 'Cursor rules file includes Aimata rule');

  fs.rmSync(tempDir, { recursive: true, force: true });
}

// ─── Summary ──────────────────────────────────────────────────────────────────

console.log('\n' + '─'.repeat(60));
console.log(`\n🏁 Results: ${passed} passed, ${failed} failed\n`);

if (failed > 0) {
  console.error('Failed tests:');
  errors.forEach(e => console.error(`  • ${e}`));
  process.exit(1);
} else {
  console.log('All tests passed! 🎉');
  process.exit(0);
}
