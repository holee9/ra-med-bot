// @MX:NOTE [AUTO] REQ-001 — structured labeling section builder.
// @MX:SPEC SPEC-REGULA-LABELING-001 (REQ-001, AC-01)

// @MX:LEGACY archived from lib
//
// Pure helpers for building/validating the 5 structured section types. DB
// persistence is handled by the API routes (app/api/labeling/documents/*).
// The helpers here are intentionally side-effect-free for unit-testability.

import type { LabelingSectionType } from './types';

/** All valid section types in canonical order. */
export const ALL_SECTION_TYPES: readonly LabelingSectionType[] = [
  'intended_use',
  'indication',
  'contraindication',
  'warning',
  'precaution',
];

/** Human-readable labels (English; UI i18n handles localization). */
export const SECTION_TYPE_LABELS: Readonly<Record<LabelingSectionType, string>> = {
  intended_use: 'Intended Use',
  indication: 'Indications for Use',
  contraindication: 'Contraindications',
  warning: 'Warnings',
  precaution: 'Precautions',
};

/**
 * REQ-001: type guard for valid section types. Rejects unknown strings
 * (defense-in-depth before DB insert).
 */
export function isLabelingSectionType(value: unknown): value is LabelingSectionType {
  return typeof value === 'string' && (ALL_SECTION_TYPES as readonly string[]).includes(value);
}

/**
 * REQ-001: build the initial section set for a new labeling document.
 * Returns all 5 section types with empty content; the UI populates each.
 */
export function buildInitialSections(
  locale = 'en',
): Array<{ sectionType: LabelingSectionType; content: string; locale: string }> {
  return ALL_SECTION_TYPES.map((sectionType) => ({
    sectionType,
    content: '',
    locale,
  }));
}

/**
 * REQ-001: validate that a section's content meets minimum requirements
 * (non-empty after trim). Used by the approve route's precondition check.
 */
export function isSectionContentValid(content: string): boolean {
  return typeof content === 'string' && content.trim().length > 0;
}
