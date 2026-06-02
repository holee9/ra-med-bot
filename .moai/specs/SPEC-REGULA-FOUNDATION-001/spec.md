---
id: SPEC-REGULA-FOUNDATION-001
title: Regula Phase 1 Foundation — 스캐폴딩 및 규제 준수 핵심 프리미티브
status: completed
created: 2026-04-22
updated: 2026-06-02
author: manager-spec
phase: 1
skill: regula
version: 0.4.0
priority: High
revision_history:
  - version: 0.1.0
    date: 2026-04-22
    author: manager-spec
    notes: Initial draft (60 REQ-FND, 12 tables, 6 technical decisions)
  - version: 0.2.0
    date: 2026-04-22
    author: manager-spec (iteration 2 via plan-auditor feedback)
    notes: |
      Applied all 23 audit findings (Critical 5 + High 8 + Medium 7 + Low 3).
      Net changes: 12 tables → 13 tables (+source_sections), font-serif order
      corrected, audit trigger hardened (TRUNCATE + REVOKE + role separation),
      tailwind.config.ts added to scope, column-level constraints (nullable/
      default/FK onDelete) specified, env fail-fast via lib/env.ts added,
      pgvector precondition added, LangChain decision moved to Phase 2 record.
      Note: v0.1.0's "12 tables" and "6 technical decisions" values were Critical
      defects (source_sections silent drop + out-of-scope LangChain decision);
      both corrected in this revision.
  - version: 0.2.1
    date: 2026-04-22
    author: manager-spec (iteration 3 via plan-auditor audit-002 minor feedback)
    notes: |
      Applied 4 minor AUDN2 findings (2 Medium + 2 Low). No structural changes,
      no new REQ-FND. AUDN2-001: "§12 Data Models — 12 테이블" → "13 테이블
      Drizzle schema (checklist_items 제외)". AUDN2-002: Group headers (A, C, D,
      E, G) extended to list suffixed REQ IDs for compliance-qa verification
      scope alignment. AUDN2-003: REQ-FND-049 Phase 2 wording clarified (wires
      existing call-sites vs adds new enum values). AUDN2-004: revision_history
      historical record preserved with optional v0.2.0 clarification note.
  - version: 0.3.0
    date: 2026-04-22
    author: manager-spec (iteration 4 via audit-002 Medium/Low findings)
    notes: |
      Applied AUDN2-001 (§12 header "12 → 13 tables"), AUDN2-002 (Group A/C/D/E/G
      headers now list suffixed REQ IDs explicitly), AUDN2-003 (REQ-FND-049 Phase
      2/5 wording split: wires vs adds enum values). AUDN2-004 preserved per audit
      recommendation. No new REQ-FND, no structural changes, ready for PROCEED_TO_PHASE_1.
  - version: 0.4.0
    date: 2026-04-23
    author: manager-spec (iteration 5 via cross-spec-audit Critical patch)
    notes: |
      Applied cross-spec-audit Critical findings C3, C6, C7 to FOUNDATION schema
      to eliminate downstream SPEC ambiguity:
      * C6 — audit_logs.action type unified: REQ-FND-044 column type changed from
        `text NOT NULL` to `audit_action pgEnum NOT NULL`. pgEnum inventory
        expanded from 7 to 8 (adds audit_action). Enables compile-time + runtime
        DB-level enforcement across all 5 Wave-1 SPECs, removing C6 BREADTH-vs-
        ENTERPRISE contradiction (ALTER TYPE ... ADD VALUE pattern now canonical).
      * C3 — audit_action enum pre-declared with FULL Phase 2~5 value set:
        Phase 1 active enum `{llm.call, source.access, expert_review.flag}`;
        Phase 2~5 additive values declared in REQ-FND-049 schema comment so
        STRUCTURED (checklist.toggle), ENTERPRISE (consult.expert_review_auto_flag,
        profile.theme_update, profile.locale_update, rbac.permission_deny,
        auth.login, auth.logout, session.invalidate, expert_review.create/assign/
        resolve) + BREADTH (10 actions) have a single declared source. Phase 1
        call-sites remain 0 (REQ-FND-049a scope discipline unchanged).
      * C7 — messages.meta_json column explicitly declared: REQ-FND-036 column
        list extended with `meta_json jsonb NULL` so CHAT REQ-CHAT-028
        (citation violations array + extensibility metadata) has schema support
        without creating parallel message_meta table. CHAT SPEC's "RUN phase 결정"
        fallback is thereby resolved at SPEC time, not implementation time.
      No structural group changes; no REQ ID renumbering; existing tests
      affected only where the enum/column type surfaces (compliance-qa 8-step
      regression expanded: previous text-column SELECT remains valid; pgEnum
      typcheck assertion added). Revision history preserved per AUDN2-004.
related_handoff_sections:
  - "§4"
  - "§5"
  - "§6"
  - "§11"
  - "§12"
  - "§13.2"
  - "§14"
  - "§15"
  - "§16"
  - "§20"
---

# SPEC-REGULA-FOUNDATION-001 — Regula Phase 1 Foundation

## 목적 (Purpose)

의료기기 RA(Regulatory Affairs) 전문가용 RAG 챗봇 `Regula`의 **프로덕션 구축 첫 단계**로, Next.js 15 애플리케이션 스캐폴딩과 **21 CFR Part 11 규제 준수에 치명적인 Day-1 프리미티브**(INSERT-only + TRUNCATE 봉쇄 + role 분리 `audit_logs`, `message_sources.cite_index`, Source Serif 4 우선 + Noto Serif KR + Pretendard 이중 언어 타이포그래피, `noindex` 메타 정책, Auth.js v5 SSO 골격, Drizzle **13-테이블** 스키마 including `source_sections` for citation deep-link anchors)를 수립한다. 본 Phase는 후속 Phase 2~6의 구현 토대이며, 여기서 누락된 제약은 이후에 보강이 극히 어렵다(특히 감사 로그 append-only 속성, citation 추적 컬럼, source_sections anchor 테이블). handoff §20 Phase 1 블록 범위를 엄격히 준수하며, RAG 파이프라인·구조화 블록·전문가 검토 흐름은 모두 **Out of Scope**.

---

## 범위 (Scope)

### In Scope

| 구분 | 산출물 |
|---|---|
| 스캐폴딩 | `package.json`, `next.config.mjs`, `tsconfig.json`, `biome.json`, `drizzle.config.ts`, `postcss.config.mjs`, `tailwind.config.ts`, `.env.example`, `lib/env.ts` (zod fail-fast env 검증) |
| 디자인 토큰 | `styles/tokens.css` (handoff §6 전체 토큰), `app/globals.css` (Tailwind v4 `@theme` 매핑, 폰트 로딩) |
| 라우트 그룹 | `app/layout.tsx` (루트), `app/(app)/layout.tsx` (Sidebar+Topbar), `app/(app)/page.tsx` (Home), `app/(app)/chat/page.tsx` (빈 상태), `app/(auth)/login/page.tsx` (SSO 진입 스켈레톤, 자체 `robots: { index: true }` override) |
| 앱 셸 | `components/shell/Sidebar.tsx`, `components/shell/Topbar.tsx` (정적 UI, 내비게이션 링크, 테마 토글 버튼 플레이스홀더) |
| Auth.js v5 | `lib/auth.ts` (Microsoft/Google OIDC provider 설정, 세션 전략, callback 스텁), `middleware.ts` (auth-wall, edge-level 리다이렉트) |
| DB 스키마 | `lib/db/schema.ts` (**13 테이블** Drizzle 정의 — `source_sections` 포함), `lib/db/client.ts` (Drizzle 클라이언트 + `pgvector` 확장 등록), `migrations/0000_init.sql`, `migrations/0001_audit_append_only.sql` |
| 감사 로그 | `lib/audit.ts` (`writeAudit()` 헬퍼, 21 CFR Part 11 필드 스키마), `audit_logs` append-only Postgres 트리거 (UPDATE/DELETE/TRUNCATE 전부 차단 + `app_role`에서 mutation 권한 REVOKE + migrations role 분리) |
| 규제/SEO | 모든 `(app)` 페이지 `<meta name="robots" content="noindex, nofollow">`, `/login`만 명시적 `robots: { index: true, follow: true }` override |
| 국제화 기반 | `<html lang="ko">` 기본, `--font-serif` 한/영 이중 fallback (Source Serif 4 우선), `--font-sans`에 Pretendard 포함하여 한국어 UI 최적 렌더링 |

### Out of Scope

다음 항목은 후속 Phase에서 처리하며, 본 SPEC에서는 **의도적으로 구현하지 않는다**:

| 항목 | 해당 Phase | 사유 |
|---|---|---|
| RAG 파이프라인 (LLM 호출, 벡터 검색, 재랭킹) | Phase 2 | handoff §20 Phase 2 범위 |
| `/api/ra/consult` SSE 스트리밍 핸들러 | Phase 2 | Phase 2 Chat core |
| `useStreamingAnswer` 훅 및 Composer 컴포넌트 | Phase 2 | Phase 2 Chat core |
| Citation 후처리 강제 로직 | Phase 2 | 스키마 컬럼(`cite_index`)은 확보, enforcement는 Phase 2 |
| 구조화 블록 렌더링 (Checklist, ComparisonTable, Timeline) | Phase 3 | handoff §20 Phase 3 |
| History, Templates, Knowledge Base, Updates, Dashboard 페이지 | Phase 4 | handoff §20 Phase 4 |
| Expert review 워크플로우 API 및 UI | Phase 5 | handoff §20 Phase 5 |
| RBAC 세분화, 조직/프로젝트 ACL 강제 | Phase 5 | Phase 5 Enterprise hardening |
| 다크 모드 polish, i18n 런타임 스위처, 접근성 감사 | Phase 5 | Phase 5 |
| Sentry, PostHog, Langfuse 관측성 wiring | Phase 5 | Phase 5 |
| Playwright e2e 테스트 작성(인프라는 준비) | Phase 6 | Phase 6 |
| LLM eval harness (promptfoo) | Phase 6 | Phase 6 |
| `/api/ra/projects`, `/api/ra/sources` 등 Zod 스키마 상세 | Phase 4 | handoff §11 상세 부족, Phase 4 착수 시 `regula-architect` 결정 |
| 21 CFR Part 11 **전자 서명**(electronic signatures) | Post-launch | GxP 워크플로우 대상 여부 미확정, append-only 감사만 Day 1 구현 |
| Queue(Inngest) wiring | Phase 2/5 | 선택만 본 SPEC에서 확정, 실제 작업자 구성은 RAG 파이프라인 착수 시 |
| LLM orchestration(LangChain.js) 코드 | Phase 2 | Phase 2 착수 시 `regula-architect`가 최종 결정 (본 SPEC에서 잠그지 않음 — AUD-013 참조) |
| Soft-delete 컬럼(`deleted_at` 등) | Post-launch | Phase 1 스키마는 hard-delete 전제. audit_logs는 불변이므로 soft-delete 무관 |

---

## 기술 결정 (Technical Decisions)

본 SPEC은 handoff README §4, §11, §12, §16의 미결 항목을 다음과 같이 **결정**한다. 결정 근거와 후속 재평가 조건을 함께 기록한다. v0.2.0에서 LLM Orchestration 결정은 Phase 2 기록으로 이동 (AUD-013 반영).

### Phase 1 확정 결정

| # | 결정 항목 | 선택 | 탈락안 | 근거 | 재평가 조건 |
|---|---|---|---|---|---|
| 1 | Vector DB | **pgvector (Postgres 확장)** | Pinecone | 단일 Postgres 인스턴스로 관계형 + 벡터 스토어 통합, 운영 단순화, Supabase/Neon 네이티브 지원, 데이터 레지던시(EU 고객) 제어 용이 | 검색 지연 P95 > 500ms 또는 코퍼스 규모 > 50M 청크 시 Pinecone 재검토 |
| 2 | Queue / Worker | **Inngest** | Trigger.dev | Vercel 네이티브 통합, Next.js Route Handlers와 동일 배포 파이프라인, event-driven RAG 재수집 작업에 적합 | Phase 5에서 수집 작업 복잡도가 Inngest 단계 제한을 초과하면 Trigger.dev 재검토 |
| 3 | `message_blocks` vs `checklist_items` | **`message_blocks` 단일 테이블 통합 (단, `source_sections`는 유지)** | 별도 `checklist_items` 테이블 | `block_type` enum (`prose` \| `checklist` \| `comparison` \| `timeline` \| `sources` \| `related`) + `block_json` 페이로드로 6종 블록을 균일 처리. 체크박스 완료 상태는 Phase 3에서 별도 `checklist_completions` 테이블로 도입 예정. **[중요 — AUD-001 반영]** 이 통합은 `checklist_items` 제거만 의미하며, handoff §12의 `source_sections` 테이블(citation deep-link anchor)은 **Phase 1에서 반드시 유지**하여 Phase 2 `#source=N&offset=M` 딥링크 기능을 지원한다. | handoff §12의 `checklist_items` 테이블은 Phase 3에서 별도 완료 상태 지속성 테이블로 재해석 |
| 4 | `/api/ra/projects` · `/api/ra/sources` Zod 스키마 | **본 Phase 범위 외 (Phase 4)** | 즉시 정의 | handoff §11 상세 누락, Phase 1은 스키마 컬럼만 확보 | Phase 4 착수 시 `regula-architect`가 스키마 결정 |
| 5 | 21 CFR Part 11 전자 서명 | **Post-launch (본 Phase 미구현)** | Phase 1 포함 | append-only `audit_logs` + 7년 보존만 Day 1 필수. 전자 서명은 GxP 워크플로우 범위 확정 후 도입 | Post-launch 컴플라이언스 감사 결과에 따라 별도 SPEC 발행 |
| 6 | audit_logs 변경 차단 범위 | **UPDATE + DELETE + TRUNCATE 모두 차단 + `app_role` mutation 권한 REVOKE + migrations role 분리** | UPDATE/DELETE만 차단 | 21 CFR Part 11 §11.10(c) "protection of records" 엄격 해석. TRUNCATE는 별도 `BEFORE TRUNCATE` 트리거 필요하며, role 분리 없이는 `DISABLE TRIGGER` 우회 가능 (AUD-003 반영). | DBA가 role 분리 운영 불가 환경이면 별도 감사 로그 아카이브 DB로 이중화 |

