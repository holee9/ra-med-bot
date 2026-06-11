// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-018)
// PCCP DOCX export — stub returning placeholder buffer.
// Full docx generation (docx library) deferred until PCCP-002.

import type { PccpComponent, PccpVersion } from '../types';

export interface PccpDocxExportOptions {
  includeDraftWatermark: boolean;
}

/**
 * Generates a DOCX buffer for the given PCCP version and its components.
 * Current implementation returns a minimal text placeholder.
 * Replace with real docx generation when PCCP-002 scope is confirmed.
 */
export async function exportPccpToDocx(
  _version: PccpVersion,
  _components: PccpComponent[],
  _options: PccpDocxExportOptions,
): Promise<Buffer> {
  // Placeholder: real DOCX generation in PCCP-002.
  const placeholder = `PCCP Export — ${_version.deviceName} v${_version.version}\n[DRAFT WATERMARK: ${_options.includeDraftWatermark}]`;
  return Buffer.from(placeholder, 'utf8');
}

export function getDocxFilename(version: PccpVersion): string {
  const safe = version.deviceName.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `PCCP_${safe}_v${version.version}.docx`;
}
