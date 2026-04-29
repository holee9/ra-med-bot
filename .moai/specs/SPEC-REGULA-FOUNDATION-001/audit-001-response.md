---
response_to: AUDIT-REGULA-FOUNDATION-001-001
spec_version_before: 0.1.0
spec_version_after: 0.2.0
date: 2026-04-22
author: manager-spec
---

# Audit Resolution — SPEC-REGULA-FOUNDATION-001 (Iteration 1 → 2)

## 해결 요약

| Severity | 총 | 해결 | 미해결 | 연기 |
|---|---|---|---|---|
| Critical | 5 | **5** | 0 | 0 |
| High | 8 | **8** | 0 | 0 |
| Medium | 7 | **7** | 0 | 0 |
| Low | 3 | **3** | 0 | 0 |
| **합계** | **23** | **23** | **0** | **0** |

**신규 REQ-FND 추가 (13개):**
- REQ-FND-010a (env fail-fast, AUD-010)
- REQ-FND-029a (tailwind.config.ts, AUD-004)
- REQ-FND-044a/b/c (source_sections 테이블 + 인덱스 + UNIQUE, AUD-001)
- REQ-FND-045a (PostgreSQL ≥16, pgvector ≥0.7, AUD-020)
- REQ-FND-046a (BEFORE TRUNCATE 트리거, AUD-003)
- REQ-FND-046b (role 권한 오남용 봉쇄, AUD-003)
- REQ-FND-047a (REVOKE 마이그레이션, AUD-003)
- REQ-FND-047b (migrations_role 분리, AUD-003)
- REQ-FND-047c (compliance-qa 8-step 회귀 테스트, AUD-003)
- REQ-FND-049a (writeAudit call-site Phase 1 제외, AUD-017)
- REQ-FND-059a (pgvector precondition 실패 경로, AUD-011)

**수정된 REQ-FND (20개):** 015 (화이트리스트 명시), 018 (robots override), 019 (한국어 라벨 + 순서), 022 (globals.css 고정), 023 (font-serif 순서 교정 — **Critical**), 027 (Event-driven → Ubiquitous 재분류), 030 (Unwanted → Conditional 재작성), 031 (12→13 tables), 032~044 (컬럼 제약 테이블 추가), 044 (conversation_id FK + onDelete 정책), 045 (13 tables + pgvector + pgEnums 명시), 046 (재구조화), 047 (3개 트리거 + REVOKE 주석), 049 (auth.* 제거 Phase 5로 이동), 053 (matcher 화이트리스트 + middleware-only), 054 (no-op stub), 056 (metadata export 구체화), 059 (13 tables), 060 (DEVELOPMENT.md 5 섹션 템플릿).

**기타 변경:**
- Frontmatter `version: 0.1.0 → 0.2.0`, `revision_history` 필드 추가, `updated: 2026-04-22`
- 목적(Purpose) 재작성: 12-테이블 → **13-테이블**, audit_logs hardening 강조, 폰트 순서 교정 명시
- In Scope/Out of Scope 테이블 재편 (tailwind.config.ts, lib/env.ts 추가; soft-delete 명시 제외)
- 기술 결정 테이블 6개 → 5개 Phase 1 + 1개 Phase 2 기록 분리
- Handoff Divergence Log 업데이트: D-1, D-2, D-4, D-9 모두 "Yes (Resolved)"로 전환; D-10, D-11 신규
- Non-Obvious Constraints ↔ REQ-FND 매트릭스 신규 (AUD-022)
- Definition of Done: 12개 → 19개 (7개 신규)
- Deliverables 테이블: 27 → 29 entries (`tailwind.config.ts`, `lib/env.ts` 추가)
- Test Strategy: audit regression 8-step 명시, middleware matcher 테스트, pgvector 실패 경로 테스트 추가
- research.md: Decision 3 (LangChain) Phase 2로 이동, 새 결정 4 (audit_logs hardening) 신설, 해석 6~9 신규/확장

