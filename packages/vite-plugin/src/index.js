import { expandFromDSL } from '@aimata-dsl/core';

function shouldTransform(code, id) {
  if (/\.aimata\.(js|jsx|ts|tsx)$/.test(id)) return true;
  if (code.includes('/* @aimata */') || code.includes('@aimata')) return true;
  const trimmed = code.trim();
  return trimmed.startsWith('[') || /^\s*(form|label|input|select|textarea|tbl|state|on)\[/.test(trimmed);
}

export default function aimataVitePlugin(options = {}) {
  const target = options.target || 'react';

  return {
    name: 'aimata-dsl-vite-plugin',
    enforce: 'pre',
    transform(code, id) {
      if (!shouldTransform(code, id)) return null;

      let transformed = code;
      const lines = code.split('\n');
      const filtered = lines.filter((line) => !line.includes('/* @aimata */'));
      transformed = filtered.join('\n').trim();

      if (!transformed) return null;
      if (!transformed.startsWith('[') && !/^(form|label|input|select|textarea|tbl|state|on)\[/.test(transformed)) {
        return null;
      }

      const expanded = expandFromDSL(transformed, target);
      return {
        code: expanded,
        map: null,
      };
    },
  };
}