### Phase 2 기록 (Phase 1에서 실행 불필요, 참고용)

| # | 결정 항목 | 선택 후보 | 근거 | 확정 시점 |
|---|---|---|---|---|
| P2-1 | LLM Orchestration | LangChain.js (우선 후보) vs LlamaIndex TS | Phase 1에는 LangChain.js 의존성을 `package.json`에 추가하지 않음. Phase 2 Chat core 착수 시 LangChain v0.3+ breaking change 상황 재확인 후 `regula-architect` 최종 결정 | Phase 2 Kickoff |

---

## EARS 인수 기준 (Acceptance Criteria)

각 요구사항은 `REQ-FND-NNN` ID로 식별하며, EARS 5개 패턴 중 적절한 형태로 기술한다. 모든 요구사항은 테스트 가능(testable)해야 한다.

**v0.2.0 상태:** 기본 REQ-FND-001 ~ 060 (60개) + 감사 후 추가된 suffixed REQ 13개 (REQ-FND-010a, 029a, 044a, 044b, 044c, 045a, 046a, 046b, 047a, 047b, 047c, 049a, 059a) = **총 73개**. 기존 번호를 유지하여 관련 문서·테스트 참조의 하위 호환성을 보존한다. 수정된 REQ (재작성/확장): 015, 018, 019, 022, 023, 027, 030, 031~045, 046, 047, 049, 053, 054, 056, 059, 060.

### Group A: Scaffolding (REQ-FND-001 ~ REQ-FND-010 + suffixed 010a)

#### REQ-FND-001 (Ubiquitous)
**요구사항:** The system SHALL declare `pnpm` as the required package manager via the `packageManager` field in `package.json` (예: `pnpm@9.x`).
**근거:** handoff §4 "pnpm 필수".
**검증 방법:** `package.json` 읽어 `packageManager` 필드 존재 및 `pnpm@` 접두사 확인.

#### REQ-FND-002 (Ubiquitous)
**요구사항:** The system SHALL require Node.js 20 LTS 이상 via `engines.node` 필드 (`">=20.0.0"`).
**근거:** handoff §4 "Node.js 20 LTS".
**검증 방법:** `package.json`의 `engines.node` 필드 파싱, `>=20` 조건 만족 확인.

#### REQ-FND-003 (Ubiquitous)
**요구사항:** The system SHALL pin Next.js 15, React 18, TypeScript 5.4 이상 버전을 dependencies/devDependencies에 명시.
**근거:** handoff §4 Frontend 스택.
**검증 방법:** `package.json`에서 `next`, `react`, `typescript` 버전 확인.

#### REQ-FND-004 (Ubiquitous)
**요구사항:** The system SHALL include Tailwind CSS v4, Drizzle ORM, Auth.js v5 (`next-auth` beta), Zustand, TanStack Query v5, Vercel AI SDK (`ai`) 의존성을 `dependencies`에 포함.
**근거:** handoff §4 Frontend/Backend/AI 스택.
**검증 방법:** `package.json` dependencies 섹션에 각 패키지명 및 메이저 버전 일치 확인.

#### REQ-FND-005 (Ubiquitous)
**요구사항:** The system SHALL include Biome, Vitest, Playwright, Drizzle Kit 의존성을 `devDependencies`에 포함.
**근거:** handoff §4 개발 도구.
**검증 방법:** `package.json` devDependencies 섹션 확인.

#### REQ-FND-006 (Ubiquitous)
**요구사항:** The system SHALL define `next.config.mjs`, `tsconfig.json` (strict 모드 활성화), `biome.json`, `drizzle.config.ts`, `postcss.config.mjs`, `.env.example` 파일을 프로젝트 루트에 포함.
**근거:** handoff §5 디렉토리 구조.
**검증 방법:** 파일 존재 및 `tsconfig.json`의 `"strict": true` 검사.

#### REQ-FND-007 (Ubiquitous)
**요구사항:** The `.env.example` file SHALL declare 모든 Phase 1 필수 환경 변수를 빈 값으로 포함: `DATABASE_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `AZURE_AD_CLIENT_ID`, `AZURE_AD_CLIENT_SECRET`, `AZURE_AD_TENANT_ID`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
**근거:** handoff §15 Auth 요건 (SSO-first, SAML/OIDC), §16 보안.
**검증 방법:** `.env.example` 파싱, 필수 키 목록 존재 확인.

#### REQ-FND-008 (Conditional)
**요구사항:** IF `pnpm install` 명령이 실행되면, THEN the system SHALL 모든 의존성을 종속성 충돌 없이 해결해야 한다 (`pnpm install --frozen-lockfile` 성공).
**근거:** handoff §18 CI/CD — Install 단계 성공 요건.
**검증 방법:** CI 환경에서 `pnpm install --frozen-lockfile` 종료 코드 0 확인.

#### REQ-FND-009 (Conditional)
**요구사항:** IF `pnpm typecheck` (또는 `pnpm tsc --noEmit`) 명령이 실행되면, THEN the system SHALL 타입 오류 0건으로 완료해야 한다.
**근거:** handoff §18 CI/CD — TypeScript typecheck 단계.
**검증 방법:** 종료 코드 0 + 오류 출력 없음.

#### REQ-FND-010 (Conditional)
**요구사항:** IF `pnpm build` (Next.js 빌드) 명령이 실행되면, THEN the system SHALL 프로덕션 번들을 오류 없이 생성해야 한다.
**근거:** handoff §18 CI/CD — Build 단계.
**검증 방법:** 종료 코드 0, `.next/` 디렉토리 생성 확인.

#### REQ-FND-010a (Conditional) [AUD-010 신규]
**요구사항:** The system SHALL expose `lib/env.ts` with a `zod` schema validating the required environment variables: `DATABASE_URL` (non-empty URL), `AUTH_SECRET` (min 32 chars), `NEXTAUTH_URL` (URL), `AUTH_MICROSOFT_ID`, `AUTH_MICROSOFT_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`. IF any required variable is missing or malformed at module-load time, THEN the system SHALL throw a human-readable `ZodError` preventing `pnpm dev`, `pnpm build`, or production boot from succeeding.
**근거:** Day-1 DX + 보안. `!` non-null assertion은 런타임 cryptic error를 유발하고, `AUTH_SECRET` 미설정 시 NextAuth가 위험한 기본값으로 동작할 수 있음 (audit AUD-010).
**검증 방법:** Vitest에서 `DATABASE_URL` 삭제 후 `import('@/lib/env')` 호출이 `ZodError` throw 확인. `.env.local` 누락 상태에서 `pnpm dev` 실행 시 명시적 에러 메시지 출력 확인.
**구현 가이드:**
```ts
// lib/env.ts
import { z } from 'zod';
const schema = z.object({
  DATABASE_URL: z.string().url(),
  AUTH_SECRET: z.string().min(32),
  NEXTAUTH_URL: z.string().url(),
  AUTH_MICROSOFT_ID: z.string().min(1),
  AUTH_MICROSOFT_SECRET: z.string().min(1),
  AUTH_GOOGLE_ID: z.string().min(1),
  AUTH_GOOGLE_SECRET: z.string().min(1),
});
export const env = schema.parse(process.env);
```

---

### Group B: Route Groups and Pages (REQ-FND-011 ~ REQ-FND-020)

#### REQ-FND-011 (Ubiquitous)
**요구사항:** The system SHALL provide `app/layout.tsx` as the root layout, which loads 글로벌 스타일(`app/globals.css`) 및 폰트 스택(Noto Serif KR, Pretendard, Source Serif 4, IBM Plex Sans, IBM Plex Mono).
**근거:** handoff §5, §6, §13.2.
**검증 방법:** `app/layout.tsx` 읽어 `import './globals.css'` 및 `next/font/google` 사용 확인.

#### REQ-FND-012 (Ubiquitous)
**요구사항:** The root layout SHALL render `<html lang="ko">` as the default locale.
**근거:** handoff §6 "한국어 UI가 기본(ko)" + product.md Non-Obvious Constraint #6.
**검증 방법:** `app/layout.tsx` 내 `<html lang="ko">` 하드코딩 확인 또는 런타임 HTML 응답 검사.

#### REQ-FND-013 (Ubiquitous)
**요구사항:** The system SHALL provide `app/(app)/layout.tsx` containing Sidebar and Topbar wrapper around `{children}`.
**근거:** handoff §5, §7.1, §7.2.
**검증 방법:** `app/(app)/layout.tsx` 읽어 `<Sidebar />` 및 `<Topbar />` import·렌더링 확인.

#### REQ-FND-014 (Ubiquitous)
**요구사항:** The `(app)` route group layout SHALL emit `<meta name="robots" content="noindex, nofollow">` via Next.js metadata API.
**근거:** handoff §15 SEO "App is behind auth → noindex entirely" + product.md Non-Obvious Constraint #7.
**검증 방법:** `app/(app)/layout.tsx`의 `export const metadata` 내 `robots: { index: false, follow: false }` 확인.

#### REQ-FND-015 (Unwanted) [AUD-008 재작성]
**요구사항:** The `(app)` route group layout SHALL NOT emit any of the following meta tags: `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `twitter:card`, `twitter:site`, `twitter:creator`, `twitter:title`, `twitter:description`, `twitter:image`, `application-name`, `<link rel="canonical">` pointing to external URLs. Allowed meta whitelist: `<title>`, `<meta charset>`, `<meta name="viewport">`, `<meta name="robots">`, `<meta name="theme-color">`, `<meta name="description">` (generic tagline only — no marketing copy), `<link rel="canonical">` (self-reference only), `<html lang="...">`.
**근거:** handoff §15 "Add structured robots.txt and auth-wall middleware" + product.md "앱 셸에 마케팅 SEO 메타태그 추가 금지" + AUD-008 명시 화이트리스트.
**검증 방법:** compliance-qa가 `app/(app)/**/page.tsx` 및 `layout.tsx` 검사로 금지 meta 부재 확인 (정규식 `og:|twitter:|application-name`). 프로덕션 빌드 HTML 응답 scraping으로 2차 검증.

#### REQ-FND-016 (Ubiquitous)
**요구사항:** The system SHALL provide `app/(app)/page.tsx` as the Home view placeholder (후속 Phase 4에서 상세 구현, Phase 1은 정적 스켈레톤).
**근거:** handoff §7.3 Home + §20 Phase 1 "Home + empty Chat".
**검증 방법:** 파일 존재 및 기본 export component 렌더링 확인.

#### REQ-FND-017 (Ubiquitous)
**요구사항:** The system SHALL provide `app/(app)/chat/page.tsx` as an empty-state placeholder (Composer·AnswerBlock 없음).
**근거:** handoff §20 Phase 1 "Home + empty Chat".
**검증 방법:** 파일 존재 및 빈 상태 메시지(예: "새로운 상담을 시작하세요") 렌더링 확인.

#### REQ-FND-018 (Ubiquitous) [AUD-019 확장]
**요구사항:** The system SHALL provide `app/(auth)/login/page.tsx` as the SSO entry skeleton (Microsoft·Google 로그인 버튼 플레이스홀더, 실제 OAuth 플로우는 `lib/auth.ts` 연동). The file SHALL export `metadata` explicitly overriding the root `noindex` default:
```ts
export const metadata: Metadata = {
  robots: { index: true, follow: true },
  title: 'Regula — Sign in',
};
```
이 override는 `/login`이 유일한 공개 페이지임을 보장하며, 다른 `(app)` 페이지는 root layout의 `noindex` 기본값을 상속한다.
**근거:** handoff §15 Auth, §20 Phase 1 + product.md Non-Obvious Constraint #7 "Auth 뒤 → 전역 noindex, `/login` 제외".
**검증 방법:** 파일 존재 및 Microsoft/Google 버튼 렌더링 확인. `curl /login` 응답에 `<meta name="robots" content="index, follow">` 포함 확인. `curl /` (인증 후) 응답에는 `noindex, nofollow` 포함 확인.

