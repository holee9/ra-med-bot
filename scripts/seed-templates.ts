// @MX:NOTE [AUTO] seed-templates — one-off script to insert quick card templates into DB.
// @MX:SPEC SPEC-REGULA-BREADTH-001 (REQ-BREADTH-061)
//
// Usage:  npx tsx scripts/seed-templates.ts
// Run against a local or staging database only — never production without a backup.

import { logger } from '../lib/observability/logger';
import { type QuickCard, homeQuickCards } from '../lib/seeds/homeQuickCards';

/**
 * Simulate upsert of quick card templates.
 * Replace this stub with real Drizzle upsert once the chat_templates table is created.
 */
async function seedTemplates(cards: QuickCard[]): Promise<void> {
  for (const _card of cards) {
  }
}

seedTemplates(homeQuickCards).catch((err) => {
  logger.error('Seed failed:', err);
  process.exit(1);
});
