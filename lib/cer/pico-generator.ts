// @MX:ANCHOR [AUTO] PICO query generator — entry point for clinical literature search.
// @MX:REASON Called by literature route and CER workflow steps; fan_in >= 3 expected.
// @MX:SPEC REQ-CLINLIT-001~005

import { generateObject } from 'ai';
import { z } from 'zod';
import { getLlmFastModel } from '../ai/llm-provider';

export interface PicoFramework {
  patient: string; // Population/Patient
  intervention: string; // Intervention (the device/treatment)
  comparator: string | null; // Comparator (null if not applicable)
  outcome: string; // Outcome measure
  meshTerms: string[]; // MeSH terms derived
  searchQuery: string; // Final PubMed query string
}

const PicoSchema = z.object({
  patient: z.string().min(1),
  intervention: z.string().min(1),
  comparator: z.string().nullable(),
  outcome: z.string().min(1),
  meshTerms: z.array(z.string()),
  searchQuery: z.string().min(1),
});

const MOCK_PICO: PicoFramework = {
  patient: 'patients requiring medical device intervention',
  intervention: 'test device',
  comparator: null,
  outcome: 'safety and efficacy outcomes',
  meshTerms: ['Medical Devices', 'Patient Safety', 'Clinical Trials as Topic'],
  searchQuery: '"medical device"[MeSH] AND "clinical trial"[pt] AND "safety"[MeSH]',
};

/**
 * Generate a PICO framework and PubMed search query from a device description.
 *
 * Uses the fast (Haiku) model for cost efficiency. In E2E_TEST_MODE,
 * returns deterministic mock data without making any LLM calls.
 */
// @MX:ANCHOR [AUTO] generatePicoQuery — public API called by literature search route.
// @MX:REASON Single authoritative source for PICO generation; must remain stable across CER workflow.
export async function generatePicoQuery(deviceDescription: string): Promise<PicoFramework> {
  // E2E_TEST_MODE: return deterministic mock without LLM call.
  const isE2EMode = process.env.E2E_TEST_MODE === 'true' && process.env.NODE_ENV !== 'production';
  if (isE2EMode) {
    return {
      ...MOCK_PICO,
      intervention: deviceDescription.slice(0, 100),
    };
  }

  const model = getLlmFastModel();

  const prompt = `You are an EU MDR clinical evaluation expert. Given the following medical device description, generate a PICO framework and an optimized PubMed search query for systematic literature review per MEDDEV 2.7/1 Rev.4.

Device Description:
${deviceDescription}

Requirements:
- Patient/Population: describe the target patient population for this device
- Intervention: the device/procedure being evaluated
- Comparator: standard of care or predicate device (null if not applicable)
- Outcome: primary safety and performance outcomes
- MeSH Terms: 3-8 relevant MeSH terms for PubMed
- Search Query: a valid PubMed Boolean search query using MeSH terms and free text

Return structured JSON matching the schema.`;

  const result = await generateObject({
    model,
    schema: PicoSchema,
    prompt,
  });

  return result.object;
}
