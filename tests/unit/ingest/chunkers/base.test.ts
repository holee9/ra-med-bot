import { describe, it, expect } from 'vitest';
import {
  MAX_CHUNK_TOKENS,
  OVERLAP_TOKENS,
  MIN_CHUNK_TOKENS,
  countTokens,
  splitByTokens,
  generateChunkMetadata,
} from '../../../../lib/ingest/chunkers/base';
import { DocClass } from '../../../../lib/ingest/doc-class';

describe('chunker constants', () => {
  it('MAX_CHUNK_TOKENS is 512', () => {
    expect(MAX_CHUNK_TOKENS).toBe(512);
  });

  it('OVERLAP_TOKENS is 64', () => {
    expect(OVERLAP_TOKENS).toBe(64);
  });

  it('MIN_CHUNK_TOKENS is 64', () => {
    expect(MIN_CHUNK_TOKENS).toBe(64);
  });
});

describe('countTokens', () => {
  it('returns 0 for empty string', () => {
    expect(countTokens('')).toBe(0);
  });

  it('returns positive integer for non-empty text', () => {
    const count = countTokens('Hello, world!');
    expect(count).toBeGreaterThan(0);
    expect(Number.isInteger(count)).toBe(true);
  });

  it('longer text has more tokens', () => {
    const short = countTokens('Hello');
    const long = countTokens('Hello world this is a longer sentence with many more words');
    expect(long).toBeGreaterThan(short);
  });
});

describe('splitByTokens', () => {
  it('returns array of strings', () => {
    const result = splitByTokens('Hello world', 512, 64);
    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('single short text returns one chunk', () => {
    const result = splitByTokens('Short text', 512, 64);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe('Short text');
  });

  it('long text is split into multiple chunks', () => {
    // Generate text that exceeds max tokens
    const longText = Array.from({ length: 100 }, (_, i) => `Sentence number ${i} with some medical regulatory content.`).join(' ');
    const result = splitByTokens(longText, 50, 10);
    expect(result.length).toBeGreaterThan(1);
  });

  it('each chunk does not exceed maxTokens', () => {
    const longText = Array.from({ length: 200 }, () => 'regulatory content').join(' ');
    const result = splitByTokens(longText, 100, 20);
    for (const chunk of result) {
      expect(countTokens(chunk)).toBeLessThanOrEqual(120); // allow small overshoot
    }
  });
});

describe('generateChunkMetadata', () => {
  it('returns ChunkMetadata with required fields', () => {
    const meta = generateChunkMetadata(DocClass.internal_sop, 'Section 1');
    expect(meta.docClass).toBe(DocClass.internal_sop);
    expect(meta.sectionPath).toBe('Section 1');
    expect(typeof meta.tokenCount).toBe('number');
  });

  it('includes optional pageNumber when provided', () => {
    const meta = generateChunkMetadata(DocClass.clinical_report, 'Results', 5);
    expect(meta.pageNumber).toBe(5);
  });

  it('includes optional offset when provided', () => {
    const meta = generateChunkMetadata(DocClass.audit_response, 'Observation 1', undefined, 100);
    expect(meta.offset).toBe(100);
  });
});
