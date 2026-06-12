// @MX:ANCHOR: [AUTO] Standards applicability mapping — called by API route and UI
// @MX:REASON: Public API boundary; fan_in >= 3 (route, tests, UI)
// @MX:SPEC: SPEC-REGULA-STANDARDS-001 REQ-STANDARDS-001~006

export interface DeviceProfile {
  deviceTypeKey: string; // 'electrical_medical_device'|'active_implantable'|'software_only'|'in_vitro_diagnostic'|'sterile_device'|'general_device'
  regulatoryPathway: string; // 'fda_510k'|'fda_pma'|'eu_mdr_class_i'|'eu_mdr_class_ii'|'eu_mdr_class_iii'|'all'
  hasSoftware: boolean;
  isElectrical: boolean;
  isSterile: boolean;
  usesAnimalTissue: boolean;
}

export interface ApplicableStandard {
  standardNumber: string;
  title: string;
  body: string;
  isMandatory: boolean;
  applicabilityReason: string;
  fdaRecognized: boolean;
  euHarmonized: boolean;
}

// Static catalog of key medical device standards (seed data — no external API needed)
export const STANDARDS_SEED_DATA = [
  {
    standardNumber: 'ISO 14971:2019',
    title: 'Medical devices — Application of risk management to medical devices',
    body: 'ISO',
    version: '2019',
    publicationYear: 2019,
    fdaRecognized: true,
    euHarmonized: true,
    scopeKeywords: ['risk', 'risk management', 'hazard'],
    status: 'current' as const,
  },
  {
    standardNumber: 'IEC 62304:2006/AMD1:2015',
    title: 'Medical device software — Software life cycle processes',
    body: 'IEC',
    version: '2015',
    publicationYear: 2015,
    fdaRecognized: true,
    euHarmonized: true,
    scopeKeywords: ['software', 'SLC', 'lifecycle'],
    status: 'current' as const,
  },
  {
    standardNumber: 'IEC 62366-1:2015',
    title: 'Medical devices — Usability engineering',
    body: 'IEC',
    version: '2015',
    publicationYear: 2015,
    fdaRecognized: true,
    euHarmonized: true,
    scopeKeywords: ['usability', 'human factors', 'UE'],
    status: 'current' as const,
  },
  {
    standardNumber: 'IEC 60601-1:2005/AMD2:2020',
    title:
      'Medical electrical equipment — General requirements for basic safety and essential performance',
    body: 'IEC',
    version: '2020',
    publicationYear: 2020,
    fdaRecognized: true,
    euHarmonized: true,
    scopeKeywords: ['electrical', 'safety', 'EMC', 'electrical medical device'],
    status: 'current' as const,
  },
  {
    standardNumber: 'IEC 60601-1-2:2014/AMD1:2020',
    title: 'Medical electrical equipment — Electromagnetic disturbances',
    body: 'IEC',
    version: '2020',
    publicationYear: 2020,
    fdaRecognized: true,
    euHarmonized: true,
    scopeKeywords: ['EMC', 'electromagnetic', 'electrical medical device'],
    status: 'current' as const,
  },
  {
    standardNumber: 'ISO 10993-1:2018',
    title:
      'Biological evaluation of medical devices — Part 1: Evaluation and testing within a risk management process',
    body: 'ISO',
    version: '2018',
    publicationYear: 2018,
    fdaRecognized: true,
    euHarmonized: true,
    scopeKeywords: ['biocompatibility', 'biological', 'materials'],
    status: 'current' as const,
  },
  {
    standardNumber: 'ISO 13485:2016',
    title: 'Medical devices — Quality management systems',
    body: 'ISO',
    version: '2016',
    publicationYear: 2016,
    fdaRecognized: false,
    euHarmonized: true,
    scopeKeywords: ['QMS', 'quality', 'management system'],
    status: 'current' as const,
  },
  {
    standardNumber: 'ISO 11135:2014',
    title: 'Sterilization of health-care products — Ethylene oxide',
    body: 'ISO',
    version: '2014',
    publicationYear: 2014,
    fdaRecognized: true,
    euHarmonized: true,
    scopeKeywords: ['sterile', 'sterilization', 'EO'],
    status: 'current' as const,
  },
  {
    standardNumber: 'ISO 11607-1:2019',
    title: 'Packaging for terminally sterilized medical devices — Part 1: Requirements for materials',
    body: 'ISO',
    version: '2019',
    publicationYear: 2019,
    fdaRecognized: true,
    euHarmonized: true,
    scopeKeywords: ['packaging', 'sterile', 'sterilization'],
    status: 'current' as const,
  },
  {
    standardNumber: 'ASTM F2132',
    title: 'Standard Specification for Accelerated Aging of Sterile Medical Device Packages',
    body: 'ASTM',
    version: 'latest',
    publicationYear: 2021,
    fdaRecognized: true,
    euHarmonized: false,
    scopeKeywords: ['packaging', 'sterile', 'aging'],
    status: 'current' as const,
  },
  {
    standardNumber: 'IEC 60601-1-6:2010/AMD1:2013',
    title: 'Medical electrical equipment — Usability',
    body: 'IEC',
    version: '2013',
    publicationYear: 2013,
    fdaRecognized: true,
    euHarmonized: true,
    scopeKeywords: ['usability', 'electrical medical device', 'HFE'],
    status: 'current' as const,
  },
  {
    standardNumber: 'ISO/IEC 27001:2022',
    title: 'Information security management systems',
    body: 'ISO',
    version: '2022',
    publicationYear: 2022,
    fdaRecognized: false,
    euHarmonized: false,
    scopeKeywords: ['cybersecurity', 'information security', 'ISMS'],
    status: 'current' as const,
  },
] as const;

