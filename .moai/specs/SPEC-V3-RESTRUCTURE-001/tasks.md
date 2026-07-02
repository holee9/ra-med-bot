# Tasks — SPEC-V3-RESTRUCTURE-001

> v3 구조 정리 (Phase A: 아카이브 잔여 14도메인 + Phase B: kernel 추출 + schema.ts 분할)
> 마스터 계획: `docs/proposals/v3-architecture-revamp-plan-2026-07-02.md`

---

## 사전 검증 (Pre-flight Checks)

- [ ] **T0.1** 기준 회귀 테스트 확보: `pnpm test` 실행 → 4815+ passed 기록 (baseline)
- [ ] **T0.2** 기준 FK 수 확보: `grep -c "REFERENCES" migrations/*.sql` → 261개 기록 (schema 분할 전후 비교용)
- [ ] **T0.3** Phase C-2 아카이브 상태 확인: `ls archive/qms-pms/lib/` → change-control, clinical-investigation, cyberdevice, labeling (4도메인, 106 files)
- [ ] **T0.4** 작업 브랜치 생성: `git checkout -b feat/v3-restructure-001`

---

## Phase A — 아카이브 잔여 14도메인 (안전 순서)

### Sub-Phase A1: 저의존성 4종 아카이브 (Priority High)

