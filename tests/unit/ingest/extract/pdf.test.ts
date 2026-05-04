import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock pdf-parse before importing the extractor
vi.mock('pdf-parse', () => ({
  default: vi.fn(),
}));

import pdfParse from 'pdf-parse';
import { extractPdf } from '../../../../lib/ingest/extract/pdf';

const mockPdfParse = vi.mocked(pdfParse);

describe('extractPdf', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('extracts text from PDF buffer', async () => {
    mockPdfParse.mockResolvedValue({ text: 'Device Description\nIntended Use' } as never);
    const result = await extractPdf(Buffer.from('fake-pdf'));
    expect(result).toBe('Device Description\nIntended Use');
  });

  it('trims whitespace from extracted text', async () => {
    mockPdfParse.mockResolvedValue({ text: '  hello world  \n\n' } as never);
    const result = await extractPdf(Buffer.from('fake-pdf'));
    expect(result).toBe('hello world');
  });

  it('throws ExtractError when pdf-parse fails', async () => {
    mockPdfParse.mockRejectedValue(new Error('Encrypted PDF'));
    await expect(extractPdf(Buffer.from('bad-pdf'))).rejects.toThrow();
  });

  it('throws ExtractError for empty PDF text', async () => {
    mockPdfParse.mockResolvedValue({ text: '' } as never);
    await expect(extractPdf(Buffer.from('empty-pdf'))).rejects.toThrow();
  });
});
