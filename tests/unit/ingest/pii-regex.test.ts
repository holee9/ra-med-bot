// RED Phase: Tests for lib/ingest/pii/regex.ts
// SPEC-REGULA-DOCINGEST-001 REQ-DOC-8B-4

import { describe, expect, it } from 'vitest';
import { detectPii, redactText } from '@/lib/ingest/pii/regex';

describe('detectPii - SSN', () => {
  it('should detect SSN pattern', () => {
    const matches = detectPii('Patient SSN is 123-45-6789 in the record.');
    const ssnMatches = matches.filter((m) => m.type === 'ssn');
    expect(ssnMatches.length).toBeGreaterThan(0);
    expect(ssnMatches[0]?.value).toBe('123-45-6789');
  });

  it('should not detect partial SSN as SSN', () => {
    const matches = detectPii('Number: 123-45');
    const ssnMatches = matches.filter((m) => m.type === 'ssn');
    expect(ssnMatches.length).toBe(0);
  });
});

describe('detectPii - Email', () => {
  it('should detect email address', () => {
    const matches = detectPii('Contact us at patient@hospital.com for more info.');
    const emailMatches = matches.filter((m) => m.type === 'email');
    expect(emailMatches.length).toBeGreaterThan(0);
    expect(emailMatches[0]?.value).toBe('patient@hospital.com');
  });

  it('should not detect invalid email', () => {
    const matches = detectPii('This is not@valid because no domain.');
    const emailMatches = matches.filter((m) => m.type === 'email');
    // Incomplete emails (no TLD) should not be detected or have lower confidence
    // The regex requires at least 2-char TLD
    const validEmails = emailMatches.filter((m) => m.confidence > 0.5);
    expect(validEmails.length).toBe(0);
  });
});

describe('detectPii - Phone', () => {
  it('should detect US phone number', () => {
    const matches = detectPii('Call us at (555) 123-4567 for appointment.');
    const phoneMatches = matches.filter((m) => m.type === 'phone');
    expect(phoneMatches.length).toBeGreaterThan(0);
  });

  it('should not detect random 7-digit number as phone', () => {
    const matches = detectPii('Reference number: 1234567');
    const phoneMatches = matches.filter((m) => m.type === 'phone');
    expect(phoneMatches.length).toBe(0);
  });
});

describe('detectPii - Credit Card', () => {
  it('should detect credit card number', () => {
    const matches = detectPii('Card: 4111 1111 1111 1111 was charged.');
    const ccMatches = matches.filter((m) => m.type === 'credit_card');
    expect(ccMatches.length).toBeGreaterThan(0);
  });

  it('should not detect 8-digit number as credit card', () => {
    const matches = detectPii('Order number: 12345678');
    const ccMatches = matches.filter((m) => m.type === 'credit_card');
    expect(ccMatches.length).toBe(0);
  });
});

describe('detectPii - Date of Birth', () => {
  it('should detect date of birth pattern', () => {
    const matches = detectPii('DOB: 01/15/1990 patient record.');
    const dobMatches = matches.filter((m) => m.type === 'dob');
    expect(dobMatches.length).toBeGreaterThan(0);
  });

  it('should not detect invalid date format', () => {
    const matches = detectPii('Version 2.5.2024');
    const dobMatches = matches.filter((m) => m.type === 'dob');
    expect(dobMatches.length).toBe(0);
  });
});

describe('detectPii - ZIP code', () => {
  it('should detect ZIP code', () => {
    const matches = detectPii('Address: 90210 Beverly Hills.');
    const zipMatches = matches.filter((m) => m.type === 'zip');
    expect(zipMatches.length).toBeGreaterThan(0);
  });
});

describe('detectPii - MRN', () => {
  it('should detect medical record number', () => {
    const matches = detectPii('MRN: 1234567 admitted to ICU.');
    const mrnMatches = matches.filter((m) => m.type === 'mrn');
    expect(mrnMatches.length).toBeGreaterThan(0);
  });

  it('should not detect short numbers as MRN', () => {
    const matches = detectPii('Item count: 12345');
    const mrnMatches = matches.filter((m) => m.type === 'mrn');
    expect(mrnMatches.length).toBe(0);
  });
});

describe('detectPii - NPI', () => {
  it('should detect NPI number', () => {
    const matches = detectPii('NPI: 1234567890 Dr. Smith.');
    const npiMatches = matches.filter((m) => m.type === 'npi');
    expect(npiMatches.length).toBeGreaterThan(0);
  });
});

describe('detectPii - DEA', () => {
  it('should detect DEA number', () => {
    const matches = detectPii('DEA: AB1234567 controlled substance.');
    const deaMatches = matches.filter((m) => m.type === 'dea');
    expect(deaMatches.length).toBeGreaterThan(0);
  });

  it('should not detect random text as DEA', () => {
    const matches = detectPii('See table A1B2C3 for reference.');
    const deaMatches = matches.filter((m) => m.type === 'dea');
    expect(deaMatches.length).toBe(0);
  });
});

describe('detectPii - URL', () => {
  it('should detect URL', () => {
    const matches = detectPii('See https://patient.example.com/records for details.');
    const urlMatches = matches.filter((m) => m.type === 'url');
    expect(urlMatches.length).toBeGreaterThan(0);
  });
});

describe('detectPii - IP address', () => {
  it('should detect IP address', () => {
    const matches = detectPii('Access from 192.168.1.100 was blocked.');
    const ipMatches = matches.filter((m) => m.type === 'ip_address');
    expect(ipMatches.length).toBeGreaterThan(0);
  });
});

describe('detectPii - License plate', () => {
  it('should detect US license plate', () => {
    const matches = detectPii('Vehicle: ABC-1234 parked outside.');
    const plateMatches = matches.filter((m) => m.type === 'license_plate');
    expect(plateMatches.length).toBeGreaterThan(0);
  });
});

describe('detectPii - PiiMatch shape', () => {
  it('should return correct PiiMatch structure', () => {
    const matches = detectPii('SSN: 123-45-6789');
    expect(matches.length).toBeGreaterThan(0);
    const match = matches[0];
    expect(match).toHaveProperty('type');
    expect(match).toHaveProperty('start');
    expect(match).toHaveProperty('end');
    expect(match).toHaveProperty('value');
    expect(match).toHaveProperty('confidence');
    expect(typeof match?.start).toBe('number');
    expect(typeof match?.end).toBe('number');
    expect(typeof match?.confidence).toBe('number');
    expect(match?.confidence).toBeGreaterThanOrEqual(0);
    expect(match?.confidence).toBeLessThanOrEqual(1);
  });

  it('should return start/end positions that match value in original text', () => {
    const text = 'Patient SSN is 123-45-6789 in the record.';
    const matches = detectPii(text);
    for (const match of matches) {
      expect(text.substring(match.start, match.end)).toBe(match.value);
    }
  });
});

describe('redactText', () => {
  it('should replace detected PII with placeholder', () => {
    const text = 'SSN is 123-45-6789 of the patient.';
    const matches = detectPii(text);
    const redacted = redactText(text, matches);
    expect(redacted).not.toContain('123-45-6789');
  });

  it('should return original text when no matches', () => {
    const text = 'No PII here whatsoever.';
    const redacted = redactText(text, []);
    expect(redacted).toBe(text);
  });

  it('should handle multiple replacements', () => {
    const text = 'Email: test@example.com SSN: 123-45-6789';
    const matches = detectPii(text);
    const redacted = redactText(text, matches);
    expect(redacted).not.toContain('test@example.com');
    expect(redacted).not.toContain('123-45-6789');
  });
});
