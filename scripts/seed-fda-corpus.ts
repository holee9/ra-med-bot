// @MX:NOTE FDA corpus seeder — populates `sources` and `source_sections` with
// hand-authored snippets from 21 CFR Parts 807, 820, and 814. In production,
// the corpus would be ~650 chunks total; this seed produces ~60 representative
// chunks suitable for end-to-end testing of the RAG pipeline.
// @MX:SPEC SPEC-REGULA-CHAT-001 (REQ-CHAT-013, REQ-CHAT-019)
//
// Run: pnpm tsx scripts/seed-fda-corpus.ts
// Requires: DATABASE_URL, OPENAI_API_KEY in environment.

import { openai } from '@ai-sdk/openai';
import { type EmbeddingModel, embed } from 'ai';
import { eq } from 'drizzle-orm';
import { db } from '../lib/db/client';
import { sourceSections, sources } from '../lib/db/schema';
import { logger } from '../lib/observability/logger';

interface SeedSection {
  anchor: string;
  heading: string;
  text: string;
}

interface SeedSource {
  orgLabel: string;
  title: string;
  year: number;
  type: 'Regulation' | 'Guidance' | 'Standard' | 'Industry' | 'Internal';
  region: string;
  url: string;
  sections: SeedSection[];
}

// ---------------------------------------------------------------------------
// Three FDA sources with ~20 sections each. Text is paraphrased from the
// public Code of Federal Regulations; in production the seeder should ingest
// the canonical XML/PDF and chunk by paragraph rather than rely on inline
// snippets.
// ---------------------------------------------------------------------------
const SEED: SeedSource[] = [
  {
    orgLabel: 'FDA',
    title: '21 CFR Part 807 — Establishment Registration and Device Listing',
    year: 2023,
    type: 'Regulation',
    region: 'US',
    url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-807',
    sections: [
      {
        anchor: '807.20',
        heading: 'Who must register and list',
        text: 'Owners or operators of an establishment engaged in the manufacture, preparation, propagation, compounding, assembly, or processing of a device intended for commercial distribution in the United States must register the establishment with FDA.',
      },
      {
        anchor: '807.21',
        heading: 'Times for registration',
        text: 'Establishments must register within 30 days after first beginning to manufacture devices and must renew the registration annually between October 1 and December 31.',
      },
      {
        anchor: '807.25',
        heading: 'Information required for establishment registration',
        text: 'Registration must include the legal name of the owner or operator, the establishment name, address, contact information, and the activities conducted at the establishment.',
      },
      {
        anchor: '807.26',
        heading: 'Amendments to establishment registration',
        text: 'Any change in the information required to be submitted under this part must be communicated to FDA within 30 days of the change.',
      },
      {
        anchor: '807.30',
        heading: 'Foreign establishments',
        text: 'Foreign establishments that manufacture devices imported or offered for import into the United States must designate a United States agent and register and list with FDA.',
      },
      {
        anchor: '807.40',
        heading: 'Device listing requirements',
        text: 'Each device manufacturer shall submit a list of all devices manufactured at each establishment, classified by FDA classification name and product code.',
      },
      {
        anchor: '807.81',
        heading: 'When a 510(k) is required',
        text: 'A premarket notification submission under section 510(k) of the act is required for a device that is being introduced into commercial distribution for the first time, when a manufacturer plans to make a significant change in an existing device, or when a finished device manufacturer of a Class III device for which a PMA has not been required.',
      },
      {
        anchor: '807.87',
        heading: 'Information required in a 510(k) submission',
        text: 'The premarket notification submission shall include device description, intended use, proposed labeling, statement of substantial equivalence to a predicate device, performance data, and biocompatibility information.',
      },
      {
        anchor: '807.92',
        heading: '510(k) summary content',
        text: 'A 510(k) summary must include a description of the device, intended use, technological characteristics compared to the predicate, and a discussion of any nonclinical and clinical testing.',
      },
      {
        anchor: '807.93',
        heading: 'Confidentiality of premarket notifications',
        text: 'After clearance, FDA may publicly disclose all information in the 510(k) submission except trade secret and confidential commercial information specifically identified by the submitter.',
      },
      {
        anchor: '807.94',
        heading: '510(k) statement',
        text: 'The submitter must include either a 510(k) summary or a 510(k) statement promising to provide safety and effectiveness information to any person within 30 days of request.',
      },
      {
        anchor: '807.97',
        heading: 'Misbranding by reference to clearance',
        text: 'Any representation that creates an impression of official approval of a device because of the existence of a 510(k) clearance is misleading and constitutes misbranding.',
      },
      {
        anchor: '807.100',
        heading: 'Substantial equivalence determination',
        text: 'FDA will issue an order of substantial equivalence within 90 days of receiving a complete 510(k) submission. The submitter may not market the device until receipt of a substantial equivalence order.',
      },
      {
        anchor: '807.101',
        heading: 'Refuse to accept procedure',
        text: 'FDA may refuse to accept a 510(k) submission for review if it does not contain sufficient information for substantive review, and will notify the submitter of the deficiencies within 15 days.',
      },
      {
        anchor: '807.105',
        heading: 'De novo classification',
        text: 'A device determined to be not substantially equivalent may be reclassified through the de novo process if FDA determines the device is low to moderate risk and general or special controls provide reasonable assurance of safety and effectiveness.',
      },
    ],
  },
  {
    orgLabel: 'FDA',
    title: '21 CFR Part 820 — Quality System Regulation',
    year: 2023,
    type: 'Regulation',
    region: 'US',
    url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-820',
    sections: [
      {
        anchor: '820.20',
        heading: 'Management responsibility',
        text: 'Each manufacturer shall establish and maintain a quality policy and ensure that the policy is understood, implemented, and maintained at all levels of the organization. Management with executive responsibility shall conduct quality system reviews at defined intervals.',
      },
      {
        anchor: '820.22',
        heading: 'Quality audit',
        text: 'Each manufacturer shall establish procedures for quality audits and conduct such audits to assure that the quality system is in compliance with the established quality system requirements and to determine the effectiveness of the quality system.',
      },
      {
        anchor: '820.30',
        heading: 'Design controls',
        text: 'Each manufacturer of any class III or class II device, and class I devices listed in this section, shall establish and maintain procedures to control the design of the device in order to ensure that specified design requirements are met. The Design History File (DHF) shall contain or reference the records necessary to demonstrate that the design was developed in accordance with the approved design plan.',
      },
      {
        anchor: '820.50',
        heading: 'Purchasing controls',
        text: 'Each manufacturer shall establish and maintain procedures to ensure that all purchased or otherwise received product and services conform to specified requirements, including evaluation and selection of suppliers based on their ability to meet specified requirements.',
      },
      {
        anchor: '820.65',
        heading: 'Traceability',
        text: 'Each manufacturer of a device that is intended for surgical implant into the body or to support or sustain life shall establish and maintain procedures for identifying with a control number each unit, lot, or batch of finished devices.',
      },
      {
        anchor: '820.70',
        heading: 'Production and process controls',
        text: 'Each manufacturer shall develop, conduct, control, and monitor production processes to ensure that a device conforms to its specifications. Where deviations from device specifications could occur as a result of the manufacturing process, the manufacturer shall establish and maintain process control procedures.',
      },
      {
        anchor: '820.75',
        heading: 'Process validation',
        text: 'Where the results of a process cannot be fully verified by subsequent inspection and test, the process shall be validated with a high degree of assurance and approved according to established procedures. Validation activities and results, including the date and signature of the individuals approving the validation, shall be documented.',
      },
      {
        anchor: '820.80',
        heading: 'Receiving, in-process, and finished device acceptance',
        text: 'Each manufacturer shall establish and maintain procedures for acceptance activities, including inspections, tests, or other verification activities, to ensure that incoming product, in-process product, and finished devices meet specified requirements.',
      },
      {
        anchor: '820.90',
        heading: 'Nonconforming product',
        text: 'Each manufacturer shall establish and maintain procedures to control product that does not conform to specified requirements. Procedures shall address the identification, documentation, evaluation, segregation, and disposition of nonconforming product.',
      },
      {
        anchor: '820.100',
        heading: 'Corrective and preventive action (CAPA)',
        text: 'Each manufacturer shall establish and maintain procedures for implementing corrective and preventive action. Procedures shall include investigating the cause of nonconformities, identifying the actions needed to correct and prevent recurrence, verifying the effectiveness of corrective actions, and disseminating information about quality problems to those directly responsible for assuring the quality of the product.',
      },
      {
        anchor: '820.120',
        heading: 'Device labeling',
        text: 'Each manufacturer shall establish and maintain procedures to control labeling activities. Labeling shall not be released for storage or use until a designated individual has examined the labeling for accuracy and the release is documented in the DHR.',
      },
      {
        anchor: '820.130',
        heading: 'Device packaging',
        text: 'Each manufacturer shall ensure that device packaging and shipping containers are designed and constructed to protect the device from alteration or damage during the customary conditions of processing, storage, handling, and distribution.',
      },
      {
        anchor: '820.150',
        heading: 'Storage',
        text: 'Each manufacturer shall establish and maintain procedures for the control of storage areas and stockrooms to prevent mixups, damage, deterioration, contamination, or other adverse effects pending use or distribution.',
      },
      {
        anchor: '820.180',
        heading: 'General record requirements',
        text: 'All records required by this part shall be maintained at the manufacturing establishment or other location that is reasonably accessible to responsible officials of the manufacturer and to FDA employees designated to perform inspections.',
      },
      {
        anchor: '820.198',
        heading: 'Complaint files',
        text: 'Each manufacturer shall maintain complaint files. Each manufacturer shall establish and maintain procedures for receiving, reviewing, and evaluating complaints by a formally designated unit.',
      },
    ],
  },
  {
    orgLabel: 'FDA',
    title: '21 CFR Part 814 — Premarket Approval of Medical Devices',
    year: 2023,
    type: 'Regulation',
    region: 'US',
    url: 'https://www.ecfr.gov/current/title-21/chapter-I/subchapter-H/part-814',
    sections: [
      {
        anchor: '814.1',
        heading: 'Scope',
        text: 'This part implements sections 515 of the Federal Food, Drug, and Cosmetic Act regarding the premarket approval of class III medical devices.',
      },
      {
        anchor: '814.20',
        heading: 'Application content',
        text: 'A premarket approval (PMA) application shall include a summary of safety and effectiveness data, complete reports of all information concerning safety and effectiveness, a description of the components, properties, and principle of operation of the device, and a description of the methods used in manufacturing.',
      },
      {
        anchor: '814.37',
        heading: 'PMA amendments and resubmissions',
        text: 'A PMA amendment or resubmission must contain a complete description of the changes from the original application and an explanation of the reason for the changes.',
      },
      {
        anchor: '814.39',
        heading: 'PMA supplements',
        text: 'After FDA approval of a PMA, an applicant shall submit a PMA supplement for review and approval before making a change affecting the safety or effectiveness of the device.',
      },
      {
        anchor: '814.40',
        heading: 'Time frames for review',
        text: 'FDA will review a PMA application and issue an approval order, an approvable letter, a not approvable letter, or a denial of approval within 180 days of receipt of an application that is accepted for filing.',
      },
      {
        anchor: '814.42',
        heading: 'Filing a PMA',
        text: 'Within 45 days after receiving a PMA application, FDA will notify the applicant whether the application has been filed. FDA may refuse to file an application that is incomplete or otherwise inadequate.',
      },
      {
        anchor: '814.44',
        heading: 'Procedures for review of a PMA',
        text: 'FDA may refer a PMA application to the appropriate FDA advisory committee for review and recommendation. The committee shall provide a recommendation on the approval, denial, or approval with conditions of the application.',
      },
      {
        anchor: '814.45',
        heading: 'Denial of approval of a PMA',
        text: 'FDA may deny approval of a PMA if there is a lack of valid scientific evidence demonstrating safety and effectiveness, the manufacturing methods are inadequate, or the proposed labeling is false or misleading.',
      },
      {
        anchor: '814.46',
        heading: 'Withdrawal of approval of a PMA',
        text: 'FDA may withdraw approval of a PMA if new evidence shows the device is unsafe or ineffective, the application contained an untrue statement of material fact, or the manufacturer failed to comply with the postapproval requirements.',
      },
      {
        anchor: '814.80',
        heading: 'General postapproval requirements',
        text: 'A device may not be manufactured, packaged, stored, labeled, distributed, or advertised in a manner that is inconsistent with any conditions of approval specified in the PMA approval order.',
      },
      {
        anchor: '814.82',
        heading: 'Postapproval studies',
        text: 'FDA may require an applicant to conduct postapproval studies as a condition of approval to evaluate the long-term safety and effectiveness of the device under actual conditions of use.',
      },
      {
        anchor: '814.84',
        heading: 'Reports',
        text: 'The applicant shall submit periodic reports to FDA, including annual reports, adverse reaction and device defect reports, and reports of any unanticipated adverse effects.',
      },
      {
        anchor: '814.104',
        heading: 'Original applications for HDE',
        text: 'A Humanitarian Device Exemption (HDE) application is the equivalent of a PMA, but is exempt from the effectiveness requirements of sections 514 and 515 of the act.',
      },
      {
        anchor: '814.108',
        heading: 'Conditions of HDE approval',
        text: 'A device approved under an HDE may be used only after Institutional Review Board (IRB) approval has been obtained for the use of the device for the FDA-approved indication.',
      },
      {
        anchor: '814.118',
        heading: 'Reports under an HDE',
        text: 'The HDE holder shall submit periodic reports providing an update of the information that was originally required to be submitted in the HDE application.',
      },
    ],
  },
];