#### REQ-FND-019 (Ubiquitous) [AUD-015 확장]
**요구사항:** The system SHALL provide `components/shell/Sidebar.tsx` rendering navigation links **in this exact order with Korean labels**: (1) 홈 → `/`, (2) 새 상담 → `/chat`, (3) 히스토리 → `/history`, (4) 템플릿 → `/templates`, (5) 지식 베이스 → `/knowledge`, (6) 규제 업데이트 → `/updates`, (7) 대시보드 → `/dashboard`, (8) 설정 → `/settings`. 추가로 sidebar 상단에 "새 상담" 강조 버튼 (primary action). Phase 1은 정적 UI, 실제 기능 연결은 후속 Phase.
**근거:** handoff §7.1 + product.md "한국어 UI가 기본" + AUD-015 라벨 배열 결정론.
**검증 방법:** 컴포넌트 렌더링 테스트(Vitest + @testing-library/react)에서 8개 `<a>` 링크의 `href` 속성과 한국어 텍스트를 정확한 순서로 검증. "새 상담" 강조 버튼 존재 확인.

#### REQ-FND-020 (Ubiquitous)
**요구사항:** The system SHALL provide `components/shell/Topbar.tsx` rendering breadcrumb 영역, 테마 토글 버튼 플레이스홀더, "전문가 검토" 버튼 플레이스홀더.
**근거:** handoff §7.2.
**검증 방법:** 컴포넌트 렌더링 후 3개 요소 DOM 존재 확인.

---

### Group C: Design Tokens and Typography (REQ-FND-021 ~ REQ-FND-030 + suffixed 029a)

#### REQ-FND-021 (Ubiquitous)
**요구사항:** The system SHALL define `styles/tokens.css` containing 모든 handoff §6 디자인 토큰 (colors: brand-50~brand-900, accent, neutral; font stacks; spacing; radii; shadows; motion; 다크 모드 오버라이드).
**근거:** handoff §6 Design Tokens.
**검증 방법:** `styles/tokens.css` 내 `--color-brand-*`, `--font-sans`, `--font-serif`, `--font-mono`, `--nav-w`, `--topbar-h` 변수 존재 확인.

#### REQ-FND-022 (Ubiquitous) [AUD-023 확정]
**요구사항:** The system SHALL declare the Tailwind v4 `@theme { ... }` block in `app/globals.css` (the main CSS entry point imported by `app/layout.tsx`), with each token key mapping 1:1 to a CSS custom property declared in `styles/tokens.css`. The `tokens.css` file remains the **single source of truth** for design tokens; `app/globals.css` only re-exports them into Tailwind's theme context via `@theme`. This location choice follows Tailwind v4 official guidance that `@theme` belongs in the main CSS entry point.
**근거:** handoff §6 "Map these 1:1 into the production app via Tailwind v4 @theme" + Tailwind v4 official documentation on `@theme` directive placement.
**검증 방법:** `app/globals.css`에 `@theme { ... }` 블록 존재 확인 및 `@import "../styles/tokens.css"` 선행 확인. `styles/tokens.css`에 `@theme` 블록이 **없음**을 확인(중복 선언 방지).

#### REQ-FND-023 (Ubiquitous) [AUD-002 재작성 — Critical]
**요구사항:** The font stack `--font-serif` SHALL be declared as **exactly** `'Source Serif 4', 'Noto Serif KR', Georgia, serif` (영문 우선, 한국어 fallback). 이 순서는 handoff §6 토큰 원문과 1:1 일치하며, 영문 Source Serif 4의 italic·OpenType 피처가 H1/인용 규제 텍스트에 정확히 적용되도록 보장한다. 한국어 친화 렌더링은 `--font-sans`의 Pretendard 배치(REQ-FND-024)에서 달성한다.
**근거:** handoff §6 line 287 원문 `` `--font-serif` | `'Source Serif 4', 'Noto Serif KR', Georgia, serif` `` + handoff §13.2 폰트 열거 순서(Source Serif 4 먼저) + product.md Non-Obvious Constraint #5 "Serif 강제 적용" + audit AUD-002.
**검증 방법:** compliance-qa SHALL verify that the `--font-serif` CSS custom property resolves in **exactly this order** (`Source Serif 4` → `Noto Serif KR` → `Georgia` → `serif`) in both light and dark themes. Regex check: `/--font-serif:\s*'Source Serif 4',\s*'Noto Serif KR',\s*Georgia,\s*serif/`.

#### REQ-FND-024 (Ubiquitous)
**요구사항:** The font stack `--font-sans` SHALL list Pretendard as a first-class Korean sans option alongside IBM Plex Sans.
**근거:** handoff §6, §13.2.
**검증 방법:** `tokens.css` 내 `--font-sans`에 `'Pretendard'` 포함 확인.

#### REQ-FND-025 (Ubiquitous)
**요구사항:** The system SHALL install `@fontsource-variable/pretendard` npm package since Pretendard is NOT available on Google Fonts.
**근거:** handoff §13.2 "Pretendard 주의: Google Fonts 미제공".
**검증 방법:** `package.json` dependencies에 `@fontsource-variable/pretendard` 존재 확인.

#### REQ-FND-026 (Ubiquitous)
**요구사항:** The system SHALL load Korean-priority fonts (Noto Serif KR, Pretendard) with `font-display: swap` and preload the primary weights (400, 600).
**근거:** handoff §15 Performance — 폰트 `display: swap` + 주요 웨이트 preload.
**검증 방법:** `app/layout.tsx`의 `next/font/google` 옵션에 `display: 'swap'` 및 preload 설정 확인.

#### REQ-FND-027 (Ubiquitous) [AUD-006 재분류 — Event-driven → Ubiquitous]
**요구사항:** The system SHALL emit CSS override rules under the `[data-theme="dark"]` selector (또는 `.dark` class selector per Tailwind v4 convention) in `styles/tokens.css`, redefining all color, shadow, and surface tokens declared in the `:root` block for dark mode rendering. The runtime class toggle behavior (setting `data-theme` on `<html>` via Zustand + localStorage) itself is **deferred to Phase 5** (UI interactivity). Phase 1 only guarantees the static CSS override block exists so that Phase 5 work only needs to add the toggle event.
**근거:** handoff §6 "[data-theme="dark"] 클래스 오버라이드 방식" + AUD-006 EARS 패턴 재분류 (CSS cascade는 정적 특성이므로 Ubiquitous가 정확).
**검증 방법:** `styles/tokens.css` 내 `[data-theme="dark"] { --color-brand-50: ...; ... }` (또는 `.dark { ... }`) 블록 존재 확인. 블록 내 최소 5개 이상의 `--color-*` 변수 재정의 확인. 런타임 토글 기능 테스트는 Phase 5 SPEC에서 수행.

#### REQ-FND-028 (Ubiquitous)
**요구사항:** The system SHALL define layout constants as CSS variables: `--nav-w: 260px`, `--topbar-h: 56px`, `--right-w: 360px`, `--content-max: 840px`.
**근거:** handoff §6 레이아웃 상수.
**검증 방법:** `tokens.css` 내 4개 변수 존재 확인.

#### REQ-FND-029 (Ubiquitous)
**요구사항:** The Tailwind v4 `@theme` mapping SHALL expose all token variables as Tailwind utility classes (예: `bg-brand-800`, `text-brand-700`, `font-serif`).
**근거:** handoff §6 + Tailwind v4 공식 `@theme` 매핑.
**검증 방법:** Tailwind 빌드 후 생성된 CSS에서 `bg-brand-800` 유틸리티 클래스 존재 확인.

#### REQ-FND-029a (Ubiquitous) [AUD-004 신규 — Critical]
**요구사항:** The system SHALL declare `tailwind.config.ts` at the project root with the following minimum contents:
- `content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}']` — glob paths for Tailwind's JIT content scanner
- `darkMode: 'class'` — ensures dark-mode utilities (`dark:bg-brand-900` 등) trigger when `[data-theme="dark"]` or `.dark` class is set on `<html>`
- `plugins: []` (Phase 1은 플러그인 없음, Phase 5 접근성 감사 시 `@tailwindcss/typography` 등 추가 가능)

This config file coexists with the CSS-side `@theme` block (REQ-FND-022) and provides build-time options that `@theme` alone cannot express (content globs, darkMode strategy).
**근거:** handoff §5 line 233 project tree 명시 (`tailwind.config.ts`) + structure.md line 69 + AUD-004 silent drop 복구. Tailwind v4 alpha/beta 기간에 `@theme`만으로 production 빌드 성공이 보장되지 않으므로 config 파일 유지.
**검증 방법:** 파일 존재 확인. `pnpm build` 실행 시 `darkMode: 'class'` 반영 확인(`dark:*` 유틸리티 생성). `content` glob 바깥 파일의 클래스는 purge되는지 smoke 테스트.

#### REQ-FND-030 (Conditional) [AUD-007 재작성]
**요구사항:** IF any file under `app/`, `components/`, or `lib/` (excluding `styles/tokens.css`) contains a raw hex color literal matching the regex `#[0-9a-fA-F]{3}([0-9a-fA-F]{3})?` (3- or 6-digit hex), THEN the system SHALL fail the Biome lint step preventing `pnpm build` from succeeding. The check is implemented as a Biome `noHexColor` custom rule or equivalent CI grep step, but **exactly one** mechanism MUST be selected and enforced (not both optional).
**근거:** handoff §6 디자인 토큰 일관성 원칙 + AUD-007 EARS Conditional 재작성 (사람의 "의도"가 아니라 파일 상태를 trigger로 사용).
**검증 방법:** `components/` 아래 임의의 `.tsx` 파일에 `style={{ color: '#ff0000' }}` 삽입 후 `pnpm lint` 실행 시 에러 exit code 1. 이후 삭제하면 통과. Biome 설정 JSON에 해당 규칙 `"error"` 레벨로 선언 확인.

---

### Group D: Database Schema (REQ-FND-031 ~ REQ-FND-045 + suffixed 044a/b/c, 045a)

**공통 정책 (v0.2.0 추가 — AUD-005 반영):** 아래 모든 테이블 정의는 다음 default policy를 따른다.
- 모든 timestamp 컬럼(`created_at`, `updated_at`, `archived_at`, `resolved_at` 등): `timestamptz` 타입, NOT NULL (nullable 명시된 경우 제외), default `now()`
- `id` PK 컬럼: `uuid` 타입, NOT NULL, default `gen_random_uuid()`
- FK onDelete 정책은 각 REQ의 제약 테이블에 명시. 미명시 FK는 `NO ACTION` (Postgres 기본)
- Phase 1은 **soft-delete 컬럼 도입하지 않음** (hard-delete 전제, audit_logs는 불변이므로 무관)

#### REQ-FND-031 (Ubiquitous) [AUD-001 수정 — Critical]
**요구사항:** The system SHALL define `lib/db/schema.ts` with **13 Drizzle table definitions**: `users`, `organizations`, `projects`, `conversations`, `messages`, `message_sources`, `message_blocks`, `sources`, `source_sections`, `templates`, `regulatory_updates`, `expert_reviews`, `audit_logs`.
**근거:** handoff §12 line 696–712 원문(13 tables including `source_sections` for deep-link anchors) + 기술 결정 #3 (`message_blocks` 통합, `source_sections`는 유지) + AUD-001 silent drop 복구.
**검증 방법:** `lib/db/schema.ts` import 후 13개 table export 확인. `source_sections` table export 존재를 Vitest에서 명시적으로 assert.

#### REQ-FND-032 (Ubiquitous) [AUD-005 + AUD-012 확장]
**요구사항:** The `users` table SHALL include the following columns with the exact constraints:

| column | type | nullable | default | notes |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `email` | text | NOT NULL | — | UNIQUE constraint |
| `name` | text | NOT NULL | — | |
| `role` | text | NOT NULL | `'member'` | Phase 5에서 RBAC enum 확장 예정 |
| `locale` | **pgEnum (`ko`, `en`)** | NOT NULL | `'ko'` | AUD-012: Drizzle `pgEnum` 명시 |
| `theme_pref` | **pgEnum (`light`, `dark`, `system`)** | NOT NULL | `'system'` | AUD-012: Drizzle `pgEnum` 명시 |
| `created_at` | timestamptz | NOT NULL | `now()` | |
| `updated_at` | timestamptz | NOT NULL | `now()` | trigger 또는 app-level 갱신 |

**근거:** handoff §12 + AUD-005 (컬럼 제약 결정론) + AUD-012 (enum 타입 결정).
**검증 방법:** Drizzle 스키마 introspection으로 컬럼 목록 + nullable + default 확인. `SELECT typname FROM pg_type WHERE typname IN ('locale', 'theme_pref')`로 pgEnum 존재 검증.

#### REQ-FND-033 (Ubiquitous) [AUD-005 확장]
**요구사항:** The `organizations` table SHALL include the following columns:

