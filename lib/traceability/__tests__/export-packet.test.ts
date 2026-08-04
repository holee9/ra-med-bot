// @vitest-environment node
// @MX:NOTE [AUTO] Unit tests for lib/traceability/export-packet (SPEC-REGULA-TRACEABILITY-001).
// @MX:SPEC SPEC-REGULA-TRACEABILITY-001 (REQ-TRACEABILITY-008)

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { EvidencePacket } from '../evidence-packet';

const hubExport = vi.fn(async () => ({
  success: true,
  content: 'PDF_BYTES',
  format: 'pdf',
  size: 9,
  filename: 'evidence-packet-DHF-001.pdf',
}));

vi.mock('@/lib/export/export-hub', () => ({ defaultExportHub: { export: hubExport } }));

const { exportPacket, packetFilename, packetTitle, packetToMarkdown, sanitizeFilename } =
  await import('../export-packet');

const packet: EvidencePacket = {
  deliverable: {
    relation: 'root',
    nodeType: 'deliverable',
    refTable: 'design_history_file',
    refId: 'DHF-001',
    authority: 'internal',
    version: '1.0',
    artifactHash: null,
    stale: false,
    children: [
      {
        relation: 'trace',
        nodeType: 'module',
        refTable: 'module',
        refId: 'M-1',
        authority: null,
        version: null,
        artifactHash: 'abc123def456',
        stale: false,
        children: [],
      },
    ],
  },
  issues: [{ kind: 'gap', detail: 'Missing traceability link' }],
} as unknown as EvidencePacket;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sanitizeFilename (L3 header-injection defense)', () => {
  it('strips path separators and CRLF', () => {
    expect(sanitizeFilename('evil\r\n../../etc')).toBe('evil.._.._etc');
  });

  it('removes double quotes', () => {
    expect(sanitizeFilename('file"name".md')).toBe('filename.md');
  });

  it('collapses multiple underscores', () => {
    expect(sanitizeFilename('a___b')).toBe('a_b');
  });

  it('caps length at 128', () => {
    expect(sanitizeFilename('x'.repeat(200)).length).toBe(128);
  });

  it('defaults to evidence-packet for empty input', () => {
    expect(sanitizeFilename('')).toBe('evidence-packet');
  });
});

describe('packetTitle + packetFilename', () => {
  it('packetTitle uses refTable:refId', () => {
    expect(packetTitle(packet)).toBe('Evidence Packet — design_history_file:DHF-001');
  });

  it('packetFilename produces a sanitized filename with the right extension', () => {
    expect(packetFilename(packet, 'pdf')).toBe('evidence-packet-DHF-001.pdf');
    expect(packetFilename(packet, 'md')).toBe('evidence-packet-DHF-001.md');
  });
});

describe('packetToMarkdown', () => {
  it('renders the deliverable heading + child nodes + compliance notes', () => {
    const md = packetToMarkdown(packet);
    expect(md).toContain('Evidence Packet');
    expect(md).toContain('## Deliverable');
    expect(md).toContain('**trace**');
    expect(md).toContain('sha256:abc123def4');
    expect(md).toContain('## Compliance Notes');
    expect(md).toContain('[gap] Missing traceability link');
  });

  it('appends usage restrictions when provided', () => {
    const md = packetToMarkdown(packet, [{ sourceId: 's-1', notice: 'Abstract only' }]);
    expect(md).toContain('## Source Usage Restrictions');
    expect(md).toContain('Abstract only');
  });
});

describe('exportPacket', () => {
  it('delegates to defaultExportHub with the right format + content', async () => {
    const result = await exportPacket(packet, 'pdf');
    expect(result.success).toBe(true);
    expect(hubExport).toHaveBeenCalledTimes(1);
    const calls = hubExport.mock.calls as unknown[][];
    expect(calls[0]?.[1]).toBeDefined();
  });
});
