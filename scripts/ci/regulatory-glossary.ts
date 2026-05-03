/**
 * regulatory-glossary.ts — REQ-ENTERPRISE-043
 *
 * Validates that both ko.json and en.json contain the 5 required
 * regulatory corpus names under the 'regulatory' key:
 * fda, euMdr, mfds, nmpa, pmda.
 *
 * Exit 0 if all are present; exit 1 if any are missing.
 *
 * Usage: pnpm ci:glossary
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const REQUIRED_KEYS = ['fda', 'euMdr', 'mfds', 'nmpa', 'pmda'] as const;

const KO_FILE = path.join(process.cwd(), 'messages', 'ko.json');
const EN_FILE = path.join(process.cwd(), 'messages', 'en.json');

function checkGlossary(filePath: string): string[] {
  const content = JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
  const regulatory = content.regulatory as Record<string, unknown> | undefined;

  if (!regulatory) {
    return REQUIRED_KEYS.slice() as unknown as string[];
  }

  return REQUIRED_KEYS.filter((k) => !(k in regulatory));
}

function main(): void {
  let hasError = false;

  for (const [label, filePath] of [
    ['ko.json', KO_FILE],
    ['en.json', EN_FILE],
  ] as const) {
    if (!fs.existsSync(filePath)) {
      console.error(`Missing file: ${filePath}`);
      hasError = true;
      continue;
    }

    const missing = checkGlossary(filePath);
    if (missing.length > 0) {
      console.error(
        `Regulatory glossary check FAILED for ${label}: missing keys: ${missing.join(', ')}`,
      );
      hasError = true;
    } else {
    }
  }

  process.exit(hasError ? 1 : 0);
}

main();