| column | type | nullable | default | notes |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `name` | text | NOT NULL | — | |
| `tier` | text | NOT NULL | `'standard'` | 예: `'standard'`/`'enterprise'` |
| `created_at` | timestamptz | NOT NULL | `now()` | |

**근거:** handoff §12 + AUD-005.
**검증 방법:** Drizzle 스키마 introspection으로 확인.

#### REQ-FND-034 (Ubiquitous) [AUD-005 확장]
**요구사항:** The `projects` table SHALL include the following columns:

| column | type | nullable | default | FK onDelete | notes |
|---|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | — | PK |
| `organization_id` | uuid | NOT NULL | — | **CASCADE** → organizations | |
| `name` | text | NOT NULL | — | — | |
| `device_class` | text | nullable | NULL | — | Phase 4 UI에서 채움 |
| `target_markets` | text[] | NOT NULL | `'{}'::text[]` | — | |
| `color` | text | nullable | NULL | — | brand color hint |
| `submission_date` | date | nullable | NULL | — | |
| `status` | text | NOT NULL | `'active'` | — | |
| `created_at` | timestamptz | NOT NULL | `now()` | — | |

**근거:** handoff §12 + AUD-005 FK 정책 (organization 삭제 시 소속 projects 일괄 제거).
**검증 방법:** 스키마 확인 + FK constraint `ON DELETE CASCADE` introspection.

#### REQ-FND-035 (Ubiquitous) [AUD-005 확장]
**요구사항:** The `conversations` table SHALL include the following columns:

| column | type | nullable | default | FK onDelete | notes |
|---|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | — | PK |
| `project_id` | uuid | nullable | NULL | **SET NULL** → projects | 프로젝트 삭제 시 대화 유지 |
| `user_id` | uuid | NOT NULL | — | **RESTRICT** → users | 사용자 삭제 불가 (대화 보유자) |
| `title` | text | nullable | NULL | — | 첫 메시지 기반 자동 생성 |
| `status` | text | NOT NULL | `'active'` | — | `active`/`archived` |
| `created_at` | timestamptz | NOT NULL | `now()` | — | |
| `archived_at` | timestamptz | nullable | NULL | — | |

**근거:** handoff §12 + AUD-005. 규제 문맥상 대화 이력은 감사 대상이므로 사용자 삭제 RESTRICT가 맞음.
**검증 방법:** 스키마 확인 + FK onDelete 정책 introspection.

#### REQ-FND-036 (Ubiquitous) [AUD-005 + AUD-018 확장 + v0.4.0 C7 수정]
**요구사항:** The `messages` table SHALL include the following columns:

| column | type | nullable | default | FK onDelete | notes |
|---|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | — | PK |
| `conversation_id` | uuid | NOT NULL | — | **CASCADE** → conversations | |
| `role` | **pgEnum (`user`, `assistant`, `system`)** | NOT NULL | — | — | |
| `content_prose` | text | NOT NULL | `''` | — | Phase 2에서 채움 |
| `confidence_level` | **pgEnum (`high`, `med`, `low`)** | nullable | NULL | — | research.md 해석 1 |
| `confidence_score` | numeric(4,3) | nullable | NULL | — | 0.000~1.000 |
| `duration_ms` | integer | nullable | NULL | — | Phase 2에서 채움 |
| `expert_review_required` | boolean | NOT NULL | `false` | — | |
| **`tokens_in`** | integer | nullable | NULL | — | **AUD-018** — Phase 2 LLM audit |
| **`tokens_out`** | integer | nullable | NULL | — | **AUD-018** — Phase 2 LLM audit |
| **`model`** | text | nullable | NULL | — | **AUD-018** — e.g., `claude-sonnet-4-5` |
| **`meta_json`** | **jsonb** | **nullable** | **NULL** | — | **v0.4.0 C7 — CHAT REQ-CHAT-028 citation violations array + extensibility metadata. Phase 2에서 채움** |
| `created_at` | timestamptz | NOT NULL | `now()` | — | |

**근거:** handoff §12 + AUD-005 (제약 결정론) + AUD-018 (LLM 호출 감사용 `tokens_in`/`tokens_out`/`model` 추가 — Phase 4 Dashboard 집계 대비) + cross-spec-audit C7 (CHAT REQ-CHAT-028 `messages.meta_json` 컬럼 존재 모호성 해소 — Phase 1에서 선제 선언하여 CHAT의 `message_meta` 보조 테이블 분기를 제거).
**검증 방법:** Drizzle introspection. `tokens_in`·`tokens_out`·`model` 컬럼 존재 및 nullable 확인. `meta_json` 컬럼 존재 및 jsonb 타입 + NULL 허용 확인. Phase 2에서 Vitest로 값 쓰기 smoke 테스트 (CHAT citation violations JSON insert → round-trip SELECT).

#### REQ-FND-037 (Ubiquitous) [AUD-005 확장]
**요구사항:** The `message_sources` table SHALL include the following columns:

| column | type | nullable | default | FK onDelete | notes |
|---|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | — | PK |
| `message_id` | uuid | NOT NULL | — | **CASCADE** → messages | |
| `source_id` | uuid | NOT NULL | — | **RESTRICT** → sources | 출처 보호 |
| `relevance_score` | numeric(4,3) | nullable | NULL | — | |
| `quoted_offset` | integer | nullable | NULL | — | source_sections 딥링크 |
| `quoted_length` | integer | nullable | NULL | — | |
| **`cite_index`** | integer | **NOT NULL** | — | — | citation 번호 매핑, Non-Obvious Constraint #1 |
| `created_at` | timestamptz | NOT NULL | `now()` | — | |

UNIQUE constraint: `(message_id, cite_index)` — 동일 메시지 내 citation 번호 중복 방지.

**근거:** handoff §12 "message_sources (..., cite_index)" + product.md Non-Obvious Constraint #1 + AUD-005.
**검증 방법:** `cite_index` 컬럼 NOT NULL constraint + UNIQUE(message_id, cite_index) 제약 확인. (Phase 1은 스키마 확보만, enforcement는 Phase 2).

#### REQ-FND-038 (Ubiquitous) [AUD-005 확장]
**요구사항:** The `message_blocks` table SHALL include the following columns:

| column | type | nullable | default | FK onDelete | notes |
|---|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | — | PK |
| `message_id` | uuid | NOT NULL | — | **CASCADE** → messages | |
| `block_type` | **pgEnum (`prose`, `checklist`, `comparison`, `timeline`, `sources`, `related`)** | NOT NULL | — | — | 6종 블록 |
| `block_json` | jsonb | NOT NULL | `'{}'::jsonb` | — | Phase 2/3에서 채움 |
| `order_index` | integer | NOT NULL | `0` | — | research.md 해석 2 |
| `created_at` | timestamptz | NOT NULL | `now()` | — | |

INDEX: `(message_id, order_index)` — Phase 3 렌더링 정렬 최적화.

**근거:** 기술 결정 #3 (단일 테이블 통합) + AUD-005.
**검증 방법:** Drizzle enum 정의 6개 값 확인. INDEX 존재 확인.

#### REQ-FND-039 (Ubiquitous) [AUD-005 + AUD-011 확장]
**요구사항:** The `sources` table SHALL include the following columns:

| column | type | nullable | default | FK onDelete | notes |
|---|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | — | PK |
| `organization_id` | uuid | **nullable** | NULL | **CASCADE** → organizations | NULL = 글로벌 규제 corpora (FDA/EU MDR 등) |
| `org_label` | text | NOT NULL | — | — | 기관명 (예: "FDA", "식약처") |
| `title` | text | NOT NULL | — | — | |
| `year` | integer | nullable | NULL | — | |
| `type` | **pgEnum (`Regulation`, `Guidance`, `Standard`, `Industry`, `Internal`)** | NOT NULL | — | — | |
| `region` | text | nullable | NULL | — | `US`/`EU`/`KR`/`CN`/`JP`/`GLOBAL` 등 |
| `url` | text | nullable | NULL | — | |
| `full_text_tsv` | tsvector | nullable | NULL | — | Phase 2 FTS |
| **`embedding`** | **vector(1536)** | nullable | NULL | — | pgvector 확장 컬럼, Phase 2에서 채움 |
| `created_at` | timestamptz | NOT NULL | `now()` | — | |

**근거:** handoff §12 + AUD-005 + AUD-011 (글로벌 corpora는 organization 미귀속).
**검증 방법:** 마이그레이션 SQL에 `CREATE EXTENSION IF NOT EXISTS vector;` 및 `embedding vector(1536)` 컬럼 확인. organization_id nullable 검증.

#### REQ-FND-040 (Ubiquitous)
**요구사항:** The system SHALL create an ivfflat or hnsw index on `sources.embedding` using cosine distance for vector similarity search (nullable-safe — NULL rows are skipped).
**근거:** handoff §11 RAG 벡터 검색 + pgvector 모범 사례.
**검증 방법:** 마이그레이션 SQL에 `CREATE INDEX ... ON sources USING ivfflat (embedding vector_cosine_ops)` 또는 hnsw 확인. (Phase 1은 인덱스 정의만, 실제 사용은 Phase 2).

#### REQ-FND-041 (Ubiquitous) [AUD-005 확장]
**요구사항:** The `templates` table SHALL include:

| column | type | nullable | default | notes |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `title` | text | NOT NULL | — | |
| `description` | text | nullable | NULL | |
| `region` | text | nullable | NULL | |
| `category` | text | nullable | NULL | |
| `file_key` | text | NOT NULL | — | S3/R2 object key |
| `usage_count` | integer | NOT NULL | `0` | |
| `created_at` | timestamptz | NOT NULL | `now()` | |

**근거:** handoff §12 + AUD-005.
**검증 방법:** 스키마 확인.

#### REQ-FND-042 (Ubiquitous) [AUD-005 확장]
**요구사항:** The `regulatory_updates` table SHALL include:

| column | type | nullable | default | notes |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | PK |
| `title` | text | NOT NULL | — | |
| `region` | text | NOT NULL | — | |
| `severity` | text | NOT NULL | `'info'` | `info`/`warning`/`critical` |
| `published_at` | timestamptz | NOT NULL | — | |
| `source_url` | text | nullable | NULL | |
| `affected_product_types` | text[] | NOT NULL | `'{}'::text[]` | |
| `impact_analysis_text` | text | nullable | NULL | Phase 4 LLM 생성 |
| `created_at` | timestamptz | NOT NULL | `now()` | |

**근거:** handoff §12 + AUD-005.
**검증 방법:** 스키마 확인.

#### REQ-FND-043 (Ubiquitous) [AUD-005 확장]
**요구사항:** The `expert_reviews` table SHALL include:

| column | type | nullable | default | FK onDelete | notes |
|---|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | — | PK |
| `conversation_id` | uuid | NOT NULL | — | **RESTRICT** → conversations | 대화 보존 |
| `message_id` | uuid | NOT NULL | — | **CASCADE** → messages | 해당 메시지 삭제 시 review도 제거 |
| `requested_by` | uuid | NOT NULL | — | **RESTRICT** → users | 요청자 보존 |
| `assigned_to` | uuid | nullable | NULL | **SET NULL** → users | 담당자 이탈 시 NULL |
| `status` | **pgEnum (`pending`, `in_progress`, `resolved`)** | NOT NULL | `'pending'` | — | |
| `notes` | text | nullable | NULL | — | |
| `created_at` | timestamptz | NOT NULL | `now()` | — | |
| `resolved_at` | timestamptz | nullable | NULL | — | |

**근거:** handoff §12 + AUD-005. `message_id` 추가로 특정 메시지에 대한 review 추적 (Phase 5 UI용).
**검증 방법:** 스키마 확인. (UI는 Phase 5).

#### REQ-FND-044 (Ubiquitous) [AUD-005 확장 + v0.4.0 C6 수정 — 21 CFR Part 11]
**요구사항:** The `audit_logs` table SHALL include the following columns:

| column | type | nullable | default | FK onDelete | notes |
|---|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | — | PK |
| `actor_id` | uuid | nullable | NULL | **SET NULL** → users | system events는 NULL, 사용자 삭제 시 기록 유지 |
| `action` | **pgEnum `audit_action`** | **NOT NULL** | — | — | **v0.4.0 C6 — pgEnum (REQ-FND-049 참조). DB-level enforcement via Drizzle `pgEnum('audit_action', [...])`. 확장은 `ALTER TYPE audit_action ADD VALUE '<name>'` 패턴 (Phase 2/4/5 migrations)** |
| `resource_type` | text | NOT NULL | — | — | |
| `resource_id` | text | NOT NULL | — | — | |
| `conversation_id` | uuid | nullable | NULL | **RESTRICT** → conversations | 관련 대화 추적(선택), 대화 삭제 불가 |
| `meta_json` | jsonb | NOT NULL | `'{}'::jsonb` | — | 추가 컨텍스트 (tokens/cost/ip/ua) |
| `created_at` | timestamptz | NOT NULL | `now()` | — | 불변 |

**핵심 FK 정책:** `actor_id` SET NULL 보장으로 사용자 삭제가 있어도 감사 기록은 보존되며 "actor_id=NULL, meta_json에 이메일/id snapshot" 패턴을 적용한다. `conversation_id`는 RESTRICT로 대화 삭제가 audit 참조와 충돌하지 않도록 강제한다.

