---
id: SPEC-REGULA-NETWORK-001
title: Regula Phase 11 Network Intelligence — Opt-in Anonymized Aggregate (k-anonymity + Differential Privacy)
status: draft
created: 2026-04-22
updated: 2026-04-22
author: manager-spec
phase: 11
skill: regula
version: 0.1.0
priority: Medium
revision_history:
  - version: 0.1.0
    date: 2026-04-22
    author: manager-spec
    notes: |
      Initial draft. 48 REQ-NET across 5 groups (A Opt-in Control / B Privacy
      Pipeline / C Aggregate Computation / D API+UI / E Legal/Audit Integration).
      10 technical decisions captured in research.md. Depends on FOUNDATION
      v0.4.0+, ENTERPRISE v0.2.0+, DOCINGEST, WORKFLOWS, RADAR. Requires
      FOUNDATION v0.5.0 enum inventory extension (4 new audit_action values).
related_handoff_sections:
  - "§6"
  - "§8.1"
  - "§9.3"
  - "§11.1"
  - "§16"
  - "§18"
depends_on:
  - SPEC-REGULA-FOUNDATION-001 (v0.4.0+)
  - SPEC-REGULA-ENTERPRISE-001 (v0.2.0+)
  - SPEC-REGULA-CLOUDFLARE-001 (implied infrastructure)
  - SPEC-REGULA-DOCINGEST-001
  - SPEC-REGULA-WORKFLOWS-001
  - SPEC-REGULA-RADAR-001
blocks_until_pending:
  - Legal opinion on GDPR Art.17 + anonymized aggregate recomputation obligation
  - FDA Pre-submission meeting confirmation (21 CFR Part 11 scope)
  - Privacy Impact Assessment (external auditor) pre-launch requirement
---

# SPEC-REGULA-NETWORK-001 — Regula Phase 11 Network Intelligence

## 목적 (Purpose)

Regula의 **멀티 조직 SaaS 구조**를 활용하여, 명시적 opt-in한 조직들이 제공하는 submission 결과, 심사 기간, deficiency 패턴, predicate 선택 성공률, indication 전략, audit 관찰 지표 등 **의료기기 RA 시장 전체의 집계 시그널**을 제공한다. 이 시그널은 어떤 개별 consultant (Emergo, RQMIS, NSF 등)도 접근 불가능하며, Regula의 **결정적 차별화 자산(data moat)**이다.

본 Phase는 **"개별 조직 submission 식별이 수학적으로 불가능하면서 시장 전체 시그널이 의미 있는 집계"**를 달성하기 위해 다음을 완결한다:

1. **Opt-in 제어** — per-signal 6-category 선택, 언제든 withdrawal (right to be forgotten 수준 구현)
2. **Privacy Pipeline** — k-anonymity (k≥5) + Differential Privacy (ε=1.0) + DLP 정적 rule + 별도 Cloudflare Worker 격리
3. **Aggregate Computation** — Mondrian partitioning + Laplace mechanism + minimum 20 contributing orgs 임계값 + weekly cron 재산출
4. **API + UI** — `/api/ra/network/*` routes, `/network` dashboard, `/admin/network/optin` 관리 페이지, Chat `network.query` intent
5. **Legal/Audit Integration** — Privacy Impact Assessment (외부 감사) 필수, 조직 계약서 addendum, audit_logs 완전성, 규제 당국 (FDA) 비공식 검토

본 Phase 완료 후에도 **Pre-launch 외부 전문가 PIA 감사 통과 및 법률 자문 결과 수용**이 production 배포 전제 조건이다. PIA 실패 시 알고리즘 재설계 가능.

참고: 모든 기술 선택 근거, 공격 모델, 법적 관할 분석, 유사 업계 사례(Flatiron Health, Tempus, Apple DP, US Census 2020)는 research.md에 상세 기록되어 있다. spec.md는 해당 research의 결론을 요구사항으로 번역한 결과물이다.

---

## 범위 (Scope)

### In Scope

| 구분 | 산출물 |
|---|---|
| Opt-in 제어 스키마 | `migrations/00XX_network_optins.sql` — `network_optins` 테이블 (org_id FK, signal_type pgEnum, consented_at, consented_by FK users, withdrawn_at, withdrawal_reason text) |
| Opt-in API | `app/api/ra/network/optin/route.ts` (POST 신규 동의, DELETE withdrawal — admin role only), Zod schema `lib/schemas/network-optin.ts` |
| Opt-in UI | `app/(app)/admin/network/optin/page.tsx` (조직 opt-in 관리, admin 전용), `components/network/OptinToggle.tsx` (per-signal 토글), `components/network/WithdrawalModal.tsx` (확인 모달 + 72h 처리 공지) |
| Contribution pipeline | `app/api/ra/network/contribute/route.ts` (opt-in 조직만 호출 — 내부 trigger, 외부 노출 제한), `migrations/00XX_network_contributions.sql` — `network_contributions` 테이블 (id, org_id FK, signal_type pgEnum, raw_data_json encrypted, received_at, anonymized_at nullable, anonymization_status pgEnum, ttl_expires_at) |
| DLP sanitizer | `lib/privacy/dlp/identifier-patterns.ts` (K-number, CE, NMPA, MFDS, PMDA, UDI, company name 정규식 사전), `lib/privacy/dlp/sanitize.ts` (staged pipeline — whitelist + regex + NER placeholder), `scripts/qa/dlp-completeness.ts` (정적 CI gate) |
| Anonymizer Worker | `cloudflare-worker-anonymizer/` 별도 repo 또는 서브디렉토리 — Cloudflare Worker 분리 배포, k-anon + DP 구현. 메인 Postgres에는 aggregate만 write (write-only service role) |
| k-anonymity 구현 | `cloudflare-worker-anonymizer/lib/k-anonymity/mondrian.ts` (multidimensional partition), quasi-identifier 정의 `cloudflare-worker-anonymizer/lib/privacy/quasi-identifiers.ts` (device_class + regulatory_category + jurisdiction + submission_year_bin) |
| Differential Privacy | `cloudflare-worker-anonymizer/lib/dp/laplace.ts` (Laplace mechanism, OpenDP 참조 구현), `cloudflare-worker-anonymizer/lib/dp/privacy-budget.ts` (ε per signal per week 추적, ε_annual 상한 모니터링) |
| Aggregate 스키마 | `migrations/00XX_network_aggregates.sql` — `network_aggregates` 테이블 (id, signal_type pgEnum, device_class, regulatory_category, jurisdiction, submission_year_bin, aggregate_json, k_group_size, contributing_orgs, epsilon_consumed numeric, updated_at, methodology_version text) |
| Aggregate 계산 cron | `cloudflare-worker-anonymizer/cron/weekly-aggregate.ts` (매주 일요일 02:00 UTC), opt-in change 즉시 재계산 (affected cells만, 7일 지연 적용) |
| Aggregate API | `app/api/ra/network/aggregates/route.ts` (GET, 읽기 전용, 인증 사용자), `app/api/ra/network/aggregates/[signal_type]/route.ts` (filter by device_class/jurisdiction/year_bin), Zod schema |
| Aggregate Dashboard | `app/(app)/network/page.tsx` (6-signal 탭 UI), `components/network/AggregateCard.tsx` (값 + 95% CI + transparency metadata), `components/network/TransparencyBanner.tsx` (k≥5 + ε=1.0 methodology 설명) |
| Chat intent 통합 | `lib/ai/intent-classifier.ts`에 `network.query` intent 추가 (Claude Haiku 재분류), `lib/ai/consult.ts` Phase B(prose)에서 aggregate lookup + citation inline, `lib/ai/network-query-handler.ts` |
| Audit integration | `audit_logs.action` enum 확장: `network.optin_change`, `network.aggregate_recompute`, `network.query`, `network.contribute` (4개 신규 값) — FOUNDATION v0.5.0 enum inventory 확장 요청 대상 |
| Privacy Impact Assessment | `.moai/compliance/pia/SPEC-REGULA-NETWORK-001-pia.md` (내부 작성), 외부 감사 리포트 보관 경로 `/compliance/pia/external-audit-2026Q3.pdf` (placeholder) |
| Organization Addendum | `templates/legal/network-intelligence-addendum.md` (조직 계약서 별도 addendum 샘플), Admin UI에서 downloadable |
| CI 검증 | `scripts/qa/network-privacy-check.ts` (k≥5 violation 0, minimum 20 violation 0, DLP identifier leak 0 정적 분석), `.github/workflows/ci.yml` 단계 추가 |
| i18n | `lib/i18n/dictionaries/ko.ts` + `en.ts` 신규 키 (network.optin.*, network.dashboard.*, network.transparency.*) |
| Dark mode | `/network` 및 `/admin/network/*` 다크 모드 완전 대응 (Phase 5 ENTERPRISE 연장) |
| Accessibility | `/network` dashboard WCAG 2.1 AA (axe-core 0 violations, 키보드 접근, ARIA labels, prefers-reduced-motion) |

### Out of Scope

다음 항목은 본 SPEC scope 밖이며, 별도 Phase 또는 Post-launch 결정 사항이다.