---

## 개별 해결 기록 (AUD-001 ~ AUD-023)

### AUD-001 [RESOLVED] — `source_sections` 테이블 silent drop 복구
**Severity:** Critical
**Patch:** spec.md
- REQ-FND-031: "12 Drizzle tables" → **"13 Drizzle tables"** (including `source_sections`)
- 신규 REQ-FND-044a: `source_sections` 컬럼 스펙 (id/source_id/anchor/heading/text/embedding/created_at + FK CASCADE)
- 신규 REQ-FND-044b: `source_sections.embedding` IVFFlat 또는 HNSW 인덱스 (cosine 거리)
- 신규 REQ-FND-044c: `UNIQUE (source_id, anchor)` 제약
- Technical Decision #3 (구 #4): `checklist_items`만 제거, `source_sections` 유지 명시
- Handoff Divergence Log D-1: "No" → "**Yes (Resolved in v0.2.0)**"
**Location:** spec.md REQ-FND-031 (line ~326), REQ-FND-044a/b/c (line ~549~575), Decision table (line ~80)
**Verification:** compliance-qa가 Drizzle introspection + `(source_id, anchor)` UNIQUE 제약 + embedding 인덱스 존재 확인.

### AUD-002 [RESOLVED] — `--font-serif` 스택 순서 교정 (Critical)
**Patch:** spec.md REQ-FND-023 전체 재작성
- **Before:** `'Noto Serif KR', 'Source Serif 4', Georgia, serif` ("한국어 우선")
- **After:** `'Source Serif 4', 'Noto Serif KR', Georgia, serif` (영문 우선, handoff §6 원문 1:1 매핑)
- "한국어 우선" 표현 삭제; 한국어 친화 렌더링은 `--font-sans`의 Pretendard에서 달성
- 검증 방법: compliance-qa SHALL verify CSS custom property resolves in this **exact** order in both themes (정규식 매칭)
- Handoff Divergence Log D-2: "No" → "**Yes (Resolved in v0.2.0: order matches handoff §6)**"
- research.md 해석 7 신규로 font stack 원리 + rendering 이해 기록
**Location:** spec.md REQ-FND-023 (line ~266), Divergence Log, research.md 해석 7
**Verification:** `grep --regex` on `styles/tokens.css` produces exactly the Source-Serif-first stack. compliance-qa의 light/dark 양 테마 검증.

### AUD-003 [RESOLVED] — audit_logs 변이 차단 범위 확장 (Critical, 21 CFR Part 11)
**Patch:** spec.md — 대폭 재구조화
- REQ-FND-046: UPDATE/DELETE row-level trigger (v0.1.0 기존)
- 신규 REQ-FND-046a: **BEFORE TRUNCATE** statement-level trigger — TRUNCATE 우회 봉쇄
- 신규 REQ-FND-046b: `app_role`에서 `DISABLE TRIGGER` / `DROP TRIGGER` / `CREATE OR REPLACE FUNCTION` 시도 시 permission denied (SQLSTATE `42501`)
- REQ-FND-047: 트리거 SQL 가이드 2개 (row-level + statement-level) + top-level 주석으로 21 CFR Part 11 + 7-year retention 명시
- 신규 REQ-FND-047a: `REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES ON audit_logs FROM <app_role>; GRANT INSERT, SELECT ON audit_logs TO <app_role>;` 마이그레이션 필수 실행
- 신규 REQ-FND-047b: Postgres role 분리 (`<app_role>` vs `<migrations_role>`) 강제, 트리거 함수 owner = `<migrations_role>`
- 신규 REQ-FND-047c: compliance-qa의 **8-step 회귀 테스트** 명시 (INSERT/SELECT 성공 + UPDATE/DELETE/TRUNCATE 차단 + DISABLE TRIGGER/DROP TRIGGER/CREATE OR REPLACE FUNCTION 권한 거부)
- Technical Decision #6 신규: audit_logs 변이 차단 범위 "UPDATE + DELETE + TRUNCATE 모두 차단 + role REVOKE + role 분리"
- research.md 결정 4 신규: 3-layer defense 설명
- Risks 표: 신규 "Supabase/Neon이 role 분리 허용 안 할 위험"
**Location:** spec.md REQ-FND-046/046a/046b/047/047a/047b/047c (line ~595~677), Decision table, Risks
**Verification:** compliance-qa가 Phase 1 DoD 체크리스트의 8-step regression 전부 PASS 확인. 결과는 `_workspace/phase-1/audit-logs-regression.txt`에 기록.

