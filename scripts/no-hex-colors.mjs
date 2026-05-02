#!/usr/bin/env node
// REQ-FND-030: Block raw hex colors inside app/, components/, lib/.
// Biome 1.9 lacks a JS/TS rule for this; tokens.css is the single source of
// truth (regula-design-tokens skill), so any `#rrggbb` / `#rrggbbaa` /
// `#rgb` literal in source is treated as a lint error.
//
// Usage: `node scripts/no-hex-colors.mjs` — exits non-zero on violations.

import fs from 'node:fs/promises';
import path from 'node:path';

const ROOTS = ['app', 'components', 'lib'];
const EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css']);
// Matches #rgb, #rgba, #rrggbb, #rrggbbaa.
const HEX_PATTERN = /#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})\b/g;

async function* walk(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch (err) {
    if (err.code === 'ENOENT') return;
    throw err;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      yield* walk(full);
    } else if (EXTENSIONS.has(path.extname(entry.name))) {
      yield full;
    }
  }
}

const violations = [];
for (const root of ROOTS) {
  for await (const file of walk(root)) {
    const content = await fs.readFile(file, 'utf8');
    const lines = content.split(/\r?\n/);
    lines.forEach((line, idx) => {
      // Skip lines that are clearly comments documenting the rule itself.
      if (/eslint-disable|biome-ignore|allow-hex/.test(line)) return;
      const matches = line.match(HEX_PATTERN);
      if (matches) {
        violations.push({ file, line: idx + 1, snippet: line.trim(), matches });
      }
    });
  }
}

if (violations.length > 0) {
  console.error(
    'REQ-FND-030 violation: raw hex colors are not allowed in app/, components/, lib/.',
  );
  console.error('Use design tokens defined in styles/tokens.css instead (e.g. bg-brand-800).\n');
  for (const v of violations) {
    console.error(`  ${v.file}:${v.line}  [${v.matches.join(', ')}]`);
    console.error(`    ${v.snippet}`);
  }
  console.error(`\n${violations.length} violation(s) found.`);
  process.exit(1);
}

// biome-ignore lint/suspicious/noConsole: CLI output
console.log('lint:hex - no raw hex colors found in app/, components/, lib/.');