| 항목 | 처리 방향 | 사유 |
|---|---|---|
| Cross-organization raw data 공유 | **절대 금지** | 본 Phase의 core privacy 약속 위반 |
| Individual submission 식별 복구 기능 | **원천 설계 불가** | k-anon + DP로 수학적 불가능 보장 |
| 의료기기 외 도메인 (제약, 진단, 생명과학) 네트워크 확장 | Post-v2 | scope 확장은 별도 규제 분석 필수 |
| Aggregate commercial resale (타 기업/consultant 판매) | Post-launch 비즈니스 결정 | legal + business review 필요 |
| Real-time aggregate 업데이트 | Weekly cron 충분 | 비용 + privacy budget 관리 복잡도 |
| Reciprocity credits / reduced subscription | Post-launch 설계 | bootstrap 전략 확정 후 |
| Federated learning (raw data 이동 없이 모델 학습) | v2 evolution 검토 | 구현 복잡도 매우 높음 |
| MPC (Secure Multi-Party Computation) / FHE | v2 evolution 검토 | 성숙한 라이브러리 부재, 성능 제약 |
| l-diversity / t-closeness 추가 레이어 | v1.1 | k-anon + DP로 v1 충분, 복잡도 감안 후 추가 |
| 중국 NMPA 기여 조직 cross-border transfer | Geo-fenced v2 | 중국 DSL/PIPL 해석 확정 후 |
| Network aggregate 기반 predictive model | Post-launch | aggregate 자체 제공이 우선 |
| Aggregate 신뢰도 machine-learning 추정 | Post-launch | CI 기반 기본 제공 |

---

## Technical Decisions (research.md 매핑)

| # | 결정 | 선택 | 탈락 | 근거 |
|---|-----|-----|-----|-----|
| 1 | Privacy 모델 | k-anonymity (k≥5) + DP (ε=1.0) | k-anon only, DP only, MPC, FHE | 강한 수학적 보장 + 실용적 유틸리티 (research §2.1~2.5) |
| 2 | 익명화 위치 | 별도 Cloudflare Worker (isolated deploy) | 메인 Postgres 내부 처리 | 공격 표면 분리, insider threat 최소화 (research §3.3, §7) |
| 3 | Opt-in 단위 | per-signal (6 categories) | all-or-nothing | Granularity가 참여 유인 (research §9.2) |
| 4 | 집계 재산출 | Weekly cron + opt-in change affected cells 즉시 | Real-time | 비용 + privacy budget 관리 (research §11) |
| 5 | 참여 임계값 | minimum 20 contributing orgs per cell | 10 orgs | Privacy headroom (research §8.2) |
| 6 | 철회 처리 | Hard delete raw + aggregate 재계산 | Soft delete | GDPR Art.17 보수 해석 (research §5.1) |
| 7 | DP 알고리즘 | Laplace mechanism | Gaussian, Exponential | COUNT/AVG 집계에 적합 (research §2.2) |
| 8 | k-anon 알고리즘 | Mondrian (multidimensional partition) | Datafly, Incognito, Anatomy | information loss 최소화 + JS 포팅 가능 (research §2.1) |
| 9 | PIA 요건 | Pre-launch 외부 전문가 감사 필수 | 내부 self-review | 규제 신뢰 확보 (research §5.5) |
| 10 | Opt-in change 반영 | 7일 지연 (differential attack 방지) | 즉시 | 공격 시나리오 D mitigation (research §3.2) |

---

## EARS Requirements

본 SPEC은 48개의 EARS 요구사항을 5개 그룹으로 분류한다. 번호 체계는 `REQ-NET-{NNN}`이다.

### Group A — Opt-in Control (REQ-NET-001 ~ 010)

#### REQ-NET-001 (Ubiquitous)
**요구사항:** The system SHALL maintain a `network_optins` Postgres table with columns: `id uuid PK`, `org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`, `signal_type network_signal_type NOT NULL`, `consented_at timestamptz NOT NULL DEFAULT now()`, `consented_by uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL`, `withdrawn_at timestamptz NULL`, `withdrawal_reason text NULL`, `created_at timestamptz NOT NULL DEFAULT now()`, `updated_at timestamptz NOT NULL DEFAULT now()`.
**근거:** research §7.1 계층 설계, §8.1 지표별 스키마.
**검증:** `drizzle-kit introspect` 결과 스키마 일치 확인, `pg_dump --schema-only` diff 검증.

#### REQ-NET-002 (Ubiquitous)
**요구사항:** The system SHALL define `network_signal_type` pgEnum with exactly 6 values: `submission_outcomes`, `review_timing`, `deficiency_patterns`, `predicate_selection`, `indication_strategies`, `audit_observations`.
**근거:** research §8.1 6-signal 설계.
**검증:** `SELECT enum_range(NULL::network_signal_type)` 결과가 정확히 6개 값.

#### REQ-NET-003 (Event-Driven)
**요구사항:** WHEN a user with `admin` role at an organization submits a `POST /api/ra/network/optin` request with valid `signal_type`, THEN the system SHALL insert a `network_optins` row with `consented_by = session.user.id`, `withdrawn_at = NULL`, and write an audit_log with `action='network.optin_change'` and `meta_json={signal_type, action: 'consent', actor_org_id}`.
**근거:** research §10.1 Opt-in 관리 페이지, §12 제약 #4 audit.
**검증:** Integration test: admin user opt-in → row 삽입 + audit_logs entry 확인. Non-admin user (ra-lead) → 403 Forbidden.

#### REQ-NET-004 (State-Driven)
**요구사항:** IF a `network_optins` row exists for `(org_id, signal_type)` with `withdrawn_at IS NULL`, THEN the organization SHALL be considered opted-in for that signal. Multiple consecutive opt-in/opt-out cycles SHALL produce multiple rows (append-only history for audit).
**근거:** 21 CFR Part 11 append-only audit trail 원칙 (handoff §16).
**검증:** Opt-in → opt-out → opt-in 반복 시 row 개수 증가 확인, history 쿼리로 전체 타임라인 복원 가능.

#### REQ-NET-005 (Event-Driven)
**요구사항:** WHEN a user with `admin` role submits `DELETE /api/ra/network/optin?signal_type=X`, THEN the system SHALL update the most recent opt-in row with `withdrawn_at = now()` and optional `withdrawal_reason`, AND enqueue a `raw-data-hard-delete-job` for that (org_id, signal_type) targeting `network_contributions`, AND write an audit_log with `action='network.optin_change'` and `meta_json={signal_type, action: 'withdraw', actor_org_id, reason}`.
**근거:** research §5.1 GDPR Art.17, §11.2 Opt-in change 즉시 재산출.
**검증:** Withdrawal API → row update + job enqueued + audit_logs 3건 확인 (optin_change + aggregate_recompute × N affected cells).

#### REQ-NET-006 (State-Driven)
**요구사항:** IF withdrawal is requested, THEN the system SHALL execute hard delete of all `network_contributions.raw_data_json` for that (org_id, signal_type) within 72 hours, AND trigger aggregate recomputation for affected cells without the 7-day opt-in delay rule.
**근거:** research §11.2 Delete path (right to be forgotten 우선).
**검증:** Withdrawal 후 72h timer 내 raw_data_json = NULL 또는 row deleted 확인, 다음 aggregate batch에서 contributing_orgs count 감소 확인.

#### REQ-NET-007 (Event-Driven)
**요구사항:** WHEN an opt-in event is created (REQ-NET-003), THEN the system SHALL NOT include that organization's contributions in aggregate recomputation for 7 days (opt-in delay window).
**근거:** research §3.2 시나리오 D differential attack mitigation, §11.2.
**검증:** Opt-in row created_at + 7 days 이내 weekly cron 실행 → contributing_orgs count 변화 없음 확인.

#### REQ-NET-008 (Ubiquitous)
**요구사항:** The `/api/ra/network/optin` endpoints SHALL be protected by `withPermission('network.manage')` middleware (Phase 5 ENTERPRISE RBAC) which SHALL only permit `admin` role within the requesting organization scope.
**근거:** handoff §16 RBAC, research §10.1.
**검증:** ra-lead/ra-member/viewer role → 403, admin role in same org → 200, admin role in different org → 403.

#### REQ-NET-009 (Ubiquitous)
**요구사항:** The `/admin/network/optin` UI page SHALL display: (a) per-signal toggle with description of data collected and anonymization method, (b) withdrawal button with confirmation modal showing 72h timeline, (c) opt-in history log pulled from `audit_logs` where `action='network.optin_change' AND meta_json.actor_org_id = session.org_id`, (d) link to Privacy Impact Assessment document.
**근거:** research §10.1 Opt-in 관리 페이지 컴포넌트.
**검증:** Playwright E2E test: admin 접근 → 모든 UI 요소 렌더 확인. ra-lead 접근 → 읽기 전용 모드 또는 접근 거부 확인.

#### REQ-NET-010 (Unwanted)
**요구사항:** The system SHALL NOT default any signal to opt-in. All 6 signals SHALL be opt-out by default at organization creation; explicit admin consent SHALL be required for each signal independently.
**근거:** research §10.1 per-signal granularity, Apple/Fitbit 교훈 (research §9.2 참조).
**검증:** 신규 조직 생성 후 `network_optins` row count = 0 확인. 기존 조직의 signal별 독립 opt-in 가능 확인.

### Group B — Privacy Pipeline (REQ-NET-011 ~ 022)

#### REQ-NET-011 (Ubiquitous)
**요구사항:** The system SHALL maintain a `network_contributions` Postgres table in the main database with columns: `id uuid PK`, `org_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE`, `signal_type network_signal_type NOT NULL`, `raw_data_json jsonb ENCRYPTED AT REST`, `received_at timestamptz NOT NULL DEFAULT now()`, `anonymized_at timestamptz NULL`, `anonymization_status anonymization_status_enum NOT NULL DEFAULT 'pending'`, `ttl_expires_at timestamptz NOT NULL DEFAULT (now() + interval '48 hours')`.
**근거:** research §7.1 계층 설계, §7.4 Raw Data TTL.
**검증:** Row inserted → ttl_expires_at = received_at + 48h 확인. `pg_cron` job이 48h 초과 row 자동 삭제.

#### REQ-NET-012 (Ubiquitous)
**요구사항:** The system SHALL define `anonymization_status_enum` pgEnum with values: `pending`, `in_progress`, `completed`, `failed`. Anonymization status transitions SHALL follow strict state machine `pending → in_progress → (completed | failed)`.
**근거:** research §7.4 수명 주기.
**검증:** Enum value 4개 확인, 역방향 전이 시도 시 constraint 위반 에러.

