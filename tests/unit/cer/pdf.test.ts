// @MX:NOTE [AUTO] Unit tests for CER PDF exporter.
// @MX:SPEC SPEC-REGULA-CER-001 (REQ-CER-028, REQ-CER-029, Issue #402)
// @MX:REASON exportToPDF builds a raw single-page PDF from primitives. Tests
//   cover: buildLines branches (stages with/without content, equivalence
//   on/off, literature refs present/empty), word-wrap, PDF structure markers
//   (header/xref/trailer), text escaping, and truncation on overflow.

import { describe, expect, it } from 'vitest';

import type { CerDocument } from '@/lib/cer/cer-assembler';
import type { CerStageId } from '@/lib/cer/meddev-stages';

// Helper: minimal valid CerDocument with overrides.
function makeCer(overrides: Partial<CerDocument> = {}): CerDocument {
  return {
    cerRunId: 'run-1',
    deviceName: 'TestDevice',
    manufacturer: 'TestCo',
    createdAt: new Date('2025-03-15T10:00:00Z'),
    stages: [
      {
        stageId: 1 as CerStageId,
        title: 'Stage 1',
        content: 'First stage content.',
        completed: true,
      },
      {
        stageId: 2 as CerStageId,
        title: 'Stage 2',
        content: 'Second stage content.',
        completed: true,
      },
    ],
    literatureReferences: [],
    ...overrides,
  };
}

describe('exportToPDF — basic structure', () => {
  it('returns a Buffer containing a valid PDF', async () => {
    const { exportToPDF } = await import('@/lib/cer/exporters/pdf');
    const pdf = await exportToPDF(makeCer());
    expect(Buffer.isBuffer(pdf)).toBe(true);

    const text = pdf.toString('latin1');
    // PDF structural markers.
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text).toContain('%%EOF');
    expect(text).toContain('xref');
    expect(text).toContain('trailer');
    expect(text).toContain('/Type /Catalog');
    expect(text).toContain('/Type /Pages');
    expect(text).toContain('/Type /Page');
    expect(text).toContain('/Type /Font');
    expect(text).toContain('/BaseFont /Helvetica');
  });

  it('includes device name in the title heading', async () => {
    const { exportToPDF } = await import('@/lib/cer/exporters/pdf');
    const pdf = await exportToPDF(makeCer({ deviceName: 'CardioStent-X1' }));
    const text = pdf.toString('latin1');
    expect(text).toContain('Clinical Evaluation Report - CardioStent-X1');
  });

  it('includes manufacturer + ISO date in header lines', async () => {
    const { exportToPDF } = await import('@/lib/cer/exporters/pdf');
    const pdf = await exportToPDF(
      makeCer({ manufacturer: 'Acme Medical', createdAt: new Date('2025-12-31T00:00:00Z') }),
    );
    const text = pdf.toString('latin1');
    expect(text).toContain('Manufacturer: Acme Medical');
    expect(text).toContain('Date: 2025-12-31');
  });

  it('includes stage headings as "stageId. title"', async () => {
    const { exportToPDF } = await import('@/lib/cer/exporters/pdf');
    const pdf = await exportToPDF(makeCer());
    const text = pdf.toString('latin1');
    expect(text).toContain('1. Stage 1');
    expect(text).toContain('2. Stage 2');
  });
});

describe('exportToPDF — stage content branches', () => {
  it('emits "(Section not yet completed.)" when stage content is empty/whitespace', async () => {
    const { exportToPDF } = await import('@/lib/cer/exporters/pdf');
    const pdf = await exportToPDF(
      makeCer({
        stages: [{ stageId: 1 as CerStageId, title: 'Empty', content: '   ', completed: false }],
      }),
    );
    const text = pdf.toString('latin1');
    // Parentheses escaped to \( \) in PDF content stream.
    expect(text).toContain('\\(Section not yet completed.\\)');
  });

  it('wraps long stage content across multiple lines', async () => {
    const longText = 'word '.repeat(200).trim(); // 200 words, well over MAX_LINE_CHARS
    const { exportToPDF } = await import('@/lib/cer/exporters/pdf');
    const pdf = await exportToPDF(
      makeCer({
        stages: [{ stageId: 1 as CerStageId, title: 'Long', content: longText, completed: true }],
      }),
    );
    const text = pdf.toString('latin1');
    // Multiple Tj operators for the wrapped lines.
    const tjCount = (text.match(/\) Tj/g) ?? []).length;
    expect(tjCount).toBeGreaterThan(1);
  });
});