### AUD-004 [RESOLVED] — `tailwind.config.ts` 산출물 복구 (Critical)
**Patch:** spec.md
- In Scope "스캐폴딩" 행에 `tailwind.config.ts` 추가
- 신규 REQ-FND-029a: Tailwind v4 config 파일 최소 내용 명시 (`content` globs, `darkMode: 'class'`, `plugins: []`)
- Deliverables #6a 추가: `tailwind.config.ts` | regula-architect | handoff §5 line 233
- Handoff Divergence Log D-4: "No" → "**Yes (Resolved in v0.2.0: REQ-FND-029a added)**"
- Risks 표에 Tailwind v4 `@theme` + `tailwind.config.ts` 병행 충돌 위험 추가
**Location:** spec.md In Scope 테이블 (line ~38), REQ-FND-029a (line ~301), Deliverables #6a, Risks
**Verification:** 파일 존재 + `pnpm build` 실행 시 `darkMode: 'class'` 반영 확인 (dark: utilities 생성).

### AUD-005 [RESOLVED] — DB 스키마 컬럼 제약 결정론 명시 (Critical)
**Patch:** spec.md REQ-FND-032~044 모두 재작성
- Group D 상단에 "**공통 정책** (v0.2.0 추가)" 블록 삽입: timestamp 기본값, uuid 기본값, FK onDelete 정책 미명시 시 `NO ACTION`, Phase 1 soft-delete 미도입 명시
- 각 테이블 REQ에 `| column | type | nullable | default | FK onDelete | notes |` 표 삽입
- 고정 FK 정책 반영:
  - `audit_logs.actor_id` → users `SET NULL`
  - `audit_logs.conversation_id` → conversations `RESTRICT`
  - `messages.conversation_id` → conversations `CASCADE`
  - `message_sources.message_id` → messages `CASCADE`; `source_id` → sources `RESTRICT`
  - `message_blocks.message_id` → messages `CASCADE`
  - `expert_reviews.message_id` → messages `CASCADE`; `assigned_to` → users `SET NULL`
  - `conversations.user_id` → users `RESTRICT`; `project_id` → projects `SET NULL`
  - `projects.organization_id` → organizations `CASCADE`
  - `sources.organization_id` → organizations `CASCADE` (nullable for global corpora)
  - `source_sections.source_id` → sources `CASCADE`
- Timestamp 컬럼: `timestamptz NOT NULL DEFAULT now()` 일관 적용
- Soft-delete 명시 Out of Scope (Out of Scope 표 마지막 행)
**Location:** spec.md REQ-FND-032~044 (line ~331~547), Group D 상단 공통 정책 박스
**Verification:** Drizzle introspection으로 모든 FK onDelete 정책 확인. Vitest 통합 테스트에서 대표 cascade 동작 (messages 삭제 → message_sources/message_blocks 동반 제거) 검증.

### AUD-006 [RESOLVED] — REQ-FND-027 EARS 패턴 재분류
**Severity:** High
**Patch:** spec.md REQ-FND-027 Event-driven → **Ubiquitous** 재분류. 런타임 토글 언급 삭제, "static CSS override rule 선언" 으로 재진술. 런타임 토글 동작은 Phase 5로 명시 연기.
**Location:** spec.md REQ-FND-027 (line ~286)
**Verification:** `[data-theme="dark"] { ... }` 블록 존재 + 최소 5개 color 변수 재정의 확인. 런타임 토글 테스트는 Phase 5 SPEC이 수행.

