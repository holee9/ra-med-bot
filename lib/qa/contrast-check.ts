// @MX:NOTE [AUTO] WCAG AA contrast ratio checker — pure implementation (SPEC-REGULA-VALIDATION-002 #368 thin split).
// @MX:SPEC SPEC-REGULA-VALIDATION-002 (#368, REQ-ENTERPRISE-048)

import * as fs from 'node:fs';

/**
 * Relative luminance for an sRGB channel value (0-255).
 */
export function channelLuminance(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

/**
 * Relative luminance for a hex color string (#rrggbb).
 */
export function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16);
  const g = Number.parseInt(clean.slice(2, 4), 16);
  const b = Number.parseInt(clean.slice(4, 6), 16);
  return 0.2126 * channelLuminance(r) + 0.7152 * channelLuminance(g) + 0.0722 * channelLuminance(b);
}

/**
 * WCAG contrast ratio between two hex colors.
 */
export function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Extract hex value for a CSS custom property from the CSS source.
 * Only resolves direct hex values (#rrggbb). Returns null for var() references.
 */
export function extractHexValue(css: string, tokenName: string): string | null {
  const regex = new RegExp(`${tokenName}\\s*:\\s*(#[0-9a-fA-F]{6})`, 'i');
  const match = css.match(regex);
  return match ? (match[1] ?? null) : null;
}

export interface ColorPair {
  name: string;
  textToken: string;
  bgToken: string;
  minRatio: number;
}

export const COLOR_PAIRS: ColorPair[] = [
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

export interface ContrastResult {
  checked: number;
  skipped: number;
  failures: string[];
  warnings: string[];
}

/**
 * Run WCAG AA contrast check on key text/background pairs from tokens.css.
 * Non-blocking: missing token file or unresolved var() references produce
 * warnings, not failures. Exit 0 unless a pair falls below its minRatio.
 */
export function runContrastCheck(tokensFile: string): ContrastResult {
  const result: ContrastResult = { checked: 0, skipped: 0, failures: [], warnings: [] };

  if (!fs.existsSync(tokensFile)) {
    result.warnings.push(`WARNING: token file not found at ${tokensFile}, skipping contrast check`);
    return result;
  }

  const css = fs.readFileSync(tokensFile, 'utf8');

  for (const pair of COLOR_PAIRS) {
    const textHex = extractHexValue(css, pair.textToken);
    const bgHex = extractHexValue(css, pair.bgToken);

    if (!textHex || !bgHex) {
      result.warnings.push(
        `WARNING: color tokens not found for "${pair.name}" (${pair.textToken}, ${pair.bgToken}), manual contrast check required`,
      );
      result.skipped++;
      continue;
    }

    const ratio = contrastRatio(textHex, bgHex);
    const ratioStr = ratio.toFixed(2);

    if (ratio < pair.minRatio) {
      result.failures.push(
        `FAIL: "${pair.name}" — contrast ratio ${ratioStr}:1 < ${pair.minRatio}:1 (WCAG AA) [${pair.textToken}=${textHex} on ${pair.bgToken}=${bgHex}]`,
      );
    }
    result.checked++;
  }

  return result;
}