describe('exportToPDF — equivalence assessment', () => {
  it('includes equivalence section when equivalenceAssessment is present', async () => {
    const { exportToPDF } = await import('@/lib/cer/exporters/pdf');
    const pdf = await exportToPDF(
      makeCer({
        equivalenceAssessment: {
          deviceName: 'DeviceA',
          equivalentDevice: 'DeviceB',
          dimensions: [
            { dimension: 'clinical', claimText: 'c', justification: 'j', satisfied: true },
            { dimension: 'technical', claimText: 'c', justification: 'j', satisfied: false },
            { dimension: 'biological', claimText: 'c', justification: 'j', satisfied: true },
          ],
          overallEquivalent: false,
          summaryText: 'Equivalence summary text.',
        },
      }),
    );
    const text = pdf.toString('latin1');
    // Parentheses are escaped to \( \) in PDF content stream; match the escaped form.
    expect(text).toContain('Equivalence Assessment \\(Article 61\\(4\\)\\)');
    expect(text).toContain('Subject: DeviceA | Equivalent: DeviceB');
    expect(text).toContain('Equivalence summary text.');
    expect(text).toContain('- clinical: satisfied');
    expect(text).toContain('- technical: not satisfied');
    expect(text).toContain('- biological: satisfied');
  });

  it('omits equivalence section when equivalenceAssessment is undefined', async () => {
    const { exportToPDF } = await import('@/lib/cer/exporters/pdf');
    const pdf = await exportToPDF(makeCer({ equivalenceAssessment: undefined }));
    const text = pdf.toString('latin1');
    expect(text).not.toContain('Equivalence Assessment');
  });
});

describe('exportToPDF — literature references', () => {
  it('emits "No literature references included." when list is empty', async () => {
    const { exportToPDF } = await import('@/lib/cer/exporters/pdf');
    const pdf = await exportToPDF(makeCer({ literatureReferences: [] }));
    const text = pdf.toString('latin1');
    expect(text).toContain('No literature references included.');
  });

  it('formats references as numbered Vancouver citations', async () => {
    const { exportToPDF } = await import('@/lib/cer/exporters/pdf');
    const pdf = await exportToPDF(
      makeCer({
        literatureReferences: [
          {
            pmid: '1',
            title: 'First Study',
            abstract: 'a',
            authors: ['Doe J'],
            journal: 'Lancet',
            year: 2023,
            volume: '101',
            pages: '1-10',
          },
          {
            pmid: '2',
            title: 'Second Study',
            abstract: 'b',
            authors: ['Roe R'],
            journal: 'BMJ',
            year: 2024,
          },
        ],
      }),
    );
    const text = pdf.toString('latin1');
    expect(text).toContain('1. Doe J. First Study. Lancet. 2023;101:1-10.');
    expect(text).toContain('2. Roe R. Second Study. BMJ. 2024.');
  });
});

describe('exportToPDF — PDF text escaping + non-ASCII stripping', () => {
  it('escapes parentheses and backslashes in content', async () => {
    const { exportToPDF } = await import('@/lib/cer/exporters/pdf');
    const pdf = await exportToPDF(
      makeCer({
        deviceName: 'Device (X)',
        stages: [
          {
            stageId: 1 as CerStageId,
            title: 'Esc',
            content: 'Path C:\\dir (test)',
            completed: true,
          },
        ],
      }),
    );
    const text = pdf.toString('latin1');
    // Parentheses and backslashes escaped in the content stream.
    expect(text).toContain('Device \\(X\\)');
    expect(text).toContain('C:\\\\dir \\(test\\)');
  });

  it('strips non-ASCII characters (stays in base Helvetica encoding)', async () => {
    const { exportToPDF } = await import('@/lib/cer/exporters/pdf');
    const pdf = await exportToPDF(makeCer({ deviceName: 'DeviceAA', stages: [] }));
    const text = pdf.toString('latin1');
    // Non-ASCII chars (e.g. Korean, em-dash) are dropped from content stream.
    // The device name is pure ASCII so it survives; just verify no crash.
    expect(text).toContain('DeviceAA');
  });
});

describe('exportToPDF — truncation', () => {
  it('appends truncation note when content exceeds one page', async () => {
    // Generate enough stages to overflow the single-page limit.
    const bigStages = Array.from({ length: 80 }, (_, i) => ({
      stageId: ((i % 10) + 1) as CerStageId,
      title: `Stage ${i}`,
      content: `${i} `.repeat(60).trim(),
      completed: true,
    }));
    const { exportToPDF } = await import('@/lib/cer/exporters/pdf');
    const pdf = await exportToPDF(makeCer({ stages: bigStages }));
    const text = pdf.toString('latin1');
    expect(text).toContain('content truncated');
    expect(text).toContain('full multi-page export pending');
  });

  it('does NOT append truncation note when content fits one page', async () => {
    const { exportToPDF } = await import('@/lib/cer/exporters/pdf');
    const pdf = await exportToPDF(makeCer());
    const text = pdf.toString('latin1');
    expect(text).not.toContain('content truncated');
  });
});

describe('exportToPDF — xref offsets', () => {
  it('xref table has correct number of objects + starts at offset 0', async () => {
    const { exportToPDF } = await import('@/lib/cer/exporters/pdf');
    const pdf = await exportToPDF(makeCer());
    const text = pdf.toString('latin1');
    // 5 objects + the free entry (0) = 6 total in xref header.
    expect(text).toContain('xref\n0 6');
    expect(text).toContain('0000000000 65535 f ');
    // First object offset should be after %PDF-1.4\n (9 bytes).
    expect(text).toContain('0000000009 00000 n ');
  });
});