#### REQ-NET-013 (State-Driven)
**요구사항:** IF `anonymization_status = 'completed'`, THEN the system SHALL hard delete `raw_data_json` (set to NULL or delete row, 운영 설계 결정) while preserving `id`, `org_id`, `signal_type`, `anonymized_at` for audit reference.
**근거:** research §7.4 "anonymization 성공 시 raw_data_json 즉시 삭제".
**검증:** Worker anonymization job 성공 → `raw_data_json IS NULL` (또는 row deleted) 확인.

#### REQ-NET-014 (State-Driven)
**요구사항:** IF `anonymization_status = 'pending'` AND `now() > ttl_expires_at`, THEN a scheduled job SHALL hard delete the row and emit a Sentry error alert with severity `high`.
**근거:** research §7.4 anonymization 실패 TTL.
**검증:** 48h 경과 pending row → `pg_cron` job에 의해 삭제, Sentry event 발생 확인.

#### REQ-NET-015 (Ubiquitous)
**요구사항:** The system SHALL implement a DLP (Data Loss Prevention) sanitizer at `lib/privacy/dlp/sanitize.ts` that executes four stages in order: (1) structural field whitelist (per-signal_type allowed fields only), (2) regex-based identifier stripping using `lib/privacy/dlp/identifier-patterns.ts` (K-number `K\d{6}`, De Novo `DEN\d{6}`, CE certificate, NMPA, MFDS, PMDA, UDI-DI patterns), (3) NER placeholder (v1.1), (4) output validation with rejection if any blocked pattern remains.
**근거:** research §4.1 식별자 사전, §4.2 DLP Pipeline Stage.
**검증:** Unit test: known identifier 포함 raw data 입력 → sanitized output에 identifier 미존재. 95%+ detection rate 필수.

#### REQ-NET-016 (Unwanted)
**요구사항:** IF the DLP sanitizer output contains any pattern from the blocked identifier list, THEN the system SHALL abort the contribution write, log the contribution ID with a Sentry alert of severity `critical`, and NOT forward the data to the anonymizer Worker.
**근거:** research §4.2 "blocked identifier 잔존 시 write abort".
**검증:** Red team test: 의도적으로 identifier 포함 synthetic data 투입 → contribution 거부 + Sentry critical alert 확인.

#### REQ-NET-017 (Ubiquitous)
**요구사항:** The anonymization compute SHALL execute in a separate Cloudflare Worker deployment (`regula-anonymizer`) with (a) separate secrets, (b) separate git repository or subfolder with distinct CODEOWNERS, (c) Cloudflare Access Service Token authentication for mTLS between main app and Worker, (d) write-only service role to `network_aggregates` table (no read permission to `network_contributions.raw_data_json` except during active anonymization job).
**근거:** research §7 데이터 파이프라인 격리 아키텍처, §3.3 Insider Threat Mitigation.
**검증:** Cloudflare dashboard에서 Worker 별도 account/tenant 확인. 메인 앱 service role이 `network_aggregates` write 가능, `network_contributions.raw_data_json` read 불가 확인.

#### REQ-NET-018 (Ubiquitous)
**요구사항:** The anonymizer Worker SHALL implement k-anonymity using the Mondrian multidimensional partitioning algorithm at `cloudflare-worker-anonymizer/lib/k-anonymity/mondrian.ts` with quasi-identifiers defined as `(device_class, regulatory_category, jurisdiction, submission_year_bin)` and k threshold `k = 5`.
**근거:** research §2.1 Mondrian 채택 근거, §3.2 시나리오 B Linking Attack mitigation.
**검증:** Unit test: 100개 synthetic rows → Mondrian partition 결과 모든 group size ≥ 5 확인.

#### REQ-NET-019 (State-Driven)
**요구사항:** IF a (quasi-identifier) group has fewer than 5 records, THEN the anonymizer Worker SHALL suppress that group's aggregate (do NOT write to `network_aggregates`) AND record the suppression count in the weekly batch report.
**근거:** research §2.1 k-threshold enforcement.
**검증:** Synthetic test: k=4 group 투입 → `network_aggregates`에 해당 cell row 미생성 확인.

#### REQ-NET-020 (Ubiquitous)
**요구사항:** The anonymizer Worker SHALL implement Laplace mechanism differential privacy at `cloudflare-worker-anonymizer/lib/dp/laplace.ts` with ε = 1.0 per signal per weekly batch. For COUNT queries, Δf = 1. For AVG queries, Δf = (max - min) / k_group_size bounded by clamping.
**근거:** research §2.2 Laplace Mechanism, §2.2 ε=1.0 정당화.
**검증:** Unit test: 동일 input 10회 실행 → 출력값 Laplace(1.0) 분포 확인. Statistical test: variance = 2/ε² within tolerance.

#### REQ-NET-021 (Ubiquitous)
**요구사항:** The anonymizer Worker SHALL track cumulative privacy budget at `cloudflare-worker-anonymizer/lib/dp/privacy-budget.ts` with per-signal weekly ε = 1.0 and annual ceiling ε_annual ≤ 52. Opt-in change triggered recomputations SHALL consume ε = 0.5 per affected cell (split budget).
**근거:** research §2.2 Privacy Budget 관리, §11.3.
**검증:** ε accumulator state persistence 확인, ε_annual 51 도달 시 admin alert 발행.

#### REQ-NET-022 (Unwanted)
**요구사항:** The anonymizer Worker logs SHALL NOT contain raw contribution data, aggregate output values, or any quasi-identifier combination. Worker logs SHALL only record: contribution ID, signal type, timestamp, anonymization duration, suppression count, error codes.
**근거:** research §7.3 로그 정책.
**검증:** Log sampling 검사 (weekly 100 log entries): raw data, aggregate value, identifier 부재 확인. Automated regex test on log export.

### Group C — Aggregate Computation (REQ-NET-023 ~ 033)

#### REQ-NET-023 (Ubiquitous)
**요구사항:** The system SHALL maintain a `network_aggregates` Postgres table with columns: `id uuid PK`, `signal_type network_signal_type NOT NULL`, `device_class text NOT NULL`, `regulatory_category text NOT NULL`, `jurisdiction text NOT NULL`, `submission_year_bin text NOT NULL`, `aggregate_json jsonb NOT NULL`, `k_group_size int NOT NULL CHECK (k_group_size >= 5)`, `contributing_orgs int NOT NULL CHECK (contributing_orgs >= 20)`, `epsilon_consumed numeric(5,3) NOT NULL`, `methodology_version text NOT NULL`, `updated_at timestamptz NOT NULL DEFAULT now()`, UNIQUE constraint on `(signal_type, device_class, regulatory_category, jurisdiction, submission_year_bin)`.
**근거:** research §8.2 Transparency Metadata 구조.
**검증:** Schema introspection 결과 CHECK constraints 및 UNIQUE 확인. Attempted insert with k_group_size=4 → constraint violation.

#### REQ-NET-024 (State-Driven)
**요구사항:** IF a potential aggregate cell has `contributing_orgs < 20`, THEN the cell SHALL be suppressed (NOT written to `network_aggregates`). This threshold is enforced independently of and in addition to the k-anonymity k≥5 threshold.
**근거:** research §8.2 minimum aggregate threshold 20.
**검증:** Synthetic test: contributing_orgs=19 + k=10 → aggregate 미생성 확인.

#### REQ-NET-025 (Event-Driven)
**요구사항:** WHEN a weekly cron schedule fires (Cloudflare Cron `0 2 * * 0` — Sunday 02:00 UTC), THEN the anonymizer Worker SHALL: (1) fetch contributions with `anonymized_at >= last_batch_timestamp`, (2) run Mondrian k-anonymity partitioning, (3) enforce contributing_orgs ≥ 20 threshold, (4) apply Laplace DP noise, (5) upsert `network_aggregates` rows, (6) write audit_logs entry with `action='network.aggregate_recompute'`, (7) complete within 10 minutes for 1M contribution baseline.
**근거:** research §11.1 Weekly Batch.
**검증:** Integration test: mock 10K contributions → cron execution → aggregates populated + audit_logs entry + execution time ≤ 10 min 확인.

#### REQ-NET-026 (Event-Driven)
**요구사항:** WHEN an opt-in event is created (REQ-NET-003), THEN the affected cells recomputation SHALL be scheduled with 7-day delay (fires `consented_at + 7 days`). WHEN an opt-out event occurs (REQ-NET-005), THEN affected cells recomputation SHALL fire immediately (within 1 hour, no delay).
**근거:** research §11.2 Opt-in Change 즉시 재산출 asymmetric policy.
**검증:** Opt-in event → 7일 후 scheduled job 확인. Opt-out event → 1시간 이내 job 실행 확인.

#### REQ-NET-027 (Ubiquitous)
**요구사항:** Each row in `network_aggregates.aggregate_json` SHALL conform to signal-type-specific JSON schemas defined in `lib/schemas/network-aggregate.ts`. For `submission_outcomes`: `{clearance_rate: number, withdraw_rate: number, pending_rate: number}`. For `review_timing`: `{median_days: number, p25: number, p75: number, mean_ai_rounds: number}`. For `deficiency_patterns`: `{top_sections: Array<{section_code: string, frequency_percent: number}>}`. For `predicate_selection`: `{success_rate_by_age_bin: Record<string, number>, same_company_effect: number}`. For `indication_strategies`: `{expansion_success_rate_by_initial_scope: Record<string, number>}`. For `audit_observations`: `{form_483_rate: number, warning_letter_rate: number, observations_per_inspection_median: number}`.
**근거:** research §8.1 Signal 1~6 schema.
**검증:** Zod schema validation on `network_aggregates` row insert. 스키마 mismatch → write reject.

