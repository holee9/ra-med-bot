import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock pdf-parse first to avoid import errors
vi.mock('pdf-parse', () => ({
  default: vi.fn().mockResolvedValue({ text: 'PDF text content' }),
}));

// Mock the individual extractors
vi.mock('../../../../lib/ingest/extract/pdf', () => ({
  extractPdf: vi.fn().mockResolvedValue('PDF text content'),
  ExtractError: class ExtractError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'ExtractError';
    }
  },
}));
vi.mock('../../../../lib/ingest/extract/docx', () => ({
  extractDocx: vi.fn().mockResolvedValue('DOCX text content'),
}));
vi.mock('../../../../lib/ingest/extract/xlsx', () => ({
  extractXlsx: vi.fn().mockResolvedValue('XLSX text content'),
}));

import { extractText } from '../../../../lib/ingest/extract/index';

describe('extractText (MIME dispatcher)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('dispatches application/pdf to extractPdf', async () => {
    const result = await extractText(Buffer.from('data'), 'application/pdf');
    expect(result).toBe('PDF text content');
  });

  it('dispatches application/vnd.openxmlformats-officedocument.wordprocessingml.document to extractDocx', async () => {
    const result = await extractText(
      Buffer.from('data'),
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    expect(result).toBe('DOCX text content');
  });

  it('dispatches application/vnd.openxmlformats-officedocument.spreadsheetml.sheet to extractXlsx', async () => {
    const result = await extractText(
      Buffer.from('data'),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    expect(result).toBe('XLSX text content');
  });

  it('throws for unsupported MIME type', async () => {
    await expect(
      extractText(Buffer.from('data'), 'text/html'),
    ).rejects.toThrow();
  });

  it('unsupported MIME error message contains unsupported or 415', async () => {
    let errorMessage = '';
    try {
      await extractText(Buffer.from('data'), 'text/html');
    } catch (err) {
      errorMessage = (err as Error).message;
    }
    expect(errorMessage.toLowerCase()).toMatch(/unsupported|415/);
  });

  it('throws for empty MIME type', async () => {
    await expect(
      extractText(Buffer.from('data'), ''),
    ).rejects.toThrow();
  });
});
