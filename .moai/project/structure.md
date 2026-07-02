# 프로젝트 구조 — Regula (v3)

> 버전: 3.0.0
> 최종 업데이트: 2026-07-02
> 개정 사유: v3 타겟 아키텍처 (kernel/domain/archive 3-Tier) 기반 재정의
> 기준 문서: docs/proposals/v3-architecture-revamp-plan-2026-07-02.md

---

## v3 타겟 아키텍처 (3-Tier 계층 2.5)

### 전체 구조

```
ra-med-bot/
├── lib/
│   ├── kernel/                    ← 신규: 공유 인프라 추상화 계층
│   │   ├── db/                    ← 기존 lib/db/ 이동 (client, schema-kernel.ts)
│   │   ├── auth/                  ← 기존 lib/auth/ 이동 (Auth.js v5, RBAC)
│   │   ├── audit/                 ← 기존 lib/audit/ 이동 (writeAudit, hash chain 강화)
│   │   ├── ratelimit/             ← 기존 lib/ratelimit/ 이동
│   │   ├── storage/               ← 기존 lib/storage/ 이동
│   │   ├── schemas/               ← 기존 lib/schemas/ (Zod 공유)
│   │   └── index.ts               ← 공개 API (도메인은 kernel에만 의존)
│   │
│   ├── domains/                   ← 비즈니스 도메인 (kernel에만 의존)
│   │   ├── ai/                    ← 기존 lib/ai/ (RAG, retrievers 5종, consult)
│   │   ├── knowledge-sources/     ← 기존 (per-corpus 5종 + delta-sync, Phase D 완결)
│   │   ├── ingest/                ← 기존 (Inngest 인제스트)
│   │   ├── impact/                ← 확장 (v3 4-layer wizard 기반)
│   │   ├── radar/                 ← 기존 (규제 레이더)
│   │   ├── predicate/             ← 기존 (KEEP)
│   │   ├── cer/                   ← 기존 (KEEP)
│   │   ├── signature/             ← 기존 (Part 11 전자서명)
│   │   ├── expert-review/         ← 기존 (Expert Review Gate 불변)
│   │   ├── digest/                ← 기존
│   │   ├── export/                ← 기존
│   │   ├── notifications/         ← 기존
│   │   ├── workflows/             ← 기존 (PMS/PMCF executors)
│   │   ├── queries/               ← 기존 (공유 쿼리)
│   │   ├── classification/         ← 기존
│   │   ├── classify/              ← 기존 (중복? 검토 후 병합)
│   │   ├── source-governance/     ← 기존 (코퍼스 거버넌스, KEEP)
│   │   ├──
│   │   ├── inbox/                 ← 신규: v3 Kanban + triage_state
│   │   ├── triage/                ← 신규: Auto-Triage 파이프라인
│   │   ├── consult/               ← 신규: v3 Power Chat (lib/ai/consult 분리)
│   │   └── registry/              ← 신규: 제품 자동 추출 (BK-033)
│   │
│   ├── bff/                       ← 신규: hybrid-ra-saas 정식 BFF 레이어
│   │   ├── hybrid-ra-client.ts    ← 기존 lib/api/에서 이동
│   │   ├── evidence-client.ts     ← 기존 이동
│   │   ├── traceability-client.ts ← 기존 이동
│   │   ├── authoring-client.ts    ← 기존 이동
│   │   ├── checklist-client.ts    ← 기존 이동
│   │   ├── with-auth.ts           ← 기존 이동
│   │   └── index.ts
│   │
│   ├── infra/                     ← 플랫폼 인프라 (cloudflare, observability, inngest)
│   │   ├── cloudflare/
│   │   ├── observability/
│   │   ├── inngest/
│   │   ├── gitea/
│   │   └── external/              ← fda-510k, eudamed 등 외부 API 클라이언트
│   │
│   └── feature-flags.ts           ← 런타임 토글 (계층 1 유지)
│
├── archive/                       ← 신규: QMS/PLM 도메인 아카이브
│   └── qms-pms/
│       ├── lib/                   ← 171 files (18 도메인)
│       ├── app/                   ← 115 files (라우트)
│       ├── tests/                 ← 9 files
│       ├── specs/                 ← 16 SPEC 디렉토리
│       ├── README.md              ← 아카이브 사유 + 복원 방법
│       └── .archive-manifest.json ← 파일 목록 + 체크섬
│
├── migrations/                    ← 선형 체인 유지 (이동 안 함)
│   ├── 0001_initial.sql
│   ├── ...
│   └── 0106_latest.sql            ← 도메인 태그 추가 (주석)
│
├── components/                    ← v3 신규 작성 (재사용 X)
│   ├── shell/
│   │   ├── PersonaBar.tsx         ← 3-tier (Employee/RA/Admin)
│   │   ├── SidebarV3.tsx
│   │   └── Topbar.tsx
│   ├── employee/                  ← 5화면
│   ├── ra/                        ← 6화면
│   ├── admin/                     ← 12화면
│   └── shared/                    ← ModalHost, ToastHost, SearchPalette
│
└── app/
    ├── (auth)/                    ← SSO
    ├── (employee)/                ← 5 라우트
    ├── (ra)/                      ← 6 라우트
    └── admin/                     ← 12 라우트
```

