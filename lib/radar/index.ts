// Barrel export for radar domain.
// Re-exports public API for backward compatibility and cleaner imports.

export { classifyUpdate } from './classifier';
export { loadPortfolio, clearPortfolioCache } from './portfolio-loader';
export { notifyUpdate, determineNotificationChannels } from './notifier';
export { scoreRelevance, shouldBundleAsDigest } from './relevance-scorer';

export type {
  ClassificationResult,
  RawUpdateInput,
} from './classifier';
export type { OrgNotificationSettings } from './notifier';
export type { AlertFatigueInput } from './relevance-scorer';
export {
  TIER1_SYSTEM_PROMPT,
  TIER2_SYSTEM_PROMPT,
  TIER3_SYSTEM_PROMPT,
} from './classifier-prompts';
export { ImpactTypeEnum } from './classifier-schemas';
