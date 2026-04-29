---
audit_id: AUDIT-REGULA-FOUNDATION-001-001
target: SPEC-REGULA-FOUNDATION-001
target_version: 0.1.0
auditor: plan-auditor
audit_date: 2026-04-22
stance: adversarial-independent
---

# Audit Report — SPEC-REGULA-FOUNDATION-001 (Iteration 1)

> Reasoning context ignored per M1 Context Isolation. Audit conducted against `spec.md` + `research.md` with cross-reference to handoff README (§4/§6/§11/§12/§13.2/§15/§16/§20), `.moai/project/{product,structure,tech}.md`, and `.claude/skills/regula/SKILL.md`.

---

## Executive Summary

- **총 findings: 23**
  - Critical: **5**
  - High: **8**
  - Medium: **7**
  - Low: **3**
- **Overall verdict: `REQUIRES_SIGNIFICANT_REWORK`**
- **Top 3 risks:**
  1. **`source_sections` 테이블 미포함** — handoff §12에 명시된 13-테이블 중 deep-link 앵커 테이블이 silent drop. Phase 2 `#source=N&offset=M` 딥링크(§9 시나리오 2) 구현 불가 → Day-1 스키마로 잠금 후 Phase 2에서 마이그레이션 필수.
  2. **폰트 스택 순서 역전** — handoff §6은 `'Source Serif 4', 'Noto Serif KR', Georgia, serif` (영문 우선)로 명시하나 REQ-FND-023은 "한국어 우선"으로 정반대 명시. 브랜드 요건 위반 + product.md Non-Obvious Constraint #5 위반.
  3. **감사 로그 INSERT-only 범위 누락** — REQ-FND-046 트리거가 `BEFORE UPDATE OR DELETE`만 차단. `TRUNCATE`, 권한 오남용, 관리자 컨텍스트 bypass는 미봉쇄. 21 CFR Part 11 §11.10(c) "protection of records" 엄격 해석 시 부족.

Phase 1 착수 불가. 최소 5개 Critical + 핵심 High 패치 후 재감사 필요.

---

## Findings Table

