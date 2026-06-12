import { describe, expect, it } from 'vitest';
import { getApplicableStandards } from '@/lib/standards/applicability-engine';

describe('getApplicableStandards', () => {
  it('returns ISO 14971 for any device type', () => {
    const result = getApplicableStandards({
      deviceTypeKey: 'general_device',
      regulatoryPathway: 'fda_510k',
      hasSoftware: false,
      isElectrical: false,
      isSterile: false,
      usesAnimalTissue: false,
    });
    expect(result.some((s) => s.standardNumber === 'ISO 14971:2019')).toBe(true);
  });

  it('includes IEC 62304 when device has software', () => {
    const result = getApplicableStandards({
      deviceTypeKey: 'general_device',
      regulatoryPathway: 'fda_510k',
      hasSoftware: true,
      isElectrical: false,
      isSterile: false,
      usesAnimalTissue: false,
    });
    expect(result.some((s) => s.standardNumber === 'IEC 62304:2006/AMD1:2015')).toBe(true);
  });

  it('includes IEC 60601-1 for electrical_medical_device', () => {
    const result = getApplicableStandards({
      deviceTypeKey: 'electrical_medical_device',
      regulatoryPathway: 'fda_510k',
      hasSoftware: false,
      isElectrical: true,
      isSterile: false,
      usesAnimalTissue: false,
    });
    expect(result.some((s) => s.standardNumber.startsWith('IEC 60601-1:'))).toBe(true);
  });

  it('includes ISO 11135 for sterile_device', () => {
    const result = getApplicableStandards({
      deviceTypeKey: 'sterile_device',
      regulatoryPathway: 'fda_510k',
      hasSoftware: false,
      isElectrical: false,
      isSterile: true,
      usesAnimalTissue: false,
    });
    expect(result.some((s) => s.standardNumber === 'ISO 11135:2014')).toBe(true);
  });

  it('includes ISO 10993-1 for device using animal tissue', () => {
    const result = getApplicableStandards({
      deviceTypeKey: 'general_device',
      regulatoryPathway: 'eu_mdr_class_ii',
      hasSoftware: false,
      isElectrical: false,
      isSterile: false,
      usesAnimalTissue: true,
    });
    expect(result.some((s) => s.standardNumber === 'ISO 10993-1:2018')).toBe(true);
  });

  it('returns software_only with IEC 62304 and IEC 62366 as mandatory', () => {
    const result = getApplicableStandards({
      deviceTypeKey: 'software_only',
      regulatoryPathway: 'fda_510k',
      hasSoftware: true,
      isElectrical: false,
      isSterile: false,
      usesAnimalTissue: false,
    });
    const mandatory = result.filter((s) => s.isMandatory).map((s) => s.standardNumber);
    expect(mandatory).toContain('IEC 62304:2006/AMD1:2015');
    expect(mandatory).toContain('IEC 62366-1:2015');
  });

  it('returns fdaRecognized=true for FDA-recognized standards', () => {
    const result = getApplicableStandards({
      deviceTypeKey: 'general_device',
      regulatoryPathway: 'fda_510k',
      hasSoftware: false,
      isElectrical: false,
      isSterile: false,
      usesAnimalTissue: false,
    });
    const iso14971 = result.find((s) => s.standardNumber === 'ISO 14971:2019');
    expect(iso14971?.fdaRecognized).toBe(true);
  });

  it('deduplicates standards when multiple rules apply same standard', () => {
    const result = getApplicableStandards({
      deviceTypeKey: 'electrical_medical_device',
      regulatoryPathway: 'fda_510k',
      hasSoftware: true,
      isElectrical: true,
      isSterile: false,
      usesAnimalTissue: false,
    });
    const nums = result.map((s) => s.standardNumber);
    const unique = new Set(nums);
    expect(nums.length).toBe(unique.size);
  });
});