#### REQ-NET-028 (Ubiquitous)
**요구사항:** Each `network_aggregates` row SHALL have `epsilon_consumed` correctly populated: 1.0 for weekly cron batch, 0.5 for opt-in change triggered recomputation, accumulated over multiple recomputations for the same cell.
**근거:** research §2.2, §11.3 Privacy Budget 관리.
**검증:** Cell lifecycle test: 초기 1.0, opt-out trigger 시 1.5, annual 52 근접 시 alert.

#### REQ-NET-029 (Ubiquitous)
**요구사항:** The `methodology_version` field SHALL be set to `'v1.0'` for this SPEC's algorithm implementation. Any change to k threshold, ε value, quasi-identifier definition, or Laplace/Mondrian algorithm SHALL require version increment AND external PIA re-approval AND full aggregate recomputation.
**근거:** research §7.3 업그레이드 정책.
**검증:** Algorithm change attempt without version increment → CI gate block. Version change → PIA re-approval workflow 문서 존재 확인.

#### REQ-NET-030 (Event-Driven)
**요구사항:** WHEN the anonymization Worker writes to `network_aggregates`, THEN the write SHALL include a transparency metadata block in `aggregate_json.transparency` containing `{k_threshold: 5, epsilon: 1.0, noise_mechanism: 'Laplace', methodology_version, computed_at, contributing_orgs, k_group_size}`.
**근거:** research §8.2 Transparency Metadata.
**검증:** Aggregate row sample → transparency 블록 필드 완전성 확인.

#### REQ-NET-031 (Unwanted)
**요구사항:** The `network_aggregates` table SHALL NOT store any field or metadata that identifies individual contributing organizations, individual submission IDs, K-numbers, or any other identifier listed in REQ-NET-015 DLP blocked pattern list.
**근거:** research §3 공격 모델 방어, §4.1 식별자 사전.
**검증:** Table schema review: org_id, submission_id, k_number column 부재. DB introspection 결과.

#### REQ-NET-032 (Ubiquitous)
**요구사항:** Weekly batch execution SHALL produce a suppression report at `/admin/network/batch-reports/` accessible only to `admin` role. Report SHALL include: number of cells computed, number of cells suppressed for k<5, number of cells suppressed for contributing_orgs<20, ε consumed this batch, privacy budget remaining.
**근거:** research §11.1 단계 7 결과 audit_logs.
**검증:** Post-batch report 존재 확인, admin 접근 가능 확인, ra-lead 접근 불가 확인.

#### REQ-NET-033 (Unwanted)
**요구사항:** The system SHALL NOT recompute aggregates in response to direct API read requests (GET endpoints). Aggregate recomputation SHALL only be triggered by (a) weekly cron, (b) opt-in delayed job (7-day), (c) opt-out immediate job. Repeated API calls to `/api/ra/network/aggregates` SHALL return cached values unchanged until next scheduled recomputation.
**근거:** research §3.2 시나리오 C Reconstruction Attack mitigation, cache.ttl = 1 week.
**검증:** GET aggregate API 100회 반복 호출 → `updated_at` 변화 없음 확인. Anti-attack test.

### Group D — API + UI (REQ-NET-034 ~ 042)

#### REQ-NET-034 (Ubiquitous)
**요구사항:** The system SHALL expose `GET /api/ra/network/aggregates` returning list of all non-suppressed aggregates, and `GET /api/ra/network/aggregates/[signal_type]` with optional query params `device_class`, `regulatory_category`, `jurisdiction`, `submission_year_bin` for filtered lookup.
**근거:** research §10.2 Aggregate Dashboard 필요 endpoint.
**검증:** API contract test: authenticated user → 200 + JSON array/object 반환. Filter params → 결과 축소 확인.

#### REQ-NET-035 (Ubiquitous)
**요구사항:** All `GET /api/ra/network/aggregates*` endpoints SHALL be protected by `withPermission('network.read')` middleware permitting all authenticated users (admin, ra-lead, ra-member, viewer) within any organization. Unauthenticated requests SHALL return 401.
**근거:** research §10.2 접근 권한 "모든 인증 사용자".
**검증:** Unauthenticated → 401, all authenticated roles → 200.

#### REQ-NET-036 (Ubiquitous)
**요구사항:** Each response from `/api/ra/network/aggregates*` SHALL include a `disclaimer` string field with value `"This aggregate is computed from opt-in organizations under k-anonymity (k≥5) and differential privacy (ε=1.0). Individual organization data cannot be inferred."` in the user's locale (ko/en).
**근거:** research §8.2 Transparency Metadata + handoff §6 bilingual.
**검증:** API response sample 검사 — disclaimer 필드 존재 + locale 대응 확인.

#### REQ-NET-037 (Ubiquitous)
**요구사항:** The system SHALL expose `POST /api/ra/network/contribute` as an INTERNAL endpoint (not publicly documented) callable only by Regula-internal pipelines (e.g., WORKFLOWS phase completion hook, DOCINGEST ingestion pipeline) authenticated via Service Token. External user-facing requests SHALL return 403.
**근거:** research §7.1 Main App → Anonymizer Worker 흐름.
**검증:** External POST with session cookie → 403. Service Token POST → 200 + row inserted to `network_contributions`.

#### REQ-NET-038 (Ubiquitous)
**요구사항:** The UI page `/network` SHALL render 6 tabs (one per signal_type) each displaying aggregate cards with value, 95% confidence interval, contributing_orgs count, k_group_size, last_updated timestamp, and transparency banner. Dashboard SHALL support filters for device_class, jurisdiction, submission_year_bin.
**근거:** research §10.2 Aggregate Dashboard 컴포넌트.
**검증:** Playwright E2E: 로그인 → /network 접근 → 6 탭 렌더 → 필터 변경 시 결과 갱신 확인.

#### REQ-NET-039 (Ubiquitous)
**요구사항:** The `/network` dashboard SHALL display a persistent transparency banner at top with text `"Regula Network Aggregate v1.0 — 익명화된 기여 조직 데이터 기반 (k-익명성 k≥5 + 차분 프라이버시 ε=1.0). 개별 조직 식별 불가능."` in Korean, English equivalent for en locale. Banner SHALL link to Privacy Impact Assessment summary page.
**근거:** research §10.2 Transparency banner.
**검증:** Dashboard 렌더 → 배너 존재 + locale 대응 + PIA 링크 동작 확인.

#### REQ-NET-040 (Event-Driven)
**요구사항:** WHEN a chat message is classified by the Haiku intent classifier as `network.query` intent with confidence >= 0.6, THEN `lib/ai/consult.ts` SHALL invoke `lib/ai/network-query-handler.ts` instead of the standard RAG path. The handler SHALL extract device_class/jurisdiction/signal from the question using structured extraction, lookup matching aggregate via `/api/ra/network/aggregates`, and format the response with inline citation `<sup class="cite">N</sup>` pointing to source `"Regula Network Aggregate v1.0 (updated YYYY-MM-DD)"`.
**근거:** research §10.3 Chat 인터페이스 통합, handoff §8.1 citation 강제.
**검증:** Chat test: "우리 device class에서 평균 심사 기간은?" → network.query intent 감지 → aggregate 조회 → 응답에 citation 존재 확인.

#### REQ-NET-041 (State-Driven)
**요구사항:** IF a `network.query` chat response cannot resolve to a matching aggregate (no contributing_orgs ≥ 20 cell exists for the requested dimensions), THEN the response SHALL fall back to general RAG with an informational note `"해당 조건의 네트워크 집계 데이터가 참여 조직 수 임계값(20)에 미달하여 제공되지 않습니다."` inline. Confidence scoring SHALL NOT trigger expert-review gating based on this fallback alone.
**근거:** research §2.5 minimum threshold 가치, handoff §9.3 expert-review gating.
**검증:** Threshold 미달 query → RAG fallback + 알림 메시지 포함 확인. expert-review auto-flag 미발생 확인.

#### REQ-NET-042 (Unwanted)
**요구사항:** The `/network` dashboard and `/admin/network/*` pages SHALL include `<meta name="robots" content="noindex, nofollow">` tags and SHALL be excluded from `/sitemap.xml`. Auth protection via Next.js middleware SHALL redirect unauthenticated users to `/login`.
**근거:** handoff §18 "Auth → noindex everywhere except /login" (Phase 5 ENTERPRISE 연장).
**검증:** curl -I 결과 noindex header 확인, sitemap.xml에서 /network 부재 확인.

### Group E — Legal, Audit, and Compliance Integration (REQ-NET-043 ~ 048)

#### REQ-NET-043 (Ubiquitous)
**요구사항:** The `audit_logs.action` pgEnum SHALL be extended with 4 new values: `network.optin_change`, `network.aggregate_recompute`, `network.query`, `network.contribute`. Extension SHALL follow the canonical `ALTER TYPE audit_action ADD VALUE '<name>'` migration pattern declared in FOUNDATION REQ-FND-049 and SHALL be added to the FOUNDATION enum inventory table as Phase 11 additions (FOUNDATION v0.5.0 expected update scope).
**근거:** research §12 제약 #4 Audit logging, FOUNDATION v0.4.0 REQ-FND-049 enum inventory 확장 패턴.
**검증:** Migration file `00XX_network_audit_actions.sql` 검토. `SELECT enum_range(NULL::audit_action)` 결과에 4개 신규 값 포함 확인. FOUNDATION enum inventory table update coordination confirmed.

**Cross-SPEC Coordination Note:** FOUNDATION v0.4.0 REQ-FND-049 enum inventory 테이블은 Phase 5까지 총 26개 값을 pre-declare했다. Phase 11 추가 4개 값(`network.optin_change`, `network.aggregate_recompute`, `network.query`, `network.contribute`)은 FOUNDATION v0.5.0 업데이트 시 반영되어야 한다. 본 SPEC의 migration은 FOUNDATION 업데이트와 coordination 후 머지된다. Cumulative enum size: 26 + 4 = **30 values**.

