/**
 * i18n-completeness.ts — REQ-ENTERPRISE-043
 *
 * Reads messages/ko.json and messages/en.json, extracts all leaf keys
 * recursively, and reports any missing keys between the two files.
 *
 * Exit 0 if all keys match; exit 1 if any are missing.
 *
 * Usage: pnpm ci:i18n
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const KO_FILE = path.join(process.cwd(), 'messages', 'ko.json');
const EN_FILE = path.join(process.cwd(), 'messages', 'en.json');

function extractKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      keys.push(...extractKeys(v as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys;
}

function main(): void {
  if (!fs.existsSync(KO_FILE)) {
    console.error(`Missing: ${KO_FILE}`);
    process.exit(1);
  }
  if (!fs.existsSync(EN_FILE)) {
    console.error(`Missing: ${EN_FILE}`);
    process.exit(1);
  }

  const ko = JSON.parse(fs.readFileSync(KO_FILE, 'utf8')) as Record<string, unknown>;
  const en = JSON.parse(fs.readFileSync(EN_FILE, 'utf8')) as Record<string, unknown>;

  const koKeys = extractKeys(ko);
  const enKeys = extractKeys(en);

  const missingInEn = koKeys.filter((k) => !enKeys.includes(k));
  const missingInKo = enKeys.filter((k) => !koKeys.includes(k));

  if (missingInEn.length > 0 || missingInKo.length > 0) {
    if (missingInEn.length > 0) {
      console.error(`Missing in en.json (${missingInEn.length}): ${missingInEn.join(', ')}`);
    }
    if (missingInKo.length > 0) {
      console.error(`Missing in ko.json (${missingInKo.length}): ${missingInKo.join(', ')}`);
    }
    process.exit(1);
  }
  process.exit(0);
}

main();