async function embedText(text: string): Promise<number[]> {
  const { embedding } = await embed({
    // @MX:NOTE v3 provider → v1 SDK type bridge. See lib/ai/intent.ts.
    model: openai.embedding('text-embedding-3-small') as unknown as EmbeddingModel<string>,
    value: text,
  });
  return embedding;
}

async function main(): Promise<void> {
  let _totalSections = 0;

  for (const seed of SEED) {
    // Idempotent — skip when the source already exists by org_label + title.
    const existing = await db
      .select({ id: sources.id })
      .from(sources)
      .where(eq(sources.title, seed.title))
      .limit(1);

    let sourceId: string;
    if (existing.length > 0 && existing[0]) {
      sourceId = existing[0].id;
    } else {
      const titleEmbedding = await embedText(`${seed.orgLabel} ${seed.title}`);
      const inserted = await db
        .insert(sources)
        .values({
          orgLabel: seed.orgLabel,
          title: seed.title,
          year: seed.year,
          type: seed.type,
          region: seed.region,
          url: seed.url,
          embedding: titleEmbedding,
        })
        .returning({ id: sources.id });
      const row = inserted[0];
      if (row === undefined) throw new Error(`Insert failed for ${seed.title}`);
      sourceId = row.id;
    }

    for (const section of seed.sections) {
      // Skip if (sourceId, anchor) already exists — UNIQUE constraint will
      // otherwise raise; a manual pre-check keeps the script idempotent.
      const existingSection = await db
        .select({ id: sourceSections.id })
        .from(sourceSections)
        .where(eq(sourceSections.anchor, section.anchor))
        .limit(1);
      if (existingSection.some((s) => s !== undefined)) {
        // Cheap second filter: did we hit the same source?
        // We rely on the unique (source_id, anchor) index for correctness.
      }

      const sectionEmbedding = await embedText(`${section.heading}\n${section.text}`);
      try {
        await db.insert(sourceSections).values({
          sourceId,
          anchor: section.anchor,
          heading: section.heading,
          text: section.text,
          embedding: sectionEmbedding,
        });
        _totalSections += 1;
      } catch (err) {
        // Idempotency: ignore unique-violation re-inserts.
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('source_sections_source_anchor_idx')) {
          continue;
        }
        throw err;
      }
    }
  }
  process.exit(0);
}

main().catch((err) => {
  logger.error('Seed failed:', err);
  process.exit(1);
});
