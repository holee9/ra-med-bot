// @MX:ANCHOR: [AUTO] Multi-jurisdiction classification engine — called by API route and tests
// @MX:REASON: Public API boundary; deterministic rule engine for 5 jurisdictions (FDA, EU MDR, MFDS, NMPA, PMDA)
// @MX:SPEC: SPEC-REGULA-CLASSIFY-001 REQ-CLASSIFY-001~020

export interface DeviceInput {
  deviceDescription: string;
  deviceType: 'active' | 'non_active' | 'software_only' | 'ivd' | 'implantable';
  contactType: 'no_contact' | 'external' | 'internal' | 'implant';
  hasSoftware: boolean;
  hasAiMl: boolean;
  isSterile: boolean;
}

export interface JurisdictionResult {
  jurisdiction: string;
  deviceClass: string;
  pathway: string;
  rule?: string;
  rationale: string;
  requiresNotifiedBody?: boolean;
}

export interface ClassificationResult {
  fda: JurisdictionResult;
  eu: JurisdictionResult;
  mfds: JurisdictionResult;
  nmpa: JurisdictionResult;
  pmda: JurisdictionResult;
  applicableStandardTypes: string[];
}

// FDA Classification (21 CFR §860-892, simplified deterministic rules)
function classifyFDA(input: DeviceInput): JurisdictionResult {
  // Active implantable → Class III PMA
  if (input.deviceType === 'implantable' && input.contactType === 'implant') {
    return {
      jurisdiction: 'FDA',
      deviceClass: 'III',
      pathway: 'PMA',
      rationale: 'Active implantable devices default to Class III/PMA per 21 CFR §860.3',
    };
  }
  // IVD
  if (input.deviceType === 'ivd') {
    return {
      jurisdiction: 'FDA',
      deviceClass: 'II',
      pathway: '510k',
      rationale: 'Most IVDs are Class II requiring 510(k)',
    };
  }
  // Software-only (SaMD)
  if (input.deviceType === 'software_only') {
    if (input.hasAiMl) {
      return {
        jurisdiction: 'FDA',
        deviceClass: 'II',
        pathway: '510k',
        rationale:
          'AI/ML SaMD with moderate risk typically Class II; may require De Novo for novel algorithms',
      };
    }
    return {
      jurisdiction: 'FDA',
      deviceClass: 'II',
      pathway: '510k',
      rationale: 'Software-only medical devices generally Class II/510(k)',
    };
  }
  // Active device, no patient contact → Class I exempt
  if (input.deviceType === 'active' && input.contactType === 'no_contact') {
    return {
      jurisdiction: 'FDA',
      deviceClass: 'I',
      pathway: 'exempt',
      rationale: 'Active devices without patient contact are typically Class I exempt',
    };
  }
  // Internal contact active device → Class III
  if (input.deviceType === 'active' && input.contactType === 'internal') {
    return {
      jurisdiction: 'FDA',
      deviceClass: 'III',
      pathway: 'PMA',
      rationale: 'Active devices with internal contact typically Class III/PMA',
    };
  }
  // Default: Class II 510(k)
  return {
    jurisdiction: 'FDA',
    deviceClass: 'II',
    pathway: '510k',
    rationale: 'Devices with moderate risk and established predicate typically Class II/510(k)',
  };
}

// EU MDR Classification (MDR 2017/745 Annex VIII Rules 1-22, simplified)
function classifyEU(input: DeviceInput): JurisdictionResult {
  // IVD → IVDR
  if (input.deviceType === 'ivd') {
    return {
      jurisdiction: 'EU MDR',
      deviceClass: 'B',
      pathway: 'notified_body',
      rule: 'IVDR Rule 3',
      rationale: 'IVD devices regulated under EU IVDR 2017/746 — most require Notified Body',
      requiresNotifiedBody: true,
    };
  }
  // Active implantable → Class III (Rule 7/8)
  if (input.deviceType === 'implantable' && input.contactType === 'implant') {
    return {
      jurisdiction: 'EU MDR',
      deviceClass: 'III',
      pathway: 'notified_body',
      rule: 'Rule 8',
      rationale: 'Active implantable devices: Class III per Annex VIII Rule 8',
      requiresNotifiedBody: true,
    };
  }
  // Software (Rule 11)
  if (input.deviceType === 'software_only') {
    const cls = input.hasAiMl ? 'IIb' : 'IIa';
    return {
      jurisdiction: 'EU MDR',
      deviceClass: cls,
      pathway: 'notified_body',
      rule: 'Rule 11',
      rationale: `Software medical device: Class ${cls} per MDR Annex VIII Rule 11`,
      requiresNotifiedBody: true,
    };
  }
  // Implantable non-active (Rule 6)
  if (input.contactType === 'implant') {
    return {
      jurisdiction: 'EU MDR',
      deviceClass: 'III',
      pathway: 'notified_body',
      rule: 'Rule 6',
      rationale: 'Non-active implantable devices: Class III per Annex VIII Rule 6',
      requiresNotifiedBody: true,
    };
  }
  // Internal short-term contact (Rule 5/6)
  if (input.contactType === 'internal') {
    return {
      jurisdiction: 'EU MDR',
      deviceClass: 'IIa',
      pathway: 'notified_body',
      rule: 'Rule 5',
      rationale: 'Devices in contact with internal body surfaces: Class IIa per Rule 5',
      requiresNotifiedBody: true,
    };
  }
  // External contact (Rule 1-4)
  if (input.contactType === 'external') {
    return {
      jurisdiction: 'EU MDR',
      deviceClass: 'I',
      pathway: 'self_cert',
      rule: 'Rule 1',
      rationale: 'Non-invasive devices in contact with intact skin: Class I per Rule 1',
      requiresNotifiedBody: false,
    };
  }
  return {
    jurisdiction: 'EU MDR',
    deviceClass: 'I',
    pathway: 'self_cert',
    rule: 'Rule 1',
    rationale: 'Non-invasive device without patient contact: Class I',
    requiresNotifiedBody: false,
  };
}

