# Tasks — SPEC-V3-RESTRUCTURE-001 (v1.1.0 kernel-only 재스코프)

> v3 구조 정리 (Phase B: kernel 추출 + schema.ts 분할 — Phase A #530 완료)
> 재개 계획: `docs/proposals/v3-abe-resumption-plan-2026-07-19.md` §3

---

## 사전 검증 (Pre-flight Checks)

- [ ] **T0.1** 기준 회귀 테스트 확보: `pnpm test` 실행 → **5450 passed, 0 failed, 68 skipped** (5518 total, exit 0, 59.7s — live run 2026-07-21 baseline)
- [ ] **T0.2** 기준 FK 수 확보: `grep -h REFERENCES migrations/*.sql | wc -l` → **274개** 기록 (schema 분할 전후 비교용). migration count: `ls migrations/*.sql | wc -l` → **125** (불변 확인용)
- [ ] **T0.3** Phase A 아카이브 상태 확인: `ls archive/qms-pms/lib/` → **8도메인**(change-control, clinical-investigation, cyberdevice, dhf, esubmit, labeling, samd, workflows); `.archive-manifest.json` domain_count=8, total_files=148
- [ ] **T0.4** 작업 브랜치 생성: `git checkout -b feat/v3-restructure-001`

---

## Phase A — 완료 (#530/PR #534)

> Phase A 완료(#530/PR #534) — 8도메인 아카이브 + `.archive-manifest.json` 생성 + 회귀 green(5450 passed). 본 tasks.md에서 Phase A 태스크 제거(kernel-only 재스코프 v1.1.0). 잔여 도메인(rlhf, knowledge-gap, risk, traceability, pccp, knowledge-promo, model-governance, standards, project-memory, corpus-license)은 #519 KEEP 재분류 — 본 SPEC 범위 밖.

---

## Phase B — Kernel 추출 + schema.ts 분할

### Sub-Phase B1: lib/kernel/ 디렉토리 생성 + 공유 인프라 이동 (Priority High)

- [ ] **T8.1** `mkdir -p lib/kernel/{db,auth,audit,ratelimit,storage,schemas}`
- [ ] **T8.2** `lib/db/` → `lib/kernel/db/`로 git mv (schema.ts, schema-docingest.ts, client.ts, migrations/ 포함)
- [ ] **T8.3** `lib/auth/` → `lib/kernel/auth/`로 git mv (**181 파일 참조** — 직검 2026-07-21)
- [ ] **T8.4** `lib/audit/` → `lib/kernel/audit/`로 git mv (**119 파일 참조** — 직검 2026-07-21)
- [ ] **T8.5** `lib/ratelimit/` → `lib/kernel/ratelimit/`로 git mv (직접 import 0건 — kernel re-export만 유지)
- [ ] **T8.6** `lib/storage/` → `lib/kernel/storage/`로 git mv (직접 import 0건 — kernel re-export만 유지)
- [ ] **T8.7** `lib/schemas/` → `lib/kernel/schemas/`로 git mv (**4 파일 참조** — Zod 공유, codemod 대상)
- [ ] **T8.8** commit: `refactor(kernel): B1 공유 인프라 6모듈 → lib/kernel/ 이동`

### Sub-Phase B2: schema-kernel.ts 발췌 (Priority High)

> **kernel 테이블 직검 식별 (2026-07-21)**: `users`(L668), `auditLogs`(L1285, table `audit_logs`), `sessions`(L1537). `verificationTokens`(L1567)은 kernel 후보. 원 v1.0.0 추정치 "users, audit_log, audit_verify_history, sessions (~5)" 중 `audit_verify_history`는 **존재하지 않음**(정정). 최종 확정 집합은 사전 grep으로 확인.

- [ ] **T9.1** schema.ts에서 kernel 테이블 식별 (사전 grep): `grep -nE "^export const (users|auditLogs|sessions|verificationTokens)" lib/db/schema.ts` → 직검 identity + 최종 수 확정 (명목 3-4: users, auditLogs, sessions, + verificationTokens 후보)
- [ ] **T9.2** `lib/kernel/db/schema-kernel.ts` 신규 파일 생성, kernel 테이블 정의 이동
- [ ] **T9.3** FK references 처리: 다른 도메인 테이블이 kernel 테이블을 참조할 때 `import { users } from '@/lib/kernel/db/schema-kernel'` 사용 (Drizzle 다중 파일 패턴)
- [ ] **T9.4** schema.ts에서 kernel 테이블 정의 제거 후 schema-kernel.ts에서 import (또는 re-export)
- [ ] **T9.5** **즉시 검증**: `pnpm drizzle-kit check` → **FK 274개** 보존 확인 (T0.2 baseline 대비)
- [ ] **T9.6** 실패 시 롤백: kernel 테이블을 schema.ts에 잔류시키고 import만 분리 (점진적)
- [ ] **T9.7** commit: `refactor(schema): B2 kernel 테이블 발췌 → schema-kernel.ts 분할 (FK 274 보존)`

### Sub-Phase B3: drizzle.config.ts glob 확장 — 신규 전환 (Priority Medium)

> **정정 (2026-07-21 직검)**: 현재 `drizzle.config.ts` L20은 `schema: './lib/db/schema.ts'` **단일 파일**. `schema-docingest.ts`는 **미배선** — 원 v1.0.0 "선례 검증됨"은 거짓. B3는 array로 **신규 전환**한다.

- [ ] **T10.1** `drizzle.config.ts`의 `schema` 필드를 단일 문자열 → 배열로 변경:
  ```typescript
  schema: [
    './lib/kernel/db/schema-kernel.ts',
    './lib/db/schema.ts',
    './lib/db/schema-docingest.ts',
  ],
  ```
- [ ] **T10.2** `pnpm drizzle-kit generate --dry` 실행 → **무의도 diff 0 확인** (schema-docingest.ts 편입이 신규 migration을 유발하지 않는지 검증; 유발 시 편입 범위 조정)
- [ ] **T10.3** `pnpm drizzle-kit check` → **FK 274개** 불변 확인
- [ ] **T10.4** commit: `refactor(drizzle): B3 config glob 확장 (신규 전환) — kernel + legacy + docingest`

### Sub-Phase B4: lib/kernel/index.ts 공개 API (Priority Medium)

- [ ] **T11.1** `lib/kernel/index.ts` 작성 (REQ-V3R-012 re-export):
  ```typescript
  export { db, withTenantScope } from './db/client';
  export { getSession, requireRole, withPermission } from './auth';
  export { writeAudit, verifyHashChain } from './audit';
  export { rateLimit } from './ratelimit';
  export { uploadAsset } from './storage';
  ```
- [ ] **T11.2** 새 추상층 도입 금지 검증: kernel은 re-export만, 의존성 역전 인터페이스/클래스 주입 금지 (TRUST 5 Readable — REQ-V3R-004)
- [ ] **T11.3** commit: `feat(kernel): B4 lib/kernel/index.ts 공개 API (re-export thin wrapper)`

### Sub-Phase B5: codemod import 경로 일괄 변경 (Priority High)

> **직검 (2026-07-21)**: union **289 파일**(db 174 · auth 181 · audit 119 · schemas 4, overlap deduped). 동적 import **55건**. ratelimit/storage는 직접 import 0건 → codemod 비대상(kernel re-export만 유지).

- [ ] **T12.1** codemod 스크립트 작성 (대상 4 경로): `@/lib/db` → `@/lib/kernel/db`, `@/lib/auth` → `@/lib/kernel/auth`, `@/lib/audit` → `@/lib/kernel/audit`, `@/lib/schemas` → `@/lib/kernel/schemas`
- [ ] **T12.2** 스크립트 실행: lib/, app/, components/ 내 **289 파일**(union, 동적 import 55건 포함) 일괄 변경
- [ ] **T12.3** **누락 0 검증 (L-014: 정적 + 동적 + 배럴 re-export)**:
  - 정적: `grep -rlE "@/lib/(db|auth|audit|schemas)([/'\"]|$)" lib/ app/ components/ | grep -v '/archive/'` → kernel 미경유 파일 0건
  - 동적: `grep -rnE "import\(['\"]@/lib/(db|auth|audit|schemas)" lib/ app/` → 동적 import 잔존 0건
  - 배럴: `lib/index.ts`류 재export 경로 갱신 확인 (`@/lib/db`, `@/lib/auth`, `@/lib/audit`, `@/lib/schemas` export가 `@/lib/kernel/*`을 가리키도록)
- [ ] **T12.4** `pnpm typecheck` → 0 에러
- [ ] **T12.5** `pnpm lint` → 0 에러 (lint:hex full, L-008)
- [ ] **T12.6** `pnpm test` → **5450+ passed** (baseline 대비 failure 0)
- [ ] **T12.7** AC-09 검증 통과
- [ ] **T12.8** commit: `refactor(codemod): B5 289 파일(동적 import 포함) import 경로 @/lib/kernel/* 일괄 변경`

### Sub-Phase B6: 순환 의존성 검증 (Priority High)

- [ ] **T13.1** AC-03 검증: `grep -rn "from.*@/lib/domains" lib/kernel/` → 결과 0건 (kernel이 domains를 import 금지)
- [ ] **T13.2** kernel↔domain 순환 의존성 0건 확인 (dependency-cruiser 또는 grep)
- [ ] **T13.3** `next dev` 구동 후 주요 페이지(/, /admin, /ra) 로드 → 500 에러 0건 (L-012: build 금지)
- [ ] **T13.4** AC-10 검증 통과
- [ ] **T13.5** commit: `test(kernel): B6 순환 의존성 0건 + next dev 페이지 로드 검증`

### Sub-Phase B7: schema @deprecated 보완 (Priority Medium)

> **AC-07 보완**: Phase A #530에서 `@deprecated` 주석 미적용(grep `@deprecated` in schema.ts = 0). 본 Phase B에서 8도메인 아카이브 테이블에 보완 추가.

- [ ] **T14.1** schema.ts에서 아카이브 8도메인 테이블 식별 (change-control, clinical-investigation, cyberdevice, dhf, esubmit, labeling, samd, workflows 분)
- [ ] **T14.2** 각 테이블 정의上方에 `/** @deprecated 아카이브됨 — archive/qms-pms/ 참조, Phase A #530 */` 주석 추가
- [ ] **T14.3** 검증: `grep -c "@deprecated.*Phase A #530\|@deprecated.*SPEC-V3-RESTRUCTURE" lib/db/schema.ts` → 아카이브 도메인 테이블 수와 일치
- [ ] **T14.4** 회귀 게이트: `pnpm typecheck` (주석만이므로 영향 0)
- [ ] **T14.5** commit: `chore(schema): B7 아카이브 8도메인 테이블 @deprecated 주석 보완 (Phase A #530 누락 보완)`

---

## Phase B 최종 게이트 (Priority High)

- [ ] **T15.1** AC-03 (kernel 순환 의존성 0), AC-04 (drizzle-kit check **FK 274** 보존), AC-05 (migration **125** 불변), AC-07 (@deprecated 8도메인 분 보완), AC-09 (codemod 누락 0 — 정적+동적+배럴), AC-10 (next dev 500 없음), AC-11 (kernel/index.ts re-export) 전부 통과
- [ ] **T15.2** `pnpm typecheck && pnpm lint && pnpm test` 전체 green (**5450+ passed**)
- [ ] **T15.3** 실DB 스키마 일관성 검증: `psql regula_test -c "\dt"` → 테이블 수 불변, `\d users` → kernel 테이블 정상 (L-013)
- [ ] **T15.4** commit: `chore(kernel): Phase B 완료 — kernel 추출 + schema 분할 + codemod`

---

## 사후 검증 (Post-flight Checks)

- [ ] **T16.1** archive/qms-pms/lib/ **8도메인**(Phase A #530 완료 상태) 유지 확인 — 재이동 없음
- [ ] **T16.2** lib/kernel/ 6모듈(db/auth/audit/ratelimit/storage/schemas) 존재 확인
- [ ] **T16.3** schema-kernel.ts 존재 + kernel 테이블(users, auditLogs, sessions, + verificationTokens) 포함 확인
- [ ] **T16.4** drizzle.config.ts glob에 3 파일(schema-kernel, schema, schema-docingest) array 포함 확인 (신규 배선)
- [ ] **T16.5** .archive-manifest.json 8도메인 엔트리 유지 확인 (domain_count=8, total_files=148)
- [ ] **T16.6** 전체 AC-01 ~ AC-11 검증 통과 (AC-02, AC-08은 N/A — Phase A 완료/KEEP 재분류)
- [ ] **T16.7** `git log --oneline` → Phase B(7 commits: B1~B7 + 최종 게이트) 순서 확인
- [ ] **T16.8** PR 생성: `feat(v3): SPEC-V3-RESTRUCTURE-001 — Phase B kernel 추출 완료 (#531)`

---

## 회귀 위험 완화 체크리스트

| 위험 | 완화 조치 | 검증 시점 |
|---|---|---|
| schema.ts 분할 시 **FK 274개** 깨짐 | `drizzle-kit check` 즉시 검증, 점진적 분리 (kernel만) | T9.5, T10.3 |
| **289 파일** import 경로 변경 누락 (동적 import 55건 + 배럴 포함) | 정적+동적+배럴 grep 누락 0건 (L-014), 자동화 스크립트 | T12.3 |
| drizzle config 신규 배선 (schema-docingest.ts 편입) | `drizzle-kit generate --dry` 무의도 diff 0 확인 | T10.2 |
| RLS 정책 / audit enum 참조 붕괴 | migration 제자리, schema.ts @deprecated 주석만 | T14.x |
| migration 체인 꼬임 | 테이블 DROP 전면 금지, TRUNCATE만 (사용자 승인 시) | T10.2 |
| next dev 500 에러 | L-012: build 금지, 페이지별 로드 테스트 | T13.3 |
| 실DB 스키마 불일치 | L-013: psql 직검 | T15.3 |
| kernel 테이블 집합 부정확 (`audit_verify_history` 부재) | 사전 grep으로 identity 확정, verificationTokens 포함 여부 판단 | T9.1 |

---

## Phase B 런-페이즈용 핵심 정보 (kernel 추출 안전 순서)

| Sub-Phase | 작업 | 게이트 | Risk |
|---|---|---|---|
| B1 | `lib/kernel/` 생성 + db/auth/audit/ratelimit/storage/schemas git mv | typecheck(codemod 후) | High |
| B2 | schema-kernel.ts 발췌(users/auditLogs/sessions/+verificationTokens) + cross-file FK import | **`drizzle-kit check` 즉시** + FK 수 동일(274) | **최고** |
| B3 | drizzle.config glob 전환(단일→array, 신규 배선) | `drizzle-kit generate --dry` 무의도 diff 0 | Medium |
| B4 | kernel/index.ts re-export 작성 | typecheck + `grep` export 항목 존재(AC-11) | Low |
| B5 | codemod 289 파일(동적 import 55건 + 배럴 포함) import 경로 | 정적+동적+배럴 grep 0건 + `pnpm test` green + AC-03 순환의존 0 | High |
| B6 | 순환 의존성 0건 + next dev 페이지 로드 500 없음 | grep + next dev 수동 확인 | Medium |
| B7 | schema @deprecated 보완(Phase A #530 누락분) | grep `@deprecated` 8도메인 분 | Low |

> **kernel 추출 원칙 (REQ-V3R-004)**: kernel은 re-export 레이어(thin wrapper) — 새 추상층, 의존성 역전 인터페이스, DI 컨테이너 전면 금지 (TRUST 5 Readable). 순환 의존성 0건 유지: `grep -rl "@/lib/domains" lib/kernel/` = 0건.
