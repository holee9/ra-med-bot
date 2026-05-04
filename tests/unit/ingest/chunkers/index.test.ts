import { describe, it, expect } from 'vitest';
import { DocClass } from '../../../../lib/ingest/doc-class';
import { chunkerRegistry, chunk } from '../../../../lib/ingest/chunkers/index';

describe('chunkerRegistry', () => {
  it('has an entry for all 8 DocClass values', () => {
    const classes = Object.values(DocClass);
    expect(classes).toHaveLength(8);
    for (const cls of classes) {
      expect(chunkerRegistry[cls], `Missing chunker for ${cls}`).toBeDefined();
      expect(typeof chunkerRegistry[cls]).toBe('function');
    }
  });
});

describe('chunk', () => {
  it('dispatches to correct chunker for each DocClass', () => {
    const classes = Object.values(DocClass);
    for (const cls of classes) {
      const chunks = chunk(cls, 'Sample regulatory text for testing purposes.', {});
      expect(Array.isArray(chunks), `chunk() for ${cls} should return array`).toBe(true);
    }
  });

  it('returns chunks with correct docClass in metadata', () => {
    const classes = Object.values(DocClass);
    for (const cls of classes) {
      const chunks = chunk(cls, 'Sample text for testing.', {});
      if (chunks.length > 0) {
        expect(chunks[0]!.metadata.docClass).toBe(cls);
      }
    }
  });
});
