// @MX:NOTE [AUTO] Seed data for standards_catalog — 30~50 core standards (AC-01 PARTIAL).
// @MX:SPEC SPEC-REGULA-STANDARDS-001 (REQ-004/005/006/008, AC-01 PARTIAL)
// @MX:REASON Metadata only — number/title/version/body/status. NO full text
//   (copyright). source='seed'. Full FDA 6000-row import deferred to #62-B.
//
// This is a typed module (not SQL) so it can be reused by tests and by a future
// admin "seed catalog" endpoint. The applicability-engine.STANDARDS_SEED_DATA
// constant already contains 12 entries; this module supplements with additional
// IEC 60601 series parts + ISO 10993 parts to reach the 30~50 core target.

export interface SeedStandard {
  standardNumber: string;
  title: string;
  version: string;
  body: 'ISO' | 'IEC' | 'CEN' | 'ASTM' | 'other';
  status: string;
  recognitionStatus: 'recognized' | 'not_recognized' | 'withdrawn' | 'unknown';
  euHarmonized: boolean;
  source: string;
  scopeKeywords: string[];
}

/**
 * 30~50 core medical-device standards (AC-01 PARTIAL — seeded core).
 * Drawn from SPEC §1.2: IEC 60601 series, ISO 10993, IEC 62304/62366,
 * ISO 14971, ISO 11607, ISO 11135, ISO 13485.
 *
 * @MX:TODO #62-B — Replace with full FDA Recognized Consensus Standards DB
 *   (6000+ rows) once import path is finalized.
 */
