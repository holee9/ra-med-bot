// @MX:NOTE [AUTO] Certificate chunker — single chunk with metadata extraction.
// @MX:SPEC SPEC-REGULA-DOCINGEST-001 (REQ-DOC-051)
import { DocClass } from '../doc-class';
import type { Chunk, ChunkerFn } from './base';
import { countTokens } from './base';

interface CertMeta {
  fdaKNumber?: string;
  deviceName?: string;
  decisionDate?: string;
  productCode?: string;
  regulatoryClass?: string;
}

function extractCertMeta(text: string): CertMeta {
  const meta: CertMeta = {};

  const kMatch = text.match(/K\s*(?:Number|No\.?|#)?\s*:?\s*(K\d{6})/i);
  if (kMatch?.[1]) meta.fdaKNumber = kMatch[1];

  const deviceMatch = text.match(/Device\s*Name\s*:?\s*(.+)/i);
  if (deviceMatch?.[1]) meta.deviceName = deviceMatch[1].trim();

  const dateMatch = text.match(/(?:Decision|Issue|Approval)\s*Date\s*:?\s*([\d-/]+)/i);
  if (dateMatch?.[1]) meta.decisionDate = dateMatch[1].trim();

  const codeMatch = text.match(/Product\s*Code\s*:?\s*([A-Z]{3})/i);
  if (codeMatch?.[1]) meta.productCode = codeMatch[1];

  const classMatch = text.match(/(?:Regulatory\s*)?Class\s*:?\s*(I{1,3}|[123])/i);
  if (classMatch?.[1]) {
    const c = classMatch[1].replace('1', 'I').replace('2', 'II').replace('3', 'III');
    meta.regulatoryClass = c;
  }

  return meta;
}

/**
 * Single-chunk certificate: the entire body is one chunk with extracted metadata.
 */
export const chunkCertificate: ChunkerFn = (text, _metadata): Chunk[] => {
  const certMeta = extractCertMeta(text);
  return [
    {
      text: text.trim(),
      metadata: {
        docClass: DocClass.issued_certificate,
        sectionPath: 'Certificate Body',
        tokenCount: countTokens(text),
        ...certMeta,
      },
    },
  ];
};