**v0.4.0 C6 패치 — `action` 타입 통일:** 이전 `text NOT NULL`은 애플리케이션 TypeScript union에만 의존하여 BREADTH-vs-ENTERPRISE drift 위험을 남겼다. 본 버전에서 pgEnum `audit_action`으로 승격하여 **DB-level enforcement**를 확보한다 — 허용 값 외 INSERT는 Postgres가 `22P02 invalid_text_representation` 또는 `23514 check_violation`으로 거부한다. 새 action 값 도입 Phase(Phase 2/4/5)는 단일 패턴 `ALTER TYPE audit_action ADD VALUE '<name>'` 마이그레이션으로 확장하며, ENTERPRISE R1 risk("ALTER TYPE ... ADD VALUE 사용")와 BREADTH REQ-BREADTH-057("DB migration 불필요")의 모순은 본 변경으로 후자가 "DB migration 최소 — ALTER TYPE one-liner만"으로 해소된다.

**근거:** handoff §12, §16 (21 CFR Part 11) + AUD-005 FK 정책 + cross-spec-audit C6 (pgEnum vs text 내부 모순 해소, pgEnum 채택 — 더 강한 타입 안전성).
**검증 방법:** `SELECT typname, enum_range(NULL::audit_action) FROM pg_type WHERE typname='audit_action'` 결과가 Phase 1 3개 값 포함. `INSERT INTO audit_logs (action, ...) VALUES ('nonexistent.action', ...)` → `22P02` 또는 `23514` 에러로 거부 확인. 스키마 introspection에서 column `action` udt_name='audit_action' 확인.

#### REQ-FND-044a (Ubiquitous) [AUD-001 신규 — Critical, `source_sections` 테이블 복구]
**요구사항:** The system SHALL declare the `source_sections` table (handoff §12 line 704 원문 복구) with the following columns:

| column | type | nullable | default | FK onDelete | notes |
|---|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | — | PK |
| `source_id` | uuid | NOT NULL | — | **CASCADE** → sources | 출처 문서 삭제 시 단락도 제거 |
| `anchor` | text | NOT NULL | — | — | deep-link anchor (예: `§11.10-c`) |
| `heading` | text | nullable | NULL | — | 섹션 제목 |
| `text` | text | NOT NULL | — | — | 단락 본문 |
| `embedding` | vector(1536) | nullable | NULL | — | Phase 2에서 채움, chunk-level 검색 |
| `created_at` | timestamptz | NOT NULL | `now()` | — | |

**근거:** handoff §12 line 704 원문 + product.md §9 시나리오 2 (`#source=N&offset=M` 딥링크) + AUD-001 silent drop 복구. Phase 2에서 chunk 단위 RAG 검색 및 DocViewer 딥링크 필수 기반.
**검증 방법:** Drizzle에서 `sourceSections` table export 확인. FK `source_id` CASCADE 확인.

#### REQ-FND-044b (Ubiquitous) [AUD-001 신규]
**요구사항:** The system SHALL create an IVFFlat or HNSW index on `source_sections.embedding` using cosine distance (`vector_cosine_ops`), matching the REQ-FND-040 pattern for `sources.embedding`.
**근거:** Phase 2 LangChain chunk retriever는 section-level similarity search를 요구함.
**검증 방법:** 마이그레이션 SQL에 `CREATE INDEX ... ON source_sections USING ivfflat (embedding vector_cosine_ops)` 또는 hnsw 존재 확인.

#### REQ-FND-044c (Ubiquitous) [AUD-001 신규]
**요구사항:** The system SHALL add a UNIQUE constraint on `(source_id, anchor)` in the `source_sections` table to support deterministic deep-link lookup (`source.id + anchor → unique row`).
**근거:** `#source=N&offset=M` URL 패턴에서 anchor 기반 조회 O(1) 보장. 중복 anchor는 논리 오류.
**검증 방법:** Postgres introspection: `SELECT conname FROM pg_constraint WHERE conname LIKE '%source_sections%anchor%'` 결과에 UNIQUE 존재 확인.

#### REQ-FND-045 (Ubiquitous) [AUD-001 + AUD-011 수정]
**요구사항:** The system SHALL provide `migrations/0000_init.sql` (생성된 Drizzle 마이그레이션) that:
1. Begins with `CREATE EXTENSION IF NOT EXISTS vector;` (pgvector 확장 활성화, AUD-011)
2. Creates all **13 tables** (users, organizations, projects, conversations, messages, message_sources, message_blocks, sources, **source_sections**, templates, regulatory_updates, expert_reviews, audit_logs)
3. Creates all pgEnum types (**8 pgEnums per v0.4.0 C6**): `locale`, `theme_pref`, `message_role`, `confidence_level`, `block_type`, `source_type`, `expert_review_status`, **`audit_action`** (Phase 1 values: `llm.call`, `source.access`, `expert_review.flag`)
4. Is wrapped in a single transaction (`BEGIN;` ... `COMMIT;`) to prevent partial application on failure
5. IF pgvector extension creation fails due to insufficient role permissions (e.g., Supabase free-tier 일부 리전), THEN `drizzle-kit push` SHALL surface the Postgres error verbatim and abort with a remediation hint (`GRANT CREATE ON DATABASE ... TO <role>` 또는 DBA 연락)

**근거:** handoff §4 Drizzle Kit + AUD-001 (13 tables) + AUD-011 (pgvector precondition + 부분 실패 방지).
**검증 방법:** `drizzle-kit generate` 산출물 SQL의 첫 줄이 `CREATE EXTENSION IF NOT EXISTS vector;` 확인. 테스트용 role에서 권한 박탈 후 `drizzle-kit push` 실행 시 명시적 에러 메시지 및 non-zero exit code 확인.

#### REQ-FND-045a (Ubiquitous) [AUD-020 신규]
**요구사항:** The system SHALL require PostgreSQL version ≥16 and pgvector extension ≥0.7.0. `drizzle.config.ts` (또는 마이그레이션 preflight 스크립트) SHALL assert the PostgreSQL server version via `SELECT current_setting('server_version_num')::int >= 160000` and `SELECT extversion FROM pg_extension WHERE extname='vector'`가 `'0.7.0'` 이상인지 확인. IF any assertion fails, THEN migration SHALL abort before touching the schema.
**근거:** handoff §4 "PostgreSQL 16" + pgvector 0.7+ hnsw 인덱스 지원 + AUD-020.
**검증 방법:** Postgres 15 환경에서 `drizzle-kit push` 실행 시 version 에러로 abort 확인. pgvector 0.6 환경에서도 동일 확인.

---

### Group E: Append-Only Audit Logs (REQ-FND-046 ~ REQ-FND-050 + suffixed 046a/b, 047a/b/c, 049a)

#### REQ-FND-046 (Event-driven) [AUD-003 확장 — Critical, 21 CFR Part 11 §11.10(c)]
**요구사항:** WHEN any client executes `UPDATE` or `DELETE` statement on the `audit_logs` table, THEN the system SHALL raise a Postgres exception (SQLSTATE `P0001`) via a row-level BEFORE trigger, rejecting the mutation without modifying any row.
**근거:** handoff §16 "immutable append-only audit_logs" + product.md Non-Obvious Constraint #4 + 21 CFR Part 11 §11.10(c) "protection of records to enable their accurate and ready retrieval".
**검증 방법:** `compliance-qa`가 Vitest 통합 테스트에서 `UPDATE audit_logs SET action='x'` 및 `DELETE FROM audit_logs` 시도 시 `P0001` 에러 throw 확인.

#### REQ-FND-046a (Event-driven) [AUD-003 신규 — Critical, TRUNCATE bypass 봉쇄]
**요구사항:** WHEN `TRUNCATE TABLE audit_logs` (or `TRUNCATE ... CASCADE`) is attempted, THEN the system SHALL raise a Postgres exception via a **statement-level `BEFORE TRUNCATE` trigger** on the `audit_logs` table, rejecting the operation without emptying the table.
**근거:** `BEFORE UPDATE OR DELETE` row-level trigger는 TRUNCATE를 커버하지 못함(Postgres 문서). AUD-003에서 지적된 핵심 우회 경로 봉쇄. 21 CFR Part 11 §11.10(c) 해석 일관성.
**검증 방법:** `compliance-qa`가 Vitest 통합 테스트에서 `TRUNCATE TABLE audit_logs` 실행 시 `P0001` 또는 `0A000` 에러 throw 확인.

#### REQ-FND-046b (Unwanted) [AUD-003 신규 — Critical, role 오남용 봉쇄]
**요구사항:** IF the database connection uses the application role (`<app_role>`, 예: `regula_app`) to execute `ALTER TABLE audit_logs DISABLE TRIGGER ALL` or `DROP TRIGGER audit_logs_no_mutation` or `CREATE OR REPLACE FUNCTION tg_audit_logs_block_mutation()`, THEN the system SHALL deny the operation at the Postgres role privilege layer (not via trigger).
**근거:** Trigger 함수 자체를 `CREATE OR REPLACE`로 무력화하거나 `DISABLE TRIGGER`로 우회 가능한 권한 경로 봉쇄. AUD-003에서 지적된 공격 표면.
**검증 방법:** `compliance-qa`가 `app_role`로 연결 후 `DISABLE TRIGGER ALL`, `DROP TRIGGER`, `CREATE OR REPLACE FUNCTION` 각각 시도 시 "permission denied" (SQLSTATE `42501`) 발생 확인.

#### REQ-FND-047 (Ubiquitous) [AUD-003 확장]
**요구사항:** The system SHALL provide `migrations/0001_audit_append_only.sql` containing:
1. A Postgres trigger function `tg_audit_logs_block_mutation()` raising exception on any mutation
2. A row-level `BEFORE UPDATE OR DELETE ON audit_logs` trigger (REQ-FND-046 구현)
3. A statement-level `BEFORE TRUNCATE ON audit_logs` trigger (REQ-FND-046a 구현)
4. A top-level SQL comment documenting "21 CFR Part 11 append-only enforcement; 7-year retention policy"

**근거:** REQ-FND-046, REQ-FND-046a 구현 수단.
**검증 방법:** 마이그레이션 SQL 파일 읽어 `CREATE OR REPLACE FUNCTION tg_audit_logs_block_mutation`, `CREATE TRIGGER ... BEFORE UPDATE OR DELETE`, `CREATE TRIGGER ... BEFORE TRUNCATE` 세 구문 모두 존재 확인.

**참조 트리거 SQL (구현 가이드, v0.2.0 업데이트):**
```sql
-- 21 CFR Part 11 §11.10(c) append-only enforcement
-- 7-year retention policy (FDA expectation)

CREATE OR REPLACE FUNCTION tg_audit_logs_block_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only (21 CFR Part 11). Operation: %', TG_OP
    USING ERRCODE = 'P0001';
END;
$$ LANGUAGE plpgsql;

-- Row-level: block UPDATE and DELETE
CREATE TRIGGER audit_logs_no_mutation
  BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION tg_audit_logs_block_mutation();

-- Statement-level: block TRUNCATE (separate event)
CREATE TRIGGER audit_logs_no_truncate
  BEFORE TRUNCATE ON audit_logs
  FOR EACH STATEMENT EXECUTE FUNCTION tg_audit_logs_block_mutation();
```

#### REQ-FND-047a (Ubiquitous) [AUD-003 신규 — Critical, app_role 권한 박탈]
**요구사항:** The migration `0001_audit_append_only.sql` SHALL execute:
```sql
REVOKE UPDATE, DELETE, TRUNCATE, REFERENCES ON audit_logs FROM <app_role>;
GRANT INSERT, SELECT ON audit_logs TO <app_role>;
```
where `<app_role>` is the Postgres role used by the Drizzle client connection (configured via `DATABASE_URL`). After this migration, the application connection can only INSERT audit records and read them; no mutation path exists through the app.
**근거:** Trigger bypass 방지의 심층 방어 (defense-in-depth). AUD-003 권고.
**검증 방법:** `app_role`로 psql 접속 후 `UPDATE audit_logs SET action='x' WHERE id=uuid_generate_v4()` 실행 시 "permission denied" (SQLSTATE `42501`) 발생 확인.

#### REQ-FND-047b (Ubiquitous) [AUD-003 신규 — Critical, role 분리]
**요구사항:** The migrations infrastructure SHALL separate Postgres roles into at least two:
- `<app_role>` (예: `regula_app`) — used by Next.js runtime via `DATABASE_URL`; INSERT+SELECT only on `audit_logs`
- `<migrations_role>` (예: `regula_migrations`) — used only by `drizzle-kit push` / `migrate`; can CREATE/ALTER/DROP schema objects (including trigger functions)

