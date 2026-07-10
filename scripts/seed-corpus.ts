// @MX:NOTE [AUTO] Multi-corpus seeder — TEST FIXTURE ONLY (2026-06-29, Issue #306).
// ⚠️ 운영 DB에서는 사용 금지: 지식베이스는 git repo 연동(설정 > 지식베이스 연결)로만 구축.
// 본 스크립트는 테스트 DB(test:e2e:setup)의 fixture 전용. 운영 코퍼스는 git repo 연동 후 채움.
// (이전: SPEC-REGULA-QUALITY-001 REQ-QUAL-001..005 multi-corpus seeder — 5개 규제 코퍼스)
// @MX:SPEC SPEC-REGULA-QUALITY-001 (REQ-QUAL-001..005)
//
// Run: pnpm db:seed:corpus  (alias for `tsx scripts/seed-corpus.ts`)
// Requires: DATABASE_URL. 임베딩은 gx10 qwen3-embedding(lib/ingest/embed → embedding-provider) 사용.
// ⚠️ TEST FIXTURE ONLY — 운영 코퍼스는 docs/architecture/knowledge-base.md 기술 git 연동 경로로만 구축.
//
// Idempotency: sources are matched by title; source_sections by (source_id, anchor)
// UNIQUE constraint. Re-running the script inserts zero new rows on a populated DB.

import { eq } from 'drizzle-orm';
import { db } from '../lib/db/client';
import { sourceSections, sources } from '../lib/db/schema';
import { embedChunks } from '../lib/ingest/embed';
import { logger } from '../lib/observability/logger';

interface SeedSection {
  anchor: string;
  heading: string;
  text: string;
}

type SourceType = 'Regulation' | 'Guidance' | 'Standard' | 'Industry' | 'Internal';

// REQ-SOURCE-GOV-004/008 — derive authorityGrade from the corpus type so seeded
// sources aren't all null-grade (which would make assessLowAuthority / REQ-008
// treat every seeded source as low-authority). Mirrors source_authority_grade enum.
function gradeForType(
  type: SourceType,
): 'regulator_official' | 'harmonized_standard' | 'internal_sop' | 'secondary_reference' {
  switch (type) {
    case 'Regulation':
    case 'Guidance':
      return 'regulator_official';
    case 'Standard':
      return 'harmonized_standard';
    case 'Internal':
      return 'internal_sop';
    case 'Industry':
      return 'secondary_reference';
    default:
      return 'secondary_reference';
  }
}

interface SeedSource {
  orgLabel: string;
  title: string;
  year: number;
  type: SourceType;
  region: string;
  url: string;
  sections: SeedSection[];
}

// ---------------------------------------------------------------------------
// Five regulatory corpora. Each corpus has >= 20 sections of real regulatory
// excerpts paraphrased from public-domain primary sources. Text excludes
// emails/SSNs to satisfy the PII guard in lib/ingest/embed.ts.
// ---------------------------------------------------------------------------

