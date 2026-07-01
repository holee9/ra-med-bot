// @MX:NOTE [AUTO] Builds the 5-dimension substantial-equivalence comparison
// document from a subject device and 1-3 selected predicates, with optional
// LLM-assisted text suggestions.
// @MX:SPEC SPEC-REGULA-PREDICATE-001 (REQ-PRE-013, REQ-PRE-016, REQ-PRE-018)
//
// The builder NEVER auto-approves any cell — `approved` always starts empty and
// is populated only by explicit user action in the UI (REQ-PRE-014 disclaimer
// and approval are UI responsibilities, not handled here). LLM suggestions are
// advisory only and are fetched in a single batched API call.

import { generateText } from 'ai';
import type { LanguageModel } from 'ai';
import type {
  ComparisonCell,
  ComparisonDimension,
  PredicateCandidate,
  PredicateComparison,
} from './types';

/** Maximum number of predicates that may be compared at once (REQ-PRE-018). */
const MAX_PREDICATES = 3;

/** The five comparison dimensions, in canonical display order. */
const DIMENSIONS: ComparisonDimension[] = [
  'intended_use',
  'indications',
  'tech_characteristics',
  'materials',
  'performance',
];

/** Human-readable labels used when prompting the LLM. */
const DIMENSION_LABELS: Record<ComparisonDimension, string> = {
  intended_use: 'Intended Use',
  indications: 'Indications for Use',
  tech_characteristics: 'Technological Characteristics',
  materials: 'Materials',
  performance: 'Performance Data',
};

const MAX_OUTPUT_TOKENS = 1024;

export interface BuildComparisonInput {
  subject_device_name: string;
  subject_inputs: Record<ComparisonDimension, string>;
  selected_predicates: PredicateCandidate[];
}

export interface ComparisonBuilder {
  buildComparison(input: BuildComparisonInput): Promise<PredicateComparison>;
}

/**
 * Create a comparison builder bound to a language model. The model is used
 * only for advisory suggestion generation; comparison structure is built
 * deterministically and never depends on a successful LLM call.
 */
export function createComparisonBuilder(model: LanguageModel): ComparisonBuilder {
  return {
    async buildComparison(input: BuildComparisonInput): Promise<PredicateComparison> {
      const { subject_device_name, subject_inputs, selected_predicates } = input;

      if (selected_predicates.length > MAX_PREDICATES) {
        throw new Error('최대 3개까지 선택 가능');
      }

      const suggestions = await fetchSuggestions(
        model,
        subject_device_name,
        subject_inputs,
        selected_predicates,
      );

      const cells: ComparisonCell[] = DIMENSIONS.map((dimension) => {
        const cell: ComparisonCell = {
          dimension,
          subject_text: subject_inputs[dimension],
          predicate_texts: selected_predicates.map((p) => p.device_description),
          // @MX:NOTE Never auto-approved — user approves each predicate via UI.
          approved: [],
        };
        const suggestion = suggestions?.[dimension];
        if (suggestion) {
          cell.llm_suggestions = [suggestion];
        }
        return cell;
      });

      return {
        subject_device_name,
        selected_predicates,
        cells,
        created_at: new Date(),
      };
    },
  };
}

/**
 * Request one comparison-note suggestion per dimension in a single batched call.
 * On any failure (API error, malformed output) returns undefined so the builder
 * degrades gracefully to a comparison without suggestions (REQ-PRE-016).
 */
async function fetchSuggestions(
  model: LanguageModel,
  subjectName: string,
  subjectInputs: Record<ComparisonDimension, string>,
  predicates: PredicateCandidate[],
): Promise<Record<ComparisonDimension, string> | undefined> {
  try {
    const prompt = buildPrompt(subjectName, subjectInputs, predicates);
    const response = await generateText({
      model,
      maxTokens: MAX_OUTPUT_TOKENS,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.text?.trim() ?? '';
    if (!text) return undefined;

    return parseSuggestions(text);
  } catch {
    return undefined;
  }
}

/**
 * Construct a single prompt asking the model to suggest a concise comparison
 * note for every dimension at once, returning a JSON object keyed by dimension.
 */
function buildPrompt(
  subjectName: string,
  subjectInputs: Record<ComparisonDimension, string>,
  predicates: PredicateCandidate[],
): string {
  const predicateList = predicates
    .map((p) => `- ${p.k_number}: ${p.device_description}`)
    .join('\n');

  const dimensionLines = DIMENSIONS.map(
    (dim) => `- ${dim} (${DIMENSION_LABELS[dim]}): subject says "${subjectInputs[dim]}"`,
  ).join('\n');

  return [
    `You are assisting a 510(k) substantial-equivalence comparison for the subject device "${subjectName}".`,
    '',
    'Predicate devices:',
    predicateList,
    '',
    'For each of the following dimensions, suggest a concise comparison note (1-2 sentences) between the subject device and the predicate(s):',
    dimensionLines,
    '',
    'Respond with ONLY a JSON object whose keys are exactly the dimension ids',
    `(${DIMENSIONS.join(', ')}) and whose values are the suggested note strings.`,
    'Do not include any text outside the JSON object.',
  ].join('\n');
}

/**
 * Parse the model's JSON response into a per-dimension suggestion map. Tolerates
 * surrounding prose by extracting the first JSON object. Returns undefined if no
 * usable suggestions were found.
 */
function parseSuggestions(raw: string): Record<ComparisonDimension, string> | undefined {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return undefined;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return undefined;
  }
  if (typeof parsed !== 'object' || parsed === null) return undefined;

  const record = parsed as Record<string, unknown>;
  const result = {} as Record<ComparisonDimension, string>;
  let any = false;
  for (const dim of DIMENSIONS) {
    const value = record[dim];
    if (typeof value === 'string' && value.length > 0) {
      result[dim] = value;
      any = true;
    }
  }
  return any ? result : undefined;
}