- [ ] **T1.1** `lib/dhf/` (1 file) + app/*dhf* (11 files) → `archive/qms-pms/lib/dhf/`, `archive/qms-pms/app/dhf/`로 git mv
- [ ] **T1.2** `lib/pms/` (1 file) → `archive/qms-pms/lib/pms/`로 git mv (app 라우트 0건)
- [ ] **T1.3** `lib/samd/` (1 file) + app/*samd* (7 files) → `archive/qms-pms/`로 git mv
- [ ] **T1.4** `lib/esubmit/` (1 file) + app/*esubmit* (9 files) → `archive/qms-pms/`로 git mv
- [ ] **T1.5** 회귀 게이트: `pnpm typecheck && pnpm test` → baseline 대비 failure 0건
- [ ] **T1.6** commit: `chore(archive): A1 저의존성 4도메인 아카이브 (dhf/pms/samd/esubmit)`

### Sub-Phase A2: 독립 2종 아카이브 (Priority High)

- [ ] **T2.1** `lib/risk/` (11 files) + app/*risk* (13 files) → `archive/qms-pms/`로 git mv (cross-import 0종)
- [ ] **T2.2** `lib/model-governance/` (13 files) + app/*model-governance* (6 files) → `archive/qms-pms/`로 git mv (cross-import 0종)
- [ ] **T2.3** 회귀 게이트: `pnpm typecheck && pnpm test` → failure 0건
- [ ] **T2.4** commit: `chore(archive): A2 독립 2도메인 아카이브 (risk/model-governance)`

### Sub-Phase A3: SHRINK 2종 (필요 함수 이동 후 아카이브) (Priority High)

- [ ] **T3.1** **rlhf SHRINK**: `lib/rlhf/retrieval-hook.ts`에서 `applyRlhfReranking` 함수 + 관련 타입 발췌 → `lib/ai/rlhf-adapter.ts` 신규 파일로 이동
- [ ] **T3.2** `lib/ai/merge.ts:7` import 경로 갱신: `from '@/lib/rlhf/retrieval-hook'` → `from '@/lib/ai/rlhf-adapter'` (또는 상대 경로 `./rlhf-adapter`)
- [ ] **T3.3** `lib/rlhf/` 나머지 16 files + app/*rlhf* (4 files) → `archive/qms-pms/`로 git mv
- [ ] **T3.4** **knowledge-gap SHRINK**: `lib/knowledge-gap/replay.ts`에서 `markGapResolved`, `replayGapTest` 함수 + 관련 타입 발췌 → `lib/radar/gap-replay-adapter.ts` 신규 파일로 이동
- [ ] **T3.5** `lib/radar/delta-sync/gap-replay.ts:14` import 경로 갱신: `from '@/lib/knowledge-gap/replay'` → `from '@/lib/radar/gap-replay-adapter'` (또는 상대 경로)
- [ ] **T3.6** `lib/knowledge-gap/` 나머지 12 files + app/*knowledge-gap* (4 files) → `archive/qms-pms/`로 git mv
- [ ] **T3.7** SHRINK 검증: `grep -rn "applyRlhfReranking" lib/ai/` → `lib/ai/rlhf-adapter.ts` 존재, `grep -rn "markGapResolved\|replayGapTest" lib/radar/` → `lib/radar/gap-replay-adapter.ts` 존재
- [ ] **T3.8** 회귀 게이트: `pnpm typecheck && pnpm test` → failure 0건 (특히 rlhf-reranking 관련 통합 테스트)
- [ ] **T3.9** commit: `chore(archive): A3 SHRINK 2도메인 아카이브 (rlhf/knowledge-gap) — 함수 이동 포함`

### Sub-Phase A4: 고의존성 6종 아카이브 (Priority High)

> 각 도메인별 크로스 임포트 처리는 run phase #35에서 도메인별 판단. stub 교체 / import 제거 / 기능 축소 중 선택.

- [ ] **T4.1** **knowledge-promo RETIRE**: `lib/knowledge-promo/` (5 files) + app/*knowledge-promo* (4 files) → `archive/qms-pms/`로 git mv (공유 인프라만 참조하므로 바로 이동)
- [ ] **T4.2** **traceability**: 크로스 임포트 처리(lib/predicate ↔ traceability 1종) → `lib/traceability/` (17 files) + app/*traceability* (11 files) 아카이브
- [ ] **T4.3** **corpus-license**: 크로스 임포트 처리(pccp 상호참조) → `lib/corpus-license/` (10 files) + app/*corpus-license* (3 files) 아카이브
- [ ] **T4.4** **pccp**: 크로스 임포트 처리(corpus-license과 함께) → `lib/pccp/` (14 files) + app/*pccp* (6 files) 아카이브
- [ ] **T4.5** **standards**: 크로스 임포트 처리(1종) → `lib/standards/` (12 files) + app/*standards* (7 files) 아카이브
- [ ] **T4.6** **project-memory**: 크로스 임포트 처리(2종) → `lib/project-memory/` (4 files) + app/*project-memory* (5 files) 아카이브
- [ ] **T4.7** 회귀 게이트: `pnpm typecheck && pnpm lint && pnpm test` → failure 0건
- [ ] **T4.8** commit: `chore(archive): A4 고의존성 6도메인 아카이브 (knowledge-promo/traceability/corpus-license/pccp/standards/project-memory)`

### Sub-Phase A5: schema.ts @deprecated 주석 (Priority Medium)

- [ ] **T5.1** schema.ts에서 아카이브 18도메인 테이블 식별 (Phase C-2 4도메인 + 본 SPEC 14도메인 분)
- [ ] **T5.2** 각 테이블 정의上方에 `/** @deprecated 아카이브됨 — archive/qms-pms/ 참조, SPEC-V3-RESTRUCTURE-001 */` 주석 추가
- [ ] **T5.3** 검증: `grep -c "@deprecated.*SPEC-V3-RESTRUCTURE-001" lib/db/schema.ts` → 아카이브 도메인 테이블 수와 일치
- [ ] **T5.4** 회귀 게이트: `pnpm typecheck` (주석만이므로 영향 0)
- [ ] **T5.5** commit: `chore(schema): A5 아카이브 18도메인 테이블 @deprecated 주석 (Phase C-2 누락 보완)`

### Sub-Phase A6: .archive-manifest.json 갱신 (Priority Medium)

- [ ] **T6.1** `.archive-manifest.json` 스키마 정의: `{ "version": "1.0", "archived_at": "ISO-8601", "domains": [{ "name": "...", "original_path": "...", "archive_path": "...", "checksum": "...", "spec": "..." }] }`
- [ ] **T6.2** Phase C-2 4도메인(change-control, clinical-investigation, cyberdevice, labeling) + 본 SPEC 14도메인 = 18도메인 엔트리 작성
- [ ] **T6.3** 각 도메인별 체크섬 계산 (`sha256sum` 기반) 및 매핑
- [ ] **T6.4** `archive/qms-pms/README.md` 갱신: 아카이브 사유, 복원 방법, 18도메인 목록
- [ ] **T6.5** commit: `docs(archive): A6 .archive-manifest.json 18도메인 갱신 + README`

### Sub-Phase A7: Phase A 최종 게이트 (Priority High)

- [ ] **T7.1** `pnpm typecheck` → 0 에러
- [ ] **T7.2** `pnpm lint` → 0 에러 (lint:hex full, L-008)
- [ ] **T7.3** `pnpm test` → 4815+ passed (baseline 대비 신규 failure 0)
- [ ] **T7.4** AC-01, AC-02, AC-06, AC-07, AC-08 검증 통과
- [ ] **T7.5** `ls archive/qms-pms/lib/ | wc -l` → 18 (Phase C-2 4 + 본 SPEC 14)
- [ ] **T7.6** commit: `chore(archive): Phase A 완료 — 18도메인 아카이브`

---

## Phase B — Kernel 추출 + schema.ts 분할

### Sub-Phase B1: lib/kernel/ 디렉토리 생성 + 공유 인프라 이동 (Priority High)

- [ ] **T8.1** `mkdir -p lib/kernel/{db,auth,audit,ratelimit,storage,schemas}`
- [ ] **T8.2** `lib/db/` → `lib/kernel/db/`로 git mv (schema.ts, schema-docingest.ts, client.ts, migrations/ 포함)
- [ ] **T8.3** `lib/auth/` → `lib/kernel/auth/`로 git mv (178 파일 참조)
- [ ] **T8.4** `lib/audit/` → `lib/kernel/audit/`로 git mv (116 파일 참조)
- [ ] **T8.5** `lib/ratelimit/` → `lib/kernel/ratelimit/`로 git mv
- [ ] **T8.6** `lib/storage/` → `lib/kernel/storage/`로 git mv
- [ ] **T8.7** `lib/schemas/` → `lib/kernel/schemas/`로 git mv (Zod 공유)
- [ ] **T8.8** commit: `refactor(kernel): B1 공유 인프라 6모듈 → lib/kernel/ 이동`

### Sub-Phase B2: schema-kernel.ts 발췌 (Priority High)

- [ ] **T9.1** schema.ts에서 kernel 테이블 식별: users, audit_log, audit_verify_history, sessions (~5 테이블, 사전 grep으로 정확한 수 확인)
- [ ] **T9.2** `lib/kernel/db/schema-kernel.ts` 신규 파일 생성, kernel 테이블 정의 이동
- [ ] **T9.3** FK references 처리: 다른 도메인 테이블이 kernel 테이블을 참조할 때 `import { users } from '@/lib/kernel/db/schema-kernel'` 사용 (Drizzle 다중 파일 패턴)
- [ ] **T9.4** schema.ts에서 kernel 테이블 정의 제거 후 schema-kernel.ts에서 import (또는 re-export)
- [ ] **T9.5** **즉시 검증**: `pnpm drizzle-kit check` → FK 261개 보존 확인 (T0.2 baseline 대비)
- [ ] **T9.6** 실패 시 롤백: kernel 테이블을 schema.ts에 잔류시키고 import만 분리 (점진적)
- [ ] **T9.7** commit: `refactor(schema): B2 kernel 테이블 5개 → schema-kernel.ts 분할 (FK 261 보존)`

### Sub-Phase B3: drizzle.config.ts glob 확장 (Priority Medium)

- [ ] **T10.1** `drizzle.config.ts`의 `schema` 필드를 배열로 변경:
  ```typescript
  schema: [
    './lib/kernel/db/schema-kernel.ts',
    './lib/db/schema.ts',
    './lib/db/schema-docingest.ts',
  ],
  ```
- [ ] **T10.2** `pnpm drizzle-kit generate` 실행 → migration 정상 생성 확인 (신규 migration 0건 — 구조 변경만)
- [ ] **T10.3** `pnpm drizzle-kit check` → FK 261개 불변 확인
- [ ] **T10.4** commit: `refactor(drizzle): B3 config glob 확장 — kernel + legacy + docingest`

### Sub-Phase B4: lib/kernel/index.ts 공개 API (Priority Medium)

- [ ] **T11.1** `lib/kernel/index.ts` 작성 (REQ-V3R-012 re-export):
  ```typescript
  export { db, withTenantScope } from './db/client';
  export { getSession, requireRole, withPermission } from './auth';
  export { writeAudit, verifyHashChain } from './audit';
  export { rateLimit } from './ratelimit';
  export { uploadAsset } from './storage';
  ```
- [ ] **T11.2** 새 추상층 도입 금지 검증: kernel은 re-export만, 의존성 역전 인터페이스/클래스 주입 금지 (TRUST 5 Readable)
- [ ] **T11.3** commit: `feat(kernel): B4 lib/kernel/index.ts 공개 API (re-export thin wrapper)`

### Sub-Phase B5: codemod import 경로 일괄 변경 (Priority High)

- [ ] **T12.1** codemod 스크립트 작성: `@/lib/db` → `@/lib/kernel/db`, `@/lib/auth` → `@/lib/kernel/auth`, `@/lib/audit` → `@/lib/kernel/audit`, `@/lib/ratelimit` → `@/lib/kernel/ratelimit`, `@/lib/storage` → `@/lib/kernel/storage`, `@/lib/schemas` → `@/lib/kernel/schemas`
- [ ] **T12.2** 스크립트 실행: lib/, app/, components/ 내 178+ 파일 일괄 변경
- [ ] **T12.3** 누락 검증: `grep -rn "from.*@/lib/db['\"]\|from.*@/lib/auth['\"]\|from.*@/lib/audit['\"]" lib/ app/ components/` → 결과 0건 (kernel 경로 미사용 파일 0건)
- [ ] **T12.4** `pnpm typecheck` → 0 에러
- [ ] **T12.5** `pnpm lint` → 0 에러
- [ ] **T12.6** `pnpm test` → 4815+ passed (baseline 대비 failure 0)
- [ ] **T12.7** AC-09 검증 통과
- [ ] **T12.8** commit: `refactor(codemod): B5 178+ 파일 import 경로 @/lib/kernel/* 일괄 변경`

### Sub-Phase B6: 순환 의존성 검증 (Priority High)

- [ ] **T13.1** AC-03 검증: `grep -rn "from.*@/lib/domains" lib/kernel/` → 결과 0건 (kernel이 domains를 import 금지)
- [ ] **T13.2** kernel↔domain 순환 의존성 0건 확인 (dependency-cruiser 또는 grep)
- [ ] **T13.3** `next dev` 구동 후 주요 페이지(/, /admin, /ra) 로드 → 500 에러 0건 (L-012: build 금지)
- [ ] **T13.4** AC-10 검증 통과
- [ ] **T13.5** commit: `test(kernel): B6 순환 의존성 0건 + next dev 페이지 로드 검증`

---

## Phase B 최종 게이트 (Priority High)

- [ ] **T14.1** AC-03 (kernel 순환 의존성 0), AC-04 (drizzle-kit check FK 261 보존), AC-05 (migration 106 불변), AC-09 (codemod 누락 0), AC-10 (next dev 500 없음), AC-11 (kernel/index.ts re-export) 전부 통과
- [ ] **T14.2** `pnpm typecheck && pnpm lint && pnpm test` 전체 green
- [ ] **T14.3** 실DB 스키마 일관성 검증: `psql regula_test -c "\dt"` → 테이블 수 불변, `\d users` → kernel 테이블 정상 (L-013)
- [ ] **T14.4** commit: `chore(kernel): Phase B 완료 — kernel 추출 + schema 분할 + codemod`

---

## 사후 검증 (Post-flight Checks)

- [ ] **T15.1** archive/qms-pms/lib/ 18도메인 확인 (Phase C-2 4 + 본 SPEC 14)
- [ ] **T15.2** lib/kernel/ 6모듈(db/auth/audit/ratelimit/storage/schemas) 존재 확인
- [ ] **T15.3** schema-kernel.ts 존재 + kernel 테이블 ~5개 포함 확인
- [ ] **T15.4** drizzle.config.ts glob에 3 파일(schema-kernel, schema, schema-docingest) 포함 확인
- [ ] **T15.5** .archive-manifest.json 18도메인 엔트리 포함 확인
- [ ] **T15.6** 전체 AC-01 ~ AC-11 검증 통과
- [ ] **T15.7** `git log --oneline` → Phase A(7 commits) + Phase B(6 commits) 순서 확인
- [ ] **T15.8** PR 생성: `feat(v3): SPEC-V3-RESTRUCTURE-001 — Phase A+B 구조 정리 완료 (#35)`

---

## 회귀 위험 완화 체크리스트

| 위험 | 완화 조치 | 검증 시점 |
|---|---|---|
| schema.ts 분할 시 FK 261개 깨짐 | `drizzle-kit check` 즉시 검증, 점진적 분리 (kernel만) | T9.5, T10.3 |
| 178+ 파일 import 경로 변경 누락 | grep 누락 0건, 자동화 스크립트 | T12.3 |
| RLS 정책 / audit enum 참조 붕괴 | migration 제자리, schema.ts @deprecated 주석만 | T5.x, T10.2 |
| migration 체인 꼬임 | 테이블 DROP 전면 금지, TRUNCATE만 (사용자 승인 시) | T10.2 |
| next dev 500 에러 | L-012: build 금지, 페이지별 로드 테스트 | T13.3 |
| SHRINK 함수 이동 누락 | merge.ts, gap-replay.ts 직검 | T3.7 |
| 실DB 스키마 불일치 | L-013: psql 직검 | T14.3 |

---

## run phase #35용 핵심 정보 (도메인별 처리 매트릭스)

| 도메인 | Sub-Phase | 전략 | 크로스 임포트 | 검증 키 |
|---|---|---|---|---|
| dhf | A1 (T1.1) | DIRECT ARCHIVE | 없음 | typecheck + test green |
| pms | A1 (T1.2) | DIRECT ARCHIVE | 없음 | typecheck green |
| samd | A1 (T1.3) | DIRECT ARCHIVE | 없음 | typecheck + test green |
| esubmit | A1 (T1.4) | DIRECT ARCHIVE | 없음 | typecheck + test green |
| risk | A2 (T2.1) | DIRECT ARCHIVE | 없음 (0종) | typecheck + test green |
| model-governance | A2 (T2.2) | DIRECT ARCHIVE | 없음 (0종) | typecheck + test green |
| rlhf | A3 (T3.1-T3.3) | SHRINK | `lib/ai/merge.ts` → `applyRlhfReranking` 이동 | grep `applyRlhfReranking` in lib/ai/ |
| knowledge-gap | A3 (T3.4-T3.6) | SHRINK | `lib/radar/delta-sync/gap-replay.ts` → 함수 이동 | grep `markGapResolved` in lib/radar/ |
| knowledge-promo | A4 (T4.1) | RETIRE | 공유 인프라만 | typecheck green |
| traceability | A4 (T4.2) | STUB/IMPORT 제거 | lib/predicate ↔ traceability (1종) | 도메인별 판단 |
| corpus-license | A4 (T4.3) | STUB/IMPORT 제거 | pccp 상호참조 (1종) | pccp와 함께 처리 |
| pccp | A4 (T4.4) | STUB/IMPORT 제거 | corpus-license 상호참조 (1종) | corpus-license와 함께 |
| standards | A4 (T4.5) | STUB/IMPORT 제거 | 1종 | 도메인별 판단 |
| project-memory | A4 (T4.6) | STUB/IMPORT 제거 | 2종 | 도메인별 판단 |

> **도메인별 판단 원칙**: stub 교체(어댑터 no-op) / import 제거(사용 중단) / 기능 축소(SHRINK) 중 해당 도메인의 Charter 정합성과 구현 비용을 고려해 run phase에서 결정. 단, AC-02(KEEP 코드 잔존 import 0건)는 무조건 충족.
