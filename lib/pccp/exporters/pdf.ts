// @MX:SPEC SPEC-REGULA-PCCP-001 (REQ-PCCP-019)
// PCCP PDF export — stub returning placeholder buffer.
// Full PDF generation (react-pdf or puppeteer) deferred until PCCP-002.

import type { PccpComponentType, PccpVersion } from '../types';

export interface PccpPdfExportOptions {
  includeDraftWatermark: boolean;
}

/**
 * Generates a PDF buffer for the given PCCP version and its components.
 * Current implementation returns a minimal text placeholder.
 * Replace with real PDF generation when PCCP-002 scope is confirmed.
 */
export async function exportPccpToPdf(
  _version: PccpVersion,
  _components: PccpComponentType[],
  _options: PccpPdfExportOptions,
): Promise<Buffer> {
  // Placeholder: real PDF generation in PCCP-002.
  const placeholder = `PCCP PDF Export — ${_version.deviceName} v${_version.version}\n[DRAFT WATERMARK: ${_options.includeDraftWatermark}]`;
  return Buffer.from(placeholder, 'utf8');
}

export function getPdfFilename(version: PccpVersion): string {
  const safe = version.deviceName.replace(/[^a-zA-Z0-9-_]/g, '_');
  return `PCCP_${safe}_v${version.version}.pdf`;
}