The trigger function `tg_audit_logs_block_mutation` and its triggers SHALL be owned by `<migrations_role>`. `DEVELOPMENT.md` (REQ-FND-060) SHALL document this role separation.
**근거:** AUD-003. `CREATE OR REPLACE FUNCTION` 우회는 함수 소유자 또는 superuser만 가능하므로 role 분리로 봉쇄.
**검증 방법:** `\df+ tg_audit_logs_block_mutation` 결과의 Owner가 `<migrations_role>`임을 확인. `app_role`에서 `CREATE OR REPLACE FUNCTION tg_audit_logs_block_mutation() ...` 시도 시 permission denied.

#### REQ-FND-047c (Ubiquitous) [AUD-003 신규 — Critical, compliance-qa 검증 범위]
**요구사항:** The `compliance-qa` agent SHALL verify during Phase 1 completion ALL of the following regression tests (running as `<app_role>`):
1. `INSERT INTO audit_logs (...)` succeeds
2. `SELECT * FROM audit_logs LIMIT 1` succeeds
3. `UPDATE audit_logs SET action='x'` fails with `P0001`
4. `DELETE FROM audit_logs` fails with `P0001`
5. `TRUNCATE TABLE audit_logs` fails with `P0001` or `0A000`
6. `ALTER TABLE audit_logs DISABLE TRIGGER ALL` fails with permission denied (`42501`)
7. `DROP TRIGGER audit_logs_no_mutation ON audit_logs` fails with permission denied
8. `CREATE OR REPLACE FUNCTION tg_audit_logs_block_mutation() ...` fails with permission denied

**근거:** AUD-003의 full defense-in-depth 검증. Phase 1 완료 판정 전 compliance-qa가 반드시 실행.
**검증 방법:** 위 8개 쿼리의 결과를 `_workspace/phase-1/audit-logs-regression.txt`에 기록, compliance-qa 승인 필수.

#### REQ-FND-048 (Ubiquitous)
**요구사항:** The system SHALL provide `lib/audit.ts` exporting a `writeAudit(params: AuditEvent)` helper 함수 which inserts into `audit_logs` with 21 CFR Part 11 필수 필드 (`actor_id`, `action`, `resource_type`, `resource_id`, `meta_json`, `created_at` 자동).
**근거:** product.md Non-Obvious Constraint #4 "Day 1 요구사항".
**검증 방법:** `lib/audit.ts` 읽어 `writeAudit` export 확인, Zod 스키마로 입력 검증 확인.

#### REQ-FND-049 (Ubiquitous) [AUD-017 수정 + v0.4.0 C3/C6 확장 — Phase 1 경계 일치]
**요구사항:** The `AuditEvent` type SHALL define `action` as a TypeScript union matching the Postgres pgEnum `audit_action` (REQ-FND-044 C6 unification). Phase 1 creates the pgEnum with **exactly 3 active values**: `'llm.call'`, `'source.access'`, `'expert_review.flag'`. These are the only values writable by Phase 1 call-sites (Phase 1 call-sites = 0 per REQ-FND-049a scope discipline, but the enum type materialization happens in migration `0000_init.sql`).

**v0.4.0 C3 확장 — Phase 2~5 enum inventory 선제 선언 (non-normative but authoritative):** 하위 Phase들이 추가할 enum 값은 본 SPEC에서 한 곳에 선언된다. 각 Phase는 자체 마이그레이션에서 `ALTER TYPE audit_action ADD VALUE '<name>'`로 확장하며, 본 선언 외 값은 도입 불가 (cross-SPEC drift 방지).

| Phase | 추가 값 | 출처 REQ |
|---|---|---|
| Phase 1 (this SPEC) | `llm.call`, `source.access`, `expert_review.flag` | REQ-FND-049 |
| Phase 2 (CHAT) | — (Phase 1 3값만 wire; 신규 enum 값 없음) | REQ-CHAT-053~056 |
| Phase 3 (STRUCTURED) | — (REQ-STRUCT-037 per scope discipline; enum 확장은 Phase 5에서) | REQ-STRUCT-037 |
| Phase 4 (BREADTH) | `conversations.list`, `conversation.view`, `message.feedback`, `template.list`, `template.download`, `updates.list`, `dashboard.view`, `projects.list`, `project.create`, `project.update` (10개) | REQ-BREADTH-057 |
| Phase 5 (ENTERPRISE) | `auth.login`, `auth.logout`, `auth.mfa_fail`, `session.invalidate`, `expert_review.create`, `expert_review.assign`, `expert_review.resolve`, `rbac.permission_deny`, `profile.theme_update`, `profile.locale_update`, `checklist.toggle` (STRUCTURED로부터 이월 — C3), `consult.expert_review_auto_flag` (REQ-ENTERPRISE-009 — C1) , `project.switch` (REQ-BREADTH-049 Phase 5 wiring — C3) | REQ-ENTERPRISE-028 외 |

**누적 최대 enum 크기:** Phase 1 3 + Phase 4 10 + Phase 5 13 = **26 values** (Phase 6 추가 없음).

**근거:** handoff §16 "every LLM call, every source access, every expert-review flag" + AUD-017 Phase 1 wiring 경계 일치 + cross-spec-audit C3 (`checklist.toggle`/`consult.expert_review_auto_flag`/`project.switch` 이월 누락 복구) + C6 (pgEnum 통일 정합).
**검증 방법:** Phase 1 완료 시: `lib/audit.ts`의 `AuditAction` TS union이 정확히 Phase 1 3값만 포함 확인. `SELECT enum_range(NULL::audit_action)` 결과가 3개 값. 본 표는 Phase 2~5 SPEC 검증 시 enum inventory 기준선으로 사용 (compliance-qa cross-SPEC 검사).

#### REQ-FND-049a (Ubiquitous) [AUD-017 명시 — Scope Discipline]
**요구사항:** Phase 1 installs the `writeAudit` helper **signature** only. The helper is **not invoked at any call-site** in Phase 1 code; all call-sites are deferred to:
- Phase 2: `llm.call`, `source.access` (RAG `/api/ra/consult` handler)
- Phase 5: `auth.login`, `auth.logout`, `expert_review.*` (auth callbacks + expert review API)

**근거:** AUD-017 — REQ-FND-054 stub vs Phase 5 audit wiring 경계 충돌 해소.
**검증 방법:** `grep -r "writeAudit(" app/ lib/ components/ --include="*.ts" --include="*.tsx"` 실행 결과 Phase 1에서는 매칭 0건 (`lib/audit.ts` 정의 자체 제외).

#### REQ-FND-050 (Ubiquitous)
**요구사항:** The system SHALL document 7-year retention policy for `audit_logs` in code comment or README (실제 retention 잡 구현은 Post-launch).
**근거:** handoff §16 "7-year retention" + product.md.
**검증 방법:** `lib/audit.ts` 또는 `migrations/0001_audit_append_only.sql` 상단 주석에 "7-year retention (21 CFR Part 11)" 문구 확인.

---

### Group F: Auth.js SSO Skeleton (REQ-FND-051 ~ REQ-FND-055)

#### REQ-FND-051 (Ubiquitous)
**요구사항:** The system SHALL configure Auth.js v5 (`next-auth@5.x`) in `lib/auth.ts` with Microsoft Entra ID (Azure AD) 및 Google OIDC providers.
**근거:** handoff §15 Auth "SSO-first (SAML/OIDC)".
**검증 방법:** `lib/auth.ts` 읽어 `providers: [AzureAD({...}), Google({...})]` 구조 확인.

#### REQ-FND-052 (Ubiquitous)
**요구사항:** The session strategy SHALL be `database` (Drizzle adapter) to persist sessions in Postgres (미래 RBAC/idle timeout 구현 대비).
**근거:** handoff §15 "idle 30분 세션 타임아웃" — DB 세션이 JWT보다 무효화 용이.
**검증 방법:** `lib/auth.ts`의 `session: { strategy: 'database' }` 확인.

#### REQ-FND-053 (State-driven) [AUD-009 + AUD-014 확장]
**요구사항:** WHILE a user is unauthenticated, the system SHALL redirect the request to `/login` using Next.js `middleware.ts` (edge-level). The middleware SHALL use the following exact matcher pattern, whitelisting all public paths:
```ts
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|login|sso/callback|api/auth|robots.txt|public).*)',
  ],
};
```
This ensures `/login`, `/sso/callback`, `/api/auth/*` (NextAuth handlers), `/_next/*` (static assets), `/robots.txt`, `/favicon.ico`, `/public/*` are **never redirected**. Additionally, IF an already-authenticated user requests `/login`, THEN the middleware SHALL redirect them to `/` (prevent login-loop).

**Middleware-only policy:** Server-side layout session checks are explicitly **NOT used for redirect logic**. Defense-in-depth session reads in layouts for personalization are allowed, but redirects happen only at the edge middleware layer (AUD-014).
**근거:** handoff §5 "미인증 접근 시 /login 리다이렉트" + §15 Auth-wall middleware + AUD-009 matcher whitelist + AUD-014 middleware-only 확정.
**검증 방법:** `middleware.ts` 파일 존재 및 위 matcher pattern 확인. 미인증 상태에서 `curl /` → 302 `/login` 확인. `curl /api/auth/callback/azure-ad` → 리다이렉트 없음 (200 or NextAuth response). 인증 상태에서 `curl /login` → 302 `/`.

#### REQ-FND-054 (Ubiquitous) [AUD-017 수정 — no-op stub]
**요구사항:** The Auth.js configuration in `lib/auth.ts` SHALL include an empty `callbacks.signIn` stub that returns `true` (allow sign-in) without invoking `writeAudit` or any other side effect. A code comment immediately above the callback SHALL document: `// Phase 5: wire writeAudit({ action: 'auth.login', actor_id: user.id }) here`. Phase 1의 의도는 Auth.js 설정 객체의 shape만 확보하는 것이며, 실제 감사 wiring은 Phase 5 SPEC에서 담당한다.
**근거:** AUD-017 — Phase 5 경계 일치. Phase 1에 `writeAudit` 호출을 넣으면 enum에 `auth.login` 필요 + Phase 1 scope discipline 위반.
**검증 방법:** `lib/auth.ts` 읽어 `callbacks.signIn: () => true` (or `async () => true`) 확인 및 Phase 5 마커 주석 존재 확인. `grep -r "writeAudit" lib/auth.ts` 결과 0건.

#### REQ-FND-055 (Ubiquitous)
**요구사항:** The system SHALL expose NextAuth v5 route handler at `app/api/auth/[...nextauth]/route.ts` that re-exports `handlers` from `lib/auth.ts`.
**근거:** Auth.js v5 공식 App Router 패턴.
**검증 방법:** 파일 존재 및 `export { GET, POST } from '@/lib/auth'` (또는 handlers 재수출) 확인.

---

### Group G: Compliance Meta and Day-1 Prep (REQ-FND-056 ~ REQ-FND-060 + suffixed 059a)

#### REQ-FND-056 (Ubiquitous) [AUD-019 확장]
**요구사항:** The root `app/layout.tsx` SHALL export a base `metadata` object:
```ts
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXTAUTH_URL ?? 'http://localhost:3000'),
  title: { default: 'Regula', template: '%s | Regula' },
  robots: { index: false, follow: false }, // default noindex for all pages
};
```
All `(app)` pages SHALL inherit this default (no override). Only `/login/page.tsx` SHALL explicitly override via `export const metadata = { robots: { index: true, follow: true } }` (see REQ-FND-018). This pattern ensures zero accidental indexing of authenticated content.
**근거:** product.md Non-Obvious Constraint #7 + AUD-019 override 패턴 명시.
**검증 방법:** `app/layout.tsx` 읽어 정확한 metadata 구조 확인. `grep -r "robots:" app/` 결과에서 `robots: { index: true` 항목이 `app/(auth)/login/page.tsx`에만 존재함을 확인.

#### REQ-FND-057 (Ubiquitous)
**요구사항:** The system SHALL provide `public/robots.txt` with `User-agent: *` and `Disallow: /` (로그인 페이지 외 크롤 금지).
**근거:** handoff §15 "Add structured robots.txt".
**검증 방법:** `public/robots.txt` 파일 존재 및 내용 확인.

#### REQ-FND-058 (Ubiquitous)
**요구사항:** The `lib/db/client.ts` SHALL export a Drizzle client instance configured with `postgres-js` driver 및 connection pool, reading `DATABASE_URL` from env.
**근거:** handoff §4 "Drizzle ORM".
**검증 방법:** `lib/db/client.ts` 읽어 `drizzle(postgres(process.env.DATABASE_URL!))` 또는 동등 구조 확인.

#### REQ-FND-059 (Conditional) [AUD-001 수정 + v0.4.0 C6 수정 — 13 tables]
**요구사항:** IF `drizzle-kit push` 명령이 실행되면, THEN the system SHALL 모든 **13 tables** 및 pgvector 확장, pgEnum 타입 **8개 (v0.4.0 C6에서 `audit_action` 추가)**, audit_logs append-only triggers (row-level + statement-level TRUNCATE), `app_role` REVOKE 마이그레이션을 대상 데이터베이스에 적용해야 한다.
**근거:** handoff §4 + REQ-FND-045 + REQ-FND-047/047a/047b + cross-spec-audit C6 (audit_action pgEnum 추가).
**검증 방법:** 테스트 DB에서 `drizzle-kit push` 실행 후:
- `\dt` 명령으로 13 tables (users, organizations, projects, conversations, messages, message_sources, message_blocks, sources, **source_sections**, templates, regulatory_updates, expert_reviews, audit_logs) 존재 확인
- `\df tg_audit_logs_block_mutation` 트리거 함수 존재 확인
- `SELECT tgname FROM pg_trigger WHERE tgrelid = 'audit_logs'::regclass` 결과에 `audit_logs_no_mutation`, `audit_logs_no_truncate` 둘 다 존재
- `SELECT has_table_privilege('<app_role>', 'audit_logs', 'UPDATE')` 결과 `false`

