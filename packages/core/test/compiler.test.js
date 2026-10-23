import test from 'node:test';
import assert from 'node:assert/strict';

import { compressToDSL, expandFromDSL } from '../src/index.js';

test('compresses verbose HTML/Tailwind into box[...] and btn[...] DSL', () => {
  const source = `
    <div class="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
      <button class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500" type="button">
        Save changes
      </button>
    </div>
  `;

  const dsl = compressToDSL(source);

  assert.match(dsl, /^\[box\./);
  assert.match(dsl, /\[btn\./);
  assert.match(dsl, /rounded-xl/);
  assert.match(dsl, /bg-blue-600/);
  assert.match(dsl, /Save changes/);
});

test('expands box[...] and btn[...] DSL back to the original HTML structure', () => {
  const dsl = `[box.mx-auto.max-w-md.rounded-xl.border.border-slate-200.bg-white.p-6.shadow-lg|[btn.inline-flex.items-center.justify-center.rounded-lg.bg-blue-600.px-4.py-2.text-sm.font-semibold.text-white.shadow-sm.hover:bg-blue-500{type=button}|Save changes]]`;

  const html = expandFromDSL(dsl, 'html');

  assert.match(html, /<div/);
  assert.match(html, /class="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"/);
  assert.match(html, /<button/);
  assert.match(html, /class="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"/);
  assert.match(html, /type="button"/);
  assert.match(html, /Save changes/);

  const react = expandFromDSL(dsl, 'react');
  assert.match(react, /<div/);
  assert.match(react, /className="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg"/);
  assert.match(react, /<button/);
  assert.match(react, /className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-500"/);
  assert.match(react, /type="button"/);
  assert.match(react, /Save changes/);
});

test('supports form, input, label, and state/event structural shorthand', () => {
  const dsl = `form[space-y-4] { label[text-sm font-bold] "Email", input[type="text", placeholder="Email", class="border p-2 rounded"], state[isOpen: false], on[click: toggleModal] }`;

  const react = expandFromDSL(dsl, 'react');
  assert.match(react, /<form className="space-y-4"/);
  assert.match(react, /<label className="text-sm font-bold">Email<\/label>/);
  assert.match(react, /<input/);
  assert.match(react, /className="border p-2 rounded"/);
  assert.match(react, /type="text"/);
  assert.match(react, /placeholder="Email"/);
  assert.match(react, /const isOpen = false;/);
  assert.match(react, /onClick=\{toggleModal\}/);
});

test('supports database table schema shorthand and SQL/Prisma/TS expansion', () => {
  const dsl = `tbl[users] { col[id, PK, int], col[email, unique, string], col[created_at, timestamp] }`;

  const sql = expandFromDSL(dsl, 'sql');
  assert.match(sql, /CREATE TABLE users/);
  assert.match(sql, /id INT PRIMARY KEY/);
  assert.match(sql, /email STRING UNIQUE/);
  assert.match(sql, /created_at TIMESTAMP/);

  const prisma = expandFromDSL(dsl, 'prisma');
  assert.match(prisma, /model users/);
  assert.match(prisma, /id Int @id/);
  assert.match(prisma, /email String @unique/);

  const ts = expandFromDSL(dsl, 'ts');
  assert.match(ts, /export interface users/);
  assert.match(ts, /id: number;/);
  assert.match(ts, /email: string;/);
});