---

## lib/ 50도메인 매핑 테이블 (전체)

### 재사용 (KEEP — kernel로 이동 또는 domains/ 유지)

| 현재 위치 | 이동 위치 | 역할 | 비고 |
|---|---|---|---|
| `lib/db/` | `lib/kernel/db/` | DB 클라이언트, schema-kernel | schema-docingest.ts 동반 |
| `lib/auth/` | `lib/kernel/auth/` | Auth.js v5, RBAC | 178 파일 참조 |
| `lib/audit/` | `lib/kernel/audit/` | writeAudit, append-only | hash chain 강화 (v3) |
| `lib/ratelimit/` | `lib/kernel/ratelimit/` | KV ratelimiter | |
| `lib/storage/` | `lib/kernel/storage/` | Object storage | |
| `lib/schemas/` | `lib/kernel/schemas/` | Zod 공유 스키마 | |
| `lib/ai/` | `lib/domains/ai/` | RAG, retrievers (5종), consult | per-corpus 재사용 |
| `lib/knowledge-sources/` | `lib/domains/knowledge-sources/` | delta-sync, ingestDocuments | Phase D 완결 |
| `lib/ingest/` | `lib/domains/ingest/` | Inngest 인제스트 | |
| `lib/inngest/` | `lib/infra/inngest/` | Inngest 설정 | |
| `lib/impact/` | `lib/domains/impact/` | analyzer, scanner | v3 4-layer 기반 |
| `lib/radar/` | `lib/domains/radar/` | 규제 레이더 | knowledge-gap 의존 제거 |
| `lib/predicate/` | `lib/domains/predicate/` | Predicate 비교 | KEEP |
| `lib/cer/` | `lib/domains/cer/` | CER 작성 | KEEP |
| `lib/signature/` | `lib/domains/signature/` | Part 11 전자서명 | 불변 |
| `lib/source-governance/` | `lib/domains/source-governance/` | 코퍼스 거버넌스 | KEEP |
| `lib/digest/` | `lib/domains/digest/` | 규제 업데이트 | KEEP |
| `lib/export/` | `lib/domains/export/` | PDF/Markdown export | KEEP |
| `lib/notifications/` | `lib/domains/notifications/` | 알림 | KEEP |
| `lib/workflows/` | `lib/domains/workflows/` | PMS/PMCF executors | KEEP |
| `lib/queries/` | `lib/domains/queries/` | 공유 쿼리 | KEEP |
| `lib/classification/` | `lib/domains/classification/` | 분류 | KEEP |
| `lib/classify/` | `lib/domains/classify/` | 분류 (중복?) | 검토 후 병합 |
| `lib/gitea/` | `lib/infra/gitea/` | 사내 NAS Git | |
| `lib/cloudflare/` | `lib/infra/cloudflare/` | CF 런타임 | |
| `lib/observability/` | `lib/infra/observability/` | Sentry/PostHog | |
| `lib/external/` | `lib/infra/external/` | fda-510k, eudamed 등 | |
| `lib/acl/` | `lib/kernel/acl/` | 접근 제어 | kernel 보조 |
| `lib/analytics/` | `lib/infra/analytics/` | 분석 | |
| `lib/api/` | `lib/bff/` | BFF 클라이언트 6종 | 통합 |
| `lib/webauth/` | `lib/kernel/webauth/` | WebAuthn | |
| `lib/seeds/` | `lib/kernel/seeds/` | 시드 데이터 | |
| `lib/feature-flags.ts` | 제자리 유지 | 런타임 토글 | 계층 1 |