const FDA_SECTIONS: SeedSection[] = [
  {
    anchor: '21CFR807.20',
    heading: '21 CFR 807.20 — Who must register and list',
    text: 'Owners or operators of an establishment engaged in the manufacture, preparation, propagation, compounding, assembly, or processing of a device intended for commercial distribution in the United States must register the establishment and list every device manufactured at it with the FDA.',
  },
  {
    anchor: '21CFR807.21',
    heading: '21 CFR 807.21 — Times for registration',
    text: 'Establishments must register within 30 days after first beginning to manufacture devices and must renew their registration annually between October 1 and December 31 each year.',
  },
  {
    anchor: '21CFR807.81',
    heading: '21 CFR 807.81 — When a 510(k) is required',
    text: 'A premarket notification 510(k) must be submitted when a manufacturer intends to introduce a device into commercial distribution for the first time, when a manufacturer plans a significant change or modification of a legally marketed device, and for any class III device for which a PMA has not been required.',
  },
  {
    anchor: '21CFR807.87',
    heading: '21 CFR 807.87 — Information required in a 510(k)',
    text: 'A 510(k) submission shall contain the device trade name, classification, intended use, proposed labeling, a substantial-equivalence statement comparing the device to a predicate, performance data, and biocompatibility information sufficient to support a substantial-equivalence determination.',
  },
  {
    anchor: '21CFR807.100',
    heading: '21 CFR 807.100 — Substantial equivalence determination',
    text: 'FDA will issue a substantial-equivalence order or a not-substantially-equivalent order within 90 FDA review days of receipt of a complete 510(k). The submitter may not introduce the device into commercial distribution until receipt of an SE order.',
  },
  {
    anchor: '21CFR814.20',
    heading: '21 CFR 814.20 — PMA application content',
    text: 'A premarket approval (PMA) application is required for a class III medical device and shall include a summary of safety and effectiveness data, complete reports of all studies of safety and effectiveness, a description of the device components and principles of operation, and a description of the manufacturing methods, facilities, and controls.',
  },
  {
    anchor: '21CFR814.40',
    heading: '21 CFR 814.40 — PMA review timeframes',
    text: 'FDA shall review a PMA and issue an approval order, an approvable letter, a not-approvable letter, or an order denying approval within 180 days of receipt of an application accepted for filing.',
  },
  {
    anchor: '21CFR820.20',
    heading: '21 CFR 820.20 — Management responsibility',
    text: 'Each manufacturer shall establish and maintain a quality policy and ensure that the policy is understood, implemented, and maintained at all levels of the organization. Management with executive responsibility shall conduct quality system reviews at defined intervals and with sufficient frequency to assure continuing suitability and effectiveness.',
  },
  {
    anchor: '21CFR820.30',
    heading: '21 CFR 820.30 — Design controls',
    text: 'Each manufacturer shall establish and maintain procedures to control the design of the device in order to ensure that specified design requirements are met. The Design History File shall contain or reference the records necessary to demonstrate that the design was developed in accordance with the approved design plan and the requirements of this part.',
  },
  {
    anchor: '21CFR820.50',
    heading: '21 CFR 820.50 — Purchasing controls',
    text: 'Each manufacturer shall establish and maintain procedures to ensure that all purchased or otherwise received product and services conform to specified requirements, including evaluation and selection of suppliers, contractors, and consultants based on their ability to meet specified requirements, including quality.',
  },
  {
    anchor: '21CFR820.70',
    heading: '21 CFR 820.70 — Production and process controls',
    text: 'Each manufacturer shall develop, conduct, control, and monitor production processes to ensure that a device conforms to its specifications. Where deviations from device specifications could occur as a result of the manufacturing process, the manufacturer shall establish and maintain process control procedures that describe any process controls necessary to ensure conformance to specifications.',
  },
  {
    anchor: '21CFR820.75',
    heading: '21 CFR 820.75 — Process validation',
    text: 'Where the results of a process cannot be fully verified by subsequent inspection and test, the process shall be validated with a high degree of assurance and approved according to established procedures. Validation activities and results, including the date and signature of the individuals approving the validation and where appropriate the major equipment validated, shall be documented.',
  },
  {
    anchor: '21CFR820.100',
    heading: '21 CFR 820.100 — Corrective and preventive action (CAPA)',
    text: 'Each manufacturer shall establish and maintain procedures for implementing corrective and preventive action. Procedures shall include analysis of processes, work operations, concessions, quality audit reports, quality records, service records, complaints, returned product, and other sources of quality data to identify existing and potential causes of nonconforming product or other quality problems.',
  },
  {
    anchor: '21CFR820.180',
    heading: '21 CFR 820.180 — General record requirements',
    text: 'All records required by this part shall be maintained at the manufacturing establishment or other location that is reasonably accessible to responsible officials of the manufacturer and to FDA employees designated to perform inspections. Such records, including those not stored at the inspected establishment, shall be made readily available for review and copying by FDA employees.',
  },
  {
    anchor: '21CFR820.198',
    heading: '21 CFR 820.198 — Complaint files',
    text: 'Each manufacturer shall maintain complaint files. Each manufacturer shall establish and maintain procedures for receiving, reviewing, and evaluating complaints by a formally designated unit. Such procedures shall ensure that all complaints are evaluated to determine whether the complaint represents an event that is required to be reported to FDA under part 803 of this chapter.',
  },
  {
    anchor: '21CFR803.10',
    heading: '21 CFR 803.10 — Medical Device Reporting (MDR) general requirements',
    text: 'Manufacturers, importers, and device user facilities must submit MDR reports to FDA when they become aware of information that reasonably suggests one of their marketed devices may have caused or contributed to a death or serious injury, or has malfunctioned and would be likely to cause or contribute to a death or serious injury if the malfunction were to recur.',
  },
  {
    anchor: '21CFR803.20',
    heading: '21 CFR 803.20 — How to report',
    text: 'Manufacturers must submit individual MDR reports on Form FDA 3500A. Reports of events that must be submitted within 5 working days are designated 5-day reports; reports that must be submitted within 30 calendar days are designated 30-day reports.',
  },
  {
    anchor: '21CFR806.10',
    heading: '21 CFR 806.10 — Reports of corrections and removals',
    text: 'Each device manufacturer or importer shall submit a written report to FDA of any correction or removal of a device initiated to reduce a risk to health posed by the device or to remedy a violation of the act caused by the device which may present a risk to health.',
  },
  {
    anchor: '21CFR11.10',
    heading: '21 CFR 11.10 — Controls for closed systems (Part 11)',
    text: 'Persons who use closed systems to create, modify, maintain, or transmit electronic records shall employ procedures and controls designed to ensure the authenticity, integrity, and where appropriate the confidentiality of electronic records. Such procedures shall include the use of secure, computer-generated, time-stamped audit trails to independently record the date and time of operator entries and actions.',
  },
  {
    anchor: '21CFR11.50',
    heading: '21 CFR 11.50 — Signature manifestations',
    text: 'Signed electronic records shall contain information associated with the signing that clearly indicates the printed name of the signer, the date and time when the signature was executed, and the meaning associated with the signature, such as review, approval, responsibility, or authorship.',
  },
  {
    anchor: '21CFR812.20',
    heading: '21 CFR 812.20 — IDE application content',
    text: 'A sponsor shall submit an Investigational Device Exemption application to FDA for any clinical investigation of a device subject to the IDE regulation. The application must contain the name and address of the sponsor, a complete report of prior investigations, a description of the methods, facilities, and controls used for manufacturing, and the proposed investigational plan.',
  },
];

