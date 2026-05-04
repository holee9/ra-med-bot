## SPEC-REGULA-RADAR-001 Progress

- Started: 2026-05-04T00:00:00Z
- Version: v2.0 (3 crawlers 축소, 40 REQ)
- Development mode: TDD
- Harness: standard

### Context
- 선행 조건: Issue #10 (DOCINGEST) ✅ CLOSED, Issue #11 (WORKFLOWS) ✅ CLOSED
- 마이그레이션 시작: 0018_radar.sql
- lib/radar/ 신규 생성
- workers/ 신규 생성

### v2.0 범위 (11 → 3 crawlers 축소)
- FDA Federal Register (REQ-RADAR-004)
- EU Official Journal (REQ-RADAR-007)  
- MFDS 식약처 고시 (REQ-RADAR-009)
- Crawler framework (REQ-RADAR-001, 002, 014-017)
- 3-Tier Classifier (REQ-RADAR-020+)
- Impact Scoring
- Notifier

### Phase Checkpoints
- [x] Phase 1: Strategy (crawler layer scaffolded)
- [ ] Phase 2: TDD Implementation (in progress)
  - [x] lib/radar/crawlers/_base.ts (framework)
  - [x] lib/radar/crawlers/_types.ts
  - [x] lib/radar/crawlers/fda-federal-register.ts
  - [x] lib/radar/crawlers/eu-oj.ts
  - [x] lib/radar/crawlers/mfds-notice.ts
  - [x] lib/radar/classifier-prompts.ts + classifier-schemas.ts
  - [x] __tests__/radar/ (6 test files)
  - [x] __tests__/fixtures/radar/ (3 fixtures)
  - [x] migrations/0018_radar.sql
  - [x] lib/db/schema.ts extensions
  - [x] lib/audit.ts extensions (3 new audit_action values)
  - [x] lib/radar/classifier.ts
  - [x] lib/radar/relevance-scorer.ts + portfolio-loader.ts
  - [x] lib/radar/notifier.ts + notifier-channels/
  - [x] workers/ (cron + 3 queue consumers)
  - [x] wrangler.toml updates
  - [x] API routes
  - [x] UI components
  - [x] TanStack Query hooks + Zustand store
- [x] Phase 2.5: Tests passing (16/16 — classifier: 7, notifier: 5, relevance-scorer: 4)
- [x] Phase 2.75: Quality gate

### Phase 10 Implementation Notes (2026-05-04)
- Lazy dynamic import pattern used in notifier.ts to prevent DB init in tests
- Local interface definitions for Cloudflare Worker types (Queue, MessageBatch, etc.) to avoid @cloudflare/workers-types dependency
- OrgPortfolio interface uses snake_case fields to match test expectations
- shouldBundleAsDigest uses most-recent alert date as window anchor (not new Date())
- Remaining TS errors are exclusively in already-completed/protected files (_types.ts shadow import)
