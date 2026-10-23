import { compressToDSL, expandFromDSL } from '@aimata-dsl/core';

const source = `
  <div class="mx-auto max-w-md rounded-xl border border-slate-200 bg-white p-6 shadow-lg">
    <button class="bg-blue-600 text-white px-4 py-2 rounded" type="button">Save changes</button>
  </div>
`;

const dsl = compressToDSL(source);
const expanded = expandFromDSL(dsl, 'react');

console.log('DSL:', dsl);
console.log('Expanded React:', expanded);