#### REQ-FND-059a (Ubiquitous) [AUD-011 신규]
**요구사항:** The first migration SHALL execute `CREATE EXTENSION IF NOT EXISTS vector;` before any table using the `vector` type. IF extension creation fails due to insufficient role permissions (e.g., Supabase free-tier 일부 리전), THEN `drizzle-kit push` SHALL surface the Postgres error verbatim and output a remediation hint in stderr: `"pgvector extension creation failed. Run 'GRANT CREATE ON DATABASE <db> TO <role>;' or contact your DBA."`
**근거:** AUD-011 pgvector precondition. 부분 migration 실패 시 DB 오염 방지.
**검증 방법:** 권한 박탈된 test role로 `drizzle-kit push` 실행 시 명시적 remediation 메시지 출력 및 non-zero exit code 확인.

#### REQ-FND-060 (Ubiquitous) [AUD-016 재작성]
**요구사항:** The system SHALL include `DEVELOPMENT.md` at the project root with the following **5 exact sections** in this order, each formatted as a Markdown heading `##`:

1. **## Prerequisites** — required system components:
   - Node.js 20 LTS 이상
   - pnpm 9.x 이상
   - PostgreSQL 16+ with pgvector 0.7+ extension (Supabase 또는 Neon 관리형)
   - Microsoft Entra ID 및 Google Cloud OIDC 앱 등록 완료

2. **## Setup** — initial project bootstrap 체크리스트 (`- [ ]` 형식):
   - [ ] `pnpm install`
   - [ ] `cp .env.example .env.local` 후 값 채우기
   - [ ] PostgreSQL 연결 확인 및 `CREATE EXTENSION vector;` 권한 확인
   - [ ] `pnpm db:migrate` (drizzle-kit push 래퍼) 실행 → 13 tables + append-only trigger 적용
   - [ ] `pnpm dev` → `http://localhost:3000` 접속하여 `/login` 리다이렉트 확인

3. **## Development Commands** — 일상 명령 테이블:
   - `pnpm dev` / `pnpm typecheck` / `pnpm lint` / `pnpm test` (Vitest) / `pnpm test:e2e` (Playwright, Phase 6) / `pnpm build`

4. **## Testing** — 테스트 레이어 안내:
   - Vitest 단위 테스트 경로: `tests/unit/`
   - Vitest 통합 테스트 (DB 필요) 경로: `tests/integration/`
   - Playwright e2e 경로: `tests/e2e/` (Phase 6)
   - audit_logs append-only 회귀 테스트 (REQ-FND-047c) 실행 방법

5. **## Troubleshooting** — 자주 발생하는 문제:
   - pgvector 확장 미설치 시 remediation
   - Auth.js provider redirect URI 불일치 해결
   - Role 분리 설정 (`app_role` vs `migrations_role`)
   - Pretendard 폰트 로딩 실패 시 `@fontsource-variable/pretendard` 재설치

**근거:** 개발자 온보딩 + handoff §20 + AUD-016 템플릿 형식 결정론.
**검증 방법:** `DEVELOPMENT.md` 존재, 5개 `##` 헤딩 정확한 순서, Setup 섹션에 `- [ ]` 체크박스 최소 5개, Prerequisites에 Node/pnpm/Postgres 버전 명시 확인.

---

## 의존성 (Dependencies)

### 상위 SPEC
없음 (Phase 1은 Regula 프로젝트의 루트 SPEC).

### 하위 SPEC (Phase 2+에서 생성 예정)
- `SPEC-REGULA-CHAT-CORE-002` (Phase 2) — Composer, 스트리밍, RAG 파이프라인
- `SPEC-REGULA-STRUCTURED-003` (Phase 3) — Checklist, ComparisonTable, Timeline
- `SPEC-REGULA-BREADTH-004` (Phase 4) — History, Templates, Knowledge, Updates, Dashboard
- `SPEC-REGULA-ENTERPRISE-005` (Phase 5) — Expert review, RBAC, 관측성
- `SPEC-REGULA-QUALITY-006` (Phase 6) — LLM eval, Playwright, 부하 테스트

### 외부 의존성 (사용자 과제)
| 의존성 | 설명 | 담당 |
|---|---|---|
| PostgreSQL **16 이상** + pgvector **0.7+** 확장 | Supabase 또는 Neon 인스턴스 프로비저닝 + `CREATE EXTENSION vector` 권한 + role 분리 설정 (`regula_app` INSERT/SELECT 권한, `regula_migrations` DDL 권한) — AUD-003/AUD-011/AUD-020 | 사용자/DevOps |
| pnpm 9.x | Node.js 20+ 환경에 `npm install -g pnpm` 또는 corepack 활성화 | 사용자 |
| Microsoft Entra ID 앱 등록 | Azure Portal에서 OIDC 앱 생성, redirect URI `{NEXTAUTH_URL}/api/auth/callback/azure-ad` 등록, client ID/secret 발급 | 사용자/IT |
| Google Cloud OIDC 앱 등록 | GCP Console에서 OAuth 2.0 client 생성, redirect URI 등록, client ID/secret 발급 | 사용자/IT |
| Node.js 20 LTS 이상 | 현재 시스템 v24.12.0 확인됨 (호환) | 사용자 |

---

## 위험 및 가정 (Risks & Assumptions)

| 구분 | 항목 | 영향 | 대응 |
|---|---|---|---|
| 위험 | `pgvector` 확장이 Supabase free tier 일부 리전에서 미지원 | 배포 차단 | Neon 폴백, 또는 유료 tier 사용 확인 |
| 위험 | Auth.js v5 가 2026-04 시점 beta 단계일 수 있음 | API 변경 위험 | 버전 고정 + Phase 5에서 stable 전환 재평가 |
| 위험 | `@fontsource-variable/pretendard` 패키지 라이선스 확인 필요 | 법무 차단 | OFL-1.1 라이선스 확인 (공개 폰트) |
| 위험 | Tailwind v4 alpha/beta 기간 — `@theme` 문법 변동 가능성 | 토큰 매핑 재작업 | v4 stable 릴리스 주기 추적, 필요 시 v3.4+`@apply` 전략 폴백 |
| 위험 | Phase 1 이후 `checklist_items` 완료 상태 요구사항 등장 시 `message_blocks.block_json`만으로 불충분 가능 | 데이터 모델 리팩터 | Phase 3 착수 시 별도 `checklist_completions` 테이블 추가 (Drizzle 마이그레이션) |
| 위험 (v0.2.0 신규) | Supabase/Neon 관리형 Postgres가 role 분리를 허용하지 않거나 `DISABLE TRIGGER` 권한이 기본 role에 포함될 수 있음 | audit 봉쇄 무력화 | DB 프로비저닝 시 `regula_app` / `regula_migrations` 분리 가능 여부 사전 검증 (REQ-FND-047b). 분리 불가 환경이면 감사 로그를 별도 DB/스키마로 아카이브 |
| 위험 (v0.2.0 신규) | Tailwind v4 `@theme` 문법과 `tailwind.config.ts` 병행 시 설정 충돌 가능성 | 빌드 실패 | Tailwind v4 공식 migration guide 준수, `@theme` = tokens / `tailwind.config.ts` = content+darkMode 명확히 역할 분리 (REQ-FND-022/029a) |
| 가정 | 사용자가 SSO 앱 등록을 Phase 1 완료 전에 수행한다 | 테스트 로그인 지연 | `.env.example` 문서화 + `DEVELOPMENT.md` 가이드 제공 |
| 가정 | 21 CFR Part 11 전자 서명은 Post-launch 대상이며 Phase 1 범위 아님 | — | 본 SPEC Technical Decision #5 명시 |
| 가정 | handoff §11 `/api/ra/projects`, `/api/ra/sources` 상세 스키마는 Phase 4에서 결정 | Phase 1 API 범위 제한 | 본 SPEC Scope Out-of-Scope 명시 |
| 가정 | LangChain.js 채택 여부는 Phase 2에서 재평가 (Phase 1에 의존성 추가 없음) | Phase 2 kickoff 시 추가 논의 필요 | Technical Decision table의 "Phase 2 기록" 섹션 참조 |

---

## 테스트 전략 (Test Strategy)

Phase 1은 **스캐폴딩 및 구조 검증**이 중심이며, 런타임 동작 테스트는 최소화한다. Phase 6에서 Playwright e2e 및 LLM eval이 확장된다.

### 단위 테스트 (Vitest)
- `lib/db/schema.ts` — Drizzle 스키마 타입 추론 smoke 테스트 (13 tables의 `$inferSelect`, `$inferInsert` 타입 컴파일)
- `lib/audit.ts` — `writeAudit` 헬퍼의 Zod 입력 검증, INSERT 쿼리 문법
- `lib/auth.ts` — provider 설정 객체 shape 검증, `callbacks.signIn` no-op 반환 확인
- `lib/env.ts` — zod 스키마 검증, 필수 키 누락 시 `ZodError` throw 확인 (AUD-010)
- `components/shell/Sidebar.tsx` — 8개 링크 한국어 라벨 및 순서 검증 (AUD-015)

### 통합 테스트 (Vitest + 테스트용 Postgres)
- `audit_logs` append-only 8-step 회귀 테스트 (REQ-FND-047c): INSERT/SELECT 성공, UPDATE/DELETE/TRUNCATE 차단, DISABLE TRIGGER/DROP TRIGGER/CREATE OR REPLACE FUNCTION 권한 거부 — **AUD-003 Critical 검증**
- `drizzle-kit push` 성공 시 **13 tables** + pgvector 확장 + 7 pgEnums + 트리거 2개 + REVOKE 마이그레이션 적용 확인 — AUD-001
- pgvector 미설치 DB에서 migration 실패 시 remediation 메시지 출력 확인 — AUD-011
- PostgreSQL 15 환경에서 version assert abort 확인 — AUD-020
- `source_sections` UNIQUE(source_id, anchor) 제약 검증 — AUD-001
- middleware matcher 검증: 미인증 `/` → `/login` 302, `/api/auth/callback/azure-ad` → 리다이렉트 없음, 인증 상태 `/login` → `/` 302 — AUD-009

### 정적 검증
- Biome lint 통과 (0 warnings, 0 errors)
- TypeScript strict 컴파일 통과 (`pnpm typecheck`)
- Next.js 프로덕션 빌드 성공 (`pnpm build`)

### 접근성
Phase 1은 정적 셸 렌더링만 포함하므로 접근성 감사는 Phase 5에서 본격 시작. Phase 1은 최소한 `<html lang="ko">`, 랜드마크 role(`<nav>`, `<main>`, `<header>`) 사용 여부만 수동 확인.

### Playwright 인프라 준비
- `playwright.config.ts` 파일 생성 (실제 테스트 코드는 Phase 2~6에서 추가)
- GitHub Actions에서 Playwright 브라우저 설치 단계 포함

---

## 산출물 (Deliverables)

v0.2.0: `tailwind.config.ts`, `lib/env.ts` 추가. `playwright.config.ts` 책임 에이전트를 regula-architect로 재배정 (AUD-021).