### AUD-007 [RESOLVED] — REQ-FND-030 Conditional 재작성
**Severity:** High
**Patch:** Unwanted (developer 의도 트리거) → **Conditional** (파일 상태 트리거). "IF any file under `app/`/`components/`/`lib/` (excluding `styles/tokens.css`) contains a raw hex literal matching regex `#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?`, THEN Biome lint SHALL fail preventing `pnpm build`." — Biome rule **또는** CI grep **둘 중 하나**만 enforcement (결정론).
**Location:** spec.md REQ-FND-030 (line ~311)
**Verification:** `components/` 아래 임의 `.tsx`에 `'#ff0000'` 삽입 후 `pnpm lint` exit code 1 확인.

### AUD-008 [RESOLVED] — REQ-FND-015 금지 meta 화이트리스트 명시
**Severity:** High
**Patch:** spec.md REQ-FND-015 — 금지 목록 열거(`og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `twitter:card`, `twitter:site`, `twitter:creator`, `twitter:title`, `twitter:description`, `twitter:image`, `application-name`, `<link rel="canonical">` external URLs) + 허용 목록 열거(`<title>`, `<meta charset>`, `<meta name="viewport">`, `<meta name="robots">`, `<meta name="theme-color">`, `<meta name="description">` generic tagline only, canonical self-reference, `<html lang>`).
**Location:** spec.md REQ-FND-015 (line ~215)
**Verification:** compliance-qa의 정규식 스캔 (`/og:|twitter:|application-name/`) + 프로덕션 HTML 응답 scraping.

### AUD-009 [RESOLVED] — REQ-FND-053 middleware matcher 화이트리스트
**Severity:** High
**Patch:** spec.md REQ-FND-053 — matcher 정확히 `/((?!_next/static|_next/image|favicon.ico|login|sso/callback|api/auth|robots.txt|public).*)` 명시. 인증된 사용자 `/login` 요청 → `/` 리다이렉트 추가. AUD-014 병합으로 middleware-only 단일화.
**Location:** spec.md REQ-FND-053 (line ~714)
**Verification:** 미인증 `curl /api/auth/callback/azure-ad` → 리다이렉트 없음, 인증 `curl /login` → 302 `/`.

### AUD-010 [RESOLVED] — 환경변수 fail-fast 검증 신규
**Severity:** High
**Patch:** spec.md
- 신규 REQ-FND-010a: `lib/env.ts` zod 스키마 (`DATABASE_URL`/`AUTH_SECRET` min 32/`NEXTAUTH_URL`/`AUTH_MICROSOFT_ID/SECRET`/`AUTH_GOOGLE_ID/SECRET`), module-load time throw
- Deliverables #7a 추가: `lib/env.ts` | regula-architect
- In Scope "스캐폴딩" 행에 `lib/env.ts` 추가
- DoD에 `DATABASE_URL` 누락 시 ZodError 발생 체크리스트 추가
- 구현 가이드 코드 스니펫 제공 (`z.object({...}).parse(process.env)`)
**Location:** spec.md REQ-FND-010a (line ~171), Deliverables #7a, DoD
**Verification:** Vitest에서 `DATABASE_URL` 삭제 후 `import('@/lib/env')` → ZodError throw 확인.

### AUD-011 [RESOLVED] — pgvector precondition 명시
**Severity:** High
**Patch:** spec.md
- REQ-FND-045 수정: 마이그레이션 첫 줄이 `CREATE EXTENSION IF NOT EXISTS vector;` + 단일 트랜잭션 래핑
- 신규 REQ-FND-059a: 확장 설치 실패 시 verbatim Postgres error + remediation hint (`GRANT CREATE ON DATABASE ...`) 출력 + non-zero exit code
- DEVELOPMENT.md Troubleshooting 섹션 (REQ-FND-060 템플릿)에 pgvector 설치 가이드 포함
**Location:** spec.md REQ-FND-045 (line ~575), REQ-FND-059a (line ~775)
**Verification:** 권한 박탈된 test role로 `drizzle-kit push` 실행 시 명시적 remediation 출력 확인.

### AUD-012 [RESOLVED] — `users.locale`/`theme_pref` 타입 결정
**Severity:** High
**Patch:** spec.md REQ-FND-032 — `locale` 및 `theme_pref`를 **Drizzle `pgEnum`**으로 명시 (text+CHECK 선택 탈락). `locale`: `('ko', 'en')` default `'ko'`; `theme_pref`: `('light', 'dark', 'system')` default `'system'`. 모두 NOT NULL.
**Location:** spec.md REQ-FND-032 (line ~331)
**Verification:** `SELECT typname FROM pg_type WHERE typname IN ('locale', 'theme_pref')` 결과 확인.

### AUD-013 [RESOLVED] — LangChain 결정 Phase 2로 이동
**Severity:** High
**Patch:** spec.md Technical Decision table 재편 — 기존 6개 → Phase 1 확정 5개 + "Phase 2 기록 (Phase 1에서 실행 불필요, 참고용)" 하위 섹션에 LangChain P2-1 엔트리. Out of Scope LLM orchestration 행 수정 ("Phase 2 착수 시 regula-architect 최종 결정"). Risks/Assumptions에도 추가. research.md 결정 3 재작성.
**Location:** spec.md Technical Decisions section (line ~80~105), research.md 결정 3
**Verification:** Phase 1 `package.json` 제출 시 `langchain`/`llamaindex` 의존성 **부재** 확인.

### AUD-014 [RESOLVED] — middleware-only redirect 확정
**Severity:** Medium
**Patch:** AUD-009 패치에 병합. REQ-FND-053에 "server-side layout session checks are explicitly NOT used for redirect logic" 명시. research.md 해석 6 업데이트.
**Location:** spec.md REQ-FND-053, research.md 해석 6
**Verification:** `grep -r "redirect('/login')" app/(app)/` 결과 0건.

### AUD-015 [RESOLVED] — Sidebar 한국어 라벨 + 순서 확정
**Severity:** Medium
**Patch:** spec.md REQ-FND-019 — "홈 → /, 새 상담 → /chat, 히스토리 → /history, 템플릿 → /templates, 지식 베이스 → /knowledge, 규제 업데이트 → /updates, 대시보드 → /dashboard, 설정 → /settings" 정확한 순서와 한국어 라벨 + href 매핑 명시. Sidebar 상단에 "새 상담" 강조 버튼.
**Location:** spec.md REQ-FND-019 (line ~242)
**Verification:** @testing-library/react 컴포넌트 렌더링 테스트로 8개 `<a>` 태그의 정확한 순서·라벨·href 검증.

### AUD-016 [RESOLVED] — DEVELOPMENT.md 5 섹션 템플릿 결정론
**Severity:** Medium
**Patch:** spec.md REQ-FND-060 재작성 — 정확한 5개 `##` 섹션 (Prerequisites / Setup / Development Commands / Testing / Troubleshooting) 및 Setup 섹션 `- [ ]` 체크박스 5개 이상 + 각 섹션 최소 내용 명시. 검증: 섹션 헤딩 존재 + 체크박스 카운트.
**Location:** spec.md REQ-FND-060 (line ~780)
**Verification:** `grep "^## " DEVELOPMENT.md` 결과 정확히 5개 + 순서 일치 확인.

### AUD-017 [RESOLVED] — Phase 1 audit_logs wiring 경계 일치
**Severity:** Medium
**Patch:** spec.md
- REQ-FND-049 수정: `action` enum에서 `auth.login` / `auth.logout` 제거, Phase 1 enum은 3개 값 (`llm.call`, `source.access`, `expert_review.flag`)만; auth.* 는 Phase 5에서 추가
- 신규 REQ-FND-049a: Phase 1은 `writeAudit` helper 시그니처만 설치하고 **call-sites 없음** 명시
- REQ-FND-054: `callbacks.signIn` no-op 반환 (`() => true`) + Phase 5 마커 주석만 포함
- Deliverables #21 lib/audit.ts 설명: "Phase 1: helper signature only, no call-sites"
**Location:** spec.md REQ-FND-049/049a/054 (line ~682~729), Deliverables
**Verification:** `grep -r "writeAudit(" app/ lib/auth.ts components/ --include="*.ts"` 결과 매칭 0건 (lib/audit.ts 정의 자체 제외).

### AUD-018 [RESOLVED] — `messages.tokens_in/tokens_out/model` 추가
**Severity:** Medium
**Patch:** spec.md REQ-FND-036 확장 — `tokens_in integer nullable`, `tokens_out integer nullable`, `model text nullable` 3개 컬럼 추가. Phase 2 LLM audit + Phase 4 Dashboard 집계 기반. research.md 해석 9 신규.
**Location:** spec.md REQ-FND-036 (line ~395), research.md 해석 9
**Verification:** Drizzle introspection으로 3개 컬럼 존재 + nullable 확인.

### AUD-019 [RESOLVED] — `/login` robots override 패턴 명시
**Severity:** Medium
**Patch:** spec.md
- REQ-FND-018 확장: `/login/page.tsx` metadata export (`robots: { index: true, follow: true }`) 코드 스니펫 명시
- REQ-FND-056: 루트 metadata 구조 상세 (metadataBase + title template + default robots noindex) + /login만 override 원칙 명시
- DoD에 `curl /login` 응답에 `index, follow` 포함 + `curl /` 응답에 `noindex, nofollow` 포함 체크리스트 추가
**Location:** spec.md REQ-FND-018, REQ-FND-056 (line ~230, 743)
**Verification:** `grep -r "robots: { index: true" app/` → `app/(auth)/login/page.tsx`에만 존재 확인.

### AUD-020 [RESOLVED] — 최소 Postgres 버전 REQ
**Severity:** Medium
**Patch:** spec.md
- 신규 REQ-FND-045a: PostgreSQL ≥16 + pgvector ≥0.7 version assert (`current_setting('server_version_num')` + `pg_extension.extversion`) migration preflight
- Dependencies 테이블 "PostgreSQL 16 **이상** + pgvector **0.7+**" 명시
- DoD에 Postgres 15 환경에서 migration abort 체크리스트 추가
**Location:** spec.md REQ-FND-045a (line ~586), Dependencies, DoD
**Verification:** Postgres 15 환경에서 `drizzle-kit push` 실행 시 version 에러 abort 확인.

### AUD-021 [RESOLVED] — playwright.config.ts 책임 에이전트 재배정
**Severity:** Low
**Patch:** spec.md Deliverables #27 — 책임 에이전트를 `regula-compliance-qa` → **`regula-architect`**로 변경. 사유 "infrastructure setup is architect's scope; compliance-qa owns verification not creation" + 노트 "test authoring deferred to Phase 6". 테스트 전략 섹션의 Playwright 인프라 준비 언급도 업데이트.
**Location:** spec.md Deliverables 테이블 line ~864
**Verification:** 해당 테이블 row 읽기 확인.

### AUD-022 [RESOLVED] — Non-Obvious Constraints ↔ REQ-FND 매트릭스 수록
**Severity:** Low
**Patch:** spec.md "관련 문서" 섹션 내 신규 하위 섹션 "Non-Obvious Constraints ↔ REQ-FND 매트릭스" 추가. CLAUDE.md 7개 제약 각각에 대해 Phase 1 대비 REQ-FND 리스트 + 상태 (전면 강화/수정 완료/스키마 확보/N/A).
**Location:** spec.md 관련 문서 섹션 (line ~983)
**Verification:** 매트릭스 7 rows 모두 REQ-FND 참조 + 상태 기재 확인.

### AUD-023 [RESOLVED] — Tailwind v4 `@theme` 위치 확정
**Severity:** Low
**Patch:** spec.md REQ-FND-022 재작성 — `@theme` 블록을 `app/globals.css`에 위치 (Tailwind v4 공식 가이드 준수); `styles/tokens.css`는 CSS custom property 단일 출처만 담당, `@theme` 블록 **중복 선언 금지**. `app/globals.css`가 `tokens.css`를 `@import` 후 `@theme`로 매핑.
**Location:** spec.md REQ-FND-022 (line ~261)
**Verification:** `styles/tokens.css`에 `@theme` 블록 부재 확인 + `app/globals.css`에 `@import "../styles/tokens.css"` + `@theme { ... }` 블록 순차 배치 확인.

---

## 재감사 준비

**iteration 2 audit 대상 범위:**
- 신규 REQ-FND 13개 (010a, 029a, 044a/b/c, 045a, 046a/b, 047a/b/c, 049a, 059a) — 독립 감사 대상
- 수정된 REQ-FND 20개 — handoff 정합성 및 EARS 패턴 재검증 필요
- 기술 결정 테이블 재편 (6 → Phase 1 5 + Phase 2 기록) — Decision Soundness 차원 재검증
- Handoff Divergence Log D-1, D-2, D-4, D-9 "Yes (Resolved)" 검증 + 신규 D-10, D-11 추가 검증
- Non-Obvious Constraints 매트릭스 (AUD-022) 완전성 검증

**회귀 검증 체크리스트:**
- [ ] AUD-001: REQ-FND-031 "13 tables" + REQ-FND-044a/b/c 3개 신규 REQ가 source_sections 완전 커버하는지
- [ ] AUD-002: REQ-FND-023의 font-serif 정규식이 정확히 `Source Serif 4` 우선인지
- [ ] AUD-003: REQ-FND-046/046a/046b/047/047a/047b/047c의 3-layer defense 모두 실행 가능한지 (compliance-qa 8-step test)
- [ ] AUD-004: REQ-FND-029a의 Tailwind config content glob / darkMode 설정이 실제 `tailwind.config.ts`로 유도되는지
- [ ] AUD-005: Group D 공통 정책 + 각 REQ 컬럼 제약 테이블로 Drizzle 스키마 결정론 충족하는지
- [ ] AUD-006~013: High 8개 모두 EARS 패턴 + 결정론 기준 통과
- [ ] AUD-014~020: Medium 7개 모두 명확한 검증 방법 기술
- [ ] AUD-021~023: Low 3개 반영 확인

**미해결/연기 항목:** 없음. 모든 23개 findings가 Phase 1 범위 내에서 full 해결되었으며, Phase 2+로 연기된 것은 AUD에서 명시적으로 허용된 LangChain 결정(AUD-013)과 writeAudit call-sites(AUD-017)뿐이며 이들은 spec.md에서 명시적 Phase 경계로 기록됨.

**충돌 해결 — 감사 권고 간 conflict 처리:**
- AUD-009 (matcher 화이트리스트) + AUD-014 (middleware-only) 병합 처리: 한 REQ-FND-053에 통합. matcher + "middleware-only, layout redirect 금지" 둘 다 포함. 더 엄격한 해석 채택 (stricter wins).
- AUD-019 (robots override) + AUD-056 기존 문구 병합: REQ-FND-018에 override 패턴 명시 + REQ-FND-056 기본값 구조에서 override 경로 교차 참조.

**iteration 2 audit 실행 권장:** plan-auditor가 v0.2.0 spec.md + audit-001-response.md를 입력으로 재감사 실행 가능. 우선순위는 AUD-001, 002, 003의 resolution 완결성 재확인 (Critical 수정의 수정 실수 방지).
