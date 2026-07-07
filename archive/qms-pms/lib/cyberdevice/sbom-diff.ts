// @MX:NOTE [AUTO] SBOM version diff (REQ-004 / AC-01).
// @MX:SPEC SPEC-REGULA-CYBERDEVICE-001 (REQ-004, AC-01)

// @MX:LEGACY archived from lib
//
// Compares two component lists and returns added / removed / updated. A
// component identity is keyed by (name, purl, cpe) — version-only changes are
// "updated". Pure deterministic function — no I/O — so it is trivially unit-testable.

import type { SbomComponent, SbomDiffResult } from './types';

function componentKey(c: SbomComponent): string {
  // Prefer purl > cpe > name as the stable identifier.
  return c.purl ?? c.cpe ?? c.name;
}

export function diffSbomVersions(a: SbomComponent[], b: SbomComponent[]): SbomDiffResult {
  const mapA = new Map(a.map((c) => [componentKey(c), c]));
  const mapB = new Map(b.map((c) => [componentKey(c), c]));

  const added: SbomComponent[] = [];
  const removed: SbomComponent[] = [];
  const updated: { from: SbomComponent; to: SbomComponent }[] = [];

  for (const [key, compB] of mapB) {
    const compA = mapA.get(key);
    if (!compA) {
      added.push(compB);
    } else if (compA.version !== compB.version) {
      updated.push({ from: compA, to: compB });
    }
  }
  for (const [key, compA] of mapA) {
    if (!mapB.has(key)) removed.push(compA);
  }

  return { added, removed, updated };
}