type ApplicabilityRule = {
  standardNumber: string;
  isMandatory: boolean;
  reason: string;
  pathway: string;
};

// Mapping rules: deviceTypeKey → applicable standards with reason
const APPLICABILITY_RULES: Record<string, ApplicabilityRule[]> = {
  general_device: [
    {
      standardNumber: 'ISO 14971:2019',
      isMandatory: true,
      reason: 'Risk management required for all medical devices',
      pathway: 'all',
    },
    {
      standardNumber: 'ISO 13485:2016',
      isMandatory: true,
      reason: 'QMS required under EU MDR Annex IX',
      pathway: 'eu_mdr_class_i',
    },
  ],
  electrical_medical_device: [
    {
      standardNumber: 'ISO 14971:2019',
      isMandatory: true,
      reason: 'Risk management required for all medical devices',
      pathway: 'all',
    },
    {
      standardNumber: 'IEC 60601-1:2005/AMD2:2020',
      isMandatory: true,
      reason: 'General safety and performance for electrical medical equipment',
      pathway: 'all',
    },
    {
      standardNumber: 'IEC 60601-1-2:2014/AMD1:2020',
      isMandatory: true,
      reason: 'EMC requirements for electrical medical equipment',
      pathway: 'all',
    },
  ],
  software_only: [
    {
      standardNumber: 'ISO 14971:2019',
      isMandatory: true,
      reason: 'Risk management required for all medical devices',
      pathway: 'all',
    },
    {
      standardNumber: 'IEC 62304:2006/AMD1:2015',
      isMandatory: true,
      reason: 'Software lifecycle required for standalone software medical devices',
      pathway: 'all',
    },
    {
      standardNumber: 'IEC 62366-1:2015',
      isMandatory: true,
      reason: 'Usability engineering required for software with user interface',
      pathway: 'all',
    },
  ],
  sterile_device: [
    {
      standardNumber: 'ISO 14971:2019',
      isMandatory: true,
      reason: 'Risk management required for all medical devices',
      pathway: 'all',
    },
    {
      standardNumber: 'ISO 11135:2014',
      isMandatory: true,
      reason: 'Sterilization validation for EO sterilized devices',
      pathway: 'all',
    },
    {
      standardNumber: 'ISO 11607-1:2019',
      isMandatory: true,
      reason: 'Packaging validation for sterile medical devices',
      pathway: 'all',
    },
    {
      standardNumber: 'ASTM F2132',
      isMandatory: false,
      reason: 'Accelerated aging protocol for sterile packaging validation',
      pathway: 'fda_510k',
    },
  ],
  in_vitro_diagnostic: [
    {
      standardNumber: 'ISO 14971:2019',
      isMandatory: true,
      reason: 'Risk management required for all medical devices',
      pathway: 'all',
    },
    {
      standardNumber: 'ISO 13485:2016',
      isMandatory: true,
      reason: 'QMS required for IVD devices',
      pathway: 'all',
    },
  ],
  active_implantable: [
    {
      standardNumber: 'ISO 14971:2019',
      isMandatory: true,
      reason: 'Risk management required for all medical devices',
      pathway: 'all',
    },
    {
      standardNumber: 'IEC 60601-1:2005/AMD2:2020',
      isMandatory: true,
      reason: 'Electrical safety for active implantable devices',
      pathway: 'all',
    },
    {
      standardNumber: 'ISO 10993-1:2018',
      isMandatory: true,
      reason: 'Biocompatibility evaluation for implantable materials',
      pathway: 'all',
    },
  ],
};

export function getApplicableStandards(profile: DeviceProfile): ApplicableStandard[] {
  const catalogMap: Map<string, (typeof STANDARDS_SEED_DATA)[number]> = new Map(
    STANDARDS_SEED_DATA.map((s) => [s.standardNumber as string, s]),
  );
  const rules: ApplicabilityRule[] =
    APPLICABILITY_RULES[profile.deviceTypeKey] ?? APPLICABILITY_RULES['general_device'] ?? [];
  const additionalRules: ApplicabilityRule[] = [];

  if (profile.hasSoftware) {
    additionalRules.push(
      {
        standardNumber: 'IEC 62304:2006/AMD1:2015',
        isMandatory: true,
        reason: 'Software lifecycle process required when device contains software',
        pathway: 'all',
      },
      {
        standardNumber: 'IEC 62366-1:2015',
        isMandatory: true,
        reason: 'Usability engineering for devices with software interface',
        pathway: 'all',
      },
    );
  }
  if (profile.isElectrical && !rules.some((r) => r.standardNumber.startsWith('IEC 60601-1:'))) {
    additionalRules.push({
      standardNumber: 'IEC 60601-1:2005/AMD2:2020',
      isMandatory: true,
      reason: 'General safety for electrical medical equipment',
      pathway: 'all',
    });
  }
  if (profile.usesAnimalTissue) {
    additionalRules.push({
      standardNumber: 'ISO 10993-1:2018',
      isMandatory: true,
      reason: 'Biocompatibility required for devices using animal tissue',
      pathway: 'all',
    });
  }

  const allRules = [...rules, ...additionalRules];
  const seen = new Set<string>();
  const result: ApplicableStandard[] = [];

  for (const rule of allRules) {
    const key = `${rule.standardNumber}:${rule.pathway}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const catalog = catalogMap.get(rule.standardNumber);
    if (!catalog) continue;
    result.push({
      standardNumber: rule.standardNumber,
      title: catalog.title,
      body: catalog.body,
      isMandatory: rule.isMandatory,
      applicabilityReason: rule.reason,
      fdaRecognized: catalog.fdaRecognized,
      euHarmonized: catalog.euHarmonized,
    });
  }

  return result;
}
