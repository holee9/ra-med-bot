// @MX:NOTE [AUTO] GSPR 17.2/17.4 + IEC 81001-5-1 mapping (REQ-008, AC-06).
// @MX:SPEC SPEC-REGULA-CYBERDEVICE-001 (REQ-008, AC-06)

// @MX:LEGACY archived from lib
//
// AC-06 requires the threat model to map to GSPR 17.2, GSPR 17.4, and
// IEC 81001-5-1 with completeness. This module is the canonical requirement
// list and the deterministic mapper from threat category → applicable clauses.

import type { GsprMappingEntry, ThreatItem } from './types';

export interface GsprRequirement {
  clause: string;
  standard: 'GSPR_17.2' | 'GSPR_17.4' | 'IEC_81001_5_1';
  requirement: string;
}

// Canonical regulatory requirements (single source of truth for AC-06 completeness).
export const CYBERSECURITY_GSPR_REQUIREMENTS: readonly GsprRequirement[] = [
  {
    clause: 'GSPR 17.2',
    standard: 'GSPR_17.2',
    requirement:
      'Devices shall be designed and manufactured in such a way as to remove or reduce as far as possible the risks related to the IT environment and cybersecurity threats.',
  },
  {
    clause: 'GSPR 17.4',
    standard: 'GSPR_17.4',
    requirement:
      'Devices shall be designed and manufactured in such a way as to ensure protection against unauthorized access and that cybersecurity risks are appropriately addressed.',
  },
  {
    clause: 'IEC 81001-5-1 §5',
    standard: 'IEC_81001_5_1',
    requirement:
      'Security risk management: identify assets, threats, and vulnerabilities; apply proportional controls across the software lifecycle.',
  },
  {
    clause: 'IEC 81001-5-1 §6',
    standard: 'IEC_81001_5_1',
    requirement:
      'Secure development lifecycle: threat modeling, secure coding, SBOM, and vulnerability response.',
  },
  {
    clause: 'IEC 81001-5-1 §7',
    standard: 'IEC_81001_5_1',
    requirement:
      'Security assurance: secure configuration, update/patch management, and end-of-support planning.',
  },
] as const;

/**
 * REQ-008 / AC-06: map generated threats to the GSPR / IEC requirements they
 * address. Each STRIDE category maps to the requirement(s) whose controls it
 * exercises. Deterministic — a regulator re-running gets the same mapping.
 */
export function mapThreatsToGspr(threats: ThreatItem[]): GsprMappingEntry[] {
  const entries: GsprMappingEntry[] = [];
  for (const threat of threats) {
    const applicable = applicableRequirementsForCategory(threat.category);
    for (const req of applicable) {
      entries.push({
        clause: req.clause,
        standard: req.standard,
        requirement: req.requirement,
        evidence: `Threat ${threat.id} (${threat.category}) — controls address this requirement`,
      });
    }
  }
  return entries;
}

/**
 * AC-06 completeness check: every requirement in CYBERSECURITY_GSPR_REQUIREMENTS
 * must be covered by at least one threat mapping. Returns the list of uncovered
 * requirements (empty array = complete).
 */
export function uncoveredRequirements(mapping: GsprMappingEntry[]): GsprRequirement[] {
  const coveredClauses = new Set(mapping.map((e) => e.clause));
  return CYBERSECURITY_GSPR_REQUIREMENTS.filter((r) => !coveredClauses.has(r.clause));
}

function applicableRequirementsForCategory(category: ThreatItem['category']): GsprRequirement[] {
  // Resolve clauses by direct constant reference so there is no Map lookup
  // (avoids non-null assertions; the clauses are compile-time constants here).
  const req = (clause: string): GsprRequirement => {
    const found = CYBERSECURITY_GSPR_REQUIREMENTS.find((r) => r.clause === clause);
    if (!found) throw new Error(`gspr_requirement_not_found: ${clause}`);
    return found;
  };
  const result: GsprRequirement[] = [];

  // GSPR 17.4 applies to every access-control / integrity threat.
  if (['spoofing', 'tampering', 'elevation_of_privilege', 'repudiation'].includes(category)) {
    result.push(req('GSPR 17.4'));
  }
  // GSPR 17.2 applies to IT-environment exposure (disclosure, DoS).
  if (['information_disclosure', 'denial_of_service'].includes(category)) {
    result.push(req('GSPR 17.2'));
  }
  // IEC 81001-5-1 §5 (risk mgmt) covers all threat categories.
  result.push(req('IEC 81001-5-1 §5'));
  // IEC 81001-5-1 §6 (secure dev lifecycle) covers tampering + spoofing.
  if (['tampering', 'spoofing', 'elevation_of_privilege'].includes(category)) {
    result.push(req('IEC 81001-5-1 §6'));
  }
  // IEC 81001-5-1 §7 (update/patch) — represented by the DOS / tampering threats
  // that the update plan mitigates.
  if (['denial_of_service', 'tampering'].includes(category)) {
    result.push(req('IEC 81001-5-1 §7'));
  }
  return result;
}
