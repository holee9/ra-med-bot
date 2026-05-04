// @MX:ANCHOR [AUTO] Radar crawler type definitions — shared contract for all 3 crawlers.
// @MX:REASON Used by fda-federal-register, eu-oj, mfds-notice crawlers and the
// _base.ts runCrawler() framework. fan_in >= 3.
// @MX:SPEC SPEC-REGULA-RADAR-001 (REQ-RADAR-004, REQ-RADAR-007, REQ-RADAR-009)

import type { DrizzleClient } from '../../../lib/db/client';

/**
 * Raw update record produced by a crawler before classification.
 * All fields are strings/dates — no classification yet.
 */
export interface RawUpdate {
  /** Stable unique identifier from the source system. Used for UPSERT deduplication. */
  external_id: string;
  title: string;
  published_at: Date;
  source_url: string;
  /** Original language content (may be Korean, French, English, etc.) */
  raw_content: string;
  /** ISO 2-letter country code or supranational code: US, EU, KR */
  region: string;
  /** Unique crawler identifier: fda-federal-register, eu-oj, mfds-notice */
  source_crawler: string;
  /** Optional hint detected at crawl time (e.g. 'recall' for keyword-matched items) */
  impact_type_hint?: string;
}

/**
 * Result returned by each crawler function.
 */
export interface CrawlerResult {
  records: RawUpdate[];
  errors: Error[];
}

/**
 * Runtime context injected into each crawler by runCrawler().
 */
export interface CrawlerContext {
  /** Cloudflare Workers env bindings (KV, R2, Browser Rendering, etc.) */
  env: {
    ROBOTS_KV: KVNamespace;
    BROWSER?: { fetch: (url: string, options?: RequestInit) => Promise<Response> };
    [key: string]: unknown;
  };
  /** Drizzle ORM database client */
  db: DrizzleClient;
  /** Timestamp of the last successful crawler run — used as date filter */
  lastRun: Date;
}

/**
 * KVNamespace minimal interface for testing environments.
 */
interface KVNamespace {
  get(key: string): Promise<string | null>;
  put(key: string, value: string, options?: { expirationTtl?: number }): Promise<void>;
}

/**
 * DrizzleClient type alias — imported from db/client but re-exported here
 * to avoid circular dependency issues in tests.
 */
type DrizzleClient = unknown;