const EU_MDR_SECTIONS: SeedSection[] = [
  {
    anchor: 'MDR-Art10',
    heading: 'MDR Article 10 — General obligations of manufacturers',
    text: 'Manufacturers shall ensure that their devices are designed and manufactured in accordance with the requirements of this Regulation. Manufacturers shall establish, document, implement, maintain, keep up to date and continually improve a quality management system that shall ensure compliance in the most effective manner and in a manner that is proportionate to the risk class and the type of device.',
  },
  {
    anchor: 'MDR-Art11',
    heading: 'MDR Article 11 — Authorised representative',
    text: 'Where the manufacturer of a device is not established in a Member State, the device may only be placed on the Union market if the manufacturer designates a sole authorised representative. The designation shall constitute the authorised representative mandate, shall be valid only when accepted in writing by the authorised representative.',
  },
  {
    anchor: 'MDR-Art13',
    heading: 'MDR Article 13 — General obligations of importers',
    text: 'Importers shall place on the Union market only devices that are in conformity with this Regulation. Before placing a device on the market importers shall verify that the device has been CE marked and that the EU declaration of conformity of the device has been drawn up.',
  },
  {
    anchor: 'MDR-Art14',
    heading: 'MDR Article 14 — General obligations of distributors',
    text: 'When making a device available on the market, distributors shall, in the context of their activities, act with due care in relation to the requirements applicable. Before making a device available on the market, distributors shall verify that the device has been CE marked and that the EU declaration of conformity has been drawn up.',
  },
  {
    anchor: 'MDR-Art20',
    heading: 'MDR Article 20 — EU declaration of conformity',
    text: 'The EU declaration of conformity shall state that the requirements specified in this Regulation have been fulfilled in relation to the device that is covered. The manufacturer shall continuously update the EU declaration of conformity. The EU declaration of conformity shall contain at least the information set out in Annex IV.',
  },
  {
    anchor: 'MDR-Art27',
    heading: 'MDR Article 27 — Unique Device Identification (UDI) system',
    text: 'The Unique Device Identification system shall allow the identification and facilitate the traceability of devices, other than custom-made and investigational devices, and shall consist of the production of a UDI that comprises a UDI device identifier and a UDI production identifier.',
  },
  {
    anchor: 'MDR-Art32',
    heading: 'MDR Article 32 — Summary of safety and clinical performance',
    text: 'For implantable devices and for class III devices other than custom-made or investigational devices, the manufacturer shall draw up a summary of safety and clinical performance. The summary of safety and clinical performance shall be written in a way that is clear to the intended user and, if relevant, to the patient.',
  },
  {
    anchor: 'MDR-Art52',
    heading: 'MDR Article 52 — Conformity assessment procedures',
    text: 'Manufacturers of devices, other than custom-made devices, shall undertake an assessment of the conformity of their devices, in accordance with the conformity assessment procedures set out in Annexes IX to XI. The conformity assessment procedure for class III implantable devices shall include the procedure based on a quality management system and on assessment of the technical documentation as specified in Annex IX.',
  },
  {
    anchor: 'MDR-Art61',
    heading: 'MDR Article 61 — Clinical evaluation',
    text: 'Confirmation of conformity with relevant general safety and performance requirements set out in Annex I under the normal conditions of the intended use of the device, and the evaluation of the undesirable side-effects and of the acceptability of the benefit-risk-ratio, shall be based on clinical data providing sufficient clinical evidence, including where applicable relevant data as referred to in Annex III.',
  },
  {
    anchor: 'MDR-Art62',
    heading: 'MDR Article 62 — General requirements regarding clinical investigations',
    text: 'Clinical investigations shall be designed and conducted in such a way that the rights, safety, dignity and well-being of the subjects participating in a clinical investigation are protected and prevail over all other interests and the clinical data generated are scientifically valid, reliable and robust.',
  },
  {
    anchor: 'MDR-Art83',
    heading: 'MDR Article 83 — Post-market surveillance system of the manufacturer',
    text: 'For each device, manufacturers shall plan, establish, document, implement, maintain and update a post-market surveillance system in a manner that is proportionate to the risk class and appropriate for the type of device. That system shall be an integral part of the manufacturer quality management system.',
  },
  {
    anchor: 'MDR-Art84',
    heading: 'MDR Article 84 — Post-market surveillance plan',
    text: 'The post-market surveillance system shall be based on a post-market surveillance plan, the requirements for which are set out in Section 1.1 of Annex III. The post-market surveillance plan shall be part of the technical documentation.',
  },
  {
    anchor: 'MDR-Art86',
    heading: 'MDR Article 86 — Periodic safety update report (PSUR)',
    text: 'Manufacturers of class IIa, class IIb and class III devices shall prepare a periodic safety update report for each device and where relevant for each category or group of devices summarising the results and conclusions of the analyses of the post-market surveillance data gathered as a result of the post-market surveillance plan.',
  },
  {
    anchor: 'MDR-Art87',
    heading: 'MDR Article 87 — Reporting of serious incidents and field safety corrective actions',
    text: 'Manufacturers of devices made available on the Union market, other than investigational devices, shall report to the relevant competent authorities any serious incident involving devices made available on the Union market, except expected side-effects which are clearly documented and quantified in the product information and assessed in the technical documentation.',
  },
  {
    anchor: 'MDR-AnnexI-1',
    heading: 'MDR Annex I — General safety and performance requirements (Section 1)',
    text: 'Devices shall achieve the performance intended by their manufacturer and shall be designed and manufactured in such a way that, during normal conditions of use, they are suitable for their intended purpose. They shall be safe and effective and shall not compromise the clinical condition or the safety of patients, or the safety and health of users or, where applicable, other persons.',
  },
  {
    anchor: 'MDR-AnnexI-3',
    heading: 'MDR Annex I — Risk management system (Section 3)',
    text: 'Manufacturers shall establish, implement, document and maintain a risk management system. Risk management shall be understood as a continuous iterative process throughout the entire lifecycle of a device, requiring regular systematic updating.',
  },
  {
    anchor: 'MDR-AnnexII',
    heading: 'MDR Annex II — Technical documentation',
    text: 'The technical documentation and, if applicable, the summary thereof to be drawn up by the manufacturer shall be presented in a clear, organised, readily searchable and unambiguous manner and shall include in particular the elements listed in this Annex including device description, intended purpose, design and manufacturing information, and risk-benefit analysis.',
  },
  {
    anchor: 'MDR-AnnexIII',
    heading: 'MDR Annex III — Technical documentation on post-market surveillance',
    text: 'The technical documentation on post-market surveillance to be drawn up by the manufacturer in accordance with Articles 83 to 86 shall be presented in a clear, organised, readily searchable and unambiguous manner and shall include in particular the post-market surveillance plan and the post-market surveillance report.',
  },
  {
    anchor: 'MDR-AnnexVIII',
    heading: 'MDR Annex VIII — Classification rules',
    text: 'Application of the classification rules shall be governed by the intended purpose of the devices. If the device in question is intended to be used in combination with another device, the classification rules shall apply separately to each of the devices. Devices are divided into classes I, IIa, IIb and III, taking into account the intended purpose of the devices and their inherent risks.',
  },
  {
    anchor: 'MDR-AnnexXIV',
    heading: 'MDR Annex XIV — Clinical evaluation and post-market clinical follow-up',
    text: 'Manufacturers shall plan, conduct and document a clinical evaluation in accordance with this Annex and Article 61. Post-market clinical follow-up shall be understood to be a continuous process that updates the clinical evaluation and shall be addressed in the manufacturer post-market surveillance plan.',
  },
];

