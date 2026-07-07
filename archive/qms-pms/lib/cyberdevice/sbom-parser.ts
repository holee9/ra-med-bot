// @MX:NOTE [AUTO] SBOM parser — SPDX (JSON) and CycloneDX (JSON) formats.
// @MX:SPEC SPEC-REGULA-CYBERDEVICE-001 (REQ-003)

// @MX:LEGACY archived from lib
//
// Tier1 scope: JSON formats only. Non-JSON SPDX (tag-value, RDF) and complex
// CycloneDX extensions are deferred (@MX:TODO tier2). The parser normalizes
// both formats into a common SbomComponent[] shape and computes a content_hash
// for dedup/versioning. Invalid formats throw ParseError (caller maps to 400).

import { createHash } from 'node:crypto';
import { type SbomComponent, sbomComponentSchema } from './types';

export class SbomParseError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'SbomParseError';
  }
}

export interface ParsedSbom {
  components: SbomComponent[];
  contentHash: string;
}

/**
 * M-1 fix (DoS guard): maximum number of components parseSbom will accept.
 * A 2MB SBOM document can carry ~50K components, parsed synchronously — reject
 * earlier to bound CPU + memory. 10K is generous for tier1 medical-device
 * firmware SBOMs while preventing a malicious payload from stalling the event
 * loop. Lift the ceiling via env SBOM_MAX_COMPONENTS if a real product exceeds.
 */
export const SBOM_MAX_COMPONENTS = Number.parseInt(process.env.SBOM_MAX_COMPONENTS ?? '10000', 10);

/**
 * REQ-003: parse + validate an SBOM document. Structural validation only —
 * tier1 does not run schema-registry validation (SPDX schema URL fetch,
 * CycloneDX JSON Schema) which is deferred. Rejects malformed JSON, wrong
 * top-level shape, and components missing required fields.
 */
export function parseSbom(format: 'spdx' | 'cyclonedx', rawDocument: string): ParsedSbom {
  let doc: unknown;
  try {
    doc = JSON.parse(rawDocument);
  } catch {
    throw new SbomParseError('SBOM document is not valid JSON', 'invalid_json');
  }

  if (typeof doc !== 'object' || doc === null || Array.isArray(doc)) {
    throw new SbomParseError('SBOM document must be a JSON object', 'invalid_root');
  }

  const docRecord = doc as Record<string, unknown>;
  const components = format === 'spdx' ? parseSpdx(docRecord) : parseCycloneDx(docRecord);

  // M-1 fix: cap component count before the per-component Zod validation loop
  // so a oversized payload is rejected in O(1) rather than O(n).
  if (components.length > SBOM_MAX_COMPONENTS) {
    throw new SbomParseError(
      `SBOM component count ${components.length} exceeds maximum ${SBOM_MAX_COMPONENTS}`,
      'too_many_components',
    );
  }

  // Validate every component through Zod so malformed entries are rejected
  // rather than silently producing partial evidence.
  const validated: SbomComponent[] = components.map((c, i) => {
    const res = sbomComponentSchema.safeParse(c);
    if (!res.success) {
      throw new SbomParseError(
        `component[${i}] invalid: ${res.error.issues[0]?.message ?? 'unknown'}`,
        'invalid_component',
      );
    }
    return res.data;
  });

  const contentHash = computeContentHash(validated);
  return { components: validated, contentHash };
}

// ---------------------------------------------------------------------------
// SPDX 2.x JSON — packages[].{name, versionInfo, supplier, externalRefs}
// ---------------------------------------------------------------------------

function parseSpdx(doc: Record<string, unknown>): SbomComponent[] {
  // SPDX spec: top-level "spdxVersion" (e.g. "SPDX-2.3") identifies the format.
  if (typeof doc.spdxVersion !== 'string' || !doc.spdxVersion.startsWith('SPDX-')) {
    throw new SbomParseError(
      'Document lacks spdxVersion — not a valid SPDX JSON document',
      'missing_spdx_version',
    );
  }
  const packages = doc.packages;
  if (!Array.isArray(packages)) {
    throw new SbomParseError('SPDX document missing packages array', 'missing_packages');
  }
  return packages.map((p): SbomComponent => {
    const pkg = p as Record<string, unknown>;
    const refs = Array.isArray(pkg.externalRefs) ? pkg.externalRefs : [];
    const purl = refs.find((r) => (r as Record<string, unknown>)?.referenceType === 'purl') as
      | Record<string, unknown>
      | undefined;
    const cpe = refs.find((r) =>
      ['cpe23Type', 'cpe22Type'].includes(
        String((r as Record<string, unknown>)?.referenceType ?? ''),
      ),
    ) as Record<string, unknown> | undefined;
    return {
      name: String(pkg.name ?? ''),
      version: String(pkg.versionInfo ?? ''),
      supplier: extractSpdxSupplier(pkg.supplier),
      purl: purl ? String(purl.referenceLocator ?? '') : undefined,
      cpe: cpe ? String(cpe.referenceLocator ?? '') : undefined,
    };
  });
}

function extractSpdxSupplier(supplier: unknown): string | undefined {
  if (typeof supplier === 'string') return supplier.split('Supplier:')[1]?.trim() ?? supplier;
  return undefined;
}

// ---------------------------------------------------------------------------
// CycloneDX 1.x JSON — components[].{name, version, supplier, purl, cpe}
// ---------------------------------------------------------------------------

function parseCycloneDx(doc: Record<string, unknown>): SbomComponent[] {
  if (typeof doc.bomFormat !== 'string' || doc.bomFormat !== 'CycloneDX') {
    throw new SbomParseError(
      'Document lacks bomFormat=CycloneDX — not a valid CycloneDX JSON document',
      'missing_bom_format',
    );
  }
  const components = doc.components;
  if (!Array.isArray(components)) {
    throw new SbomParseError('CycloneDX document missing components array', 'missing_components');
  }
  return components.map((c): SbomComponent => {
    const comp = c as Record<string, unknown>;
    const supplier = comp.supplier as Record<string, unknown> | undefined;
    return {
      name: String(comp.name ?? ''),
      version: String(comp.version ?? ''),
      supplier: supplier?.name ? String(supplier.name) : undefined,
      purl: comp.purl ? String(comp.purl) : undefined,
      cpe: comp.cpe ? String(comp.cpe) : undefined,
    };
  });
}

/**
 * Deterministic content hash over the canonical component payload. Used for
 * dedup (same SBOM imported twice → same hash) and version tracking.
 */
export function computeContentHash(components: SbomComponent[]): string {
  const canonical = components
    .map((c) => `${c.name}@${c.version}|${c.purl ?? ''}|${c.cpe ?? ''}|${c.supplier ?? ''}`)
    .sort()
    .join('\n');
  return createHash('sha256').update(canonical).digest('hex');
}