| ID | Severity | Dimension | REQ-FND ref | Summary | Recommended Action |
|----|----------|-----------|-------------|---------|---------------------|
| AUD-001 | Critical | Handoff Consistency / Coverage Gap | REQ-FND-031 | `source_sections` 테이블 누락 (13→12) | REQ-FND 추가 또는 Scope/Risks에 명시적 연기 근거 |
| AUD-002 | Critical | Handoff Consistency | REQ-FND-023 | `--font-serif` 순서 역전 (Noto Serif KR 우선) | handoff §6 원문 `Source Serif 4, Noto Serif KR, Georgia` 순서로 수정 |
| AUD-003 | Critical | Edge Case / Audit Integrity | REQ-FND-046, 047 | `TRUNCATE`/관리자 `DISABLE TRIGGER`/`ROLE` bypass 미차단 | 트리거에 `TRUNCATE` event, role revoke 명시 추가 |
| AUD-004 | Critical | Coverage Gap | — | `tailwind.config.ts` 산출물 부재 (handoff §5 line 233에 명시) | In Scope 파일 목록에 추가 또는 Tailwind v4 설정 근거 명시 |
| AUD-005 | Critical | Scope / Coverage Gap | REQ-FND-036, 037 | `messages.tokens_in/out`, `message_sources.quoted_text` 등 필드 미정의 상태에서 audit 필드와 혼재 | 각 컬럼의 nullable·default·FK onDelete 정책 명시 |
| AUD-006 | High | EARS Pattern | REQ-FND-027 | Event-driven REQ가 스크립트 클라이언트 동작을 기술, 시스템 응답 경계 불명확 | "런타임 토글"이 아니라 "CSS 오버라이드 블록 선언" Ubiquitous로 재분류 |
| AUD-007 | High | EARS Pattern | REQ-FND-030 | Unwanted 패턴이 사람(developer) 행동을 trigger로 사용. 테스트 불가 | "hex 리터럴 존재 시 lint error" Conditional로 재작성 |
| AUD-008 | High | Testability | REQ-FND-015 | "마케팅 SEO 메타태그"의 구체 정의 부재 (og:*, twitter:* 외 "인덱싱 유도 메타" 모호) | 금지 태그 화이트리스트 열거 (og:, twitter:, canonical, description 제외) |
| AUD-009 | High | Edge Case | — | `/login`이 `(auth)` 그룹인데 middleware가 `(app)` 외에도 루트 `/` 등을 커버하는지 명시 부재 | REQ-FND-053에 public paths 화이트리스트 (`/login`, `/sso/callback`, `/api/auth/*`, `/_next/*`, `/robots.txt`) 명시 |
| AUD-010 | High | Edge Case | REQ-FND-058 | `DATABASE_URL` 미설정 시 `pnpm dev` 부팅 동작 미정의 | 환경변수 fail-fast 검증(zod 기반 `env.ts`) REQ 추가 |
| AUD-011 | High | Edge Case | REQ-FND-039, 045, 059 | pgvector 확장 권한 없는 사용자(Supabase free-tier, roleless CI)에서 migration 실패 경로 미정의 | Precondition REQ: "IF vector extension 부재 시 `drizzle-kit push` 명시적 오류 메시지 출력" 추가 |
| AUD-012 | High | Handoff Consistency | REQ-FND-032 | `locale` 타입 `('ko'|'en')` pgEnum인지 text check인지 불명확 | Drizzle pgEnum 명시 or check constraint 명시 |
| AUD-013 | High | Decision Soundness | Decision #3 (LangChain.js) | Phase 1에서 LangChain 의존성 미추가(Phase 2 도입)인데 결정만 선행. 재평가 트리거가 Phase 2 착수 시점 — Phase 1 고정 불필요 | Phase 1 기술 결정에서 제외(Phase 2 결정으로 이동) 또는 "Phase 1은 기록만" 명시 |
| AUD-014 | Medium | Coverage Gap | — | `middleware.ts` 가 산출물 표(line 524)에 있으나 REQ-FND-053이 `middleware.ts` OR server-side layout 양쪽 허용 → 결정론 부재 | research.md 해석 6을 spec.md REQ에 통합, 단일 방식 확정 |
| AUD-015 | Medium | Testability | REQ-FND-019 | "8개 내비게이션 항목" 하드코딩 — 프로토타입과 일치 여부 독립 검증 없이 숫자만 제시 | handoff §7.1 라벨 배열 명시(Home, Chat, History, Templates, Knowledge, Updates, Dashboard, Settings) 및 섹션 재확인 |
| AUD-016 | Medium | Testability | REQ-FND-060 | "5개 항목 체크리스트" — 내용·순서·형식 미지정 | DEVELOPMENT.md 템플릿 출력 형식(markdown 체크리스트) 명시 |
| AUD-017 | Medium | Scope Discipline | REQ-FND-054 | `writeAudit` 호출을 `callbacks.signIn` stub에 포함 — audit wiring은 Phase 5로 표기했으나 REQ-FND-049 action enum에 `auth.login` 필수 포함 시 Day-1 wiring 불가피 | Phase 5 vs Day-1 경계 일치: stub = no-op이면 `auth.login` enum은 Phase 5로 이동; Day-1 wiring이면 Out of Scope "감사 wiring Phase 5" 문구 수정 |
| AUD-018 | Medium | Handoff Consistency | REQ-FND-036 | `messages` 컬럼 목록에서 handoff §12의 `tokens_in`, `tokens_out`, `model` 필드 누락 (§16 LLM 감사 요건 간접 영향) | 필드 포함 또는 "Phase 5 감사 확장 시 추가" 명시 |
| AUD-019 | Medium | Non-Obvious Constraint | REQ-FND-056 | 루트 metadata의 `robots: { index: false, follow: false }`만 설정. `/login`에서 override 방법(경로별 metadata export) 미기술 | `/login/page.tsx`의 metadata override 방식 (`robots: { index: true }`) 구체화 |
| AUD-020 | Medium | Edge Case | — | 최소 Postgres 버전 명시 부재 (tech.md는 16, handoff §4도 16, SPEC에는 version pin 없음) | REQ-FND 추가: "The system SHALL require PostgreSQL ≥16 (pgvector 0.7+ 호환)" |
| AUD-021 | Low | Coverage Gap | — | `playwright.config.ts` Deliverable(#27)에 compliance-qa로 할당 — 해당 에이전트가 Phase 6 소관이나 Phase 1 인프라 준비 문구와 role 중첩 | 책임 에이전트를 regula-architect로 재배정 검토 |
| AUD-022 | Low | Documentation | — | 관련 문서 섹션에 handoff 링크 있으나 `.moai/project/*.md` 경로만 상대 표기. CLAUDE.md Non-Obvious Constraints 직접 인용 없음 | 각 Non-Obvious Constraint 7개 항목을 REQ-FND ↔ constraint# 매트릭스로 첨부 (본 감사 §하단 참조) |
| AUD-023 | Low | Testability | REQ-FND-022 | `@theme { ... }` 블록 위치를 `app/globals.css`로 고정 vs Tailwind v4 공식 가이드(별도 `tokens.css` 내부도 허용) | v4 공식 문서와의 정합성 재확인 후 위치 최종 확정 |

---

## Detailed Findings

### AUD-001 [Critical] `source_sections` 테이블 silent drop
**Dimension:** Handoff Consistency / Coverage Gap
**Evidence:**
- `spec.md:L256` "12 Drizzle table definitions: `users`, ..., `audit_logs`"
- `.moai/project/tech.md:L166` 테이블 목록에 `source_sections (id, source_id, anchor, heading, text, embedding vector(1536))` 존재
- handoff README line 704: `source_sections (id, source_id, anchor, heading, text, embedding vector(1536))` — **독립 테이블**
- product.md §9 시나리오 2: "Citation 클릭 → DocViewer 모달 → 관련 단락 하이라이트(amber underline), `#source=N&offset=M` 딥링크" — deep-link anchor는 `source_sections.anchor` 필드 필수

**Issue:** SPEC은 Technical Decision #4에서 `checklist_items` 제거 근거만 기술하고 `source_sections` 제거는 **근거 없이 silent drop**. handoff는 13개 테이블이며 SPEC은 12개만 포함.

**Impact:**
- Phase 2 citation deep-link 구현 시 스키마 migration 추가 불가피 → Phase 1에서 Day-1로 잠그겠다는 SPEC 목적(line 27) 자기 모순.
- 벡터 인덱스가 `sources.embedding` 한 곳만 → 단락 수준 검색(LangChain chunk retrieval) 불가.

**Recommended patch:** REQ-FND-031에 `source_sections` 추가(13 tables), 컬럼 스펙 별도 REQ(예: REQ-FND-031b) 신설, `embedding vector(1536)` 인덱스 REQ(REQ-FND-040과 동일 레벨) 추가.

---

### AUD-002 [Critical] `--font-serif` 스택 순서 역전
**Dimension:** Handoff Consistency
**Evidence:**
- `spec.md:L214` "`--font-serif: 'Noto Serif KR', 'Source Serif 4', Georgia, serif;` (또는 한국어 우선 순서) 확인"
- `spec.md:L212` REQ-FND-023 "The font stack `--font-serif` SHALL list Noto Serif KR 및 Source Serif 4 (한국어 우선)"
- handoff README line 287: `` `--font-serif` | `'Source Serif 4', 'Noto Serif KR', Georgia, serif` ``
- handoff §13.2 line 747–748: "Source Serif 4 (400/500/600 + italic 400/500)", "Noto Serif KR (400/500/600)" — Source Serif 우선 열거
- `.moai/project/tech.md:L192` `--font-serif: 'Source Serif 4', 'Noto Serif KR', Georgia, serif;`

**Issue:** SPEC은 "한국어 우선"이라는 상위 원칙을 글자 그대로 font stack 순서로 옮김. 그러나 handoff §6 토큰 정의는 영문 Source Serif를 먼저 배치. font-family stack은 **존재 시 앞 폰트 우선 적용**이므로 순서 뒤집기는 영문 텍스트에도 Noto Serif KR을 강제하는 브랜드 요건 위반. Non-Obvious Constraint #5 "Serif 강제 적용 위치 — H1, 사용자 질문, 인용 규제 텍스트" 모두 영향.

**Impact:** Brand/typography contrast 훼손. 영문 Source Serif 4의 italic·OpenType 피처 접근 불가. handoff 원문 1:1 매핑 원칙(§6 "Map these 1:1") 위반.

**Recommended patch:** REQ-FND-023 문구를 `` `--font-serif: 'Source Serif 4', 'Noto Serif KR', Georgia, serif` ``로 고정, "한국어 fallback 우선순위 보장" 표현은 `--font-sans`의 Pretendard 배치에 한정.

---

### AUD-003 [Critical] audit_logs 변이 차단이 UPDATE/DELETE만 커버
**Dimension:** Edge Case / Audit Integrity (21 CFR Part 11)
**Evidence:**
- `spec.md:L335` REQ-FND-046 "WHEN 누군가가 `audit_logs` 테이블에 UPDATE 또는 DELETE 구문을 실행하면..."
- `spec.md:L355` 트리거 SQL `BEFORE UPDATE OR DELETE ON audit_logs`
- handoff §16 line: "immutable append-only audit_logs"
- product.md: "불변(immutable) 로그; 수정·삭제 불가"

**Issue:** Postgres `TRUNCATE TABLE audit_logs`는 `BEFORE UPDATE OR DELETE` 트리거를 **우회**한다(전용 `BEFORE TRUNCATE` 이벤트 필요). 또한:
- `ALTER TABLE audit_logs DISABLE TRIGGER ...` 권한을 가진 role의 경우 공격 표면 존재
- Supabase RLS 없이 `service_role`로 임의 변경 가능성
- 트리거 함수 자체 `CREATE OR REPLACE`로 silent 무력화 가능

21 CFR Part 11 §11.10(c)은 "protection of records to enable their accurate and ready retrieval" — TRUNCATE 경로가 남아 있으면 append-only 속성 미충족.

**Impact:** 규제 실사(FDA audit) 시 immutability 증빙 실패. Day-1 제약 자기 모순.

**Recommended patch:**
- 트리거 구문에 `BEFORE TRUNCATE ON audit_logs` 추가 (statement-level)
- `REVOKE TRUNCATE, UPDATE, DELETE ON audit_logs FROM <app_role>` 마이그레이션 추가
- 별도 RLS 정책: "only superuser 또는 migration role만 audit_logs DDL 가능"
- 7년 retention archival 잡의 아카이브 경로도 append-only 동일 제약 적용(Phase 5로 연기 가능하나 본 SPEC에 명시)

---

### AUD-004 [Critical] `tailwind.config.ts` 산출물 부재 / Tailwind v4 설정 명시 공백
**Dimension:** Coverage Gap
**Evidence:**
- `spec.md:L37` In Scope "스캐폴딩 | `package.json`, `next.config.mjs`, `tsconfig.json`, `biome.json`, `drizzle.config.ts`, `postcss.config.mjs`, `.env.example`"
- handoff README line 233 프로젝트 트리: `├── tailwind.config.ts`
- structure.md:L69: `├── tailwind.config.ts`
- `spec.md:L501–530` Deliverables 표 — `tailwind.config.ts` 항목 없음

**Issue:** SPEC은 `postcss.config.mjs`만 포함하고 `tailwind.config.ts`를 언급하지 않음. Tailwind v4는 `@theme` directive로 CSS 내 설정이 가능하나, `content` 경로 매핑·플러그인·다크 모드 strategy는 config 파일이 일반적. 산출물 표에서 완전히 누락되어 Phase 1 완료 판정이 모호.

**Impact:** Tailwind v4 alpha/beta 시점에 `@theme`만으로 production 빌드 성공이 보장되지 않음 — risks 표 항목(위험 "Tailwind v4 alpha/beta")과 충돌.

**Recommended patch:**
- In Scope 표 및 Deliverables에 `tailwind.config.ts` 추가 OR 명시적 사유("Tailwind v4는 config-less 운영") REQ 추가
- REQ-FND 별도 항목으로 "The system SHALL declare Tailwind content glob as `['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}']`" 형태 명시

---

### AUD-005 [Critical] DB 스키마 컬럼 제약(nullable, default, onDelete) 결정론 부재
**Dimension:** Scope / Testability
**Evidence:**
- REQ-FND-032~044: 컬럼명만 나열하고 `nullable` 여부, default 값, FK `onDelete` cascade 정책 미지정
- `spec.md:L281` REQ-FND-036 `confidence_score (numeric, nullable)` 만 nullable 언급
- `spec.md:L316` REQ-FND-043 `assigned_to (FK → users, nullable)` 만 FK+nullable 명시

**Issue:** Drizzle 스키마 정의에서 NOT NULL vs nullable, unique index, FK `onDelete: 'cascade'|'set null'|'restrict'` 결정이 없으면 **에이전트가 임의로 결정** → 재현 불가. 예: `messages.conversation_id` FK가 `onDelete: 'cascade'`면 대화 삭제 시 messages도 제거. audit_logs에는 절대 cascade 금지.

**Impact:** Phase 2 backend 구현 시 스키마 변경 마이그레이션 재발. 감사 로그 의도치 않은 cascade 제거 가능성(규제 위험).

**Recommended patch:** 각 REQ-FND-03X에 컬럼 제약 표 첨부(예: `| column | type | nullable | default | fk_onDelete |`). 최소한 `audit_logs.actor_id`는 `ON DELETE SET NULL` 명시.

---

### AUD-006 [High] REQ-FND-027 Event-driven 패턴 오용
**Dimension:** EARS Pattern Compliance
**Evidence:**
- `spec.md:L232` "WHEN `document.documentElement.setAttribute('data-theme', 'dark')` 가 실행되면, the system SHALL override brand, neutral, surface 색상 토큰을 다크 모드 값으로 적용해야 한다."
- 검증 방법은 "CSS 오버라이드 블록 존재 확인"만으로 기술

**Issue:** EARS Event-driven은 "외부 이벤트 발생 시 시스템이 응답하는" 명세이나, 현 REQ는 **CSS cascade의 정적 특성**을 기술. 런타임 토글 구현은 Phase 5로 연기됐음(line 234). 즉 "실행 시 적용"은 사실상 "CSS 변수 오버라이드 블록이 선언되어 있음"과 동치 → Ubiquitous 패턴이 정확.

**Impact:** 감사 시 "다크 모드 런타임 토글 미구현 = REQ 미충족" 오판 위험. 테스트 방식과 EARS 형식 불일치.

**Recommended patch:**
> "The system SHALL define `[data-theme="dark"]` CSS block in `styles/tokens.css` overriding brand/neutral/surface tokens. (런타임 토글 동작은 Phase 5로 연기.)" — Ubiquitous 재분류.

---

### AUD-007 [High] REQ-FND-030 Unwanted 패턴이 사람 행동을 트리거로 사용
**Dimension:** EARS Pattern Compliance / Testability
**Evidence:**
- `spec.md:L247` "IF a developer attempts to hardcode brand hex values (예: `#0f1e3a`) directly in component JSX/TSX, THEN the system SHALL flag the usage via Biome lint rule (또는 CI grep 경고)."

**Issue:** EARS Unwanted 패턴의 trigger는 **시스템 상태/이벤트**이어야 테스트 가능. "developer attempts to..."는 의도·행위 수준으로, **코드가 hex 리터럴을 포함함** 과 혼동됨. 또한 "Biome lint rule **또는** CI grep" 대안이 열림 — 결정론 부재.

**Impact:** 검증 스크립트 작성 시 "developer 의도"를 감지 불가, 실제 체크는 리터럴 grep만 가능.

**Recommended patch:**
> (Conditional) "IF any `.tsx` or `.ts` file under `components/` or `app/` contains a brand hex literal (regex `#[0-9a-f]{3,6}` 일치 중 brand 팔레트 값), THEN CI step `pnpm lint:no-hex` SHALL fail."
- Biome 규칙 OR CI grep 중 **하나로 확정**.

---

### AUD-008 [High] REQ-FND-015 금지 메타태그 화이트리스트 모호
**Dimension:** Testability
**Evidence:**
- `spec.md:L168` "THEN the system SHALL NOT emit any marketing SEO tags (`og:*`, `twitter:*`, `description` 외 인덱싱 유도 메타)"

**Issue:** "description 외 인덱싱 유도 메타" 표현이 모호. `description` 은 허용인지 금지인지 구문적으로 양의. 실제 금지 목록이 불완전하면 감사 실패.

**Recommended patch:** 금지 태그 명시 화이트리스트:
- 금지: `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`, `<link rel="canonical">`
- 허용: `<title>`, `<meta name="viewport">`, `<meta name="robots">`, `<meta charset>`

---

### AUD-009 [High] auth-wall middleware public path 정의 부재
**Dimension:** Edge Case
**Evidence:**
- `spec.md:L389–391` REQ-FND-053 "WHILE a user is unauthenticated, the system SHALL redirect 요청을 `/login` 페이지로 (모든 `(app)` route group 경로 대상)"
- 검증 방법: "미인증 fetch 시 302 → `/login` 확인"

**Issue:** Next.js middleware는 URL path matcher로 동작하며 route group `(app)`은 path-level에서 투명. 실제 middleware가 제외해야 할 public path:
- `/login`, `/sso/callback` (auth routes)
- `/api/auth/*` (NextAuth handlers, self-referential)
- `/_next/*`, `/favicon.ico`, `/robots.txt`, `/public/*`

**Impact:** 잘못된 matcher 설정 시 `/api/auth/callback/azure-ad` 자체가 `/login`으로 리다이렉트 → SSO 로그인 불가(무한 루프).

**Recommended patch:** REQ-FND-053에 matcher 명시(예: `matcher: ['/((?!login|sso|api/auth|_next|favicon.ico|robots.txt).*)']`) 및 `/login`에서 이미 인증된 사용자는 `/`로 리다이렉트하는 조건 추가.

---

### AUD-010 [High] 환경변수 fail-fast 검증 REQ 부재
**Dimension:** Edge Case
**Evidence:**
- `spec.md:L124` REQ-FND-007 "환경 변수를 빈 값으로 포함" (존재만 보장)
- REQ-FND-058: `drizzle(postgres(process.env.DATABASE_URL!))` — `!` non-null assertion만으로 런타임 보호

**Issue:** `.env` 미설정 상태에서 `pnpm dev` 실행 시 런타임에서 Postgres 연결 실패로 cryptic error 노출. 더 나쁘게는 NextAuth가 `NEXTAUTH_SECRET` 기본값으로 동작. 개발자 DX + 보안 양면에서 Day-1 검증 필요.

**Recommended patch:** REQ-FND 추가 — "The system SHALL validate required env vars at module-load time via `zod.parse(process.env)` in `lib/env.ts`; missing keys SHALL throw with a human-readable message."

---

### AUD-011 [High] pgvector 확장 precondition 미정의
**Dimension:** Edge Case
**Evidence:**
- `spec.md:L297` REQ-FND-039 `embedding vector(1536)` (pgvector 확장 컬럼)
- `spec.md:L460` risks 표에 "pgvector가 Supabase free tier 일부 리전에서 미지원" 기재
- REQ-FND-059 "drizzle-kit push 시 12 tables 및 pgvector 확장, audit_logs 트리거 적용"

**Issue:** pgvector 미설치 DB에서 `CREATE EXTENSION vector` 권한이 없으면 migration이 **중간 실패** → 스키마 절반만 적용된 상태로 DB 오염. 복구 경로 미정의.

**Recommended patch:**
- REQ 추가: "The migration `0000_init.sql` SHALL begin with `CREATE EXTENSION IF NOT EXISTS vector;` and abort transactionally if extension privilege is missing."
- `DEVELOPMENT.md`에 "Supabase/Neon 에서 pgvector 사전 활성화 절차" 섹션 필수.

---

### AUD-012 [High] `users.locale`, `users.theme_pref` 타입 결정론 부재
**Dimension:** Handoff Consistency
**Evidence:**
- `spec.md:L261` REQ-FND-032 `locale` (`ko`|`en`), `theme_pref` (`light`|`dark`|`system`) — 괄호 표기만 있고 Drizzle pgEnum / text + CHECK constraint 선택 미지정
- handoff §12는 타입 미명시

**Issue:** pgEnum은 마이그레이션 비용 높음(추가 시 `ALTER TYPE`), text+check는 유연. Phase 5 i18n 런타임 스위처에서 locale 확장 필요 시 선택 영향.

**Recommended patch:** Drizzle `pgEnum` vs text 선택을 명시. research.md 해석 1(`confidence_level` pgEnum)과 정책 일관성 유지.

---

### AUD-013 [High] LangChain.js 결정 선행이 Phase 1 산출물과 무관
**Dimension:** Decision Soundness
**Evidence:**
- Technical Decision #3: "LangChain.js 선택"
- Out of Scope line 68: "LLM orchestration(LangChain.js) 코드 | Phase 2 | 선택만 본 SPEC에서 확정"
- Phase 1 REQ-FND 어느 곳도 LangChain.js 의존성 추가를 요구하지 않음

**Issue:** Phase 1에서 **코드·의존성 설치 없음** → 결정만 문서에 박제. Phase 2 착수 시 최신 호환성 재평가가 필요하므로 현 시점에 잠그는 이익 < 제약. falsifiable 조건(LangChain v0.3+ breaking change)은 Phase 2 시점 판단이어야 함.

**Recommended patch:** Technical Decision #3을 "Phase 1 범위 외 — Phase 2 착수 시 `regula-architect`가 최종 결정"으로 변경, 또는 결정 유지 시 `package.json`에 `langchain` 의존성을 Phase 1에서 추가(역시 단점 존재).

---

### AUD-014 [Medium] middleware vs server-side session check 비결정
**Dimension:** Coverage Gap
**Evidence:**
- REQ-FND-053 "middleware.ts (또는 `app/(app)/layout.tsx` server-side check)"
- Deliverables 표 line 524 `middleware.ts (auth-wall)` — middleware 전제
- research.md 해석 6: "권장: middleware.ts"

**Issue:** REQ는 OR 선택지, 산출물 표는 middleware 강제. 에이전트가 혼란.

**Recommended patch:** REQ-FND-053을 "SHALL implement via Next.js `middleware.ts`"로 단일화. Layout-side check는 금지 혹은 보조 수단만 허용.

---

### AUD-015 [Medium] Sidebar 내비게이션 항목 라벨 목록 결정론
**Dimension:** Testability
**Evidence:** `spec.md:L188` "(Home, Chat, History, Templates, Knowledge, Updates, Dashboard, Settings)" 8개 나열

**Issue:** 한국어·영어 라벨 기본값 미지정. i18n은 Phase 5이지만 Phase 1 정적 UI 렌더링 시 어느 언어? Handoff 프로토타입은 한국어 UI. 현 REQ는 영어 라벨만 나열.

**Recommended patch:** REQ-FND-019에 한국어 라벨 기본값 추가(예: "홈, 새 상담, 히스토리, 템플릿, 지식 베이스, 규제 업데이트, 대시보드, 설정") + `<html lang="ko">` 일치.

---

### AUD-016 [Medium] DEVELOPMENT.md 체크리스트 형식 미지정
**Dimension:** Testability
**Evidence:** `spec.md:L430` "5개 항목 체크리스트 포함 확인"

**Issue:** 5개 항목이 정확히 무엇인지 문자열 매칭? 순서 고정? 형식 결정 부재.

**Recommended patch:** 검증 문자열 목록을 REQ에 명시, Markdown 체크박스 `- [ ]` 형식으로 고정.

---

### AUD-017 [Medium] Phase 1 audit_logs wiring 경계 모순
**Dimension:** Scope Discipline
**Evidence:**
- REQ-FND-054 "callbacks.signIn 내 `writeAudit({ action: 'auth.login', ... })` 호출"
- Out of Scope line 59: "Expert review 워크플로우 API 및 UI | Phase 5"
- REQ-FND-049 `auth.login` action enum 포함

**Issue:** signIn callback에 실제 writeAudit 호출이 Day-1이면 그 자체가 Phase 1 audit wiring. 그런데 "상세 audit wiring은 Phase 5"(line 394) 문구와 충돌. Phase 5로 연기된다면 REQ-FND-054 stub은 no-op 주석 수준이어야 하며, 실제 INSERT은 Phase 5.

**Recommended patch:** 문구 명확화 — "Phase 1: `writeAudit` import 및 호출 구조만 wiring, 실제 DB INSERT 검증은 Phase 5 통합 테스트에서" 또는 Day-1 wiring으로 일원화.

---

### AUD-018 [Medium] `messages` 테이블 LLM 감사 필드 누락
**Dimension:** Handoff Consistency
**Evidence:** REQ-FND-036 컬럼 목록에 `tokens_in`, `tokens_out`, `model`, `cost_usd` 등 LLM 호출 감사에 필요한 필드 부재

**Issue:** handoff §16 "every LLM call → audit_logs" 는 `audit_logs.meta_json`으로 수용 가능하나, messages 테이블에도 cost/token이 있어야 Dashboard(§7.9 Recharts) 집계 가능. Phase 4 breadth에서 ALTER 필요.

**Recommended patch:** `messages.tokens_in`, `tokens_out`, `model` 3개 추가(default NULL, Phase 2에서 채움). Phase 1 stub 스키마도 확보.

---

### AUD-019 [Medium] `/login` robots override 구현 세부 누락
**Dimension:** Non-Obvious Constraint Realization
**Evidence:** REQ-FND-056 "전역 기본값, `/login`만 예외 override"

**Issue:** Next.js App Router에서 하위 route가 root metadata를 override하려면 `export const metadata`를 명시적으로 재선언해야 함. REQ 본문에는 전역 기본값만 기술, `/login/page.tsx`의 override 코드 패턴 미지정.

**Recommended patch:** REQ-FND-018에 "`login/page.tsx` SHALL export metadata with `robots: { index: true, follow: true }` overriding the root default" 추가.

---

### AUD-020 [Medium] 최소 Postgres 버전 REQ 부재
**Dimension:** Edge Case
**Evidence:** tech.md "PostgreSQL 16"; SPEC에는 버전 pin 없음.

**Issue:** pgvector 0.7+ 호환성, `gen_random_uuid()`, `generated always as identity` 등 버전 의존 기능 다수. 버전 명시 없으면 Supabase tier간 차이 발생.

**Recommended patch:** REQ 추가 — "The system SHALL require PostgreSQL 16 or higher with pgvector 0.7+"

---

### AUD-021 [Low] Deliverable 책임 에이전트 재검토
**Dimension:** Coverage Gap
**Evidence:** `spec.md:L529` "`playwright.config.ts` (인프라만) | regula-compliance-qa"

**Issue:** compliance-qa는 감사·검증 성격이며 config 생성은 architect 성격에 가까움. Phase 1은 인프라만 준비, Phase 6 실제 테스트 작성 시 compliance-qa 참여.

**Recommended patch:** `regula-architect`로 재할당, compliance-qa는 감사만.

---

### AUD-022 [Low] Non-Obvious Constraints 7개 ↔ REQ-FND 매트릭스 미수록
**Dimension:** Documentation
**Evidence:** "관련 문서" 섹션 line 576에 "7개 제약" 언급만.

**Recommended patch:** 본 감사 §Non-Obvious Constraint Realization 매트릭스를 spec.md에 흡수.

---

### AUD-023 [Low] Tailwind v4 `@theme` 위치 선택
**Dimension:** Testability
**Evidence:** REQ-FND-022 `@theme` 블록을 `app/globals.css`에 위치시키라 명시. 그러나 tech.md line 186은 `tokens.css`에 `@theme` 블록을 두는 예시.

**Recommended patch:** 공식 문서 기준으로 `app/globals.css` 또는 `styles/tokens.css` 중 하나로 확정.

---

## Coverage Matrix — Regula skill Phase 1 deliverables vs REQ-FND

| Target File (SKILL.md Phase 1) | Covering REQ-FND | Status |
|---|---|---|
| `package.json` | REQ-FND-001~005, 008, 025 | Covered |
| `next.config.mjs` | REQ-FND-006 | Covered |
| `tsconfig.json` | REQ-FND-006, 009 | Covered |
| `biome.json` | REQ-FND-006, 030 | Covered |
| `drizzle.config.ts` | REQ-FND-006, 059 | Covered |
| **`tailwind.config.ts`** | **— (AUD-004)** | **MISSING** |
| `postcss.config.mjs` | REQ-FND-006 | Covered |
| `.env.example` | REQ-FND-007 | Covered (but no env validation — AUD-010) |
| `app/layout.tsx` | REQ-FND-011, 012, 026, 056 | Covered |
| `app/(app)/layout.tsx` | REQ-FND-013, 014, 015 | Covered |
| `app/(app)/page.tsx` (Home) | REQ-FND-016 | Covered (empty) |
| `app/(app)/chat/page.tsx` (empty) | REQ-FND-017 | Covered |
| `app/(auth)/login/page.tsx` | REQ-FND-018 | Covered (missing robots override — AUD-019) |
| `components/shell/Sidebar.tsx` | REQ-FND-019 | Covered (label spec weak — AUD-015) |
| `components/shell/Topbar.tsx` | REQ-FND-020 | Covered |
| `styles/tokens.css` | REQ-FND-021, 023, 024, 027, 028 | Covered (font order wrong — AUD-002) |
| `app/globals.css` | REQ-FND-022, 029 | Covered |
| `lib/db/schema.ts` (12 tables) | REQ-FND-031~044 | **Under-covered** (13 tables per handoff — AUD-001) |
| `lib/db/client.ts` | REQ-FND-058 | Covered |
| `lib/auth.ts` | REQ-FND-051, 052, 054 | Covered |
| `lib/audit.ts` | REQ-FND-048, 049, 050 | Covered |
| `migrations/` | REQ-FND-045, 047, 059 | Covered (TRUNCATE gap — AUD-003; pgvector precondition — AUD-011) |
| `middleware.ts` | REQ-FND-053 | Covered (public path matcher — AUD-009) |
| `app/api/auth/[...nextauth]/route.ts` | REQ-FND-055 | Covered |
| `public/robots.txt` | REQ-FND-057 | Covered |
| `DEVELOPMENT.md` | REQ-FND-060 | Covered (format unclear — AUD-016) |
| `playwright.config.ts` | Deliverable #27 | No explicit REQ-FND — orphan |

---

## EARS Pattern Compliance Matrix

| Pattern | Count | % | Notes |
|---|---|---|---|
| Ubiquitous | 51 | 85% | 정상 |
| Event-driven | 2 (027, 046 partial) | 3% | REQ-FND-027 오분류(AUD-006); REQ-FND-046은 hybrid로 표기 |
| State-driven | 1 (053) | 2% | 정상 |
| Conditional | 4 (008, 009, 010, 059) | 7% | 정상 |
| Unwanted | 3 (015, 030, 046) | 5% | REQ-FND-030 trigger 오용(AUD-007) |

- 60/60 REQ가 SHALL 명시 — MP-1 REQ 번호 순차성 PASS (001~060 gap·duplicate 없음)
- MP-2 EARS 형식 준수: 부분 FAIL (AUD-006, AUD-007)
- Informal language 잔존 위치: REQ-FND-048 "must insert..." 없음 확인, 나머지 Ubiquitous는 SHALL 준수

---

## Non-Obvious Constraint Realization

| # | Constraint (CLAUDE.md) | Phase 1 Prep REQ | 상태 |
|---|---|---|---|
| 1 | Citation inline `<sup>` 강제 | REQ-FND-037 (`cite_index NOT NULL`) | 부분 — 스키마만 확보 (enforcement Phase 2) |
| 2 | SSE 다단계 스트리밍 | — | N/A Phase 1, OK |
| 3 | Expert-review 자동 게이팅 | REQ-FND-043 (`expert_reviews` 테이블), REQ-FND-036 (`expert_review_required` 컬럼) | 부분 — 스키마만 |
| 4 | 21 CFR Part 11 감사 | REQ-FND-044~050 (append-only trigger + 7년 retention 주석) | **부분 — TRUNCATE/role bypass 커버 부족 (AUD-003)** |
| 5 | Serif/Sans 타이포그래피 | REQ-FND-023, 024, 026 | **역전 (AUD-002)** |
| 6 | ko/en first-class | REQ-FND-012 (`<html lang="ko">`), REQ-FND-032 (`locale` 컬럼) | 부분 — 폰트 순서 이슈(AUD-002) + locale enum 미결정(AUD-012) |
| 7 | noindex 전역 | REQ-FND-014, 056, 057 | 부분 — `/login` override 코드 패턴 미지정(AUD-019) |

5개 Constraint 중 3개에서 gap 확인. **규제·브랜드 Day-1 가드 완전 미충족 상태.**

---

## Handoff Divergence Log

| # | SPEC 기술 | handoff 원문 | 문서화 여부 | AUD 연결 |
|---|---|---|---|---|
| D-1 | 12 tables | 13 tables (`source_sections` 포함) | **No** | AUD-001 |
| D-2 | `--font-serif: 'Noto Serif KR', 'Source Serif 4', Georgia` | `'Source Serif 4', 'Noto Serif KR', Georgia, serif` | **No** | AUD-002 |
| D-3 | `message_blocks` 통합(checklist_items 제거) | 별도 `checklist_items` 테이블 | **Yes (Decision #4)** | OK |
| D-4 | `postcss.config.mjs`만 포함 | `tailwind.config.ts` 트리에 명시 | **No** | AUD-004 |
| D-5 | `pgvector` 선택 | "Pinecone OR pgvector" 열거 | **Yes (Decision #1)** | OK |
| D-6 | Auth.js `session.strategy = 'database'` | idle 30분만 명시, 전략 미결정 | **Yes (research.md 해석 3)** | OK |
| D-7 | SSO: Microsoft Entra ID + Google | handoff §4 "Microsoft/Google" (구체 provider 이름 없음) | **No (해석)** | 참고만 |
| D-8 | `message_blocks.order_index` 추가 | handoff sketch에는 없음 | **Yes (research.md 해석 2)** | OK |

---

## Chain-of-Verification Pass

**2차 점검 결과:**

- 60개 REQ-FND 번호 순차성 재확인: 001~060 gap·duplicate 없음 — MP-1 PASS
- SHALL 키워드 누락 점검: 60개 전부 SHALL 사용 — OK
- handoff §12 line 696–708 13개 테이블 vs SPEC 12개 재대조 → `source_sections` 확정 누락(AUD-001 1차 포착 재확인)
- handoff line 287 font token 원문 재인용 → SPEC REQ-FND-023의 순서 뒤집기 확정(AUD-002)
- Exclusions(line 47~68) 재정독: Phase별 귀속 근거 구체적 — 적절
- CLAUDE.md Non-Obvious Constraints 7개 전체 매핑 완수(§Non-Obvious Constraint Realization)
- Dependencies/Risks 모순 점검: Risks 표에 `pgvector` 위험 기재하나 precondition REQ 부재 — AUD-011 확정
- 2차 패스에서 **새롭게 발견된 결함 없음**. 1차 감사에서 포착한 23개 모두 확증.

---

## Regression Check (Iteration 2+ only)

N/A (iteration 1, 최초 감사).

---

## Recommendation

**현 상태에서 Phase 1 착수는 권장하지 않음.** `REQUIRES_SIGNIFICANT_REWORK`.

### manager-spec에 대한 actionable 수정 지시

**Critical(5개) — 반드시 수정:**
1. **AUD-001:** REQ-FND-031 기존 12 tables → **13 tables**(`source_sections` 포함)로 수정. 별도 REQ-FND로 `source_sections (id, source_id, anchor, heading, text, embedding vector(1536))` 컬럼·FK 명시 + embedding 인덱스 REQ 추가. Technical Decision #4 영역에 "`checklist_items`만 제거, `source_sections`는 유지" 명시.
2. **AUD-002:** REQ-FND-023 본문과 검증 방법을 `` `--font-serif: 'Source Serif 4', 'Noto Serif KR', Georgia, serif` ``로 수정. "한국어 우선" 표현 삭제, Pretendard의 `--font-sans` 배치만 ko-friendly 부분으로 재진술.
3. **AUD-003:** REQ-FND-046/047을 확장 — `BEFORE TRUNCATE ON audit_logs` 트리거 추가, `REVOKE TRUNCATE, UPDATE, DELETE` 마이그레이션 추가, 트리거 함수 `CREATE OR REPLACE` 금지 DDL 정책 명시, REQ-FND-048 `writeAudit`에 대응되는 `DROP TRIGGER` 불가 sentinel 테스트 추가.
4. **AUD-004:** In Scope 스캐폴딩 행에 `tailwind.config.ts` 추가 OR 명시적 "config-less 운영" 결정 추가. Deliverables 표 동기화.
5. **AUD-005:** REQ-FND-032~044 각 항목에 컬럼 제약 표(nullable / default / FK onDelete) 추가. 최소 audit_logs.actor_id FK는 `ON DELETE SET NULL`, conversation_id는 RESTRICT로 고정.

**High(8개) — 수정 강력 권장:** AUD-006 EARS 재분류, AUD-007 Conditional 재작성, AUD-008 금지 태그 화이트리스트, AUD-009 middleware matcher, AUD-010 env zod 검증, AUD-011 pgvector precondition, AUD-012 enum 결정, AUD-013 LangChain 결정 이동.

**Medium(7) / Low(3):** 주요 Critical/High 수정과 함께 일괄 반영.

### 재감사 조건

- 모든 Critical 5개 + 핵심 High(AUD-006, 007, 009, 010, 011) 해결 후 iteration 2 audit 재실행
- 재감사 시 본 audit-001.md의 각 AUD ID별 resolution status를 `audit-002.md` Regression Check에 기록
- iteration 3까지 Critical 미해결 시 escalation → 사용자에게 SPEC 재설계 여부 확인