const MFDS_SECTIONS: SeedSection[] = [
  {
    anchor: 'MFDS-Act-Art6',
    heading: '의료기기법 제6조 — 제조업의 허가',
    text: '의료기기를 업으로 제조하려는 자는 식품의약품안전처장의 허가를 받아야 한다. 제1항에 따른 허가를 받으려는 자는 총리령으로 정하는 시설과 제조 및 품질관리체계를 갖추어야 하며, 제조소별로 식품의약품안전처장에게 제조업 허가를 신청하여야 한다.',
  },
  {
    anchor: 'MFDS-Act-Art7',
    heading: '의료기기법 제7조 — 제조허가 등',
    text: '의료기기 제조업자가 의료기기를 제조하려는 경우에는 제조하려는 의료기기에 대하여 식품의약품안전처장의 제조허가 또는 제조인증을 받거나 제조신고를 하여야 한다. 다만 인체에 미치는 위해의 정도가 매우 낮은 의료기기로서 총리령으로 정하는 의료기기는 그러하지 아니하다.',
  },
  {
    anchor: 'MFDS-Act-Art10',
    heading: '의료기기법 제10조 — 임상시험계획의 승인',
    text: '의료기기로 임상시험을 하려는 자는 임상시험계획서를 작성하여 식품의약품안전처장의 승인을 받아야 한다. 다만 시판 중인 의료기기의 허가사항에 대한 임상적 효과관찰 및 이상사례 조사를 위한 시험은 그러하지 아니하다.',
  },
  {
    anchor: 'MFDS-Act-Art13',
    heading: '의료기기법 제13조 — 제조업자의 준수사항',
    text: '제조업자는 제조 및 품질관리에 관한 사항으로서 총리령으로 정하는 사항을 준수하여야 한다. 제조업자는 의료기기의 제조와 품질관리에 관한 사항을 준수하기 위하여 제조 및 품질관리기준에 적합하게 제조소를 운영하여야 한다.',
  },
  {
    anchor: 'MFDS-Act-Art15',
    heading: '의료기기법 제15조 — 수입업의 허가 등',
    text: '의료기기를 업으로 수입하려는 자는 식품의약품안전처장의 허가를 받아야 한다. 수입업자가 의료기기를 수입하려는 경우에는 수입하려는 의료기기에 대하여 식품의약품안전처장의 수입허가 또는 수입인증을 받거나 수입신고를 하여야 한다.',
  },
  {
    anchor: 'MFDS-Act-Art20',
    heading: '의료기기법 제20조 — 판매업의 신고',
    text: '의료기기를 업으로 판매 또는 임대하려는 자는 영업소마다 시장 군수 또는 구청장에게 판매업 신고 또는 임대업 신고를 하여야 한다. 다만 의료기기 제조업자나 수입업자가 그가 제조하거나 수입한 의료기기를 직접 판매하는 경우에는 그러하지 아니하다.',
  },
  {
    anchor: 'MFDS-Act-Art26',
    heading: '의료기기법 제26조 — 의료기기 임상시험기관',
    text: '식품의약품안전처장은 의료기기에 관한 임상시험을 실시할 수 있는 의료기기 임상시험기관을 지정할 수 있다. 임상시험기관으로 지정받으려는 자는 총리령으로 정하는 인력 시설 및 운영체계를 갖추어 식품의약품안전처장에게 신청하여야 한다.',
  },
  {
    anchor: 'MFDS-Act-Art28',
    heading: '의료기기법 제28조 — 부작용 등의 보고',
    text: '제조업자 수입업자 및 의료기기 취급자는 의료기기로 인하여 사망 또는 인체에 심각한 부작용이 발생하였거나 발생할 우려가 있음을 인지한 경우 식품의약품안전처장에게 그 사실을 보고하여야 한다.',
  },
  {
    anchor: 'MFDS-Act-Art31',
    heading: '의료기기법 제31조 — 회수 및 폐기 명령 등',
    text: '식품의약품안전처장 시도지사 또는 시장 군수 구청장은 의료기기가 안전성 또는 유효성에 문제가 있어 국민건강에 위해를 줄 우려가 있다고 판단되는 경우에는 해당 의료기기의 제조업자 수입업자 또는 판매업자에게 그 의료기기의 회수 또는 폐기를 명할 수 있다.',
  },
  {
    anchor: 'MFDS-Notice-2023-1',
    heading: '의료기기 제조 및 품질관리 기준 — 제2장 품질경영시스템',
    text: '제조업자는 품질경영시스템을 수립 문서화 시행 유지 및 효과성을 지속적으로 개선하여야 한다. 품질경영시스템은 의료기기의 의도된 용도와 위험에 비례하여 적절히 구축되어야 하며 ISO 13485 요구사항을 충족하여야 한다.',
  },
  {
    anchor: 'MFDS-Notice-2023-4',
    heading: '의료기기 제조 및 품질관리 기준 — 제4장 자원관리',
    text: '제조업자는 품질경영시스템 운영에 필요한 인적자원 기반시설 및 작업환경을 결정하고 제공하여야 한다. 의료기기의 품질에 영향을 미치는 업무를 수행하는 인원은 적절한 학력 교육 훈련 기능 및 경험에 근거하여 적격성을 갖추어야 한다.',
  },
  {
    anchor: 'MFDS-Notice-2023-7',
    heading: '의료기기 제조 및 품질관리 기준 — 제7장 제품실현',
    text: '제조업자는 의료기기의 실현에 필요한 프로세스를 계획하고 개발하여야 한다. 제품실현 계획은 품질경영시스템의 다른 프로세스 요구사항과 일치하여야 하며 위험관리에 대한 내용을 포함하여야 한다.',
  },
  {
    anchor: 'MFDS-Notice-Class-Rule1',
    heading: '의료기기 등급분류 — 일반원칙',
    text: '의료기기는 인체에 미치는 잠재적 위해의 정도에 따라 1등급 2등급 3등급 4등급으로 분류한다. 등급분류는 의료기기의 사용목적과 사용방법에 따라 결정되며 식품의약품안전처장은 의료기기 등급분류 기준을 고시하여야 한다.',
  },
  {
    anchor: 'MFDS-Notice-Class-Rule2',
    heading: '의료기기 등급분류 — 비침습적 의료기기 분류',
    text: '비침습적 의료기기 중 인체로부터 채취된 체액 또는 조직을 일시적으로 보관하는 의료기기는 2등급으로 분류된다. 다만 채취된 체액 또는 조직이 환자에게 다시 사용될 의료기기는 등급분류 규칙을 추가로 적용한다.',
  },
  {
    anchor: 'MFDS-Notice-Class-Rule3',
    heading: '의료기기 등급분류 — 침습적 의료기기 분류',
    text: '인체에 일시적 또는 단기간 사용되는 침습적 의료기기는 2등급으로 분류된다. 인체에 장기간 사용되는 침습적 의료기기 중 중추순환계나 중추신경계에 직접 접촉하는 의료기기는 4등급으로 분류된다.',
  },
  {
    anchor: 'MFDS-Notice-IVD-1',
    heading: '체외진단의료기기법 제3조 — 등급분류',
    text: '체외진단의료기기는 사용목적과 인체에 미치는 잠재적 위해의 정도에 따라 1등급부터 4등급까지로 분류된다. 등급분류 기준은 식품의약품안전처장이 정하여 고시한다.',
  },
  {
    anchor: 'MFDS-Notice-IVD-Art5',
    heading: '체외진단의료기기법 제5조 — 제조허가',
    text: '체외진단의료기기를 업으로 제조하려는 자는 식품의약품안전처장의 허가를 받아야 한다. 제조하려는 체외진단의료기기에 대하여는 별도의 제조허가 또는 인증을 받아야 한다.',
  },
  {
    anchor: 'MFDS-Notice-Postmarket-1',
    heading: '의료기기 시판후조사 — 일반원칙',
    text: '의료기기 시판후조사는 시판된 의료기기의 안전성 및 유효성을 지속적으로 확인하기 위하여 실시하는 조사이다. 제조업자 및 수입업자는 시판후조사 계획을 수립하여 식품의약품안전처장의 승인을 받아 실시하여야 한다.',
  },
  {
    anchor: 'MFDS-Notice-UDI-1',
    heading: '의료기기 표준코드(UDI) — 부착 의무',
    text: '의료기기 제조업자 및 수입업자는 식품의약품안전처장이 정하는 의료기기에 대하여 의료기기 표준코드를 부여하고 의료기기 또는 그 포장에 표시하여야 한다. 표준코드는 의료기기를 식별하고 추적할 수 있도록 부여된다.',
  },
  {
    anchor: 'MFDS-Notice-Adverse-1',
    heading: '의료기기 부작용 등 안전성 정보 보고',
    text: '의료기기 취급자는 의료기기의 사용으로 인하여 사망 또는 인체에 심각한 부작용이 발생하였거나 발생할 우려가 있음을 인지한 때에는 그 사실을 알게 된 날부터 7일 이내에 식품의약품안전처장에게 보고하여야 한다.',
  },
];