#### REQ-NET-044 (Event-Driven)
**요구사항:** WHEN any of the following events occur, THEN the system SHALL write an audit_logs entry with appropriate `action`, `actor_id`, `resource_type='network'`, `resource_id=signal_type`, and PII-free `meta_json`:
- Opt-in/opt-out via REQ-NET-003/REQ-NET-005 → `action='network.optin_change'`
- Weekly cron or opt-in-triggered aggregate recomputation completion (REQ-NET-025/026) → `action='network.aggregate_recompute'`, meta_json containing `{cells_computed, cells_suppressed_k, cells_suppressed_threshold, epsilon_consumed, batch_duration_ms}`
- Chat `network.query` intent resolution (REQ-NET-040) → `action='network.query'`, meta_json containing `{signal_type, filters_applied, result_found: bool}` (question text BANNED)
- Internal contribution write via REQ-NET-037 → `action='network.contribute'`, meta_json containing `{signal_type, source_pipeline}` (raw_data BANNED)

**근거:** handoff §16 "every LLM call, every source access, every expert-review flag" 확장 + research §5.3 21 CFR Part 11 audit trail.
**검증:** Static analysis CI (`scripts/qa/audit-completeness.ts`) Phase 5에서 확립한 패턴 준용 — 모든 POST/PATCH/DELETE on `/api/ra/network/*` writeAudit 호출 존재 검증.

#### REQ-NET-045 (Unwanted)
**요구사항:** The `audit_logs.meta_json` for `network.*` actions SHALL NOT contain: raw contribution data, individual aggregate values (to avoid log-based reconstruction attack), organization names, user emails, chat question text, or any DLP-blocked identifier pattern. Static CI analysis SHALL enforce this via `scripts/qa/audit-completeness.ts` (Phase 5 확장).
**근거:** research §5.3 21 CFR Part 11 + §3.2 시나리오 C Reconstruction Attack mitigation.
**검증:** Audit sample review + CI gate fails if forbidden keys detected in writeAudit call sites.

#### REQ-NET-046 (Ubiquitous)
**요구사항:** Before production deployment, a Privacy Impact Assessment SHALL be completed by an external privacy auditor (e.g., CIPL, IAPP-certified consultant, or regulatory counsel) covering: (a) data flow diagram, (b) threat analysis (research §3 참조), (c) privacy mechanism mathematical proof (k≥5, ε=1.0), (d) legal basis review (GDPR, HIPAA, 21 CFR Part 11, MFDS/NMPA/PMDA), (e) opt-in consent validity, (f) incident response plan. Audit report SHALL be stored at `.moai/compliance/pia/SPEC-REGULA-NETWORK-001-external-audit-YYYY-QN.pdf` AND SHALL be publicly summarizable (Regula publishes PIA summary link at `/privacy/pia-network`).
**근거:** research §5.5 PIA Frameworks, §12 제약.
**검증:** Production deploy gate: PIA file 존재 + signed-off status + public summary URL 접근 가능 확인. Deploy automation이 해당 파일 미존재 시 block.

#### REQ-NET-047 (Ubiquitous)
**요구사항:** Each organization that opts-in to any network signal SHALL accept a Network Intelligence Addendum (separate from main service agreement) containing: (1) 6 signal categories explicitly enumerated, (2) anonymization method summary (k≥5 + ε=1.0), (3) 72h withdrawal procedure, (4) aggregate usage scope (internal decision-making only, resale prohibited), (5) Regula's liability limits (anonymization robustness warranted but 0% re-identification not promised), (6) jurisdiction. Template SHALL be at `templates/legal/network-intelligence-addendum.md` and downloadable from `/admin/network/optin` page. Addendum acceptance SHALL be recorded in `network_optins.meta_json.addendum_accepted_version`.
**근거:** research §5.6 Network Intelligence Addendum.
**검증:** Opt-in flow 렌더 → addendum PDF 렌더 + signed acceptance checkbox → DB에 addendum_accepted_version 기록 확인.

#### REQ-NET-048 (State-Driven)
**요구사항:** IF the annual cumulative privacy budget ε_annual for any signal exceeds 52 (weekly ε=1.0 × 52 weeks ceiling), THEN the anonymizer Worker SHALL (a) halt further aggregate updates for that signal until admin review, (b) emit a PagerDuty alert to Regula compliance team, (c) write audit_logs with `action='network.aggregate_recompute'` and `meta_json.halt_reason='privacy_budget_exhausted'`. Recovery requires admin-initiated budget reset procedure AND external PIA auditor sign-off.
**근거:** research §2.2 Privacy Budget 관리, §11.3.
**검증:** ε_annual 상한 도달 시뮬레이션 → halt + alert + audit log 확인. Recovery workflow 문서 존재 확인.

---

## Acceptance Criteria

본 SPEC의 완료는 다음 모든 조건을 만족할 때 인정된다.

### 보안 및 프라이버시 Gate
1. **k-anonymity violation 0건:** Red team이 100개 synthetic aggregates 생성/검증, `k_group_size < 5` 값 0건.
2. **Differential privacy ε ≤ 1.0 수학적 증명 첨부:** Laplace mechanism 구현이 ε=1.0 보장을 만족함을 문서 `docs/privacy/ε-proof-SPEC-NETWORK-001.md`로 첨부. OpenDP 참조 구현과 일치 검증.
3. **minimum 20 contributing orgs 임계값 enforcement:** 19 orgs 상황에서 aggregate 미생성 확인.
4. **DLP identifier leak 0건:** known positive set 1000개에 대해 sanitizer detection rate ≥ 95%. Red team이 100 attempts로 leak 시도, 성공률 0%.
5. **Insider threat mitigation:** Worker 별도 배포 확인, 메인 Postgres service role이 `network_contributions.raw_data_json` 읽기 불가 확인.

### 법적 및 규제 Gate
6. **Privacy Impact Assessment 외부 감사 통과:** 외부 전문가 (CIPL, IAPP-certified consultant, 또는 동등) 서명 받은 PIA 리포트 첨부. Deploy automation이 파일 존재 검증.
7. **FDA Pre-submission meeting 비공식 확인:** 21 CFR Part 11 scope 해석에 대해 FDA Q-submission 또는 법률 자문 meeting 노트 첨부 (Pending 상태여도 초기 배포 가능한 경우 조건부 승인).
8. **Network Intelligence Addendum 계약서 샘플 완성:** 템플릿 파일 + 법률 자문 검토 완료 sign-off.
9. **audit_logs 완전성:** `scripts/qa/audit-completeness.ts` CI gate 통과. 4개 신규 enum 값 모두 writeAudit 호출 사이트 존재.

### 운영 및 기능 Gate
10. **Opt-in/out 변경 후 72h 내 집계 반영:** E2E test가 opt-out → 72h 시뮬레이션 → aggregate contributing_orgs 감소 확인.
11. **Weekly cron 10 min 이내 실행:** 1M contribution baseline mock test에서 batch duration ≤ 10 min 확인.
12. **Raw data 파이프라인 end-to-end encrypted:** 메인 app → Worker 통신 TLS 1.3 + mTLS 확인. `network_contributions.raw_data_json` at-rest encryption 확인.
13. **Chat network.query intent 동작:** 6 signal별 sample query 각 3개 총 18개 케이스에서 정답 aggregate 조회 + citation 부착 확인.

### 접근성 및 i18n Gate
14. **WCAG 2.1 AA:** `/network` 및 `/admin/network/*` 모든 페이지 axe-core 0 violations, 키보드 내비게이션 full path, prefers-reduced-motion 존중.
15. **i18n 완전성:** `scripts/qa/i18n-completeness.ts` 통과 — ko/en dictionary key parity, 모든 network.* 키 번역 존재.
16. **Dark mode:** `/network` 및 `/admin/network/*` 다크 모드 FOUT 없이 렌더, 색 대비 WCAG AA 만족.

### 통합 Gate
17. **Cross-SPEC enum inventory 일치:** FOUNDATION v0.5.0 REQ-FND-049 table에 Phase 11 4개 값 포함. compliance-qa cross-SPEC 검사 통과.
18. **Regression 없음:** Phase 1~10 기존 기능(CHAT, STRUCTURED, BREADTH, ENTERPRISE, DOCINGEST, WORKFLOWS, RADAR)에 대한 E2E smoke test 통과.

---

## Risks

### Catastrophic Risks
- **R1 (Catastrophic, 낮음 확률):** Re-identification 공격 성공 — 경쟁사가 외부 공시 데이터와 결합하여 특정 조직 submission 역추론. Mitigation: k≥5 + ε=1.0 + minimum 20 + quasi-identifier 일반화 + PIA 외부 감사 + 정기 red team.
- **R2 (Catastrophic, 낮음 확률):** Anonymizer Worker 보안 결함 또는 insider threat으로 raw data 유출. Mitigation: 별도 배포 + 최소 권한 service role + Cloudflare Access + break-glass workflow 감사 + Worker 로그 PII-free + separate CODEOWNERS.
- **R3 (Catastrophic, 낮음 확률):** 규제 당국이 anonymized aggregate를 PHI로 재해석. Mitigation: FDA Pre-submission meeting + HIPAA Safe Harbor 기준 달성 근거 문서 + 외부 PIA 감사.

### High Risks
- **R4 (높음):** 초기 참여 조직 수 부족 (bootstrap 실패) → 집계 의미 없음. Mitigation: Launch partner 3~5개 선확보 + threshold waiver 법률 검토 + reciprocity credits post-launch.
- **R5 (높음):** Competitive chilling effect — 조직이 opt-out 대량 발생. Mitigation: Transparency-by-default + per-signal granularity + PIA 공개 + bilateral value (aggregate 접근 제공).
- **R6 (높음):** 중국 DSL/PIPL cross-border transfer 규제로 중국 조직 기여 차단. Mitigation: 초기 중국 opt-in 제한 + geo-fenced Worker v2 설계.