### 신규 (v3 도메인)

| 신규 위치 | 역할 | 기반 |
|---|---|---|
| `lib/domains/inbox/` | Kanban 4-column, triage_state, ESIG 승인 | 신규 (v3 02_data_model.md) |
| `lib/domains/triage/` | Auto-Triage 파이프라인 (RAG+LLM+confidence) | 신규 (v3 05_playbook.md 의사코드) |
| `lib/domains/consult/` | Power Chat 세션 (관할권 비교, 저장) | lib/ai/consult 분리 |
| `lib/domains/registry/` | 제품 자동 추출 (BK-033), product_markets | 신규 |

### 아카이브 (archive/qms-pms/로 이동)

| 현재 위치 | 파일 수 (lib) | 라우트 (app) | SPEC | 아카이브 사유 |
|---|---|---|---|---|
| `lib/clinical-investigation/` | 12 | 11 | SPEC-REGULA-CLINICAL-INVESTIGATION-001 | QMS 임상 도메인 |
| `lib/cyberdevice/` | 14 | 6 | SPEC-REGULA-CYBERDEVICE-001 | UI 노출 0, API-only |
| `lib/model-governance/` | 13 | 6 | SPEC-REGULA-MODEL-GOVERNANCE-001 | 6-8명 팀엔 과잉 MLOps |
| `lib/labeling/` | 12 | 11 | SPEC-REGULA-LABELING-001 | 경계 도메인 |
| `lib/traceability/` | 17 | 11 | SPEC-REGULA-TRACEABILITY-001 | v3 SaaS 연동으로 이관 |
| `lib/rlhf/` | 17 | 4 | SPEC-REGULA-RLHF-001 | SHRINK: feedback + heatmap만 KEEP |
| `lib/standards/` | 12 | 7 | SPEC-REGULA-STANDARDS-001 | SHRINK: seed 30-50 + 알림만 |
| `lib/change-control/` | 13 | 8 | SPEC-REGULA-CHANGE-CONTROL-001 | [지양-3] QMS 위반 |
| `lib/corpus-license/` | 10 | 3 | SPEC-REGULA-CORPUS-LICENSE-001 | [지양-5] SaaS 경계 |
| `lib/pccp/` | 14 | 6 | SPEC-REGULA-PCCP-001 | v3 SaaS 연동 검토 |
| `lib/knowledge-gap/` | 13 | 4 | SPEC-REGULA-KNOWLEDGE-GAP-001 | SHRINK: detector만 |
| `lib/knowledge-promo/` | 5 | 4 | SPEC-REGULA-KNOWLEDGE-PROMO-001 | RETIRE |
| `lib/project-memory/` | 4 | 4 | SPEC-REGULA-PROJECT-MEMORY-001 | SHRINK: 수동 메모만 |
| `lib/risk/` | 11 | 13 | SPEC-REGULA-RISK-001 | v3 SaaS 연동으로 이관 |
| `lib/dhf/` | 1 | 11 | (SPEC 없음) | QMS 핵심 |
| `lib/pms/` | 1 | 0 | SPEC-REGULA-PMS-001 | QMS (라우트는 workflows 사용) |
| `lib/samd/` | 1 | 7 | (SPEC 없음) | QMS 보조 |
| `lib/esubmit/` | 1 | 9 | (SPEC 없음) | stub, UI 0 |

**아카이브 합계**: lib 171 + app 115 + tests 9 + migrations 40 (참조만, 이동 안 함) + specs 16 = **334 files + 40 migration 참조**

> **마스터 계획과의 차이**: 마스터 계획은 app 전체를 115 files로 집계했으나, 실제 검증 결과 **app/api 58 files** + **app/(auth)/(app)/(admin)/(employee)/(ra) 하위 57 files**로 115 files 맞음. 기준 차이를 명시.

---

## 의존성 정정 (중요 — 마스터 계획 보정)

### KEEP → Archive cross-import (실제 38건)

마스터 계획 §1.2는 "2건"으로 과소평가했으나, 실제 검증 결과 **38건**의 cross-import가 확인됨.