const NMPA_SECTIONS: SeedSection[] = [
  {
    anchor: 'NMPA-Reg-Art1',
    heading: '医疗器械监督管理条例 第一条 — 立法宗旨',
    text: '为了保证医疗器械的安全 有效 保障人体健康和生命安全 促进医疗器械产业发展 制定本条例。本条例适用于在中华人民共和国境内从事医疗器械的研制 生产 经营 使用活动及其监督管理。',
  },
  {
    anchor: 'NMPA-Reg-Art4',
    heading: '医疗器械监督管理条例 第四条 — 风险分类管理',
    text: '国家对医疗器械按照风险程度实行分类管理。第一类是风险程度低 实行常规管理可以保证其安全 有效的医疗器械。第二类是具有中度风险 需要严格控制管理以保证其安全 有效的医疗器械。第三类是具有较高风险 需要采取特别措施严格控制管理以保证其安全 有效的医疗器械。',
  },
  {
    anchor: 'NMPA-Reg-Art13',
    heading: '医疗器械监督管理条例 第十三条 — 第一类医疗器械备案',
    text: '第一类医疗器械实行产品备案管理。从事第一类医疗器械生产的 由生产企业向所在地设区的市级人民政府负责药品监督管理的部门备案。备案时应当提交相关资料 备案部门收到资料后应当立即核对并出具凭证。',
  },
  {
    anchor: 'NMPA-Reg-Art14',
    heading: '医疗器械监督管理条例 第十四条 — 第二类 第三类医疗器械注册',
    text: '第二类 第三类医疗器械实行产品注册管理。第二类医疗器械由省 自治区 直辖市人民政府药品监督管理部门审查 批准后发给医疗器械注册证。第三类医疗器械由国务院药品监督管理部门审查 批准后发给医疗器械注册证。',
  },
  {
    anchor: 'NMPA-Reg-Art20',
    heading: '医疗器械监督管理条例 第二十条 — 临床评价',
    text: '医疗器械产品注册 备案应当进行临床评价。第一类医疗器械的备案不需要进行临床评价。下列情形可以免于进行临床评价 工作机理明确 设计定型 同品种已上市并且无重大不良事件记录的成熟产品。',
  },
  {
    anchor: 'NMPA-Reg-Art27',
    heading: '医疗器械监督管理条例 第二十七条 — 生产许可',
    text: '从事第二类 第三类医疗器械生产的 应当向所在地省 自治区 直辖市人民政府药品监督管理部门提出申请。申请人应当提交与产品相适应的生产场地 环境条件 生产设备以及专业技术人员等资料。',
  },
  {
    anchor: 'NMPA-Reg-Art34',
    heading: '医疗器械监督管理条例 第三十四条 — 经营许可',
    text: '从事第二类医疗器械经营的 由经营企业向所在地设区的市级人民政府负责药品监督管理的部门备案。从事第三类医疗器械经营的 经营企业应当向所在地设区的市级人民政府负责药品监督管理的部门申请经营许可。',
  },
  {
    anchor: 'NMPA-Reg-Art39',
    heading: '医疗器械监督管理条例 第三十九条 — 进口医疗器械',
    text: '进口的医疗器械应当是在境外合法上市的医疗器械。境外医疗器械上市许可持有人应当通过其在中国境内设立的代理人办理进口医疗器械注册或者备案。代理人应当协助上市许可持有人履行本条例规定的义务。',
  },
  {
    anchor: 'NMPA-Reg-Art45',
    heading: '医疗器械监督管理条例 第四十五条 — 不良事件监测',
    text: '医疗器械上市许可持有人 经营企业 使用单位应当对所生产 经营 使用的医疗器械开展不良事件监测 评价医疗器械上市后风险 主动收集 及时报告医疗器械不良事件 并按照规定向国家医疗器械不良事件监测信息系统报告。',
  },
  {
    anchor: 'NMPA-Reg-Art48',
    heading: '医疗器械监督管理条例 第四十八条 — 缺陷召回',
    text: '医疗器械上市许可持有人发现其上市的医疗器械存在缺陷的 应当立即采取措施实施召回 通知有关经营企业 使用单位和使用者 及时公布召回信息 并将召回情况向负责药品监督管理的部门报告。',
  },
  {
    anchor: 'NMPA-Order-739-Art2',
    heading: '医疗器械生产监督管理办法 第二条 — 适用范围',
    text: '在中华人民共和国境内从事医疗器械生产活动及其监督管理 应当遵守本办法。从事医疗器械生产活动 应当遵守法律 法规 规章 强制性标准 经注册或者备案的产品技术要求并保证医疗器械生产质量。',
  },
  {
    anchor: 'NMPA-Order-739-Art10',
    heading: '医疗器械生产监督管理办法 第十条 — 生产质量管理体系',
    text: '医疗器械生产企业应当按照医疗器械生产质量管理规范的要求 建立健全与所生产产品相适应的生产质量管理体系并保持有效运行 在医疗器械的设计开发 生产 经营和服务的全过程中确保产品安全 有效。',
  },
  {
    anchor: 'NMPA-Order-739-Art21',
    heading: '医疗器械生产监督管理办法 第二十一条 — 委托生产',
    text: '医疗器械上市许可持有人可以自行生产医疗器械 也可以委托符合条件的企业生产医疗器械。具有高风险的植入性医疗器械不得委托生产 具体目录由国家药品监督管理局制定 调整并公布。',
  },
  {
    anchor: 'NMPA-Order-739-Art48',
    heading: '医疗器械生产监督管理办法 第四十八条 — 飞行检查',
    text: '药品监督管理部门根据监督管理工作需要 可以对医疗器械上市许可持有人 受托生产企业开展飞行检查。被检查单位应当配合检查工作 不得拒绝 逃避 妨碍。',
  },
  {
    anchor: 'NMPA-Annual-Report',
    heading: '医疗器械年度自查报告 — 编制要求',
    text: '医疗器械上市许可持有人应当每年对质量管理体系的运行情况进行全面自查 形成自查报告。自查报告应当于次年3月31日前向所在地省级药品监督管理部门提交 自查报告应当如实反映质量管理体系运行情况和发现的问题。',
  },
  {
    anchor: 'NMPA-Clinical-Trial-Art1',
    heading: '医疗器械临床试验质量管理规范 — 总则',
    text: '为加强医疗器械临床试验管理 维护受试者权益 保证临床试验过程规范 结果科学 真实 可靠 制定本规范。本规范适用于在中华人民共和国境内开展的需要进行临床试验审批的第三类医疗器械的临床试验。',
  },
  {
    anchor: 'NMPA-Clinical-Trial-Art16',
    heading: '医疗器械临床试验质量管理规范 第十六条 — 知情同意',
    text: '研究者应当向受试者详细说明试验的目的 风险 预期受益 替代治疗方案 受试者的权利和义务等 在受试者充分理解的基础上 由受试者本人或其法定代理人在知情同意书上签字并注明日期。',
  },
  {
    anchor: 'NMPA-Adverse-Event-Art10',
    heading: '医疗器械不良事件监测和再评价管理办法 第十条 — 报告时限',
    text: '医疗器械上市许可持有人发现或者获知所持有医疗器械发生死亡或严重伤害事件的 应当在发现或获知之日起15日内 通过国家医疗器械不良事件监测信息系统报告。导致死亡的应当在7日内报告。',
  },
  {
    anchor: 'NMPA-UDI-Notice-1',
    heading: '医疗器械唯一标识系统规则 第三条 — 实施范围',
    text: '医疗器械唯一标识由产品标识与生产标识组成。医疗器械上市许可持有人应当按照规定要求开展医疗器械唯一标识工作 在医疗器械产品或其包装上标识医疗器械唯一标识。',
  },
  {
    anchor: 'NMPA-Innovation-Art1',
    heading: '创新医疗器械特别审查程序',
    text: '为鼓励医疗器械创新发展 完善创新医疗器械审查机制 制定创新医疗器械特别审查程序。申请人申请创新医疗器械特别审查应当具有产品核心技术发明专利权 同时产品具有显著的临床应用价值。',
  },
];

