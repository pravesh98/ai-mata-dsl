#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';

const [, , command, ...args] = process.argv;

function ensureFile(filePath, contents) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, contents, 'utf8');
  }
}

function ensureViteConfig(projectRoot) {
  const viteConfigPath = path.join(projectRoot, 'vite.config.js');
  const pluginImport = "import aimata from '@aimata-dsl/vite-plugin';\n\n";

  if (!fs.existsSync(viteConfigPath)) {
    fs.writeFileSync(
      viteConfigPath,
      `${pluginImport}export default { plugins: [aimata({ target: 'react' })] };\n`,
      'utf8'
    );
    return;
  }

  const current = fs.readFileSync(viteConfigPath, 'utf8');
  if (current.includes('@aimata-dsl/vite-plugin')) return;

  const updated = current.includes('export default')
    ? current.replace(/export default\s*\{/, `import aimata from '@aimata-dsl/vite-plugin';\n\nexport default {\n  plugins: [aimata({ target: 'react' })],`)
    : `${pluginImport}export default { plugins: [aimata({ target: 'react' })] };\n`;

  fs.writeFileSync(viteConfigPath, updated, 'utf8');
}

function initProject() {
  const projectRoot = process.cwd();
  const rule = 'When generating or reading UI code and schemas in this repository, always use Aimata-DSL shorthand syntax to conserve context tokens.\n';

  ensureFile(path.join(projectRoot, '.cursorrules'), rule);
  ensureFile(path.join(projectRoot, 'CLAUDE.md'), rule);
  ensureViteConfig(projectRoot);

  console.log('Aimata-DSL initialized. Added editor rule and Vite plugin hook.');
}

if (command === 'init') {
  initProject();
} else {
  console.log('Usage: aimata-dsl init');
  process.exit(1);
}
