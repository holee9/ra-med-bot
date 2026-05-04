import { describe, expect, it } from 'vitest';
import { chunkCertificate } from '../../../../lib/ingest/chunkers/certificate';
import { DocClass } from '../../../../lib/ingest/doc-class';

const SAMPLE_CERT = `
UNITED STATES FOOD AND DRUG ADMINISTRATION
510(k) CLEARANCE LETTER

Device Name: VitalMonitor Pro
K Number: K241234
Product Code: DXN
Regulatory Class: II
Decision Date: 2024-03-15

This is to certify that the above-mentioned device has received 510(k) clearance.
`;

const SAMPLE_ISO_CERT = `
ISO 13485:2016 Certificate

Certificate Number: ISO-2024-5678
Organization: MedDevice Corp
Scope: Design and manufacture of cardiovascular monitoring devices
Issue Date: 2024-01-01
Expiry Date: 2027-01-01
`;

describe('chunkCertificate', () => {
  it('returns a single chunk for the entire body', () => {
    const chunks = chunkCertificate(SAMPLE_CERT, {});
    expect(chunks).toHaveLength(1);
  });

  it('chunk has docClass issued_certificate', () => {
    const chunks = chunkCertificate(SAMPLE_CERT, {});
    expect(chunks[0]?.metadata.docClass).toBe(DocClass.issued_certificate);
  });

  it('extracts fda_k_number from metadata_json', () => {
    const chunks = chunkCertificate(SAMPLE_CERT, {});
    const meta = chunks[0]?.metadata;
    expect(meta).toBeDefined();
  });

  it('chunk text contains the full content', () => {
    const chunks = chunkCertificate(SAMPLE_CERT, {});
    expect(chunks[0]?.text).toContain('VitalMonitor');
  });

  it('handles ISO certificate without FDA K number', () => {
    const chunks = chunkCertificate(SAMPLE_ISO_CERT, {});
    expect(chunks).toHaveLength(1);
    expect(chunks[0]?.text).toContain('ISO');
  });
});
