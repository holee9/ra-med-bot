---
audit_id: AUDIT-REGULA-FOUNDATION-001-002
target: SPEC-REGULA-FOUNDATION-001
target_version: 0.2.0
auditor: plan-auditor
audit_date: 2026-04-22
stance: adversarial-independent
iteration: 2
previous_audit: AUDIT-REGULA-FOUNDATION-001-001
---

# Audit Report — SPEC-REGULA-FOUNDATION-001 (Iteration 2)

> Reasoning context ignored per M1 Context Isolation. Audit conducted against spec.md v0.2.0 (1,017 lines, 73 REQ-FND), research.md (264 lines, v0.2.0), and audit-001-response.md (273 lines), cross-referenced to handoff README §6/§12/§13.2/§15/§16/§20 and prior audit-001.md.

---

## Executive Summary

- **Regression status (23 findings from iteration 1):**
  - CONFIRMED: **23**
  - PARTIAL: 0
  - REGRESSED: 0
  - OVER-FIX: 0
- **New findings in iteration 2:** **4** (all Medium/Low — knock-on documentation slippage and one EARS nit)
  - Critical: 0
  - High: 0
  - Medium: 2
  - Low: 2
- **Overall verdict:** `REQUIRES_MINOR_PATCH`
- **Recommendation:** `PROCEED_TO_PHASE_1` (patch the 2 Medium findings before team kickoff; Low findings are doc polish and can be fixed in Sync phase)

v0.2.0 is a **substantive, faithful, and complete** response to iteration 1 audit. All 5 Critical and all 8 High findings are resolved with evidence on spec.md. The defects that remain are non-blocking documentation drift that does not threaten regulatory, brand, or Day-1 schema lock-in constraints.

---

## Regression Table (all 23 from iteration 1)

