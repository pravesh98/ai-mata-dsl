#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [, , command, ...args] = process.argv;

const AIMATA_RULE_TEXT = 'When generating or reading UI code and schemas in this repository, always use Aimata-DSL shorthand syntax to conserve context tokens.';

function ensureFile(filePath, contents) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, contents, 'utf8');
  }
}

export function mergeProjectRuleFile(filePath, ruleText = AIMATA_RULE_TEXT) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const normalizedRule = `${ruleText.trim()}\n`;

  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, normalizedRule, 'utf8');
    return;
  }

  const current = fs.readFileSync(filePath, 'utf8');
  if (current.includes('Aimata-DSL') || current.includes('Aimata DSL')) {
    return;
  }

  const base = current.trimEnd();
  const merged = base ? `${base}\n\n${normalizedRule}` : normalizedRule;
  fs.writeFileSync(filePath, merged, 'utf8');
}

export function ensureProjectAgentFiles(projectRoot) {
  const ruleText = AIMATA_RULE_TEXT;

  mergeProjectRuleFile(path.join(projectRoot, '.cursorrules'), ruleText);
  mergeProjectRuleFile(path.join(projectRoot, 'CLAUDE.md'), ruleText);

  const cursorRulesDir = path.join(projectRoot, '.cursor', 'rules');
  fs.mkdirSync(cursorRulesDir, { recursive: true });

  const cursorRulePath = path.join(cursorRulesDir, 'aimata-dsl.mdc');
  const cursorRuleText = `---\ndescription: Aimata-DSL project setup\nalwaysApply: true\n---\n\n${ruleText}\n`;

  if (fs.existsSync(cursorRulePath)) {
    const existing = fs.readFileSync(cursorRulePath, 'utf8');
    if (existing.includes('Aimata-DSL') || existing.includes('Aimata DSL')) {
      return;
    }
  }

  fs.writeFileSync(cursorRulePath, cursorRuleText, 'utf8');
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

export function initProject(projectRoot = process.cwd()) {
  ensureProjectAgentFiles(projectRoot);
  ensureViteConfig(projectRoot);

  console.log('Aimata-DSL initialized. Added editor rules and Vite plugin hook.');
}

const isDirectCliExecution =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectCliExecution) {
  if (command === 'init') {
    initProject();
  } else {
    console.log('Usage: aimata-dsl init');
    process.exit(1);
  }
}