const PMDA_SECTIONS: SeedSection[] = [
  {
    anchor: 'PMDA-Act-Art2',
    heading: '医薬品医療機器等法 第2条 — 定義',
    text: 'この法律で医療機器とは 人若しくは動物の疾病の診断 治療若しくは予防に使用されること 又は人若しくは動物の身体の構造若しくは機能に影響を及ぼすことが目的とされている機械器具等であって 政令で定めるものをいう。',
  },
  {
    anchor: 'PMDA-Act-Art2-5',
    heading: '医薬品医療機器等法 第2条第5項 — 高度管理医療機器',
    text: '高度管理医療機器とは 医療機器のうち 副作用又は機能の障害が生じた場合において 人の生命及び健康に重大な影響を与えるおそれがあることからその適切な管理が必要なものとして 厚生労働大臣が薬事審議会の意見を聴いて指定するものをいう。',
  },
  {
    anchor: 'PMDA-Act-Art23-2',
    heading: '医薬品医療機器等法 第23条の2 — 製造販売業の許可',
    text: '医療機器の製造販売をしようとする者は その種類に応じて 厚生労働大臣の許可を受けなければならない。この許可は5年ごとにその更新を受けなければ その期間の経過によって その効力を失う。',
  },
  {
    anchor: 'PMDA-Act-Art23-2-3',
    heading: '医薬品医療機器等法 第23条の2の3 — 製造業の登録',
    text: '医療機器の製造をしようとする者は 製造所ごとに 厚生労働大臣の登録を受けなければならない。前項の登録は5年ごとにその更新を受けなければ その期間の経過によって その効力を失う。',
  },
  {
    anchor: 'PMDA-Act-Art23-2-5',
    heading: '医薬品医療機器等法 第23条の2の5 — 医療機器の製造販売の承認',
    text: '医療機器の製造販売をしようとする者又は外国製造医療機器特例承認取得者は 品目ごとにその製造販売についての厚生労働大臣の承認を受けなければならない。承認を受けようとする者は申請書に臨床試験の試験成績に関する資料その他の資料を添付して申請しなければならない。',
  },
  {
    anchor: 'PMDA-Act-Art23-2-23',
    heading: '医薬品医療機器等法 第23条の2の23 — 認証医療機器',
    text: '指定高度管理医療機器又は管理医療機器の製造販売をしようとする者は 品目ごとに 厚生労働大臣の登録を受けた者の認証を受けなければならない。認証は基準への適合性についての書面審査及び実地調査により行う。',
  },
  {
    anchor: 'PMDA-Act-Art41',
    heading: '医薬品医療機器等法 第41条 — 基準への適合',
    text: '医療機器は その性状 品質又は性能がその物の使用の目的に応じて適切なものでなければならない。厚生労働大臣は医療機器の性状 品質及び性能の適正を図るため 必要があると認めるときは 薬事審議会の意見を聴いて 医療機器の規格を定めることができる。',
  },
  {
    anchor: 'PMDA-Act-Art63-2',
    heading: '医薬品医療機器等法 第63条の2 — 添付文書等の記載事項',
    text: '医療機器は これに添付する文書又はその容器若しくは被包に 使用上の注意のうち 当該医療機器の有効性及び安全性のために必要な情報として厚生労働省令で定めるものを記載しなければならない。',
  },
  {
    anchor: 'PMDA-Act-Art68-2',
    heading: '医薬品医療機器等法 第68条の2 — 医療機器の有効性及び安全性に関する情報',
    text: '医療機器の製造販売業者は 常時 その製造販売をする医療機器の有効性及び安全性に関する事項その他適正な使用のために必要な情報を収集し及び検討するとともに 薬局開設者 病院若しくは診療所の開設者又は医師 歯科医師 薬剤師等に対し これを提供するよう努めなければならない。',
  },
  {
    anchor: 'PMDA-Act-Art68-10',
    heading: '医薬品医療機器等法 第68条の10 — 副作用等の報告',
    text: '医療機器の製造販売業者又は外国製造医療機器特例承認取得者は その製造販売をし 又は承認を受けた医療機器について 当該医療機器の副作用その他の事由によるものと疑われる疾病 障害若しくは死亡の発生又は当該医療機器の使用によるものと疑われる感染症の発生に関する事項を知ったときは 厚生労働省令で定めるところにより その旨を厚生労働大臣に報告しなければならない。',
  },
  {
    anchor: 'PMDA-MO-169-QMS',
    heading: '医療機器及び体外診断用医薬品の製造管理及び品質管理の基準に関する省令 — 第3条',
    text: '製造販売業者等は 医療機器又は体外診断用医薬品の製造管理及び品質管理が適切かつ円滑に実施されるよう 品質マネジメントシステムを確立し 文書化し 実施し 維持し かつ その実効性を継続的に改善しなければならない。',
  },
  {
    anchor: 'PMDA-MO-169-Art4',
    heading: 'QMS省令 第4条 — 品質マニュアル',
    text: '製造販売業者等は 品質マニュアルを文書化し これを維持しなければならない。品質マニュアルには品質マネジメントシステムの適用範囲 文書化された手順及びプロセス間の相互関係についての記述を含めなければならない。',
  },
  {
    anchor: 'PMDA-MO-169-Art30',
    heading: 'QMS省令 第30条 — 設計開発',
    text: '製造販売業者等は 設計開発手順を文書化しなければならない。当該手順には設計開発の段階及び管理 設計開発に関する責任及び権限 設計開発に従事する人員間の連絡及び情報伝達 設計開発の検証及び妥当性確認の活動を含めなければならない。',
  },
  {
    anchor: 'PMDA-MO-169-Art45',
    heading: 'QMS省令 第45条 — 製造工程のバリデーション',
    text: '製造販売業者等は 製品の製造工程の結果が後続の監視又は測定で検証することができないものについて 当該製造工程の妥当性を確認するための手順を文書化し 確立しなければならない。',
  },
  {
    anchor: 'PMDA-MO-169-Art63',
    heading: 'QMS省令 第63条 — 是正措置',
    text: '製造販売業者等は 不適合の再発を防止するため その原因を除去する是正措置に関する手順を文書化しなければならない。是正措置は 検出された不適合のもたらす影響に応じたものでなければならない。',
  },
  {
    anchor: 'PMDA-GVP-MO-135',
    heading: 'GVP省令 — 製造販売後安全管理',
    text: '製造販売業者は 安全管理業務の手順に関する文書を作成し 製造販売後安全管理を適正かつ円滑に実施するため 安全管理情報の収集 検討及びその結果に基づく安全確保措置を実施しなければならない。',
  },
  {
    anchor: 'PMDA-GPSP-MO-171',
    heading: 'GPSP省令 — 製造販売後の調査及び試験',
    text: '製造販売業者は 製造販売後の調査及び試験の業務手順に関する文書を作成し 使用成績調査 製造販売後臨床試験を実施することにより当該医療機器の品質 有効性及び安全性に関する情報の収集等を行わなければならない。',
  },
  {
    anchor: 'PMDA-Recall-Art68-9',
    heading: '医薬品医療機器等法 第68条の9 — 回収',
    text: '医療機器の製造販売業者は その製造販売をする医療機器を回収するときは その旨を厚生労働大臣に届け出るとともに 回収の状況を厚生労働大臣に報告しなければならない。回収は患者の生命及び健康を保護するため迅速かつ確実に行わなければならない。',
  },
  {
    anchor: 'PMDA-MID-NET',
    heading: 'MID-NET — 医療情報データベース',
    text: 'MID-NETは 医薬品医療機器総合機構が運営する医療情報データベースシステムである。製造販売業者は 医療機器の市販後安全対策においてMID-NETを活用した薬剤疫学調査を実施することができる。調査計画書はPMDAの事前確認を受けることが望ましい。',
  },
  {
    anchor: 'PMDA-SAKIGAKE',
    heading: '先駆け審査指定制度',
    text: '先駆け審査指定制度は 世界に先駆けて開発され 早期の治験段階で著明な有効性が見込まれる医療機器を指定し 各種支援による開発促進と優先審査等による早期の実用化を目指す制度である。指定品目は通常6か月程度の優先審査の対象となる。',
  },
];

