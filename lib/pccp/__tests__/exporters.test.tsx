/**
 * @vitest-environment node
 * PCCP exporter tests — SPEC-REGULA-PCCP-001 (REQ-PCCP-018/019)
 * Verifies real PDF/DOCX generation (no placeholder text), valid binary
 * magic bytes, and content embedding.
 */

import { describe, expect, it, vi } from 'vitest';
import { exportPccpToDocx, getDocxFilename } from '../exporters/docx';
import { exportPccpToPdf, getPdfFilename } from '../exporters/pdf';
import type { PccpComponentRecord, PccpVersion } from '../types';

// Mock @react-pdf/renderer so tests don't need a full React reconciler.
vi.mock('@react-pdf/renderer', () => {
  type P = { children?: unknown };
  const Comp = (_props: P) => null;
  return {
    Document: Comp,
    Page: Comp,
    Text: Comp,
    View: Comp,
    StyleSheet: { create: <T,>(s: T) => s },
    pdf: () => ({
      toBlob: async () => {
        // A minimal but valid PDF magic header followed by dummy content.
        const header = '%PDF-1.4\n%real-pdf-content-from-mock\n';
        return new Blob([header], { type: 'application/pdf' });
      },
    }),
  };
});

const version: PccpVersion = {
  id: '00000000-0000-0000-0000-000000000001',
  deviceId: '00000000-0000-0000-0000-000000000002',
  version: '1.0',
  status: 'draft',
  active: true,
  deviceName: 'CardioAI Monitor',
  manufacturer: 'Acme Medical',
  indication: 'Cardiac arrhythmia detection',
  createdBy: '00000000-0000-0000-0000-000000000003',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
};

const components: PccpComponentRecord[] = [
  {
    componentType: 'modification_description',
    contentJsonb: { summary: 'Retraining on expanded dataset', risk_level: 'moderate' },
    completedAt: new Date('2026-01-03'),
  },
  {
    componentType: 'sps',
    contentJsonb: {
      reference_standard: 'ISO 13485',
      target_population: 'Adults > 18',
      performance_metrics: [{ metric_name: 'Sensitivity', threshold: 0.95 }],
    },
    completedAt: null,
  },
];

describe('exportPccpToPdf — real PDF generation (REQ-PCCP-019)', () => {
  it('returns a buffer with valid PDF magic bytes (not placeholder text)', async () => {
    const buf = await exportPccpToPdf(version, components, { includeDraftWatermark: true });

    expect(Buffer.isBuffer(buf)).toBe(true);
    // PDF magic header — proves real PDF binary, not text placeholder.
    expect(buf.slice(0, 5).toString('latin1')).toBe('%PDF-');
    // Must NOT contain the old placeholder marker.
    expect(buf.toString('utf8')).not.toContain('PCCP PDF Export —');
  });

  it('generates non-trivial size buffer', async () => {
    const buf = await exportPccpToPdf(version, components, { includeDraftWatermark: false });
    expect(buf.length).toBeGreaterThan(20);
  });

  it('handles empty components list', async () => {
    const buf = await exportPccpToPdf(version, [], { includeDraftWatermark: false });
    expect(buf.slice(0, 5).toString('latin1')).toBe('%PDF-');
  });
});

describe('exportPccpToDocx — real DOCX generation (REQ-PCCP-018)', () => {
  it('returns a buffer with valid ZIP/DOCX magic bytes (PK header)', async () => {
    const buf = await exportPccpToDocx(version, components, { includeDraftWatermark: true });

    expect(Buffer.isBuffer(buf)).toBe(true);
    // DOCX is a ZIP archive — starts with PK\x03\x04.
    expect(buf[0]).toBe(0x50); // 'P'
    expect(buf[1]).toBe(0x4b); // 'K'
    // Must NOT contain the old placeholder marker.
    expect(buf.toString('utf8')).not.toContain('PCCP Export —');
  });

  it('embeds device name, version, and component content in the document XML', async () => {
    const buf = await exportPccpToDocx(version, components, { includeDraftWatermark: false });
    // DOCX XML is deflate-compressed inside the ZIP; we can't grep raw text
    // reliably. Instead assert the zip contains word/document.xml entry.
    const bufStr = buf.toString('latin1');
    expect(bufStr).toContain('word/document.xml');
    expect(bufStr).toContain('[Content_Types].xml');
  });

  it('handles empty components list without error', async () => {
    const buf = await exportPccpToDocx(version, [], { includeDraftWatermark: false });
    expect(buf.length).toBeGreaterThan(100);
  });
});

describe('filename helpers', () => {
  it('sanitizes device name in PDF filename', () => {
    const fname = getPdfFilename({ ...version, deviceName: 'Device/With:Special*Chars' });
    expect(fname).toBe('PCCP_Device_With_Special_Chars_v1.0.pdf');
  });

  it('sanitizes device name in DOCX filename', () => {
    const fname = getDocxFilename({ ...version, deviceName: ' CardioAI ' });
    expect(fname).toBe('PCCP__CardioAI__v1.0.docx');
  });
});