| KEEP 도메인 | Archive 도메인 | Import 수 | 해결책 |
|-----------|--------------|----------|--------|
| `lib/ai` | `lib/rlhf` | 10 | 어댑터 stub (feedback-adapter.ts) |
| `lib/radar` | `lib/knowledge-gap` | 5 | 어댑터 stub (gap-adapter.ts) |
| `lib/predicate` | `lib/traceability` | 5 | 어댑터 stub 또는 기능 축소 |
| `lib/standards` | `lib/model-governance` | 4 | 어댑터 stub 또는 기능 축소 |
| `lib/corpus-license` | `lib/pccp` | 4 | 어댑터 stub 또는 기능 축소 |
| `lib/pccp` | `lib/corpus-license` | 4 | 어댑터 stub 또는 기능 축소 |
| `lib/rlhf` | `lib/ai` | 3 | SHRINK: feedback + heatmap만 lib/ai/로 가져오고 나머지 아카이브 |
| `lib/model-governance` | `lib/standards` | 3 | 어댑터 stub 또는 기능 축소 |
| `lib/knowledge-gap` | `lib/radar` | 3 | SHRINK: detector만 lib/radar/로 가져오고 나머지 아카이브 |
| `lib/traceability` | `lib/predicate` | 2 | 어댑터 stub 또는 기능 축소 |
| `lib/change-control` | `lib/workflows` | 1 | 어댑터 stub 또는 기능 축소 |
| `lib/pms` | `lib/workflows` | 1 | 어댑터 stub 또는 기능 축소 |

> **Phase C 실행 전**: stub 교체/import 제거/KEEP 유지 중 처리 필요. structure.md 아카이브 섹션에 명시.

---

## Phase A-E 개편 계획 (마이그레이션 순서)

### Phase A — 아카이브 (Archive 334 files)

- **목표**: QMS/PLM 18 도메인 334 files 물리 이동 → archive/qms-pms/
- **산출물**: archive/qms-pms/ 디렉토리, .archive-manifest.json, 어댑터 stub 2개 (ai, radar)
- **게이트**: 4,806+ tests green (아카이브 9 tests 제외), 기능 동일
- **회귀 전략**: git mv이므로 복원 용이. 실패 시 `git revert` + `git mv` 역순
- **SPEC**: SPEC-V3-ARCHIVE-001 (신규)
- **위험**: ai→rlhf, radar→knowledge-gap 2 의존성. 어댑터 stub로 완화

### Phase B — Kernel 추출 (lib/kernel/ 경계 확립)

- **목표**: 공유 인프라(db/auth/audit/ratelimit/storage)를 lib/kernel/로 격리
- **산출물**: lib/kernel/ 디렉토리, schema-kernel.ts, kernel/index.ts (re-export)
- **게이트**: 4,806+ tests green, 모든 import 경로 정상
- **회귀 전략**: kernel은 re-export 레이어이므로 기존 함수 시그니처 불변. import 경로만 변경
- **SPEC**: SPEC-V3-KERNEL-001 (신규)
- **위험**: 178+ 파일이 auth를 참조 → 일괄 import 경로 변경. 자동화 스크립트 필요

### Phase C — v3 도메인 구현 (신규 기능)

- **목표**: inbox, triage, impact wizard, registry, consult 신규 구현
- **산출물**: lib/domains/inbox/, lib/domains/triage/, lib/domains/impact/ (확장), lib/domains/registry/, lib/domains/consult/
- **게이트**: 신규 도메인 단위 테스트 통과, 기존 4,806 tests green 유지
- **회귀 전략**: 신규 도메인이므로 기존 코드 영향 없. 다만 consult 분리 시 lib/ai/consult 참조 처리
- **SPEC**: SPEC-V3-INBOX-001, SPEC-V3-TRIAGE-001, SPEC-V3-IMPACT-001, SPEC-V3-REGISTRY-001, SPEC-V3-CONSULT-001
- **위험**: triage가 ai(RAG) + inbox를 조합 → 오케스트레이션 복잡도. 문서화로 완화

### Phase D — UI 재작성 + Audit hash chain

- **목표**: 3-tier PersonaBar, components/ 전면 재작성, audit_log hash chain 강화
- **산출물**: components/ (shell/employee/ra/admin/shared), audit previous_hash BYTEA 추가
- **게이트**: E2E (Playwright) 3 페르소나 화면 통과, hash chain 검증 크론 동작
- **회귀 전략**: UI는 신규이므로 기존 components/는 archive/로 이동 가능. audit hash chain은 migration 추가
- **SPEC**: SPEC-V3-UI-001, SPEC-V3-AUDIT-CHAIN-001
- **위험**: UI 전면 재작성은 일정 지연 가능성. audit hash chain은 데이터 마이그레이션 필요 (기존 audit_log에 previous_hash 채우기)