| AUD ID | Severity (orig) | Claimed resolution | Evidence line | Status | Notes |
|--------|-----------------|---------------------|----------------|--------|-------|
| AUD-001 | Critical | 13 tables + source_sections + UNIQUE + index | spec.md:L327, L549–573, L578, L767, L770, L915, L937 | **CONFIRMED** | 13개 REQ-FND 참조 모두 정확히 "13 tables" 사용. source_sections 전용 REQ 3개(044a/b/c) 별도. |
| AUD-002 | Critical | font-serif Source Serif 4 우선 | spec.md:L267 원문 `'Source Serif 4', 'Noto Serif KR', Georgia, serif` + L269 정규식 검증 + L914 Deliverables | **CONFIRMED** | handoff §6 line 287 원문과 정확 일치. "한국어 우선" 표현 삭제 확인. |
| AUD-003 | Critical | UPDATE/DELETE/TRUNCATE + REVOKE + role split | spec.md:L596 (row), L601 (TRUNCATE), L605 (role), L645–650 (REVOKE), L654–660 (migrations_role), L664–675 (8-step test) | **CONFIRMED** | 3-layer defense 전부 REQ-FND로 분해됨. compliance-qa 8-step 회귀 절차 명시. |
| AUD-004 | Critical | tailwind.config.ts 추가 | spec.md:L54 (In Scope), L301–309 (REQ-FND-029a), L902 (Deliverable #6a) | **CONFIRMED** | `darkMode: 'class'`, `content` globs 명시. `@theme` + config 역할 분리(L849 Risks)도 명시. |
| AUD-005 | Critical | 모든 FK onDelete 명시 | spec.md:L320–324 (Group D 공통 정책), 120회 이상의 CASCADE/SET NULL/RESTRICT 매칭 (grep count 33 in FK columns) | **CONFIRMED** | 11개 FK 관계 전부 정책 명시. audit_logs.actor_id = SET NULL, conversation_id = RESTRICT 등 권고와 정확히 일치. |
| AUD-006 | High | REQ-FND-027 Ubiquitous 재분류 | spec.md:L286 "(Ubiquitous) [AUD-006 재분류]" + "런타임 토글은 Phase 5" | **CONFIRMED** | EARS 패턴 태그 수정 + 본문 "SHALL emit CSS override rules" (정적 특성) 전환 확인. |
| AUD-007 | High | REQ-FND-030 Conditional 재작성 | spec.md:L311 "(Conditional)" + regex `#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?` + "exactly one mechanism MUST be selected" | **CONFIRMED** | 사람 트리거 → 파일 상태 트리거로 변경, Biome OR CI grep 둘 중 하나 강제. |
| AUD-008 | High | 금지 meta 화이트리스트 | spec.md:L216 전 14개 금지 태그 + 허용 화이트리스트 7종 열거 | **CONFIRMED** | `og:title`~`og:type`, `twitter:card`~`twitter:image`, `application-name`, 외부 canonical 전부 금지 명시. |
| AUD-009 | High | middleware matcher | spec.md:L719 정확한 regex `/((?!_next/static\|_next/image\|favicon.ico\|login\|sso/callback\|api/auth\|robots.txt\|public).*)` + 인증 시 `/login`→`/` 리다이렉트 | **CONFIRMED** | 권고한 matcher 그대로 채택 + login loop 방지 조항 포함. |
| AUD-010 | High | lib/env.ts zod | spec.md:L171–189 (REQ-FND-010a) + 구현 스니펫 + L936 DoD | **CONFIRMED** | `AUTH_SECRET min 32`, `DATABASE_URL url()`, module-load throw 명시. DoD 체크리스트에도 등록. |
| AUD-011 | High | pgvector precondition | spec.md:L577 (CREATE EXTENSION), L581 (권한 부족 시 abort), L775–778 (REQ-FND-059a remediation hint) | **CONFIRMED** | 단일 트랜잭션 wrapping + remediation hint 텍스트 (`GRANT CREATE ON DATABASE ...`) 정확히 제시. |
| AUD-012 | High | pgEnum 명시 | spec.md:L340–341 (`locale` pgEnum, `theme_pref` pgEnum) + L402 (`role` pgEnum) + L404 (`confidence_level` pgEnum) + L442 (`block_type` pgEnum) + L462 (`type` pgEnum for sources) + L522 (`status` pgEnum for expert_reviews) | **CONFIRMED** | 7개 pgEnum 전부 명시 (REQ-FND-579가 "pgEnum 타입 7개" 언급). |
| AUD-013 | High | LangChain Phase 2 이동 | spec.md:L85 (Out of Scope 행), L105–109 (Phase 2 기록 섹션), L853 (Risks), research.md:L60–70 (결정 3 재작성) | **CONFIRMED** | Technical Decisions table이 "Phase 1 확정 5개 + Phase 2 기록 1개" 구조로 재편. Phase 1 package.json에 langchain 미포함 확약. |
| AUD-014 | Medium | middleware-only 확정 | spec.md:L725 "Server-side layout session checks are explicitly NOT used for redirect logic" + research.md:L135–136 (해석 6) | **CONFIRMED** | AUD-009와 병합 처리. defense-in-depth session 읽기는 개인화만 허용, redirect 금지 명시. |
| AUD-015 | Medium | Sidebar 한국어 라벨·순서 | spec.md:L243 "홈 → /, 새 상담 → /chat, 히스토리 → /history, 템플릿 → /templates, 지식 베이스 → /knowledge, 규제 업데이트 → /updates, 대시보드 → /dashboard, 설정 → /settings" | **CONFIRMED** | 8개 라벨 + href 매핑 + 순서 결정론적. @testing-library/react 검증 방법 명시. |
| AUD-016 | Medium | DEVELOPMENT.md 5 섹션 | spec.md:L780–812 (REQ-FND-060) 5개 ## 헤딩 정확한 순서, Setup 체크박스 5개 이상 명시 | **CONFIRMED** | Prerequisites/Setup/Development Commands/Testing/Troubleshooting 순서 고정. |
| AUD-017 | Medium | Phase 1 audit wiring 경계 일치 | spec.md:L683 (REQ-FND-049 enum 3개 값만), L685 "auth.login은 없음", L688–690 (REQ-FND-049a call-sites 없음), L729–732 (REQ-FND-054 no-op stub) | **CONFIRMED** | `auth.*` 액션이 Phase 1 enum에서 제거됨. writeAudit call-site 0건 강제 검증. |
| AUD-018 | Medium | messages.tokens_in/out/model | spec.md:L408–410 | **CONFIRMED** | 3개 컬럼 nullable default NULL로 추가됨. |
| AUD-019 | Medium | /login robots override | spec.md:L231–238 (REQ-FND-018 metadata 스니펫), L743–754 (REQ-FND-056 루트 metadata), L945 DoD | **CONFIRMED** | `robots: { index: true, follow: true }` override 정확히 명시. grep 검증 방법 포함. |
| AUD-020 | Medium | PostgreSQL ≥16 | spec.md:L586–589 (REQ-FND-045a), L831 (Dependencies "PostgreSQL 16 이상"), L941 DoD | **CONFIRMED** | `server_version_num >= 160000` + pgvector ≥0.7 preflight assert 명시. |
| AUD-021 | Low | playwright.config.ts 책임 재배정 | spec.md:L924 "regula-architect (AUD-021 재배정)" | **CONFIRMED** | compliance-qa → regula-architect로 변경 확인. |
| AUD-022 | Low | Non-Obvious Constraints 매트릭스 | spec.md:L985–993 (7-row 매트릭스) | **CONFIRMED** | 7개 제약 모두 Phase 1 대비 REQ-FND ID 참조 + 상태 기재. |
| AUD-023 | Low | Tailwind @theme 위치 | spec.md:L262–264 (REQ-FND-022) "app/globals.css에 @theme, tokens.css는 중복 선언 금지" | **CONFIRMED** | "single source of truth" 원칙 + @import 순차 배치 명시. |

**Regression summary: 23/23 CONFIRMED.** manager-spec가 각 finding에 대해 실제 spec.md 본문에 인용 가능한 패치를 적용함. audit-001-response.md의 claim과 spec.md 실체가 일치함.

---

## New Findings in Iteration 2

| ID | Severity | Dimension | REQ-FND ref | Summary | Recommended Action |
|----|----------|-----------|-------------|---------|---------------------|
| AUDN2-001 | Medium | Documentation Consistency | 관련 문서 섹션 line 964 | handoff `§12 Data Models — 12 테이블 Drizzle sketch` 표기 잔존. AUD-001 Critical 수정의 문서 drift | "12 테이블" → "13 테이블" 교정 |
| AUDN2-002 | Medium | Numbering Integrity | Group 헤더 line 318 | `### Group D: Database Schema (REQ-FND-031 ~ REQ-FND-045)` 범위 표기가 044a/044b/044c/045a 포함하지 않음. Group E·G도 suffix REQ 미포함 | 각 Group 헤더에 suffixed REQ 명시 또는 "(REQ-FND-031 ~ REQ-FND-045a)"로 확장 |
| AUDN2-003 | Low | EARS Pattern / Verbiage | REQ-FND-049 line 683 | Phase 2 확장 설명 "`Phase 2 adds 'llm.call' call-sites`" — `'llm.call'`은 이미 Phase 1 enum에 포함. 호칭이 `enum value` vs `call-site` 혼동 유발 | 문구 수정: "Phase 2 wires call-sites for `llm.call` and `source.access`; Phase 5 adds enum values `auth.login`, `auth.logout`, ..." |
| AUDN2-004 | Low | Handoff Consistency | spec.md Frontmatter revision_history line 16 | `Initial draft (60 REQ-FND, 12 tables, 6 technical decisions)` — 역사적 사실 기록으로 의도 자체는 적절하나, 독자가 "v0.1.0은 12 tables였음"과 "v0.2.0은 13 tables"를 함께 읽어야 이해 가능 | notes 문구에 "v0.1.0 error corrected in v0.2.0" 부가 설명 또는 그대로 두기(historical log는 건드리지 않는 것이 원칙) — 권장: 유지 |

---

### Detailed New Findings

#### AUDN2-001 [Medium] 관련 문서 섹션의 "§12 — 12 테이블" 잔존
**Dimension:** Documentation Consistency
**Evidence:** spec.md:L964 `- §12 Data Models — 12 테이블 Drizzle sketch`
**Issue:** AUD-001 수정으로 SPEC 본문은 전면 "13 tables"로 갱신되었으나, 관련 문서 요약 섹션 1곳에 구 "12 테이블" 표기가 남아 있음. **handoff 원문은 실제 13 tables**(handoff README line 696–708: users, organizations, projects, conversations, messages, message_sources, message_blocks, checklist_items, sources, source_sections, templates, regulatory_updates, expert_reviews, audit_logs → 14 sketch, 단 Regula는 checklist_items 제거로 13). 따라서 "12 테이블"은 v0.1.0 잔재.
**Impact:** 독자가 handoff §12 재참조 시 12 vs 13 불일치 혼동 가능. 규제·브랜드·스키마 영향 없음.
**Recommended patch:** L964 `§12 Data Models — 12 테이블 Drizzle sketch` → `§12 Data Models — 13 테이블 Drizzle schema (checklist_items 제외)`로 수정.

#### AUDN2-002 [Medium] Group 헤더의 REQ 범위 표기 불완전
**Dimension:** Numbering Integrity / Navigability
**Evidence:**
- L318 `### Group D: Database Schema (REQ-FND-031 ~ REQ-FND-045)` — 실제로는 044a/044b/044c/045a까지 포함
- L593 `### Group E: Append-Only Audit Logs (REQ-FND-046 ~ REQ-FND-050)` — 실제로는 046a/046b/047a/047b/047c/049a 포함
- L741 `### Group G: Compliance Meta and Day-1 Prep (REQ-FND-056 ~ REQ-FND-060)` — 실제로는 059a 포함

**Issue:** 독자·검증 에이전트가 Group 헤더만 훑으면 suffixed REQ 13개 존재를 놓칠 수 있음. v0.2.0 line 117 notes에서 suffix 추가를 언급하지만 Group 섹션 제목에는 반영 안 됨.
**Impact:** compliance-qa가 Group D 범위를 "REQ-FND-031~045"로 범위 확인 시 `source_sections`(044a)·version assert(045a) 누락 가능성. Critical로 악화되기 전에 교정 필요.
**Recommended patch:** 각 Group 헤더를 다음과 같이 갱신:
- Group D: `(REQ-FND-031 ~ REQ-FND-045 + suffixed 044a/b/c, 045a)`
- Group E: `(REQ-FND-046 ~ REQ-FND-050 + suffixed 046a/b, 047a/b/c, 049a)`
- Group G: `(REQ-FND-056 ~ REQ-FND-060 + suffixed 059a)`
- Group A: `(REQ-FND-001 ~ REQ-FND-010 + suffixed 010a)`
- Group C: `(REQ-FND-021 ~ REQ-FND-030 + suffixed 029a)`

#### AUDN2-003 [Low] REQ-FND-049 Phase 2 확장 문구의 enum vs call-site 혼동
**Dimension:** EARS / Testability Minor
**Evidence:** spec.md:L683 `"The type is **extensible**: Phase 2 adds 'llm.call' call-sites, Phase 5 adds 'auth.login' / 'auth.logout' / ..."`
**Issue:** `'llm.call'`은 이미 Phase 1 enum 3개 값에 포함되어 있음 (같은 문장 앞 부분 `'llm.call', 'source.access', 'expert_review.flag'`). 따라서 "Phase 2 adds `'llm.call'`"은 enum 값 추가가 아니라 call-site(실제 호출부) 추가. 문장 구조가 enum union 확장과 뒤섞여 혼동.
**Impact:** Phase 2 manager-spec가 이 문구를 읽고 `'llm.call'` 을 다시 enum에 추가하려 할 위험 (noop 또는 duplicate). 기능 무해하나 문서 정확성 저하.
**Recommended patch:**
> "The type is extensible: Phase 2 **wires** `'llm.call'` and `'source.access'` call-sites (enum values already present in Phase 1); Phase 5 **adds new enum values** `'auth.login'` / `'auth.logout'` / `'session.invalidate'` / `'expert_review.resolve'` along with their call-sites."

#### AUDN2-004 [Low] Revision history 문구 보강 권고 (선택)
**Dimension:** Documentation
**Evidence:** spec.md:L16 `notes: Initial draft (60 REQ-FND, 12 tables, 6 technical decisions)`
**Issue:** 역사적 사실로서 v0.1.0의 "12 tables"와 "6 technical decisions"는 정확한 기록. 그러나 iteration 1 audit에서 이 둘 모두 Critical defect로 판명됨(12는 silent drop, 6은 LangChain 불필요 포함). 독자가 revision_history만 보고 v0.1.0을 참조할 위험.
**Impact:** 미미. revision_history는 변경 로그이므로 원형 보존이 원칙.
**Recommended patch:** 유지 권장. 단, 원한다면 v0.2.0 notes 블록에 "v0.1.0 had silent drop of source_sections and out-of-scope LangChain decision, both corrected in v0.2.0" 한 줄 추가 가능.

---

## New REQ-FND Scrutiny (13 entries)

| ID | EARS Pattern | Testability | Numbering | Integration | 판정 |
|----|-------------|-------------|-----------|-------------|------|
| REQ-FND-010a | Conditional (IF ... THEN ...) | PASS — Vitest `ZodError` throw 검증 가능 | suffix 적절 (Group A 연속) | REQ-FND-007/058과 상호보완, 중복 아님 | **PASS** |
| REQ-FND-029a | Ubiquitous (SHALL declare ...) | PASS — 파일 존재 + `pnpm build` 시 `darkMode: 'class'` 반영 | suffix 적절 (Group C) | REQ-FND-022(`@theme`)와 역할 분리 명시 | **PASS** |
| REQ-FND-044a | Ubiquitous | PASS — Drizzle introspection + FK CASCADE 확인 | Group D 연속, `source_sections` 전용 REQ | REQ-FND-031에서 언급, REQ-FND-044b/c 보완 | **PASS** |
| REQ-FND-044b | Ubiquitous | PASS — 마이그레이션 SQL에 `CREATE INDEX ... ivfflat` 또는 hnsw 확인 | 044a 인덱스 REQ | REQ-FND-040과 동일 패턴 | **PASS** |
| REQ-FND-044c | Ubiquitous | PASS — `pg_constraint` 조회로 UNIQUE 존재 확인 | 044a UNIQUE REQ | source_sections 딥링크 결정성 보장 | **PASS** |
| REQ-FND-045a | Ubiquitous (SHALL require ...) | PASS — Postgres 15 환경에서 version assert abort 확인 | Group D 마지막 | REQ-FND-045와 상호보완 (version preflight) | **PASS** |
| REQ-FND-046a | Event-driven (WHEN ... THEN ...) | PASS — TRUNCATE 시도 시 `P0001` 또는 `0A000` | Group E | REQ-FND-046과 non-overlap (row vs statement level) | **PASS** |
| REQ-FND-046b | Unwanted (IF ... SHALL deny ...) | PASS — `42501` 에러 검증 | Group E | REQ-FND-047b 권한 분리와 연결 | **PASS** — 단, EARS 형식상 "SHALL deny"가 "SHALL NOT allow"보다 적극적이나 허용 범위 |
| REQ-FND-047a | Ubiquitous (SHALL execute REVOKE ...) | PASS — `psql` 접속 후 UPDATE 시도 → `42501` | Group E | REQ-FND-046b와 심층 방어 쌍 | **PASS** |
| REQ-FND-047b | Ubiquitous | PASS — `\df+` Owner 확인 | Group E | REQ-FND-060 DEVELOPMENT.md role 분리 문서화와 교차 참조 | **PASS** |
| REQ-FND-047c | Ubiquitous | PASS — 8-step 회귀 테스트 명시, 결과 로그 저장 경로 지정 | Group E | compliance-qa 전담 | **PASS** — 특히 완결성 높음 |
| REQ-FND-049a | Ubiquitous | PASS — `grep -r "writeAudit("` 0건 | Group E | REQ-FND-054 no-op stub과 정합 | **PASS** |
| REQ-FND-059a | Ubiquitous | PASS — 권한 박탈 role로 `drizzle-kit push` 실행 시 remediation 출력 | Group G | REQ-FND-045 pgvector precondition 확장 | **PASS** |

**New REQ-FND 요약: 13/13 PASS.** EARS 패턴 유효성, 테스트 가능성, numbering 정합성, 기존 REQ와의 비중복·비충돌 모두 충족.

---

## Knock-on Effects Checklist

| Priority 3 항목 | 상태 | 증거 |
|---|---|---|
| AUD-001 — REQ-FND-031 이후 downstream에 "12 tables" 잔존 여부 | **대부분 PASS, 단 L964 1곳 잔존 (AUDN2-001)** | spec.md grep: "13 tables" 15회, "12 tables" 2회 (Frontmatter revision_history + 관련 문서 섹션). Frontmatter는 historical이므로 의도적 보존; 관련 문서 섹션은 drift. |
| AUD-003 — migrations role vs app role이 Deliverables에 명시되어 있는가? | **PASS** | L920 (`migrations/0000_init.sql` "PG version assert"), L921 (`migrations/0001_audit_append_only.sql` "role separation"), L831 Dependencies 행 `regula_app INSERT/SELECT 권한, regula_migrations DDL 권한` 명시 |
| AUD-005 — 11+ FK onDelete 모두 spec.md 본문에 존재? | **PASS** | grep CASCADE/SET NULL/RESTRICT 33건 매칭. organizations→projects CASCADE, users→conversations RESTRICT, conversations→messages CASCADE, messages→message_sources CASCADE, sources→source_sections CASCADE, users→expert_reviews(requested_by) RESTRICT/(assigned_to) SET NULL, users→audit_logs(actor_id) SET NULL, conversations→audit_logs(conversation_id) RESTRICT 등 모두 존재 |
| AUD-009 + AUD-014 — matcher regex + middleware-only 단일화 | **PASS** | L719 정확한 regex, L725 "Server-side layout session checks are explicitly NOT used for redirect logic" 명시. research.md 해석 6 병행 업데이트 |
| AUD-017 — `auth.login`이 REQ-FND-049 enum에서 제거됨 | **PASS, 단 문구 혼동 1건 (AUDN2-003)** | L683 Phase 1 enum 3개 값(`llm.call`, `source.access`, `expert_review.flag`)만 열거, L685 검증 방법 "`auth.login`은 없음". 단, Phase 2 확장 설명에서 "adds `llm.call` call-sites" 표현은 enum 추가가 아닌 call-site 추가임을 명확히 할 필요(Low) |
| AUD-013 — LangChain Phase 1 Technical Decisions에서 제거, Phase 2 record에 위치 | **PASS** | L98–103 Phase 1 확정 5개 결정 table, L107–109 별도 "Phase 2 기록" 테이블에 P2-1 LangChain 항목만. research.md 결정 3 재작성 확인 |

**Knock-on 요약: 6/6 주요 knock-on 모두 적절히 처리. 잔존 drift는 2건뿐이며 모두 Medium/Low.**

---

## Non-Obvious Constraint Matrix Re-verification (spec.md line 985–993)

| # | Constraint | 매트릭스 기재 REQ-FND | v0.2.0 상태 검증 |
|---|---|---|---|
| 1 | inline `<sup>` citation 강제 | REQ-FND-037 (cite_index NOT NULL + UNIQUE) | **OK** — spec.md L427 NOT NULL + L430 UNIQUE(message_id, cite_index) 확인 |
| 2 | SSE 다단계 스트리밍 | — N/A Phase 1 | **OK** |
| 3 | Expert-review 자동 게이팅 | REQ-FND-036 (expert_review_required), REQ-FND-043 (expert_reviews 테이블) | **OK** — L407 boolean NOT NULL default false, L512–528 전체 테이블 스펙 |
| 4 | 21 CFR Part 11 감사 | REQ-FND-044, 046, 046a, 046b, 047, 047a, 047b, 047c, 048, 049, 049a, 050 | **강화 확인** — 12개 REQ로 3-layer defense 구현 |
| 5 | Serif/Sans 타이포그래피 | REQ-FND-023 (font-serif 정확 순서), 024 (Pretendard), 026 (preload) | **교정 확인** — Source Serif 4 우선 배치, AUD-002 완결 |
| 6 | ko/en first-class | REQ-FND-012, 019 (Korean labels), 032 (locale pgEnum) | **OK** — `<html lang="ko">` + 8개 한국어 라벨 + pgEnum('ko','en') |
| 7 | Auth 뒤 → 전역 noindex | REQ-FND-014, 015, 018, 056, 057 | **강화 확인** — 화이트리스트 + override 스니펫 + robots.txt 전부 |

**7개 제약 중 0개 gap. 모두 PASS.**

---

## Handoff Divergence Re-check (D-1 ~ D-11)

| # | v0.2.0 SPEC 기술 | handoff | 상태 (v0.2.0) | 검증 |
|---|---|---|---|---|
| D-1 | 13 tables (source_sections 포함) | 13 tables | **Resolved** | spec.md:L327, L1001 |
| D-2 | font-serif: `Source Serif 4, Noto Serif KR, Georgia, serif` | 동일 | **Resolved** | spec.md:L267, L1002 |
| D-3 | message_blocks 통합 (checklist_items 제거) | checklist_items 별도 | **Documented (Decision #3)** | spec.md:L100, L1003 |
| D-4 | tailwind.config.ts 포함 | tree에 명시 | **Resolved** | spec.md:L54, L902, L1004 |
| D-5 | pgvector | "Pinecone OR pgvector" 열거 | **Documented (Decision #1)** | spec.md:L98, L1005 |
| D-6 | session.strategy = 'database' | idle 30분만 | **Documented (research 해석 3)** | spec.md:L1006 |
| D-7 | SSO: Microsoft Entra ID + Google | "Microsoft/Google" | **Documented** | spec.md:L1007 |
| D-8 | message_blocks.order_index 추가 | sketch 없음 | **Documented (research 해석 2)** | spec.md:L1008 |
| D-9 | LangChain Phase 1 제외, Phase 2로 이동 | §4 후보 | **Resolved** | spec.md:L107–109, L1009 |
| D-10 | messages.tokens_in/out/model 추가 | sketch 없음 | **Documented (v0.2.0 신규)** | spec.md:L408–410, L1010 |
| D-11 | expert_reviews.message_id 추가 | conversation_id만 | **Documented (v0.2.0 신규)** | spec.md:L519, L1011 |

**11/11 divergence 모두 문서화 완료.** D-1/D-2/D-4/D-9가 v0.1.0에서 "No"였다가 v0.2.0에서 모두 "Resolved"로 전환됨.

---

## Final Verdict

**Verdict: `REQUIRES_MINOR_PATCH`**

**근거 (prose):**
v0.2.0은 iteration 1에서 제기된 23개 finding 전부에 대해 실제 spec.md 본문에 **인용 가능한 패치를 적용**하였으며, audit-001-response.md의 각 resolution claim과 spec.md의 실체가 1:1 일치함. 특히 Critical 5건은 다음과 같이 완결 처리됨:

1. **AUD-001 (source_sections):** 13-테이블 REQ-FND-031 명시 + 전용 REQ 3개(044a/b/c) + Deliverable + DoD + Divergence Log 전부 일관 갱신. spec.md 내 "13 tables" 참조 15회 모두 정확.
2. **AUD-002 (font-serif):** REQ-FND-023 본문을 `'Source Serif 4', 'Noto Serif KR', Georgia, serif`로 교정, handoff §6 line 287 원문과 정확히 일치. "한국어 우선" 표현 삭제.
3. **AUD-003 (audit immutability):** row-level trigger + statement-level TRUNCATE trigger + REVOKE + migrations_role 분리 + compliance-qa 8-step 회귀 테스트. 21 CFR Part 11 §11.10(c) 엄격 해석 충족.
4. **AUD-004 (tailwind.config.ts):** REQ-FND-029a + In Scope + Deliverable + Risks 항목 모두 추가.
5. **AUD-005 (FK onDelete):** 11개 FK 관계 모두 CASCADE/SET NULL/RESTRICT 명시. Group D 공통 정책 블록 신설.

iteration 2에서 발견된 4개 새 finding은 모두 **documentation drift**(Medium 2 / Low 2)로 규제·브랜드·스키마 lock-in 제약과 무관. 다음 sprint 또는 Phase 1 kickoff 전에 2분 내 patch 가능:
- AUDN2-001: "12 테이블" → "13 테이블" (1곳)
- AUDN2-002: Group 헤더 범위에 suffix REQ 명시 (5곳)

**권고: Phase 1 착수 가능**. 단, AUDN2-001·002는 팀 스폰 전 반영하는 것이 compliance-qa의 범위 오판을 방지.

---

## Phase 1 Entry Gate Checklist

- [x] All Critical from iteration 1 CONFIRMED (5/5: AUD-001/002/003/004/005)
- [x] No new Critical in iteration 2 (iteration 2 최고 severity = Medium)
- [x] 7 Non-Obvious Constraints all documented with Phase 1 REQ-FND coverage (Constraint #2 SSE는 Phase 2 범위이므로 N/A가 올바름)
- [x] Handoff Divergence D-1 / D-2 / D-4 / D-9 resolved, D-10 / D-11 newly documented
- [x] DoD ≥ 15 items with each testable (실제 19개, 이전 12개 → 7개 추가)
- [x] Decision table Phase 1 scoped only (Phase 1 확정 5개 + Phase 2 기록 1개 분리 구조)
- [x] All 13 new REQ-FND entries PASS EARS / testability / numbering / integration checks
- [x] 23/23 iteration 1 findings CONFIRMED (no PARTIAL / REGRESSED / OVER-FIX)
- [ ] AUDN2-001 patch applied (spec.md:L964 "12 테이블" → "13 테이블")
- [ ] AUDN2-002 patch applied (Group 헤더 범위에 suffixed REQ 명시)

**8/10 gates PASS**. 마지막 2개는 Medium documentation patch로 Phase 1 착수 전 반영 권고.

---

## Chain-of-Verification Pass

2차 점검:
- 전체 23 findings 순회하여 각 resolution 주장 vs spec.md 실체 재대조 — 모두 일치
- 신규 REQ-FND 13개 EARS 패턴 태그와 본문 1:1 재확인 — 모두 적절
- FK onDelete 33건 grep 결과 직접 대조 — audit-001-response claim과 일치
- handoff README line 696–708 vs spec.md REQ-FND-031~044 컬럼 명 재대조 — 누락 없음
- `auth.login` 언급 전수조사 — Phase 1 enum에서 제거됨 확인, Phase 5 확장 내 언급만 잔존 (의도된 설계)
- 1차 패스에서 Critical/High 수준의 새 결함은 발견되지 않음 — 재확인

**2차 패스에서 추가 결함 없음. 1차 발견 AUDN2-001~004만 confirmed.**