### Medium Risks
- **R7 (중간):** DP noise 과다로 aggregate가 의사결정 활용 불가. Mitigation: ε=1.0 sweet spot 선택 + contributing orgs 증가로 상쇄 + Rand 결과 95% CI 함께 제공.
- **R8 (중간):** Privacy budget ε_annual 고갈 시 서비스 중단. Mitigation: 상한 모니터링 + 사전 경고 + budget reset 절차 (REQ-NET-048).
- **R9 (중간):** 법률 규제 변경 (HIPAA Safe Harbor 재해석 등). Mitigation: 법률 자문 분기별 review + flexible architecture (k 및 ε 파라미터 설정 가능 설계).

### Low Risks
- **R10 (낮음):** Weekly cron 실행 실패로 aggregate stale. Mitigation: monitoring + retry + 2회 연속 실패 시 admin alert.

---

## Non-Obvious Constraints Compliance Matrix

handoff §16 "Non-Obvious Product Constraints" 섹션의 7개 제약이 본 Phase 11에 미치는 영향을 명시한다.

| # | 제약 | 본 SPEC 반영 REQ |
|---|---|---|
| 1 | Citation 강제 (§8.1) | REQ-NET-040 — chat network.query 응답의 aggregate 값에 inline citation `<sup class="cite">N</sup>` 부착 |
| 2 | Multi-phase streaming (§11.1) | REQ-NET-040 — network.query는 단일 phase (prose + structured aggregate block as `sources` or `related` event); 신규 SSE event 도입 없음 (기존 채널 재사용) |
| 3 | Expert-review auto-flagging (§9.3) | REQ-NET-041 — threshold 미달 fallback 시 expert-review auto-trigger 발생 안 함 (RAG fallback 기본) |
| 4 | Audit logging (§16) | REQ-NET-043 — **신규 audit_action 4개 값** (`network.optin_change`, `network.aggregate_recompute`, `network.query`, `network.contribute`). FOUNDATION v0.5.0 enum inventory 확장 요청. Cumulative 30 values. REQ-NET-044 — 4개 값 모두 writeAudit 호출 사이트 보증. REQ-NET-045 — meta_json PII-free. |
| 5 | Serif 타이포 (§6) | `/network` dashboard의 stat values (clearance_rate, median_days 등)은 serif 적용 — FE 구현 시 `font-serif` Tailwind 클래스 적용 (Phase 3 STRUCTURED의 StatCard 패턴 재사용) |
| 6 | 한국어 + 영어 1급 (§6) | REQ-NET-036, REQ-NET-039 — 모든 UI 텍스트 ko/en bilingual, disclaimer + transparency banner 양언어 제공. REQ-NET-015 DLP sanitizer는 한/영 의료기기 식별자 정규식 사전 보유. |
| 7 | Auth → noindex (§18) | REQ-NET-042 — `/network` 및 `/admin/network/*` noindex 강화 (Phase 5 ENTERPRISE 기조 연장) |

---

## Pending

다음 항목은 본 SPEC 초안 단계에서 확정되지 못했으며, 별도 의사결정 프로세스 필요:

1. **법률 자문 결과 수용 대기 (Blocking for production deploy):**
   - Q1 (GDPR Art.17 + anonymized aggregate recomputation 의무): 법률 자문 결과에 따라 REQ-NET-006 구현 세부사항 조정 가능
   - Q2 (21 CFR Part 11 scope — anonymized aggregate가 electronic record인가): FDA Pre-submission meeting 필요
   - Q3 (HIPAA Safe Harbor 18개 식별자 적용 범위): 의료기기 도메인 특화 해석 필요
   - Q4 (중국 DSL/PIPL cross-border transfer): 중국 조직 opt-in 시 별도 geo-fenced 아키텍처 필요

2. **비즈니스 결정 대기 (Post-launch):**
   - Q5 (Reciprocity credits vs Open aggregate): 초기 v1은 open aggregate, post-launch 재평가
   - Q6 (Aggregate commercial resale 허용 여부): Out of Scope로 유지, 별도 비즈니스 결정
   - Q7 (참여 인센티브 투자 규모): bootstrap 결과 관측 후

3. **기술 결정 유보:**
   - Q8 (Worker 런타임 — JS vs Rust/wasm): 프로토타입 성능 측정 후 결정
   - Q9 (OpenDP 라이브러리 vs 자체 Laplace 구현): OpenDP PoC 검증 후 결정
   - Q10 (l-diversity/t-closeness 추가 레이어): v1.1에서 homogeneity attack 실측 후 결정

4. **외부 감사 및 승인:**
   - Privacy Impact Assessment 외부 감사 필수 (production deploy gate) — 별도 procurement 프로세스
   - FDA 또는 법률 고문과의 informal review — 일정 조정 필요

5. **Cross-SPEC coordination:**
   - FOUNDATION v0.5.0 업데이트가 Phase 11 enum inventory 4개 값을 반영할 때까지 본 SPEC의 migration merge 대기. 단일 coordinated PR로 처리.

---

## Cross-SPEC References

| 참조 SPEC | 참조 항목 | 본 SPEC 영향 |
|---|---|---|
| SPEC-REGULA-FOUNDATION-001 v0.4.0+ | REQ-FND-044 audit_logs.action pgEnum, REQ-FND-049 enum inventory | REQ-NET-043 Phase 11 4개 값 추가, FOUNDATION v0.5.0 업데이트 coordination 필요 |
| SPEC-REGULA-FOUNDATION-001 v0.4.0+ | REQ-FND-049a scope discipline | REQ-NET-044 writeAudit 호출 사이트 보증, Phase 11 신규 audit action은 본 SPEC 범위 내에서만 wire |
| SPEC-REGULA-ENTERPRISE-001 v0.2.0+ | RBAC withPermission middleware | REQ-NET-008, REQ-NET-035 — network.manage / network.read permission 추가 |
| SPEC-REGULA-ENTERPRISE-001 v0.2.0+ | audit_logs 정적 분석 CI gate | REQ-NET-044, REQ-NET-045 — 본 SPEC 신규 endpoint에 대해 동일 gate 적용 |
| SPEC-REGULA-ENTERPRISE-001 v0.2.0+ | Dark mode runtime, i18n runtime, accessibility | REQ-NET-036, REQ-NET-039 — `/network` dashboard 다크모드 + ko/en + WCAG 2.1 AA 준수 |
| SPEC-REGULA-CHAT-001 | `lib/ai/consult.ts` Phase B 구조 | REQ-NET-040 — network.query intent handler 통합 |
| SPEC-REGULA-CHAT-001 | Intent classifier (Haiku) | REQ-NET-040 — network.query intent 추가 학습 |
| SPEC-REGULA-DOCINGEST-001 | 의료기기 도메인 식별자 및 controlled vocabulary | REQ-NET-015 DLP sanitizer에서 DOCINGEST의 식별자 패턴 재사용 |
| SPEC-REGULA-WORKFLOWS-001 | Submission workflow completion hook | REQ-NET-037 — WORKFLOWS phase 완료 시 contribute hook 발화 (단, opt-in 조직만) |
| SPEC-REGULA-RADAR-001 | Regulatory category 분류 | REQ-NET-018 quasi-identifier 중 regulatory_category는 RADAR 분류 체계 재사용 |

---

## Data Model Detail

본 섹션은 REQ-NET-001, -011, -023 등 스키마 요구사항의 세부 column 정의, constraint, index, 그리고 migration 순서를 명시한다. 구현 단계 manager-ddd 참조 문서.

### Migration Order (Phase 11)

Phase 11 migration은 단일 coordinated commit에서 다음 순서로 생성된다:

| 순번 | Migration File | 내용 | Depends on |
|---|---|---|---|
| 1 | `00XX_network_enums.sql` | `network_signal_type`, `anonymization_status_enum` pgEnum 생성 | FOUNDATION `audit_action` 존재 |
| 2 | `00XX_network_optins.sql` | `network_optins` 테이블 + FK + index | `00XX_network_enums.sql` |
| 3 | `00XX_network_contributions.sql` | `network_contributions` 테이블 + TTL 인덱스 + at-rest encryption trigger | `00XX_network_enums.sql` |
| 4 | `00XX_network_aggregates.sql` | `network_aggregates` 테이블 + UNIQUE constraint + CHECK constraints | `00XX_network_enums.sql` |
| 5 | `00XX_network_audit_actions.sql` | `ALTER TYPE audit_action ADD VALUE` × 4개 값 추가 | FOUNDATION `audit_action` enum 존재 |

### Table `network_optins` Schema Detail

```sql
CREATE TABLE network_optins (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id          uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  signal_type     network_signal_type NOT NULL,
  consented_at    timestamptz NOT NULL DEFAULT now(),
  consented_by    uuid NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  withdrawn_at    timestamptz,
  withdrawal_reason text,
  addendum_accepted_version text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_network_optins_org_signal_active
  ON network_optins (org_id, signal_type)
  WHERE withdrawn_at IS NULL;

CREATE INDEX idx_network_optins_history
  ON network_optins (org_id, signal_type, consented_at DESC);
```

**Rationale:**
- Partial index `idx_network_optins_org_signal_active` 는 "현재 opt-in 여부" 조회를 O(log n)로 수행 (REQ-NET-004 상태 판정)
- `addendum_accepted_version` NOT NULL enforcement는 REQ-NET-047 계약서 수락 기록 의무화
- `consented_by ON DELETE SET NULL` 은 사용자 삭제 시 opt-in 기록 보존 (FOUNDATION audit pattern 일치)

### Table `network_contributions` Schema Detail