const SEED: SeedSource[] = [
  {
    orgLabel: 'FDA',
    title: '21 CFR Medical Device Regulations (Quality Corpus)',
    year: 2023,
    type: 'Regulation',
    region: 'US',
    url: 'https://www.ecfr.gov/current/title-21',
    sections: FDA_SECTIONS,
  },
  {
    orgLabel: 'EU-MDR',
    title: 'Regulation (EU) 2017/745 on medical devices (MDR)',
    year: 2017,
    type: 'Regulation',
    region: 'EU',
    url: 'https://eur-lex.europa.eu/eli/reg/2017/745/oj',
    sections: EU_MDR_SECTIONS,
  },
  {
    orgLabel: 'MFDS',
    title: '의료기기법 및 식약처 고시 (Medical Device Act of Korea)',
    year: 2023,
    type: 'Regulation',
    region: 'KR',
    url: 'https://www.mfds.go.kr/',
    sections: MFDS_SECTIONS,
  },
  {
    orgLabel: 'NMPA',
    title:
      '医疗器械监督管理条例 (Regulations on the Supervision and Administration of Medical Devices)',
    year: 2021,
    type: 'Regulation',
    region: 'CN',
    url: 'https://www.nmpa.gov.cn/',
    sections: NMPA_SECTIONS,
  },
  {
    orgLabel: 'PMDA',
    title: '医薬品医療機器等法 (Pharmaceuticals and Medical Devices Act, PMDEA)',
    year: 2023,
    type: 'Regulation',
    region: 'JP',
    url: 'https://www.pmda.go.jp/',
    sections: PMDA_SECTIONS,
  },
];

