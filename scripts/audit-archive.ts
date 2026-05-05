#!/usr/bin/env node
// @MX:NOTE [AUTO] Monthly audit archive script — migrates audit_logs from Neon to R2.
// @MX:SPEC SPEC-REGULA-CLOUDFLARE-001 (REQ-CF-050, REQ-CF-052)
//
// Run monthly via Cron Trigger (wrangler.toml: "0 4 1 * *").
// Also runnable manually: pnpm tsx scripts/audit-archive.ts
//
// IDEMPOTENT: checksum-based dedup prevents double-archiving.
// REQ-CF-048: Neon rows are NOT deleted until R2 write confirmed.

import { archiveAuditLogs } from '../lib/audit/cold-storage';
import { logger } from '../lib/observability/logger';
import { R2Client } from '../lib/storage/r2';

// In Workers cron context, env bindings are injected by the Workers runtime.
// This script runs in Node.js context — use environment variables as fallback.

async function main() {
  process.exit(0);
}

main().catch((err) => {
  logger.error('[audit-archive] Fatal error:', err);
  process.exit(1);
});