```sql
CREATE TABLE network_contributions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  signal_type           network_signal_type NOT NULL,
  raw_data_json         jsonb,  -- ENCRYPTED via pgcrypto or Cloudflare encryption-at-rest
  received_at           timestamptz NOT NULL DEFAULT now(),
  anonymized_at         timestamptz,
  anonymization_status  anonymization_status_enum NOT NULL DEFAULT 'pending',
  ttl_expires_at        timestamptz NOT NULL DEFAULT (now() + interval '48 hours'),
  source_pipeline       text NOT NULL,  -- 'workflows' | 'docingest' | 'radar'
  error_reason          text,
  created_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_network_contributions_pending_ttl
  ON network_contributions (ttl_expires_at)
  WHERE anonymization_status IN ('pending', 'in_progress');

CREATE INDEX idx_network_contributions_batch_pickup
  ON network_contributions (signal_type, anonymization_status, received_at)
  WHERE anonymization_status = 'pending';
```

**Rationale:**
- `raw_data_json` 는 at-rest encryption 필수 (REQ-NET-011) — pgcrypto `pgp_sym_encrypt` 또는 Cloudflare managed encryption
- `ttl_expires_at` 기본값 48h는 REQ-NET-014 강제 삭제 기준 시간
- Partial index `idx_network_contributions_pending_ttl` 는 cron TTL 삭제 job 성능 최적화
- `source_pipeline` 필드는 audit trail 재구성 지원 (REQ-NET-044 meta_json.source_pipeline)

### Table `network_aggregates` Schema Detail

```sql
CREATE TABLE network_aggregates (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_type           network_signal_type NOT NULL,
  device_class          text NOT NULL,
  regulatory_category   text NOT NULL,
  jurisdiction          text NOT NULL,
  submission_year_bin   text NOT NULL,
  aggregate_json        jsonb NOT NULL,
  k_group_size          int NOT NULL CHECK (k_group_size >= 5),
  contributing_orgs     int NOT NULL CHECK (contributing_orgs >= 20),
  epsilon_consumed      numeric(5,3) NOT NULL CHECK (epsilon_consumed > 0),
  epsilon_cumulative_annual numeric(6,3) NOT NULL DEFAULT 0,
  methodology_version   text NOT NULL,
  computed_at           timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uniq_aggregate_cell UNIQUE (
    signal_type, device_class, regulatory_category, jurisdiction, submission_year_bin
  )
);

CREATE INDEX idx_network_aggregates_signal_filter
  ON network_aggregates (signal_type, device_class, jurisdiction);

CREATE INDEX idx_network_aggregates_updated
  ON network_aggregates (updated_at DESC);
```

**Rationale:**
- CHECK constraints `k_group_size >= 5` 와 `contributing_orgs >= 20` 은 REQ-NET-019, REQ-NET-024 강제
- UNIQUE constraint는 동일 cell 중복 방지 (upsert pattern enforcement)
- `epsilon_cumulative_annual` 은 REQ-NET-048 annual budget 추적

### Table `audit_logs` Extension (Phase 11)

**FOUNDATION `audit_action` pgEnum 확장 migration:**

```sql
-- 00XX_network_audit_actions.sql
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'network.optin_change';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'network.aggregate_recompute';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'network.query';
ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'network.contribute';
```

**Note:** `ALTER TYPE ... ADD VALUE` 는 Postgres 12+ transactional이 아님 — migration framework (drizzle-kit)에서 `IF NOT EXISTS` 사용하여 idempotent 보장.

**FOUNDATION v0.5.0 enum inventory update 요청:**

| Phase | 추가 값 | 누적 |
|---|---|---|
| Phase 1 (FOUNDATION) | `llm.call`, `source.access`, `expert_review.flag` | 3 |
| Phase 4 (BREADTH) | (10 values) | 13 |
| Phase 5 (ENTERPRISE) | (13 values) | 26 |
| **Phase 11 (NETWORK)** | `network.optin_change`, `network.aggregate_recompute`, `network.query`, `network.contribute` | **30** |

---

## Given-When-Then Acceptance Scenarios

본 섹션은 주요 REQ-NET에 대한 실행 가능한 시나리오를 Given-When-Then 형식으로 기술한다. Playwright E2E + integration test 참조 문서.

### Scenario A — Admin Opt-in Flow (REQ-NET-003, -008, -009, -047)

**Given:**
- 조직 `org-a`가 Regula 프로덕션 인스턴스에 존재
- 사용자 `user-admin-1`이 `org-a`의 `admin` role 보유
- `org-a`는 현재 어떤 signal에도 opt-in되어 있지 않음 (`network_optins` rows = 0)

**When:**
- `user-admin-1`이 `/admin/network/optin` 페이지 접속
- `submission_outcomes` 토글 활성화
- Network Intelligence Addendum 모달 렌더, `addendum_v1.0` 버전 수락 체크박스 확인
- "확인" 버튼 클릭 → `POST /api/ra/network/optin` 발화 with `{signal_type: 'submission_outcomes', addendum_version: 'v1.0'}`

**Then:**
- `network_optins` 에 새 row 생성: `{org_id: org-a, signal_type: submission_outcomes, consented_by: user-admin-1, withdrawn_at: NULL, addendum_accepted_version: 'v1.0'}`
- `audit_logs` 에 entry 생성: `{action: 'network.optin_change', actor_id: user-admin-1, resource_type: 'network', resource_id: 'submission_outcomes', meta_json: {signal_type: 'submission_outcomes', action: 'consent', actor_org_id: org-a}}`
- UI 토글 활성 상태 + 히스토리 로그에 신규 엔트리 표시
- 7일 지연 job이 `consented_at + 7 days` timestamp로 scheduled (REQ-NET-007, REQ-NET-026)

### Scenario B — Non-Admin Permission Denied (REQ-NET-008)

**Given:**
- 사용자 `user-ra-lead-1`이 `org-a`의 `ra-lead` role 보유

**When:**
- `user-ra-lead-1`이 `/admin/network/optin` 접속 시도

**Then:**
- 페이지 렌더 거부 (Next.js middleware redirect) 또는 403 에러 페이지 표시
- `network_optins` 테이블에 변화 없음
- `audit_logs`에 `action='rbac.permission_deny'` (Phase 5 ENTERPRISE 정의) 기록: `meta_json: {required_permission: 'network.manage', actor_role: 'ra-lead'}`

### Scenario C — Withdrawal and Right to be Forgotten (REQ-NET-005, -006)

**Given:**
- `org-a`는 `submission_outcomes` 에 3개월 전부터 opt-in
- `network_contributions` 에 `org-a` 기여 raw data 100건 (50건 anonymized_at 존재, raw_data_json = NULL; 50건 pending, raw_data_json 보유)
- `network_aggregates` 에 `org-a` 기여 반영된 cells 다수

**When:**
- `user-admin-1`이 `/admin/network/optin` 에서 `submission_outcomes` withdrawal 요청
- Withdrawal 모달에서 "72시간 내 raw data 삭제 + 다음 batch aggregate 재계산" 공지 확인 후 확인
- `DELETE /api/ra/network/optin?signal_type=submission_outcomes` 발화

**Then:**
- `network_optins` 해당 active row의 `withdrawn_at` 현재 시간으로 update
- `raw-data-hard-delete-job` 즉시 enqueue
- 72h 이내 `network_contributions where org_id=org-a AND signal_type=submission_outcomes` 의 `raw_data_json` 전체 NULL 또는 row delete 확인
- `aggregate-recompute-job` 즉시 (1h 이내) 실행 — opt-out 경로는 7일 지연 미적용 (REQ-NET-026)
- `network_aggregates` 의 affected cells 에서 `contributing_orgs` 1 감소, `aggregate_json` 값 재계산 (Laplace noise 재주입), `epsilon_consumed` += 0.5
- `audit_logs` 다음 3건 entry:
  - `action='network.optin_change', meta_json={action: 'withdraw', ...}`
  - `action='network.aggregate_recompute', meta_json={trigger: 'opt_out', cells_affected: N, epsilon_consumed: 0.5}` (cell별 × N)
  - `rbac` 검증 entry

### Scenario D — Weekly Cron Execution (REQ-NET-025, -032, -044)

**Given:**
- 현재 시각 = Sunday 01:59 UTC
- `network_contributions` 테이블에 지난 주 신규 기여 5,000건 (모두 anonymization_status='completed')
- 전체 contributing orgs = 50

**When:**
- Cloudflare Cron 02:00 UTC 발화
- Anonymizer Worker `weekly-aggregate` job 시작

**Then:**
- Worker가 `network_contributions WHERE anonymized_at >= last_batch_ts` 쿼리로 기여 fetch
- Mondrian partitioning: 총 120 potential cells 생성, 40 cells가 k<5 으로 suppress, 15 cells가 contributing_orgs<20 으로 suppress
- 65 cells 에 대해 Laplace(Δf/1.0) 노이즈 주입 후 `network_aggregates` upsert
- 각 cell의 `epsilon_consumed` += 1.0, `epsilon_cumulative_annual` 증분
- Batch duration: 예: 287 seconds (< 10 min 요건 만족)
- `audit_logs` entry 생성: `{action: 'network.aggregate_recompute', meta_json: {cells_computed: 65, cells_suppressed_k: 40, cells_suppressed_threshold: 15, epsilon_consumed: 1.0, batch_duration_ms: 287000, batch_type: 'weekly_cron'}}`
- `/admin/network/batch-reports/` 에 report 엔트리 추가 (admin만 조회 가능)

### Scenario E — DLP Rejection on Identifier Leak (REQ-NET-015, -016)

**Given:**
- `org-a`는 `deficiency_patterns` opt-in 상태
- WORKFLOWS 파이프라인이 `POST /api/ra/network/contribute` 호출 (service token 인증)
- Request body raw_data에 실수로 FDA K-number 포함: `{device_class: 'II', deficiency_text: "...K243521 was referenced..."}`

**When:**
- DLP sanitizer Stage 2 regex `K\d{6}` 매칭 → K243521 감지