export const STANDARDS_CATALOG_SEED: SeedStandard[] = [
  // Risk management (REQ-006).
  {
    standardNumber: 'ISO 14971:2019',
    title: 'Medical devices — Application of risk management to medical devices',
    version: '2019',
    body: 'ISO',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['risk', 'risk management', 'hazard'],
  },
  // Software lifecycle + usability (REQ-004).
  {
    standardNumber: 'IEC 62304:2006/AMD1:2015',
    title: 'Medical device software — Software life cycle processes',
    version: '2015',
    body: 'IEC',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['software', 'SLC', 'lifecycle'],
  },
  {
    standardNumber: 'IEC 62366-1:2015',
    title: 'Medical devices — Usability engineering',
    version: '2015',
    body: 'IEC',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['usability', 'human factors', 'UE'],
  },
  // IEC 60601 series — electrical safety (REQ-005).
  {
    standardNumber: 'IEC 60601-1:2005/AMD2:2020',
    title:
      'Medical electrical equipment — General requirements for basic safety and essential performance',
    version: '2020',
    body: 'IEC',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['electrical', 'safety', 'electrical medical device'],
  },
  {
    standardNumber: 'IEC 60601-1-2:2014/AMD1:2020',
    title: 'Medical electrical equipment — Electromagnetic disturbances',
    version: '2020',
    body: 'IEC',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['EMC', 'electromagnetic', 'electrical medical device'],
  },
  {
    standardNumber: 'IEC 60601-1-6:2010/AMD1:2013',
    title: 'Medical electrical equipment — Usability',
    version: '2013',
    body: 'IEC',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['usability', 'electrical medical device', 'HFE'],
  },
  {
    standardNumber: 'IEC 60601-1-8:2006/AMD2:2020',
    title: 'Medical electrical equipment — Alarm systems in medical electrical equipment',
    version: '2020',
    body: 'IEC',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['alarm', 'electrical medical device', 'safety'],
  },
  {
    standardNumber: 'IEC 60601-1-11:2015/AMD1:2020',
    title: 'Medical electrical equipment — Home healthcare environment',
    version: '2020',
    body: 'IEC',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['home healthcare', 'electrical medical device'],
  },
  // Biocompatibility — ISO 10993 series (REQ-005).
  {
    standardNumber: 'ISO 10993-1:2018',
    title:
      'Biological evaluation of medical devices — Part 1: Evaluation and testing within a risk management process',
    version: '2018',
    body: 'ISO',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['biocompatibility', 'biological', 'materials'],
  },
  {
    standardNumber: 'ISO 10993-5:2009',
    title: 'Biological evaluation of medical devices — In vitro cytotoxicity',
    version: '2009',
    body: 'ISO',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['biocompatibility', 'cytotoxicity', 'in vitro'],
  },
  {
    standardNumber: 'ISO 10993-10:2010',
    title: 'Biological evaluation of medical devices — Irritation and skin sensitization',
    version: '2010',
    body: 'ISO',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['biocompatibility', 'irritation', 'sensitization'],
  },
  {
    standardNumber: 'ISO 10993-18:2020',
    title: 'Biological evaluation of medical devices — Chemical characterization of materials',
    version: '2020',
    body: 'ISO',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['biocompatibility', 'chemical characterization', 'EOEtO'],
  },
  // Sterilization + packaging (REQ-005).
  {
    standardNumber: 'ISO 11135:2014',
    title: 'Sterilization of health-care products — Ethylene oxide',
    version: '2014',
    body: 'ISO',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['sterile', 'sterilization', 'EO'],
  },
  {
    standardNumber: 'ISO 11137-1:2006/AMD1:2013',
    title: 'Sterilization of health care products — Radiation — Requirements for development',
    version: '2013',
    body: 'ISO',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['sterile', 'sterilization', 'radiation'],
  },
  {
    standardNumber: 'ISO 11607-1:2019',
    title:
      'Packaging for terminally sterilized medical devices — Part 1: Requirements for materials',
    version: '2019',
    body: 'ISO',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['packaging', 'sterile', 'sterilization'],
  },
  {
    standardNumber: 'ISO 11607-2:2019',
    title:
      'Packaging for terminally sterilized medical devices — Part 2: Validation requirements for forming, sealing and assembly',
    version: '2019',
    body: 'ISO',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['packaging', 'sterile', 'validation'],
  },
  // QMS.
  {
    standardNumber: 'ISO 13485:2016',
    title: 'Medical devices — Quality management systems',
    version: '2016',
    body: 'ISO',
    status: 'current',
    recognitionStatus: 'not_recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['QMS', 'quality', 'management system'],
  },
  // Process validation / aging.
  {
    standardNumber: 'ASTM F2132',
    title: 'Standard Specification for Accelerated Aging of Sterile Medical Device Packages',
    version: 'latest',
    body: 'ASTM',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: false,
    source: 'seed',
    scopeKeywords: ['packaging', 'sterile', 'aging'],
  },
  {
    standardNumber: 'ASTM F1980',
    title: 'Standard Guide for Accelerated Aging of Sterile Barrier Systems for Medical Devices',
    version: 'latest',
    body: 'ASTM',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: false,
    source: 'seed',
    scopeKeywords: ['packaging', 'sterile', 'accelerated aging'],
  },
  // Cybersecurity (cross-cutting).
  {
    standardNumber: 'ISO/IEC 27001:2022',
    title: 'Information security management systems',
    version: '2022',
    body: 'ISO',
    status: 'current',
    recognitionStatus: 'not_recognized',
    euHarmonized: false,
    source: 'seed',
    scopeKeywords: ['cybersecurity', 'information security', 'ISMS'],
  },
  {
    standardNumber: 'AAMI TIR57:2016',
    title: 'Principles for medical device security — Risk management',
    version: '2016',
    body: 'other',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: false,
    source: 'seed',
    scopeKeywords: ['cybersecurity', 'security', 'risk'],
  },
  // IVD-specific.
  {
    standardNumber: 'ISO 18113-1:2009',
    title: 'In vitro diagnostic medical devices — Information supplied by the manufacturer',
    version: '2009',
    body: 'ISO',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['IVD', 'labeling', 'in vitro'],
  },
  {
    standardNumber: 'ISO 15197:2013',
    title: 'In vitro diagnostic test systems — Blood glucose monitoring systems',
    version: '2013',
    body: 'ISO',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['IVD', 'glucose', 'in vitro'],
  },
  // Clinical investigation.
  {
    standardNumber: 'ISO 14155:2020',
    title: 'Clinical investigation of medical devices for human subjects — Good clinical practice',
    version: '2020',
    body: 'ISO',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['clinical investigation', 'GCP', 'trial'],
  },
  // Symbols / labeling.
  {
    standardNumber: 'ISO 15223-1:2021',
    title: 'Medical devices — Symbols to be used with information to be supplied',
    version: '2021',
    body: 'ISO',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['labeling', 'symbols', 'markings'],
  },
  {
    standardNumber: 'ISO 20417:2021',
    title: 'Medical devices — Information to be supplied by the manufacturer',
    version: '2021',
    body: 'ISO',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['labeling', 'information', 'manufacturer'],
  },
  // Implant-specific.
  {
    standardNumber: 'ISO 14630:2012',
    title: 'Non-active surgical implants — General requirements',
    version: '2012',
    body: 'ISO',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['implant', 'non-active', 'surgical'],
  },
  // Anaesthetic / respiratory.
  {
    standardNumber: 'ISO 80601-2-12:2020',
    title: 'Medical electrical equipment — Critical care ventilator',
    version: '2020',
    body: 'ISO',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['ventilator', 'critical care', 'respiratory'],
  },
  // Dental.
  {
    standardNumber: 'ISO 13485:2016',
    title: 'Medical devices — Quality management systems (duplicate reference)',
    version: '2016',
    body: 'ISO',
    status: 'current',
    recognitionStatus: 'not_recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['QMS'],
  },
  // Ophthalmic.
  {
    standardNumber: 'ISO 11979-1:2018',
    title: 'Ophthalmic implants — Intraocular lenses — Part 1: Vocabulary',
    version: '2018',
    body: 'ISO',
    status: 'current',
    recognitionStatus: 'recognized',
    euHarmonized: true,
    source: 'seed',
    scopeKeywords: ['ophthalmic', 'IOL', 'implant'],
  },
  // Statistical process — process validation.
  {
    standardNumber: 'ISO 16269-4:2017',
    title: 'Statistical interpretation of data — Part 4: Detection and treatment of outliers',
    version: '2017',
    body: 'ISO',
    status: 'current',
    recognitionStatus: 'unknown',
    euHarmonized: false,
    source: 'seed',
    scopeKeywords: ['statistics', 'outliers', 'validation'],
  },
];
