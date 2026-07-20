# v3 아키텍처 개편 — Phase A/B/E 재개 계획 (2026-07-19)

> 상태 프레이밍: **부분 실행 중** (#519). Phase C/D 완료, A/B/E 미착수. 공식 승인 기록 부재.
> 본 문서는 **계획서**이며 코드 실행이 아니다. Phase A는 **검증만(verify-only)** — 재개·확장이 아니다.
> 접근: **CHARTER v3 정합성 점검을 먼저 수행**하고, 그 결과로 B/E 재개 범위를 확정한다.

기준 정의: `.moai/project/product.md` v3.0.0
헌장: `.moai/specs/CHARTER.md` v2.0.0 (지양 5종)
관련 감사: `docs/purpose-alignment-audit-2026-07-16.md`
마스터 계획: `docs/proposals/v3-architecture-revamp-plan-2026-07-02.md` (676줄)

---

## 0. 직접 검증 결과 (SPEC 문구 맹신 금지 — 2026-07-19 직검)

> 이 프로젝트의 반복 교훈(L-013/L-014): 매트릭스·tasks.md가 실제 상태와 어긋난다. 아래는 **코드/파일 직검** 수치다.

| 항목 | SPEC/문서 서술 | **실측 (2026-07-19)** | 판정 |
|---|---|---|---|
| archive/qms-pms/lib 도메인 수 | 18 (RESTRUCTURE AC-06, product.md L82/L122, 마스터 §7) | **8** (change-control, clinical-investigation, cyberdevice, dhf, esubmit, labeling, samd, workflows) | **stale** |
| `.archive-manifest.json` | 존재해야 함 (REQ-V3R-008/013, AC-06) | **부재** (repo 전역 검색 0건) | **미생성** |
| `lib/kernel/` | Phase B 산출물 | **부재** | 미착수(정상) |
| `lib/bff/` | Phase E 산출물 | **부재** | 미착수(정상) |
| `lib/api/` 클라이언트 | 6 + 공통 | **7 파일** (hybrid-ra/evidence/traceability/authoring/checklist-client + with-auth + error-handling) | 일치 |
| kernel codemod 대상 | "178+ 파일" (REQ-V3R-009) | **union 290 파일** (`@/lib/db` 174 · `@/lib/auth` 181 · `@/lib/audit` 119, 중복 제거) | **stale(과소)** |
| `@/lib/ratelimit`·`@/lib/storage` import | kernel re-export 대상 | **≈0~2 파일** (직접 import 거의 없음) | re-export는 유지, codemod 비대상 |
| `drizzle.config.ts` schema | "이미 schema-docingest.ts + schema.ts glob 로드, 패턴 확장만" | **`schema: './lib/db/schema.ts'` 단일 파일**. schema-docingest.ts는 config·schema.ts 어디에서도 미참조 | **stale(선례 미검증)** |
| schema.ts 규모 | 3,232줄 / 86 pgTable | **3,531줄 / 93 pgTable** | stale(증가) |
| pccp | RESTRUCTURE §1.2 아카이브 대상 | **lib/pccp 라이브 유지** (KEEP, #521 정합) | SPEC stale, 현실 정합 |
| pms | 아카이브 대상 | lib/·archive 양쪽 부재(전면 제거된 듯) | 확인 필요 |
| workflows | — | lib/ 8파일 + archive 3파일 (**부분 아카이브** — CAPA분 #520 이동, `capa-generator.ts` 삭제 확인) | 정합 |
| RESTRUCTURE tasks.md | — | **94개 전부 미체크**, status=planned | 미착수 |
| SPEC-V3-BFF/ARCHIVE/KERNEL-001 | 마스터·structure.md가 참조 | **디렉토리 미존재** (RESTRUCTURE-001만 존재) | 신규 작성 필요 |
| 회귀 기준 통과 수 | 문서 4229 / SPEC 4815 | **미확정** (live test 파일 413개, 실행 미수행) | **live run으로 확정 권고** |

**핵심 함의**: "18도메인 아카이브"는 product.md·CHARTER·RESTRUCTURE·마스터 §7에 **완료처럼 서술**돼 있으나 실제는 **8도메인**만 이동됐다. 마스터 계획 헤더(L10)만 "8도메인 이동됨, kernel/bff/infra 미착수"로 최신화돼 있어 문서 간 내부 모순이다. 잔여 QMS 인접 도메인(risk·traceability·standards·model-governance·corpus-license·knowledge-promo·project-memory·rlhf·knowledge-gap)은 **여전히 라이브**이며, 오케스트레이터 판정상 **KEEP**으로 재분류되었다(#519 맥락).

---

## 1. 정합성 점검 결과 (CHARTER v3 / product.md v3.0.0)

각 항목: **준수 / 조정 필요 / 충돌**.

### 1.1 Phase A(검증) 정합성

| 점검 | 판정 | 근거·조치 |
|---|---|---|
| 아카이브 자체의 정책 정합 | **준수** | QMS/PLM 도메인 물리 이동 = 지양-3(QMS 대체 금지) 이행. product.md L82와 일치 |
| RESTRUCTURE §1.2 "잔여 14도메인 아카이브" | **조정 필요** | 잔여 다수가 KEEP 재판정 → 14 타깃은 무의미. §1.2/§1.5/REQ-V3R-008/AC-06(=18)을 **8 + 잔여 KEEP**으로 정정 (하단 §3.6) |
| RESTRUCTURE §1.2 pccp 아카이브 등재 | **충돌** | #521: pccp는 규제 제출물(QMS 아님) → 라이브 보존. 실제 아카이브 8도메인에 pccp 없음(정합). **SPEC 문구만 stale** → 마스터 §3.3처럼 "정정: KEEP" 주석 추가 |
| product.md L82/L122 "18개 archive 이동" | **조정 필요(거버넌스)** | 기준 정의 문서가 실측(8)과 불일치. product.md는 표준이므로 **사용자 승인** 하에 "8 이동 + 잔여 QMS 인접 KEEP(별도 결정 보류), pccp 영구 KEEP"으로 정정 권고 |

### 1.2 Phase B(kernel 추출) 정합성

| 점검 | 판정 | 근거·조치 |
|---|---|---|
| kernel 추출의 정책 정합 | **준수** | 공유 인프라 re-export만. 신규 기능·QMS·법적 주장 생성 없음 → 지양 1~5 무관 |
| 지양 위반 재도입(#520) 위험 | **준수** | 인프라 이동은 CAPA/외부감사관 재도입과 무관. 단, RESTRUCTURE가 A(아카이브)+B(kernel) **묶음**이므로 재개 시 "잔여 아카이브" 태스크를 살려 QMS 재이동을 시도하지 않도록 **B를 kernel-only로 재스코프** 필요 |
| 과잉 추상화 지양(TRUST 5 Readable) | **준수** | REQ-V3R-004/§7: kernel=thin re-export, DI/인터페이스 분리 금지. 유지 |
| RESTRUCTURE 스코프(A+B 번들) | **조정 필요** | Phase A 아카이브 태스크 대부분 무의미 → B(kernel)만 남기고 재스코프 |
| codemod 규모 178 → 290, drizzle glob 미검증 | **조정 필요** | REQ-V3R-009 수치·§4.2 B3 근거 정정(§3.6) |

### 1.3 Phase E(BFF 통합) 정합성

| 점검 | 판정 | 근거·조치 |
|---|---|---|
| BFF 연동 자체 | **준수** | CHARTER §3 지양-5 **명시적 허용 (a)**: "hybrid-ra-saas BFF 연동(lib/bff/, 6 integration points)은 외판이 아니라 내부 시스템 간 연동". product.md L71/L112/L128과 일치 |
| PCCP 저작 역할 분리(#521 defer) | **조정 필요** | #521이 "Regula vs SaaS 저작 역할"을 Phase E로 defer. 마스터 §6.4 잠정안: PCCP **작성 워크벤치는 SaaS(주)**, Regula는 pccp lib(게이팅·equivalence) KEEP. **SPEC-V3-BFF-001에서 확정 결정**하고, SaaS 저작 경로라도 Expert Review Gate·인용·Article 61(4) disclaimer 불변(지양-2/4·불변목록)을 보존해야 함 |
| 지양-4(게이팅 없는 규제 판단) | **조정 필요** | integration point 3(Consult→Authoring), 1(Impact→Evidence)이 SaaS 저작으로 흐를 때 Regula 산출물의 confidence 게이트·disclaimer가 우회되지 않도록 BFF SPEC에 REQ로 명시 |
| integration point #2 traceability "(아카이브)" 전제 | **충돌** | 마스터 §6.3은 traceability를 "아카이브 후 어댑터 우회"로 서술하나 **traceability는 라이브**(미아카이브). BFF SPEC은 이 전제를 정정하고, traceability를 (a) 먼저 아카이브 후 어댑터, (b) 라이브 유지 중 하나로 **결정**해야 함 |
| 지양-5 경계 | **준수(조건부)** | 허용은 6 integration points·내부 연동에 한정. 외부 고객 tier·결제·멀티조직 확장은 금지 — BFF SPEC 범위에 명시 |

### 1.4 인지 편향·실패 시나리오 점검

- **Anchoring**: "18도메인/178파일" 숫자에 고정되지 말 것 → 실측(8/290) 채택.
- **확증 편향**: "kernel은 re-export라 저위험" 서술을 그대로 신뢰하지 말 것 → schema.ts 분할(261 FK, 93 pgTable)은 실질 고위험.
- **선례 과신**: "schema-docingest.ts glob 선례 검증됨"은 **거짓**(config 미참조). B3는 신규 배선.
- **왜 실패할 수 있나(선호안=A→B→E)**: (1) codemod 290 파일 중 배럴 재export·동적 import 누락 시 런타임만 실패(L-014), (2) drizzle multi-file 전환이 FK cross-file import에서 타입 붕괴, (3) BFF PCCP 역할 결정이 지양-4 게이팅을 무너뜨림.

---

## 2. Phase A — 검증 계획 (verify-only)

**목적**: archive/qms-pms 무결성 + 기준 회귀 0 재확인. 이는 **B/E 착수 전제로만** 사용한다. 아무 도메인도 새로 아카이브하지 않는다.

### 2.1 검증 게이트 (구체 커맨드)

| G# | 검증 항목 | 커맨드 | 기대값 | Priority |
|---|---|---|---|---|
| A-V1 | 아카이브 도메인 존재 | `ls -1 archive/qms-pms/lib/ \| wc -l` | **8** (기대값을 18→8로 정정) | High |
| A-V2 | 아카이브 도메인 명세 | `ls -1 archive/qms-pms/lib/` | change-control·clinical-investigation·cyberdevice·dhf·esubmit·labeling·samd·workflows | High |
| A-V3 | manifest 정합 | `test -f .archive-manifest.json && jq '.domains \| length' .archive-manifest.json` | **현재 부재** → 게이트 통과 위해 manifest **생성 필요**(원본경로·체크섬·복원경로, 8도메인) | High |
| A-V4 | KEEP 코드가 아카이브 도메인 미참조 | `grep -rlE "from.*@/lib/(dhf\|samd\|esubmit\|clinical-investigation\|cyberdevice\|labeling\|change-control)" lib/ app/ components/ \| grep -v '/archive/'` | 0건 | High |
| A-V5 | 기준 회귀 baseline 확정 | `pnpm test 2>&1 \| tail -5` | **4229 vs 4815 실행으로 확정** 후 baseline 고정. 이후 신규 failure 0 | High |
| A-V6 | 정적 게이트 | `pnpm typecheck && pnpm lint` | exit 0 | High |
| A-V7 | 런타임 무결성 | `next dev` 후 `/`, `/admin`, `/ra` 로드 500 0건 (L-012: dev 중 build 금지) | 500 0건 | Medium |
| A-V8 | migration 불변 | `ls lib/db/migrations/*.sql \| wc -l` (구조.md는 106 언급 — 실측으로 고정) | 착수 전후 동일 | Medium |

### 2.2 #519 "A 미착수" vs 메모리 "종료 선언" 불일치 해소 — 공식 종료 게이트

- **문제**: #519는 "A 미착수", 일부 메모리·문서는 아카이브를 "완료"로 서술. 실측은 "8도메인 이동 = 부분 완료, manifest 부재".
- **해소 방식(결정)**: Phase A를 **"검증 게이트 A-V1~A-V8 전부 green"으로 공식 종료** 정의한다. 통과 시 상태를 **"A 검증 완료 — B/E 착수 가능"**으로 기록(#519 후속 코멘트 + product.md 상태란).
- **종료 조건 필수 산출물**: `.archive-manifest.json` 생성(현재 부재), 회귀 baseline 수치 확정(4229/4815 중 실측), 상태 문구 정정.
- **비확장 원칙**: A-V 게이트는 잔여 KEEP 도메인을 아카이브로 이동하지 않는다. 잔여 도메인 처분은 별도 거버넌스 결정(§6 이슈).

---

## 3. Phase B — kernel 추출 재개 계획

**거버넌스 SPEC**: `SPEC-V3-RESTRUCTURE-001` (status=planned, 94 tasks 미체크). 단, Phase A 아카이브 태스크가 대부분 무의미 → **kernel-only로 재스코프** 후 재개.
**주의**: 마스터 §7·structure.md는 `SPEC-V3-KERNEL-001`(미존재)을 참조. 실재 SPEC은 RESTRUCTURE-001. **RESTRUCTURE-001을 Phase B 단일 거버넌스 SPEC으로 확정**하고 ARCHIVE/KERNEL SPEC-ID 참조는 superseded 표기.

### 3.1 kernel 경계 (re-export only — 새 추상층 금지)

```typescript
// lib/kernel/index.ts (REQ-V3R-012)
export { db, withTenantScope } from './db/client';
export { getSession, requireRole, withPermission } from './auth';
export { writeAudit, verifyHashChain } from './audit';
export { rateLimit } from './ratelimit';
export { uploadAsset } from './storage';
```
이동 대상: `lib/{db,auth,audit,ratelimit,storage,schemas}` → `lib/kernel/*` (git mv). 함수 시그니처 불변, import 경로만 변경.

### 3.2 schema-kernel.ts 발췌

- schema.ts(3,531줄/93 pgTable)에서 `users`, `audit_log`, `audit_verify_history`, `sessions`(~5) 발췌 → `lib/kernel/db/schema-kernel.ts`.
- 잔여 테이블의 FK references는 schema-kernel.ts의 export를 **cross-file import**로 참조.
- 아카이브 도메인 테이블은 **삭제 금지** — `@deprecated` 주석만(261 FK 보존, REQ-V3R-006/007).

### 3.3 drizzle.config.ts glob 확장 (선례 미검증 — 신규 배선)

- **정정**: 현재 `schema: './lib/db/schema.ts'` **단일 파일**. schema-docingest.ts는 미배선 → "선례 검증됨"은 거짓.
- 변경: `schema: ['./lib/kernel/db/schema-kernel.ts', './lib/db/schema.ts', './lib/db/schema-docingest.ts']`
- 검증: `pnpm drizzle-kit check` + FK 수 분할 전후 동일. schema-docingest.ts 편입이 신규 migration diff를 유발하는지 `drizzle-kit generate --dry` 확인(무의도 diff면 편입 범위 조정).

### 3.4 codemod (290 파일 — 실측 반영)

- **정정**: "178+" → **union 290 파일** (`@/lib/db` 174 · `@/lib/auth` 181 · `@/lib/audit` 119). ratelimit·storage는 직접 import ≈0 → codemod 비대상(kernel re-export만 유지).
- 자동화: `@/lib/db` → `@/lib/kernel/db`, `@/lib/auth` → `@/lib/kernel/auth`, `@/lib/audit` → `@/lib/kernel/audit` 일괄 치환 스크립트(ast-grep 또는 sed + tsconfig paths).
- **누락 0 검증(L-014 대응 — 동적 import·배럴 재export 포함)**:
  - 정적: `grep -rlE "@/lib/(db\|auth\|audit)([/'\"]" lib/ app/ components/ | grep -v '/archive/'` → kernel 미경유 파일 0건.
  - 동적: `grep -rnE "import\(['\"]@/lib/(db\|auth\|audit)" lib/ app/` → 동적 import 잔존 0건.
  - 배럴: `lib/index.ts`류 재export 경로 갱신 확인.
  - 최종: `pnpm typecheck` 0 error + `pnpm test` 신규 failure 0.

### 3.5 안전 순서 (sub-phase B1→B5, 각 단계 게이트)

| Sub | 작업 | 게이트 | Risk |
|---|---|---|---|
| B1 | `lib/kernel/` 생성 + db/auth/audit/ratelimit/storage/schemas git mv | typecheck(codemod 후) | High |
| B2 | schema-kernel.ts 발췌 + cross-file FK import | **`drizzle-kit check` 즉시** + FK 수 동일 | **최고** |
| B3 | drizzle.config glob 전환 | `drizzle-kit generate --dry` 무의도 diff 0 | Medium |
| B4 | kernel/index.ts re-export 작성 | typecheck + `grep` export 항목 존재(AC-11) | Low |
| B5 | codemod 290 파일 import 경로 | 정적+동적+배럴 grep 0건 + `pnpm test` green + AC-03 순환의존 0 | High |

순환 의존성 0 유지(REQ-V3R-004, AC-03): `grep -rl "@/lib/domains" lib/kernel/` = 0건.

### 3.6 SPEC 갱신 필요 항목 (RESTRUCTURE-001)

1. **§1.2**: "잔여 14도메인 아카이브" → "Phase A 8도메인 이동 완료. 잔여 QMS 인접 도메인은 KEEP 재판정(별도 거버넌스)". pccp 아카이브 등재 삭제(#521 KEEP 주석).
2. **§1.5 / REQ-V3R-009 / AC-09**: codemod "178+" → **290**.
3. **REQ-V3R-008 / AC-06 / AC-07**: 아카이브 도메인 수 **18 → 8**. `@deprecated` 대상도 8도메인.
4. **§4.1 A1~A6**: Phase A 아카이브 서브페이즈는 "검증 완료 + manifest 생성"으로 축소(재이동 태스크 제거).
5. **§4.2 B3 / structure.md §schema 분할**: drizzle "선례 검증됨" 문구 삭제 → "단일 파일 config를 array로 신규 전환" 명시.
6. **REQ-V3R-001 / REQ-V3R-011**: 회귀 기준 "4815"를 **live run 실측치로 확정** 후 고정.
7. **tasks.md**: 94개 중 archive 재이동 태스크 제거, kernel 태스크만 잔존하도록 재작성. status=planned 유지.
8. **SPEC-ID 정합**: 마스터 §7·structure.md의 `SPEC-V3-ARCHIVE-001`/`SPEC-V3-KERNEL-001` 참조를 RESTRUCTURE-001로 통일(superseded 표기).

---

## 4. Phase E — BFF 통합 계획 (SPEC-first)

**선행 필수**: `SPEC-V3-BFF-001` **미존재** → **신규 작성이 Phase E 착수의 선결 조건**. 코드 이동 전 SPEC 확정(annotation cycle 포함).

### 4.1 lib/api → lib/bff 이동 (시그니처 불변, import 경로만)

- 대상 7파일: `hybrid-ra-client.ts`(Azure api-prod), `evidence-client.ts`, `traceability-client.ts`, `authoring-client.ts`, `checklist-client.ts`, `with-auth.ts`, `error-handling.ts` → `lib/bff/`.
- 공통 에러 처리·재시도·타임아웃·인증 일원화(마스터 §6.2). `lib/bff/index.ts` 공개 API.
- **B 의존 판정**: structure.md는 "Phase E 독립"이라 하나, 마스터 §6.3 integration point 6이 `lib/kernel/audit/`를 참조하고 BFF 클라이언트는 auth/audit를 사용 → **kernel 경계 사용 O**. 따라서 **B 완료 후 E**가 이중 codemod(lib/api 이동 + kernel 경로 재적용) 회피에 유리. SPEC 작성은 B와 병렬 가능(SPEC-first).

### 4.2 6 integration points + mock SaaS 테스트

| # | Regula | SaaS | 방향 | Phase E 처리 |
|---|---|---|---|---|
| 1 | domains/impact | Evidence API | R→S | Impact 결과 전송. **confidence 게이트 우회 금지 REQ** |
| 2 | traceability | Traceability API | S→R | **정정 필요**: 마스터는 "아카이브 전제"이나 traceability 라이브 → 아카이브 후 어댑터 vs 라이브 유지 **결정** |
| 3 | domains/consult | Authoring API | R→S | Consult 초안 → SaaS Authoring 세션. **Draft watermark·disclaimer 보존 REQ** |
| 4 | domains/inbox | Hybrid-Ra API | 양방향 | 승인 답변 전송/리비전 동기화 |
| 5 | domains/registry | Hybrid-Ra API | R→S | 제품 마스터 동기화(BK-033) |
| 6 | kernel/audit | (없음) | R 내부 | 감사 로그 SaaS 미전송(Part 11 내부통제) |

- mock SaaS 전략: `lib/bff/__tests__/`에 Azure api-prod·Hybrid-Ra API를 msw/nock 스텁으로 대체. 6 흐름별 계약 테스트(요청 스키마·에러·재시도·타임아웃). integration E2E는 mock 서버 대상.

### 4.3 PCCP 저작 역할 분리 결정 (#521 defer — **Phase E 범위 포함**)

- **결정 대상**: PCCP 문서 **작성**을 Regula가 하는가, hybrid-ra-saas가 하는가.
- 잠정안(마스터 §6.4): 작성 워크벤치=**SaaS(주)**, Regula는 `lib/pccp`(equivalence-gate·baseline-snapshot·audit-wiring) KEEP + BFF로 SaaS Authoring 연동.
- **불변 제약(SPEC-V3-BFF-001 REQ로 명시)**: 저작 경로가 SaaS든 Regula든 (a) Expert Review Gate 불변(RA Lead 승인, product.md L67), (b) 인용 없는 주장 export 차단, (c) Article 61(4) disclaimer 강제, (d) PCCP 적용 범위 판단은 RA Lead 승인(지양-4). 하나라도 우회되면 지양-2/4 위반.
- #37(Submission Lifecycle: 510(k)·CER·PCCP 패키징, open)과의 경계 정의 필요 → BFF SPEC에서 참조.

### 4.4 리스크

- Azure api-prod 인증 만료(마스터 §6.1) → 착수 전 토큰·시크릿 유효성 확인, mock으로 개발 분리.
- SaaS API 스키마 변경 → 계약 테스트로 조기 감지.
- traceability "아카이브" 전제 오류 → §4.2 #2 결정 선행.

---

## 5. 시퀀싱·게이트·리스크 종합

### 5.1 순서와 병렬성

```
A(verify) ──[A-V1~A-V8 green]──> B(kernel) ──[B1~B5 green]──> E(BFF impl)
                                     │
                                     └─(병렬 가능) SPEC-V3-BFF-001 작성(SPEC-first)
```
- **A → B → E 순차**: A는 B/E의 전제(오케스트레이터 확정). B는 codemod가 광범위(290)해 E보다 선행이 이중 작업 회피에 유리(E BFF가 kernel auth/audit 사용).
- **병렬 허용**: `SPEC-V3-BFF-001` **문서 작성**은 B 구현과 병렬 가능(코드 이동 아님). RESTRUCTURE-001 재스코프 문서 작업도 A 검증과 병렬 가능.
- **비병렬**: B 구현(schema 분할·codemod)과 E 코드 이동은 동시 금지(import 경로 충돌).

### 5.2 Phase 진입/종료 게이트

| Phase | 진입 게이트 | 종료 게이트 |
|---|---|---|
| A | (없음) | A-V1~A-V8 green + `.archive-manifest.json` 생성 + 회귀 baseline 확정 + 상태 문구 정정 |
| B | A 종료 + RESTRUCTURE-001 kernel-only 재스코프 승인 | B1~B5 green + `drizzle-kit check` + 순환의존 0 + codemod 누락 0 + 회귀 신규 failure 0 |
| E | B 종료 + SPEC-V3-BFF-001 승인(annotation 완료) + traceability #2 결정 + PCCP 역할 결정 | BFF 계약 테스트 green + mock SaaS integration E2E + Expert Review Gate/disclaimer 보존 검증 |

### 5.3 최상위 리스크 3종

1. **schema.ts 분할 FK 붕괴** (High) — 261 FK · 93 pgTable · 3,531줄. kernel 테이블 cross-file import 시 Drizzle 타입 에러. 완화: B2에서 `drizzle-kit check` 즉시·점진 분리·kernel 테이블만.
2. **codemod 과소추정 + drizzle 선례 오신뢰** (High) — 290 파일(178 아님) + multi-file glob 미배선. 완화: 실측 grep 기준, 동적 import·배럴 포함 누락 검증, glob 신규 배선 `generate --dry`.
3. **Phase E PCCP/저작 게이팅 붕괴 + traceability 전제 오류** (High) — SaaS 저작 경로가 Expert Review Gate·disclaimer 우회(지양-2/4), traceability "아카이브" 오전제. 완화: BFF SPEC에 게이트 보존 REQ 명시, #2 결정 선행.

---

## 6. 이슈 등록 권고 (초안 — 실제 등록은 사용자 검토 후 오케스트레이터 수행)

현재 A/B/E 열린 추적 이슈 없음(#517~#521 전부 closed). 관련 open: #202(Hybrid RA E2E), #37(PCCP Submission Lifecycle), #402(coverage). 아래는 **초안**.

### 초안 1 — Phase A 검증 게이트 정의·실행 (verify-only)
- **제목**: `[P1][거버넌스] v3 Phase A 공식 종료 게이트 — 아카이브 8도메인 검증 + manifest 생성 + 상태 정정`
- **라벨**: `domain/architecture`, `type/verify`, `P1`
- **요약**: A-V1~A-V8 게이트 실행. `.archive-manifest.json` 신규 생성(8도메인). 회귀 baseline(4229 vs 4815) live run 확정. product.md·#519 상태란을 "A 검증 완료 — B/E 착수 가능"으로 정정. product.md L82/L122 "18개"를 "8 + 잔여 KEEP"으로 정정(사용자 승인). **확장 금지**(잔여 도메인 재이동 안 함).

### 초안 2 — Phase B kernel 추출 재개 + RESTRUCTURE-001 재정합
- **제목**: `[P1][구조] v3 Phase B kernel 추출 재개 — SPEC-V3-RESTRUCTURE-001 kernel-only 재스코프`
- **라벨**: `component/backend`, `component/schema`, `type/restructure`, `domain/architecture`, `P1`
- **요약**: RESTRUCTURE-001을 kernel-only로 재스코프(§3.6의 8개 정정). lib/kernel 추출, schema-kernel.ts 발췌, drizzle glob **신규 배선**(선례 미검증), codemod **290 파일**(178 아님) import 경로 변경, 순환의존 0. tasks.md 재작성(archive 태스크 제거). ARCHIVE/KERNEL SPEC-ID 참조 통일.

### 초안 3 — Phase E BFF SPEC 신규 작성 + PCCP 저작 역할 결정
- **제목**: `[P2][통합] v3 Phase E — SPEC-V3-BFF-001 신규 작성 + PCCP 저작 역할(Regula vs SaaS) 결정(#521 defer)`
- **라벨**: `component/backend`, `type/integration`, `domain/architecture`, `P2`
- **요약**: SPEC-V3-BFF-001 신규(EARS). lib/api 7파일 → lib/bff 이동(시그니처 불변). 6 integration points + mock SaaS 계약 테스트. #521 PCCP 저작 역할 확정(마스터 §6.4 기준) + Expert Review Gate·disclaimer 보존 REQ. integration point #2 traceability "아카이브" 전제 정정 결정. Azure api-prod 인증 리스크. #37·#202와 경계 정의.

### 초안 4 — (선택) 문서 정합성 정정
- **제목**: `[P2][문서] v3 stale 수치 정정 — 아카이브 18→8, codemod 178→290, drizzle glob, product.md 정합`
- **라벨**: `documentation`, `domain/architecture`, `P2`
- **요약**: product.md v3.0.0·CHARTER·structure.md·마스터 §7의 "18도메인"·"178파일"·"drizzle glob 선례" 실측 정정. (초안 1·2에 흡수 가능.)

---

Version: 1.0.0
Created: 2026-07-19
Author: manager-strategy
Status: 계획서(승인 대기). 코드 실행 없음. Phase A는 verify-only.
