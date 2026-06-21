// @MX:NOTE [AUTO] Central Inngest function registry. The serve endpoint imports
// this array so every registered function is exposed in one place.
// @MX:SPEC SPEC-REGULA-DIGEST-001 / SPEC-REGULA-DOCINGEST-001

import { weeklyDigestFn } from './digest/weekly-digest';
import { uploadProcessedFn } from './docingest/upload-processed';

/**
 * All Inngest functions served by app/api/inngest/route.ts.
 * Add new functions here (single source of truth for registration).
 */
export const functions = [weeklyDigestFn, uploadProcessedFn];
