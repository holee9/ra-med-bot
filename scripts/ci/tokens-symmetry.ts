/**
 * tokens-symmetry.ts — REQ-ENTERPRISE-036
 *
 * Verifies that every theme-facing CSS custom property (--*) defined in the
 * :root {} block also has a corresponding definition in the
 * [data-theme="dark"] block.
 *
 * Exit 0 if all theme tokens are symmetric, exit 1 if any are missing in dark mode.
 *
 * Usage: pnpm ci:tokens
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { logger } from '../../lib/observability/logger';

const CSS_FILE = path.join(process.cwd(), 'styles', 'tokens.css');
const DARK_SELECTOR = '[data-theme="dark"]';
const THEME_TOKEN_PREFIXES = ['--color-', '--bg-', '--border-', '--ring-', '--shadow-'];
const THEME_TEXT_TOKENS = new Set([
  '--text-primary',
  '--text-secondary',
  '--text-tertiary',
  '--text-muted',
  '--text-inverse',
  '--text-brand',
  '--text-accent',
]);

function extractTokens(css: string, blockSelector: string): string[] {
  // Find the selector block: e.g. ":root {" or "[data-theme=\"dark\"] {"
  // Handles nested braces by tracking brace depth.
  const selectorIndex = css.indexOf(blockSelector);
  if (selectorIndex === -1) return [];

  const openBrace = css.indexOf('{', selectorIndex);
  if (openBrace === -1) return [];

  let depth = 1;
  let i = openBrace + 1;
  while (i < css.length && depth > 0) {
    if (css[i] === '{') depth++;
    else if (css[i] === '}') depth--;
    i++;
  }

  const block = css.slice(openBrace + 1, i - 1);

  // Extract --variable-name from the block (ignore values)
  const matches = block.match(/--[\w-]+(?=\s*:)/g);
  return matches ? [...new Set(matches)] : [];
}

function main(): void {
  if (!fs.existsSync(CSS_FILE)) {
    logger.error(`Token file not found: ${CSS_FILE}`);
    process.exit(1);
  }

  const css = fs.readFileSync(CSS_FILE, 'utf8');

  const rootTokens = extractTokens(css, ':root');
  const darkTokens = extractTokens(css, DARK_SELECTOR);

  const requiredTokens = rootTokens.filter(
    (token) =>
      THEME_TOKEN_PREFIXES.some((prefix) => token.startsWith(prefix)) ||
      THEME_TEXT_TOKENS.has(token),
  );
  const missing = requiredTokens.filter((t) => !darkTokens.includes(t));

  if (missing.length > 0) {
    for (const _t of missing) {
    }
    process.exit(1);
  }
  process.exit(0);
}

main();
