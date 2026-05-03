/**
 * contrast-check.ts — REQ-ENTERPRISE-048
 *
 * Reads the CSS token file and checks WCAG AA contrast ratio (4.5:1 minimum
 * for normal text) for key text/background color pairs.
 *
 * Exit 0: all pairs pass or tokens not found (non-blocking).
 * Exit 1: a pair fails WCAG AA contrast.
 *
 * Usage: pnpm ci:contrast
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const TOKENS_FILE = path.join(process.cwd(), 'styles', 'tokens.css');

// Relative luminance for an sRGB channel value (0-255)
function channelLuminance(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

// Relative luminance for a hex color string (#rrggbb)
function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

// WCAG contrast ratio between two hex colors
function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// Extract hex value for a CSS custom property from the CSS source.
// Only resolves direct hex values (#rrggbb). Returns null for var() references
// (cannot resolve at static analysis time — those require a browser).
function extractHexValue(css: string, tokenName: string): string | null {
  // Match: --token-name: #rrggbb (with optional whitespace and semicolon)
  const regex = new RegExp(`${tokenName}\\s*:\\s*(#[0-9a-fA-F]{6})`, 'i');
  const match = css.match(regex);
  return match ? (match[1] ?? null) : null;
}

interface ColorPair {
  name: string;
  textToken: string;
  bgToken: string;
  minRatio: number; // WCAG AA: 4.5 normal, 3.0 large
}

// Key text/background pairs to check.
// Only pairs with direct hex values in tokens.css are checked;
// pairs using var() references are skipped with a warning (cannot resolve statically).
const COLOR_PAIRS: ColorPair[] = [
  {
    name: 'brand-800 on brand-50 (primary button text on bg)',
    textToken: '--color-brand-800',
    bgToken: '--color-brand-50',
    minRatio: 4.5,
  },
  {
    name: 'brand-500 on brand-50 (link color on light bg)',
    textToken: '--color-brand-500',
    bgToken: '--color-brand-50',
    minRatio: 4.5,
  },
];

function main(): void {
  if (!fs.existsSync(TOKENS_FILE)) {
    console.warn(`WARNING: token file not found at ${TOKENS_FILE}, skipping contrast check`);
    process.exit(0);
  }

  const css = fs.readFileSync(TOKENS_FILE, 'utf8');
  let hasFailure = false;
  let _checkedCount = 0;
  let _skippedCount = 0;

  for (const pair of COLOR_PAIRS) {
    const textHex = extractHexValue(css, pair.textToken);
    const bgHex = extractHexValue(css, pair.bgToken);

    if (!textHex || !bgHex) {
      console.warn(
        `WARNING: color tokens not found for "${pair.name}" (${pair.textToken}, ${pair.bgToken}), manual contrast check required`,
      );
      _skippedCount++;
      continue;
    }

    const ratio = contrastRatio(textHex, bgHex);
    const ratioStr = ratio.toFixed(2);

    if (ratio < pair.minRatio) {
      console.error(
        `FAIL: "${pair.name}" — contrast ratio ${ratioStr}:1 < ${pair.minRatio}:1 (WCAG AA) [${pair.textToken}=${textHex} on ${pair.bgToken}=${bgHex}]`,
      );
      hasFailure = true;
    } else {
    }
    _checkedCount++;
  }

  if (hasFailure) {
    process.exit(1);
  }

  process.exit(0);
}

main();