| # | 파일 경로 | 책임 에이전트 | handoff 섹션 |
|---|---|---|---|
| 1 | `package.json` | regula-architect | §4 |
| 2 | `next.config.mjs` | regula-architect | §4, §5 |
| 3 | `tsconfig.json` | regula-architect | §4 |
| 4 | `biome.json` | regula-architect | §4 |
| 5 | `drizzle.config.ts` | regula-backend | §4, §12 |
| 6 | `postcss.config.mjs` | regula-design-system | §6 |
| 6a | **`tailwind.config.ts`** (AUD-004) | regula-architect | §5 line 233 |
| 7 | `.env.example` | regula-architect | §15, §16 |
| 7a | **`lib/env.ts`** (zod fail-fast, AUD-010) | regula-architect | §15, §16 |
| 8 | `app/layout.tsx` | regula-frontend | §5, §6, §13.2, §15 |
| 9 | `app/globals.css` | regula-design-system | §6 |
| 10 | `app/(app)/layout.tsx` | regula-frontend | §5, §7.1, §7.2, §15 |
| 11 | `app/(app)/page.tsx` | regula-frontend | §7.3 |
| 12 | `app/(app)/chat/page.tsx` | regula-frontend | §7.4 |
| 13 | `app/(auth)/login/page.tsx` (with robots override) | regula-frontend | §15 |
| 14 | `app/api/auth/[...nextauth]/route.ts` | regula-backend | §15 |
| 15 | `components/shell/Sidebar.tsx` (Korean labels) | regula-frontend | §7.1 |
| 16 | `components/shell/Topbar.tsx` | regula-frontend | §7.2 |
| 17 | `styles/tokens.css` (font order: Source Serif 4 first) | regula-design-system | §6 |
| 18 | `lib/db/schema.ts` (**13 tables incl. `source_sections`**) | regula-backend | §12 |
| 19 | `lib/db/client.ts` | regula-backend | §4 |
| 20 | `lib/auth.ts` (no-op signIn stub) | regula-backend | §15, §16 |
| 21 | `lib/audit.ts` (Phase 1: helper signature only, no call-sites) | regula-backend + regula-compliance-qa | §16 |
| 22 | `middleware.ts` (auth-wall with matcher whitelist) | regula-backend | §15 |
| 23 | `migrations/0000_init.sql` (13 tables + pgvector + pgEnums + PG version assert) | regula-backend | §4, §12 |
| 24 | `migrations/0001_audit_append_only.sql` (UPDATE/DELETE/TRUNCATE triggers + REVOKE + role separation) | regula-backend + regula-compliance-qa | §16 |
| 25 | `public/robots.txt` | regula-frontend | §15 |
| 26 | `DEVELOPMENT.md` (5 sections per AUD-016) | regula-architect | §20 |
| 27 | `playwright.config.ts` (infrastructure only, test authoring deferred to Phase 6) | **regula-architect** (AUD-021 재배정) | §17 |

---

## 완료 조건 (Definition of Done)

본 Phase 완료로 간주하려면 다음 19개 조건을 **모두** 충족해야 한다 (v0.2.0에서 7개 추가):

- [ ] `pnpm install --frozen-lockfile` 성공 (REQ-FND-008)
- [ ] `pnpm typecheck` 0 오류 (REQ-FND-009, TypeScript strict 모드)
- [ ] `pnpm build` 성공 (REQ-FND-010, Next.js 프로덕션 번들 생성)
- [ ] Biome lint 0 warnings / 0 errors (REQ-FND-030 hex 리터럴 검출 포함)
- [ ] `DATABASE_URL` 누락 상태에서 `pnpm dev` 실행 시 `ZodError` 발생 (REQ-FND-010a, 환경변수 fail-fast)
- [ ] `drizzle-kit push`가 테스트 DB에 **13 tables** (including `source_sections`) + pgvector + 7개 pgEnums + audit triggers 2개 + REVOKE 마이그레이션 적용 (REQ-FND-059) — AUD-001 + AUD-003
- [ ] `compliance-qa`의 audit_logs regression 8-step test 전부 PASS (REQ-FND-047c): INSERT/SELECT 성공, UPDATE/DELETE/TRUNCATE 차단, DISABLE TRIGGER/DROP TRIGGER/CREATE OR REPLACE FUNCTION 권한 거부
- [ ] `source_sections` 테이블 존재, `(source_id, anchor)` UNIQUE + embedding index 적용 확인 (REQ-FND-044a/b/c) — AUD-001
- [ ] pgvector 확장 미설치 DB에서 `drizzle-kit push` 실행 시 명시적 remediation 메시지 출력 (REQ-FND-059a) — AUD-011
- [ ] PostgreSQL 15 환경에서 migration이 version assert로 abort (REQ-FND-045a) — AUD-020
- [ ] `pnpm dev` 실행 후 `/` 접속 시 미인증 상태면 `/login`으로 302 리다이렉트 (REQ-FND-053)
- [ ] 미인증 상태에서 `/api/auth/callback/azure-ad` 접근 시 `/login`으로 리다이렉트되지 **않음** (matcher whitelist 검증) — AUD-009
- [ ] 인증 상태에서 `/login` 접근 시 `/`로 리다이렉트 (로그인 루프 방지) — AUD-009
- [ ] `/login` 페이지 HTML 응답에 `<html lang="ko">` + `<meta name="robots" content="index, follow">` 포함 (REQ-FND-012, REQ-FND-018) — AUD-019
- [ ] `/` (인증 후) 페이지 응답에 `<meta name="robots" content="noindex, nofollow">` 포함 (REQ-FND-014, REQ-FND-056) + 금지 meta (`og:*`, `twitter:*`) 부재 (REQ-FND-015) — AUD-008
- [ ] `public/robots.txt` 접근 시 `Disallow: /` 응답 (REQ-FND-057)
- [ ] Sidebar에 8개 내비게이션 링크 (한국어 라벨, 정확한 순서) + "새 상담" 버튼, Topbar에 3개 요소 렌더링 (REQ-FND-019, REQ-FND-020) — AUD-015
- [ ] `styles/tokens.css`의 `--font-serif` 값이 정확히 `'Source Serif 4', 'Noto Serif KR', Georgia, serif` (영문 우선) — AUD-002
- [ ] `DEVELOPMENT.md` 5개 `##` 섹션 정확한 순서 및 Setup 체크박스 5개 이상 포함 (REQ-FND-060) — AUD-016

---

## 관련 문서

### Handoff 섹션
- §4 Recommended Tech Stack — 전체 스택 테이블
- §5 Project Structure — 폴더 트리
- §6 Design Tokens — tokens.css 원본
- §7.1–§7.2 Shell components — Sidebar, Topbar 스펙
- §7.3 Home view
- §7.4 Chat / New Consultation (Phase 1은 빈 상태만)
- §11 Backend Integration (Phase 1 관련: API 라우트 구조만)
- §12 Data Models — 13 테이블 Drizzle schema (checklist_items 제외)
- §13.2 Fonts — 5개 폰트 스택
- §15 Performance & SEO — noindex 정책, 폰트 preload
- §16 Security & Compliance — 21 CFR Part 11, audit_logs append-only
- §17 Testing Strategy — Vitest/Playwright 레이어
- §18 Deployment & DevOps — GitHub Actions 파이프라인
- §20 Implementation Roadmap — Phase 1 블록

### MoAI 프로젝트 문서
- `.moai/project/product.md` — 제품 비전, 7개 Non-Obvious Constraints
- `.moai/project/structure.md` — 디렉토리 전략, Route Groups, 8 Views
- `.moai/project/tech.md` — 기술 스택, SSE 계약, 데이터 모델

### CLAUDE.md
- "Non-Obvious Product Constraints" 블록 — citation, 스트리밍, expert review, 감사, serif, i18n, noindex 7개 제약
- "Target Stack" 블록 — 스택 지정

### Non-Obvious Constraints ↔ REQ-FND 매트릭스 (AUD-022 신규)

CLAUDE.md "Non-Obvious Product Constraints" 7개 항목이 본 SPEC에서 어떤 REQ-FND로 Day-1 대비되는지 추적.

| # | Constraint (CLAUDE.md) | Phase 1 대비 REQ-FND | 상태 |
|---|---|---|---|
| 1 | 모든 LLM 주장에 inline `<sup>` citation 강제 | REQ-FND-037 (`message_sources.cite_index NOT NULL` + UNIQUE) | 스키마 확보 (enforcement는 Phase 2 후처리) |
| 2 | SSE 다단계 스트리밍 (trace → prose → structured) | — | N/A Phase 1 (Phase 2 `/api/ra/consult`) |
| 3 | Expert-review 자동 게이팅 (confidence < 0.7 또는 차단 키워드) | REQ-FND-036 (`expert_review_required` 컬럼), REQ-FND-043 (`expert_reviews` 테이블) | 스키마 확보 (게이팅 로직은 Phase 2/5) |
| 4 | 21 CFR Part 11 감사 — append-only, 7년 보존 | REQ-FND-044, 046, 046a, 046b, 047, 047a, 047b, 047c, 048, 049, 049a, 050 | **전면 강화** (UPDATE/DELETE/TRUNCATE/role bypass 전부 봉쇄 — AUD-003) |
| 5 | Serif/Sans 타이포그래피 대비 (브랜드 요건) | REQ-FND-023 (font-serif 정확한 순서), REQ-FND-024 (Pretendard), REQ-FND-026 (preload) | **수정 완료** (Source Serif 4 우선, AUD-002) |
| 6 | 한/영 이중언어 first-class | REQ-FND-012 (`<html lang="ko">`), REQ-FND-019 (Korean sidebar labels), REQ-FND-032 (`locale` pgEnum) | 기본값 `ko`, 런타임 스위처는 Phase 5 |
| 7 | Auth 뒤 → 전역 noindex (`/login` 제외) | REQ-FND-014, 015, 018, 056, 057 | **전면 강화** (noindex 기본값 + `/login` 명시 override + 금지 meta 화이트리스트 — AUD-008/AUD-019) |

### Handoff Divergence Log (v0.2.0 업데이트)

SPEC이 handoff README와 차이를 보이는 지점 및 문서화 상태.

| # | SPEC 기술 | handoff 원문 | 문서화 상태 | 관련 AUD |
|---|---|---|---|---|
| D-1 | **13 tables** (source_sections 포함) | 13 tables | **Yes (Resolved in v0.2.0: source_sections restored)** | AUD-001 |
| D-2 | `--font-serif: 'Source Serif 4', 'Noto Serif KR', Georgia, serif` | 동일 (영문 우선) | **Yes (Resolved in v0.2.0: order matches handoff §6)** | AUD-002 |
| D-3 | `message_blocks` 통합 (checklist_items 제거) | 별도 `checklist_items` 테이블 | Yes (Technical Decision #3) | OK |
| D-4 | `tailwind.config.ts` 포함 | `tailwind.config.ts` 트리에 명시 | **Yes (Resolved in v0.2.0: REQ-FND-029a added)** | AUD-004 |
| D-5 | pgvector 선택 | "Pinecone OR pgvector" 열거 | Yes (Technical Decision #1) | OK |
| D-6 | Auth.js `session.strategy = 'database'` | idle 30분만 명시 | Yes (research.md 해석 3) | OK |
| D-7 | SSO providers: Microsoft Entra ID + Google | handoff §4 "Microsoft/Google" | Yes (research.md 해석 4 → v0.2.0 명시) | 참고만 |
| D-8 | `message_blocks.order_index` 추가 | handoff sketch에는 없음 | Yes (research.md 해석 2) | OK |
| D-9 | LangChain.js Phase 1 결정 제외 | handoff §4 후보로 언급 | **Yes (Resolved in v0.2.0: moved to Phase 2 record)** | AUD-013 |
| D-10 | `messages.tokens_in/tokens_out/model` 추가 | handoff sketch에 없음 (§16 LLM 감사 요건만) | Yes (v0.2.0 추가) | AUD-018 |
| D-11 | `expert_reviews.message_id` 추가 | handoff는 `conversation_id`만 | Yes (v0.2.0 추가, Phase 5 UI용) | AUD-005 |

### 프로토타입 참조 (직접 복사 금지)
- `RA-bot-design/design_handoff_regula/design_files/src/*.jsx` — 레이아웃/간격/상호작용 의도 참조용
- `RA-bot-design/design_handoff_regula/design_files/styles/tokens.css` — 토큰 1:1 매핑 원본
- `RA-bot-design/design_handoff_regula/screenshots/*.png` — 8개 참조 화면 (다크 모드 포함)

---

## Pending Cross-Audit Findings (v0.4.0)

cross-spec-audit.md(2026-04-22)의 High findings 중 본 iteration에서 해소되지 않고 후속 Wave에서 추적할 항목. 각 Phase 진입 시 또는 Wave 4 iteration에서 점진 해소 가능 범위로 판단된 항목만 기록.

| ID | 요약 | 관련 Phase | 추적 상태 |
|---|---|---|---|
| H1 | LAUNCH E2E 스위트가 ENTERPRISE "E2E 전체" 약속을 제한적으로 커버 (7 core flows only) | LAUNCH, ENTERPRISE | Wave 4 또는 Phase 5 진입 시 결정 |
| H2 | VPAT 공식 문서가 LAUNCH REQ로 미등록 (2026-04-23 H9 패치에서 preflight 일부 보강 — VPAT 자체 작성은 Post-launch 검토) | LAUNCH | Post-launch tracking |
| H3 | Feature flag 시스템이 LAUNCH REQ로 미등록 (rollback runbook 참조만 존재) | LAUNCH | Post-launch tracking |
| H5 | Project delete 구현 오너십 미할당 (BREADTH 405, ENTERPRISE REQ 부재) | ENTERPRISE 또는 Post-launch | Phase 5 kickoff 재검토 |
| H6 | Users CRUD 구현 오너십 미할당 (rbac.manage permission matrix만 존재) | ENTERPRISE 또는 Post-launch | Phase 5 kickoff 재검토 |
| H7 | BREADTH 10 + ENTERPRISE 13 action 누적 선언 방식 — **v0.4.0에서 REQ-FND-049 inventory table로 해소됨** (모든 Phase의 추가 값을 단일 표에 선언) | FOUNDATION | **RESOLVED in v0.4.0** |

기타 Medium/Low findings(M1~M8, L1~L4)는 본 SPEC scope 외로, 각 Phase 진입 시 해당 SPEC 이터레이션에서 개별 결정한다.