**Then:**
- Contribution write 즉시 abort (rows 미삽입)
- Sentry alert: severity `critical`, tags: `{dlp_leak: true, signal_type: 'deficiency_patterns', pattern_matched: 'fda_k_number'}`
- API 응답: 400 Bad Request with error code `DLP_IDENTIFIER_DETECTED` (raw text 미포함)
- `audit_logs` 선택적 entry: `{action: 'network.contribute', meta_json: {result: 'rejected_dlp', pattern_class: 'fda_k_number'}}` (identifier 값 자체는 로그 금지)
- `network_contributions` 테이블에 row 생성 없음 (REQ-NET-016 abort 의미)

### Scenario F — Chat network.query Intent Resolution (REQ-NET-040, -041)

**Given:**
- 사용자 `user-ra-member-1`이 chat 인터페이스 사용 중
- `network_aggregates` 에 `(submission_outcomes, II, cardiovascular, US, 2024-2025)` cell 존재: `{clearance_rate: 0.76, contributing_orgs: 34, k_group_size: 187}`

**When:**
- 사용자 입력: "우리 Class II cardiovascular device의 FDA 510(k) clearance 성공률은?"
- Haiku intent classifier → `network.query` intent, confidence 0.82

**Then:**
- `lib/ai/network-query-handler.ts` 발동
- 구조화 추출: `{signal_type: 'submission_outcomes', device_class: 'II', regulatory_category: 'cardiovascular', jurisdiction: 'US'}`
- `/api/ra/network/aggregates/submission_outcomes?device_class=II&regulatory_category=cardiovascular&jurisdiction=US` 조회
- Aggregate 반환: `{clearance_rate: 0.76, transparency: {contributing_orgs: 34, k_group_size: 187, epsilon: 1.0, methodology_version: 'v1.0'}}`
- Chat 응답 형식 (Korean locale):
  - 본문: "Regula Network Aggregate v1.0 기준, Class II cardiovascular US 510(k) clearance 성공률은 약 76%입니다 <sup class="cite">1</sup>. 기여 조직 34곳, k-group size 187 기반."
  - Citation [1]: "Regula Network Aggregate v1.0 (updated 2026-04-22). Methodology: k-anonymity (k≥5) + differential privacy (ε=1.0)."
  - Transparency block inline (expandable)
- `audit_logs`: `{action: 'network.query', resource_type: 'network', resource_id: 'submission_outcomes', meta_json: {signal_type: 'submission_outcomes', filters_applied: {device_class: 'II', regulatory_category: 'cardiovascular', jurisdiction: 'US'}, result_found: true}}` (question text 미포함 — REQ-NET-045)

### Scenario G — Insufficient Threshold Fallback (REQ-NET-041)

**Given:**
- `(audit_observations, III, ophthalmic, CN, 2024-2025)` cell에 contributing_orgs = 15 (< 20 임계값)
- 따라서 해당 cell은 `network_aggregates` 에 미존재 (suppressed)

**When:**
- 사용자가 "Class III ophthalmic China audit 483 발생률은?" 질문

**Then:**
- `network.query` intent 감지, aggregate 조회 요청
- `/api/ra/network/aggregates/audit_observations?device_class=III&regulatory_category=ophthalmic&jurisdiction=CN` → 404 (cell missing)
- Handler가 일반 RAG fallback으로 전환
- Chat 응답: RAG 기반 일반 FDA/NMPA guidance + "해당 조건의 네트워크 집계 데이터가 참여 조직 수 임계값(20)에 미달하여 제공되지 않습니다." 알림 inline
- Confidence 점수는 RAG 결과 기반으로 계산 — expert-review auto-trigger는 threshold 미달 사실만으로는 발동 안 함 (REQ-NET-041)

### Scenario H — Privacy Budget Exhaustion (REQ-NET-048)

**Given:**
- `submission_outcomes` signal의 `epsilon_cumulative_annual` = 51.7 (연간 상한 52 근접)

**When:**
- 다음 weekly cron 실행 → ε=1.0 소비 시 annual 52.7 초과 예상

**Then:**
- Anonymizer Worker가 pre-check 단계에서 budget 상한 감지
- Aggregate 재산출 halt (신호 `submission_outcomes` 만 해당, 다른 signal은 정상 진행)
- PagerDuty alert 발화: `{severity: 'critical', component: 'regula-anonymizer', signal_type: 'submission_outcomes', reason: 'privacy_budget_exhausted'}`
- `audit_logs` entry: `{action: 'network.aggregate_recompute', meta_json: {halt_reason: 'privacy_budget_exhausted', epsilon_cumulative_annual: 51.7, signal_type: 'submission_outcomes'}}`
- Admin UI `/admin/network/batch-reports/` 에 budget exhaustion 배너 표시
- Recovery workflow: admin 승인 + external PIA auditor sign-off 후 budget reset

---

## Observability Separation Policy

본 SPEC은 Phase 5 ENTERPRISE에서 확립한 "audit_logs는 regulatory, 기타 관측성은 product analytics" 분리 원칙을 엄격히 준수한다.

### Regulatory Trail (audit_logs 전담)

- `network.optin_change`, `network.aggregate_recompute`, `network.query`, `network.contribute` 4개 action
- Append-only 테이블, 7년 보존 (21 CFR Part 11 기준)
- Sentry/PostHog/Langfuse/Vercel Analytics **미전송** (Phase 5 정책 연장)

### Product Analytics (PostHog, 선택)

- 전송 가능 이벤트:
  - `network_dashboard_viewed` (user role, signal tab, filter 선택 등) — PII-free
  - `network_optin_toggle_viewed` (admin UI 진입 이벤트)
- 전송 **금지** 이벤트:
  - 실제 aggregate 값 (reconstruction attack 우려)
  - 조직별 기여 여부 (membership inference)
  - 질문 텍스트

### Error Tracking (Sentry)

- `network.*` 관련 errors 추적
- Identifier leak alerts (REQ-NET-016) severity `critical`
- 메타데이터에 raw_data, aggregate values 포함 **금지**
- Scrubbing rule: `raw_data_json`, `aggregate_json` 필드 자동 제거

### LLM Tracing (Langfuse)

- `network.query` intent 판정 시 Langfuse generation trace
- Prompt/response 에서 aggregate 값은 placeholder로 masking 후 trace
- Retention: 90일

### Worker Logs

- Cloudflare Worker `regula-anonymizer` 의 로그는 **별도 vendor** (Cloudflare Logpush → S3 또는 전용 observability) 로 전송
- 메인 Sentry/PostHog와 격리
- 내용: contribution ID, signal type, timestamp, anonymization duration, suppression count, error codes만 (raw data, aggregate values 금지 — REQ-NET-022)

---

## Rollout and Rollback Plan

### Rollout Stages

| 단계 | 범위 | Gate |
|---|---|---|
| Dev | 개발자 로컬 + Storybook | Unit tests pass |
| Preview | Cloudflare Preview Worker + staging Postgres | Integration tests + privacy simulation tests pass |
| Canary | Internal Regula team 1 org + 3 launch partner 조직 opt-in 가능 | 외부 PIA 감사 통과 + 법률 자문 완료 |
| GA | All organizations opt-in 가능 | Canary 최소 30일 무이슈 + regulatory informal review |

### Rollback Procedure

**Scenario: Privacy breach 의심 시**

1. **즉시 조치 (1h):**
   - Anonymizer Worker 비활성화 (Cloudflare feature flag)
   - `/api/ra/network/contribute` endpoint 503 응답
   - `/network` 및 `/admin/network/*` 페이지 maintenance banner 표시

2. **단기 조치 (24h):**
   - `network_contributions` 에서 의심 시점 이후 raw_data_json hard delete
   - `network_aggregates` 에서 의심 cells 삭제
   - 외부 감사팀에 24h 내 notification (GDPR Art.33 기준)

3. **Post-mortem:**
   - 원인 분석 리포트 `.moai/compliance/incidents/YYYY-MM-DD-network-breach.md`
   - 규제 당국 breach notification (해당 관할 72h 이내)
   - 영향 조직에 개별 고지

### Feature Flag

- `FEATURE_NETWORK_INTELLIGENCE_ENABLED` (organization-level feature flag)
- 기본 OFF (Canary 단계에서 개별 조직 OptIn)
- GA 후에도 조직 관리자가 비활성화 요청 시 OFF 가능

---

## Methodology Versioning Policy

본 SPEC의 `methodology_version = 'v1.0'` 은 다음 변경 시 증분된다:

| 변경 유형 | 버전 증분 | 조치 |
|---|---|---|
| k threshold 변경 (5 → 7 등) | v1.0 → v2.0 | 전체 aggregate 재산출 + PIA 재승인 + 조직 고지 |
| ε 값 변경 (1.0 → 0.5 등) | v1.0 → v2.0 | 전체 aggregate 재산출 + PIA 재승인 |
| Quasi-identifier 정의 변경 | v1.0 → v2.0 | 전체 aggregate 재산출 + PIA 재승인 |
| Laplace → Gaussian mechanism | v1.0 → v2.0 | 전체 aggregate 재산출 + PIA 재승인 + 수학 증명 갱신 |
| l-diversity 추가 (v1.1) | v1.0 → v1.1 | 전체 aggregate 재산출 + PIA supplement |
| Minor bug fix (no math change) | v1.0 → v1.0.1 | 변경 로그만, 재산출 불필요 |

**Storage:** 각 `network_aggregates` row는 계산 당시의 `methodology_version` 기록. UI는 버전 mismatch 감지 시 "legacy methodology" 표시.

---

**End of SPEC-REGULA-NETWORK-001 v0.1.0**

총 48개 REQ-NET across 5 groups. research.md의 10 Technical Decisions, 5 attack scenarios, 5 legal jurisdictions, 6 industry references에 일대일 매핑됨. 본 SPEC의 production deploy는 PIA 외부 감사 + 법률 자문 결과 수용 + FOUNDATION v0.5.0 enum inventory coordination 완료 후 가능.