// MFDS (Korea — 의료기기법 등급)
function classifyMFDS(input: DeviceInput): JurisdictionResult {
  if (
    input.contactType === 'implant' ||
    (input.deviceType === 'active' && input.contactType === 'internal')
  ) {
    return {
      jurisdiction: 'MFDS',
      deviceClass: '4',
      pathway: '품목허가',
      rationale: '이식형/고위험 능동기기 — 4등급 품목허가',
    };
  }
  if (input.deviceType === 'software_only') {
    return {
      jurisdiction: 'MFDS',
      deviceClass: '2',
      pathway: '품목허가',
      rationale: '독립형 의료기기 소프트웨어 — 2~3등급 (기능에 따라 결정)',
    };
  }
  if (input.contactType === 'internal' || input.deviceType === 'ivd') {
    return {
      jurisdiction: 'MFDS',
      deviceClass: '3',
      pathway: '품목허가',
      rationale: '체내접촉 또는 체외진단 기기 — 3등급',
    };
  }
  return {
    jurisdiction: 'MFDS',
    deviceClass: '2',
    pathway: '품목허가',
    rationale: '일반적 의료기기 — 2등급',
  };
}

// NMPA (China — 分类)
function classifyNMPA(input: DeviceInput): JurisdictionResult {
  if (
    input.contactType === 'implant' ||
    (input.deviceType === 'active' && input.contactType === 'internal')
  ) {
    return {
      jurisdiction: 'NMPA',
      deviceClass: 'III',
      pathway: '注册审评',
      rationale: '植入类/高风险有源器械 — 第三类',
    };
  }
  if (input.deviceType === 'ivd' || input.contactType === 'internal') {
    return {
      jurisdiction: 'NMPA',
      deviceClass: 'II',
      pathway: '注册审评',
      rationale: '体外诊断/接触体内 — 第二类',
    };
  }
  return {
    jurisdiction: 'NMPA',
    deviceClass: 'II',
    pathway: '注册审评',
    rationale: '普通医疗器械 — 第二类',
  };
}

// PMDA (Japan — 薬機法クラス)
function classifyPMDA(input: DeviceInput): JurisdictionResult {
  if (
    input.contactType === 'implant' ||
    (input.deviceType === 'active' && input.contactType === 'internal')
  ) {
    return {
      jurisdiction: 'PMDA',
      deviceClass: 'III',
      pathway: '製造販売承認',
      rationale: '植込型/高管理医療機器 — クラスIII',
    };
  }
  if (input.deviceType === 'software_only' && input.hasAiMl) {
    return {
      jurisdiction: 'PMDA',
      deviceClass: 'III',
      pathway: '製造販売承認',
      rationale: 'AI/ML含む高度管理医療機器ソフトウェア — クラスIII',
    };
  }
  if (input.deviceType === 'ivd' || input.contactType === 'internal') {
    return {
      jurisdiction: 'PMDA',
      deviceClass: 'II',
      pathway: '認証',
      rationale: '管理医療機器 — クラスII',
    };
  }
  return {
    jurisdiction: 'PMDA',
    deviceClass: 'I',
    pathway: '届出',
    rationale: '一般医療機器 — クラスI (届出)',
  };
}

function getApplicableStandardTypes(input: DeviceInput): string[] {
  const types: string[] = ['ISO 14971 (Risk Management)'];
  if (input.hasSoftware || input.deviceType === 'software_only') {
    types.push('IEC 62304 (Software Lifecycle)', 'IEC 62366-1 (Usability)');
  }
  if (input.deviceType === 'active' || input.deviceType === 'implantable') {
    types.push('IEC 60601-1 (Electrical Safety)');
  }
  if (input.isSterile) {
    types.push('ISO 11135 (Sterilization)', 'ISO 11607 (Packaging)');
  }
  if (input.contactType === 'implant' || input.contactType === 'internal') {
    types.push('ISO 10993-1 (Biocompatibility)');
  }
  if (input.hasAiMl) {
    types.push('IEC 62304 (AI/ML Lifecycle)', 'ISO 14971 (AI Risk Management)');
  }
  return [...new Set(types)];
}

// @MX:ANCHOR: [AUTO] classifyDevice — primary classification entry point called by route and tests
// @MX:REASON: fan_in >= 3: route handler, test suite, and future report generator all call this
// @MX:SPEC: SPEC-REGULA-CLASSIFY-001 REQ-CLASSIFY-001
export function classifyDevice(input: DeviceInput): ClassificationResult {
  return {
    fda: classifyFDA(input),
    eu: classifyEU(input),
    mfds: classifyMFDS(input),
    nmpa: classifyNMPA(input),
    pmda: classifyPMDA(input),
    applicableStandardTypes: getApplicableStandardTypes(input),
  };
}