interface SeedSummary {
  sourcesInserted: number;
  sourcesSkipped: number;
  sectionsInserted: number;
  sectionsSkipped: number;
}

export async function runSeedCorpus(
  database: typeof db = db,
  embed: (texts: string[]) => Promise<(number[] | null)[]> = embedChunks,
): Promise<SeedSummary> {
  const summary: SeedSummary = {
    sourcesInserted: 0,
    sourcesSkipped: 0,
    sectionsInserted: 0,
    sectionsSkipped: 0,
  };

  for (const seed of SEED) {
    // Idempotency: check by title (org_label is not unique on its own).
    const existing = await database
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.title, seed.title))
      .limit(1);

    let sourceId: string;
    if (existing.length > 0 && existing[0]) {
      sourceId = existing[0].id;
      summary.sourcesSkipped += 1;
    } else {
      const [titleEmbedding] = await embed([`${seed.orgLabel} ${seed.title}`]);
      const inserted = await database
        .insert(sources)
        .values({
          orgLabel: seed.orgLabel,
          title: seed.title,
          year: seed.year,
          type: seed.type,
          region: seed.region,
          url: seed.url,
          // REQ-SOURCE-GOV-004/008 — set authorityGrade from corpus type.
          authorityGrade: gradeForType(seed.type),
          approvalStatus: 'approved',
          embedding: titleEmbedding,
        })
        .returning({ id: sources.id });
      const row = inserted[0];
      if (row === undefined) throw new Error(`Insert failed for ${seed.title}`);
      sourceId = row.id;
      summary.sourcesInserted += 1;
    }

    // Batch-embed all section texts for this source in one OpenAI call.
    const sectionTexts = seed.sections.map((s) => `${s.heading}\n${s.text}`);
    const sectionEmbeddings = await embed(sectionTexts);

    for (let i = 0; i < seed.sections.length; i += 1) {
      const section = seed.sections[i];
      if (!section) {
        throw new Error(`Section missing at index ${i} of ${seed.title}`);
      }
      const embedding = sectionEmbeddings[i] ?? null;

      try {
        // Use .returning() to make the call shape symmetric with the sources
        // insert above and to make unit-test mocking with biome's
        // noThenProperty rule straightforward.
        await database
          .insert(sourceSections)
          .values({
            sourceId,
            anchor: section.anchor,
            heading: section.heading,
            text: section.text,
            embedding,
          })
          .returning({ id: sourceSections.id });
        summary.sectionsInserted += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        // UNIQUE(source_id, anchor) violation → already seeded, skip silently.
        if (msg.includes('source_sections_source_anchor_idx')) {
          summary.sectionsSkipped += 1;
          continue;
        }
        throw err;
      }
    }
  }

  return summary;
}

/** Total number of (source, section) rows the seed will attempt to insert. */
export const TOTAL_SECTIONS = SEED.reduce((sum, s) => sum + s.sections.length, 0);
/** Total number of source rows. */
export const TOTAL_SOURCES = SEED.length;
/** Exposed for unit tests — the raw seed data. */
export const SEED_DATA = SEED;

// ---------------------------------------------------------------------------
// CLI entry point — only runs when invoked directly via `tsx scripts/seed-corpus.ts`.
// Vitest imports this module to test runSeedCorpus without triggering main().
// ---------------------------------------------------------------------------
const isCliEntry =
  typeof process !== 'undefined' &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  process.argv[1].replace(/\\/g, '/').endsWith('scripts/seed-corpus.ts');

if (isCliEntry) {
  const hasRealOpenAiKey =
    !!process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('dev-placeholder');
  const embedFn = hasRealOpenAiKey
    ? embedChunks
    : async (texts: string[]): Promise<(number[] | null)[]> => texts.map(() => null);

  runSeedCorpus(db, embedFn)
    .then((summary) => {
      logger.info('seed-corpus complete', { summary });
      process.exit(0);
    })
    .catch((err: unknown) => {
      logger.error('seed-corpus failed', { err });
      process.exit(1);
    });
}