### Phase E — BFF 통합 + hybrid-ra-saas 심화 연동

- **목표**: lib/api/ 6 클라이언트 → lib/bff/ 통합, 6 integration points 활성화
- **산출물**: lib/bff/ 정식 레이어, integration 흐름 6종 구현
- **게이트**: BFF 클라이언트 단위 테스트, integration E2E (mock SaaS)
- **회귀 전략**: 기존 lib/api/ 클라이언트를 이동하므로 함수 시그니처 유지. import 경로만 변경
- **SPEC**: SPEC-V3-BFF-001
- **위험**: Azure api-prod 인증 만료, SaaS 측 API 스키마 변경. mock 테스트로 완화

---

## schema.ts 분할 전략 (Drizzle 다중 스키마 파일)

**선례**: `lib/db/schema-docingest.ts`가 이미 존재하며 검증된 패턴.

**분할 계획**:

| 파일 | 내용 | 테이블 수 (예상) |
|---|---|---|
| `lib/kernel/db/schema-kernel.ts` | users, audit_log, audit_verify_history, sessions | ~5 |
| `lib/domains/ai/schema-ai.ts` | conversations, messages, embeddings, retriever 캐시 | ~8 |
| `lib/domains/knowledge-sources/schema-ks.ts` | source_sections, git_repos, sync_log | ~4 |
| `lib/domains/inbox/schema-inbox.ts` | **신규**: inbox_tickets, triage_log | ~3 |
| `lib/domains/impact/schema-impact.ts` | impact_results, retest_matrix | ~2 |
| `lib/domains/registry/schema-registry.ts` | **신규**: products, product_markets | ~3 |
| `lib/db/schema.ts` (레거시) | KEEP 도메인 테이블 (감소 상태 유지) | ~40 |

**Drizzle 설정**: `drizzle.config.ts`에서 모든 schema 파일을 glob으로 로드 (이미 schema-docingest.ts와 schema.ts를 함께 읽으므로 패턴 확장만 필요).

**주의**: 아카이브 도메인 테이블(clinical_investigation, capa, change_control 등)은 schema.ts에서 **삭제하지 않고** 레거시 섹션으로 표시. 이유: migration 체인(261 FK)이 이 테이블들을 참조하므로, 스키마 정의를 제거하면 Drizzle 타입 에러 발생. 대신 `@deprecated` 주석 + 아카이브 도메인 코드 이동으로 런타임 접근 차단.

---

## 공유 인프라 경계 (kernel 추상화 원칙)

**kernel의 역할**: 도메인이 직접 DB 클라이언트나 audit 함수를 호출하지 않고, kernel 인터페이스를 통해 호출.

```typescript
// lib/kernel/index.ts (공개 API)
export { db, withTenantScope } from './db/client';
export { getSession, requireRole, withPermission } from './auth';
export { writeAudit, verifyHashChain } from './audit';
export { rateLimit } from './ratelimit';
export { uploadAsset } from './storage';
```

**도메인 규칙**:
- 도메인은 `@/lib/kernel`과 `@/lib/schemas`만 import 가능
- 도메인 간 직접 import 금지 (필요 시 라우트 레이어에서 조합)
- 예외: `lib/domains/triage`는 `lib/domains/ai`(RAG 검색)와 `lib/domains/inbox`(티켓 생성)를 조합할 수 있음 (오케스트레이션 도메인)

**과잉한 추상화 지양 (TRUST 5 Readable)**:
- kernel은 인터페이스가 아닌 **re-export 레이어** (thin wrapper). 새로운 추상층을 만들지 않고 기존 함수를 그대로 노출.
- 의존성 역전 인터페이스(Interface segregation) 도입 안 함. 6-8명 팀에 불필요.

---

## 관련 문서

- **v3 마스터 계획**: docs/proposals/v3-architecture-revamp-plan-2026-07-02.md
- **v3 원본 문서**: docs/v3/ (README + 5개 하위 문서)
- **제품 정의**: product.md
- **기술 명세**: tech.md
