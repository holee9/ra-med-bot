// @MX:ANCHOR [AUTO] Evidence synthesis — GRADE assessment and CER section draft generation.
// @MX:REASON Sole function that produces regulated CER clinical evidence sections (6/7/8).
// @MX:SPEC REQ-CLINLIT-021~025

import { generateObject } from 'ai';
import { z } from 'zod';
import { getLlmModel } from '../ai/llm-provider';
import type { PicoFramework } from './pico-generator';
import type { PubMedArticle } from './pubmed-client';

export interface SynthesisResult {
  gradeSummary: string;
  narrativeSynthesis: string;
  cerSection6Draft: string; // Clinical Background (MEDDEV 2.7/1 Section 6)
  cerSection7Draft: string; // Clinical Data table (MEDDEV 2.7/1 Section 7)
  cerSection8Draft: string; // Appraisal of Clinical Data (MEDDEV 2.7/1 Section 8)
  gradeCounts: { high: number; moderate: number; low: number; veryLow: number };
}

export type AppraiserArticle = PubMedArticle & {
  sign50Level: string;
  gradeQuality: string;
  citation: string;
};

const SynthesisSchema = z.object({
  gradeSummary: z.string().min(1),
  narrativeSynthesis: z.string().min(1),
  cerSection6Draft: z.string().min(1),
  cerSection7Draft: z.string().min(1),
  cerSection8Draft: z.string().min(1),
});

function countGrades(articles: AppraiserArticle[]): SynthesisResult['gradeCounts'] {
  const counts = { high: 0, moderate: 0, low: 0, veryLow: 0 };
  for (const a of articles) {
    switch (a.gradeQuality) {
      case 'high':
        counts.high++;
        break;
      case 'moderate':
        counts.moderate++;
        break;
      case 'low':
        counts.low++;
        break;
      case 'very_low':
        counts.veryLow++;
        break;
    }
  }
  return counts;
}

const MOCK_SYNTHESIS: Omit<SynthesisResult, 'gradeCounts'> = {
  gradeSummary:
    'GRADE evidence summary: moderate quality evidence from included studies supports device safety and performance.',
  narrativeSynthesis:
    'Narrative synthesis: included studies demonstrate acceptable safety and efficacy profile consistent with EU MDR requirements.',
  cerSection6Draft:
    '## 6. Clinical Background\n\nE2E mock CER Section 6 — Clinical Background content.',
  cerSection7Draft:
    '## 7. Clinical Data\n\n| Study | SIGN 50 | GRADE | Outcome |\n|-------|---------|-------|---------|\n| E2E Mock Study | 1+ | Moderate | Positive |',
  cerSection8Draft:
    '## 8. Appraisal of Clinical Data\n\nE2E mock CER Section 8 — Appraisal content.',
};

/**
 * Synthesize evidence from included articles into GRADE summary and CER section drafts.
 *
 * Produces CER Sections 6 (Clinical Background), 7 (Clinical Data),
 * and 8 (Appraisal of Clinical Data) per MEDDEV 2.7/1 Rev.4 structure.
 * In E2E_TEST_MODE, returns deterministic mock content.
 */
export async function synthesizeEvidence(
  includedArticles: AppraiserArticle[],
  deviceDescription: string,
  picoFramework: PicoFramework,
): Promise<SynthesisResult> {
  const gradeCounts = countGrades(includedArticles);

  // E2E_TEST_MODE: return deterministic mock without LLM call.
  const isE2EMode = process.env.E2E_TEST_MODE === 'true' && process.env.NODE_ENV !== 'production';
  if (isE2EMode) {
    return { ...MOCK_SYNTHESIS, gradeCounts };
  }

  if (includedArticles.length === 0) {
    return {
      gradeSummary: 'No articles were included after screening. No evidence synthesis possible.',
      narrativeSynthesis: 'Insufficient evidence identified for narrative synthesis.',
      cerSection6Draft:
        '## 6. Clinical Background\n\nInsufficient literature identified for this device.',
      cerSection7Draft: '## 7. Clinical Data\n\nNo included studies.',
      cerSection8Draft:
        '## 8. Appraisal of Clinical Data\n\nNo clinical data available for appraisal.',
      gradeCounts,
    };
  }

  const model = getLlmModel();

  const articleSummaries = includedArticles
    .slice(0, 30) // Cap at 30 to manage token budget
    .map(
      (a) =>
        `- ${a.citation} [SIGN 50: ${a.sign50Level}, GRADE: ${a.gradeQuality}]\n  Title: ${a.title}\n  Abstract: ${a.abstract?.slice(0, 300) ?? 'N/A'}`,
    )
    .join('\n');

  const gradeCountStr = `High: ${gradeCounts.high}, Moderate: ${gradeCounts.moderate}, Low: ${gradeCounts.low}, Very Low: ${gradeCounts.veryLow}`;

  const prompt = `You are a clinical evaluation expert drafting an EU MDR Clinical Evaluation Report (CER) per MEDDEV 2.7/1 Rev.4.

Device: ${deviceDescription}

PICO:
- Population: ${picoFramework.patient}
- Intervention: ${picoFramework.intervention}
- Outcome: ${picoFramework.outcome}

Included studies (${includedArticles.length} total, showing up to 30):
${articleSummaries}

GRADE distribution: ${gradeCountStr}

Generate:
1. gradeSummary: A concise GRADE evidence quality summary paragraph
2. narrativeSynthesis: A narrative synthesis paragraph describing safety and performance findings
3. cerSection6Draft: EU MDR CER Section 6 — Clinical Background (markdown, ~300 words)
4. cerSection7Draft: EU MDR CER Section 7 — Clinical Data as a markdown table with columns: Study, Year, Design, SIGN 50, GRADE, Key Finding
5. cerSection8Draft: EU MDR CER Section 8 — Appraisal of Clinical Data including strengths, limitations, and conclusions (markdown, ~400 words)

Return structured JSON.`;

  const result = await generateObject({
    model,
    schema: SynthesisSchema,
    prompt,
  });

  return { ...result.object, gradeCounts };
}
