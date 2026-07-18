# Regula v3 아키텍처 전면 개편 마스터 계획서

> **작성일**: 2026-07-02
> **상태**: ~~제안 (Proposal) — 사용자 승인 대기~~ → **부분 실행 중** (2026-07-18 정정, #519)
> **작성자**: manager-strategy (MoAI 오케스트레이터)
>
> **상태 정정 (2026-07-18, #519)**: "승인 대기" 문구는 stale. 방향 5종은 위 "사용자 확정 방향"에
> 이미 사용자 확정 기록이 있고, **Phase C/D는 구현·머지 완료**(INBOX/TRIAGE/CONSULT/IMPACT/
> AUDIT-CHAIN/PERSONA — SPEC-V3-* 이슈 #320/#321/#339/#341/#357 등으로 추적). **Phase A/B**
> (kernel 추출·archive: archive/qms-pms/에 8도메인 이동됨, kernel/bff/infra 미착수)와 **Phase E**
> (BFF)는 미착수. ⚠️ **공식 실행 승인 기록은 없음** — Phase C/D는 별도 승인 절차 없이 구현으로
> 진행됨(감사 추적 공백). 향후 아키텍처 결정은 채택 도장(예: scope-rationalization "✅ 채택됨")을
> 남길 것.
> **대상**: Regula(ra-med-bot) v3 아키텍처 개편
> **사용자 확정 방향**: 5종 (점진적 마이그레이션 / QMS 아카이브 / UI v3 신규 / hybrid-ra-saas 심화 / 모듈화 전면 개편)
> **선행 문서**: `docs/proposals/scope-rationalization-2026-06-28.md` (계층 1-2 채택됨), `docs/v3/` 전체

---

## 0. 요약 (Executive Summary)

본 계획은 v3 아키텍처 개편을 위한 전략-설계 문서로, **이전 제안서의 "계층 3 보류" 결론을 번복**하고 **계층 2.5 (Balanced — kernel/domain/archive 3-tier)** 를 권고한다.

**번복 근거**: 이전 제안은 "도메인 간 결합도가 높아 물리적 분리 비용이 크다"고 판단했으나, 2026-07-02 직접 검증 결과 **아카이브 대상 18개 도메인의 cross-import는 평균 0~2건**(매우 낮음), KEEP 도메인이 아카이브 도메인을 참조하는 경우는 **단 2건**(ai→rlhf, radar→knowledge-gap)에 불과하다. 이 결합도라면 물리적 아카이브 이동과 kernel 추상화가 안전하다.

**5대 핵심 결정**:
1. **모듈화 전략**: 계층 2.5 (kernel/domain/archive 3-tier, Drizzle 다중 스키마 파일)
2. **아카이브**: 334 files / 18 도메인 → `archive/qms-pms/` 물리 이동 (의존성 위험 낮음)
3. **v3 신규**: 8개 SPEC-ID, Phase C-D에서 구현 (inbox/triage/impact/UI/audit-chain/registry/bff/consult)
4. **hybrid-ra-saas**: lib/api/ 기존 4 BFF 클라이언트 → lib/bff/ 정식 레이어로 통합 (6 integration points)
5. **마이그레이션**: Phase A-E 5단계 (회귀 위험 낮은 순: 아카이브 → kernel → v3 도메인 → UI → BFF)

---

## 1. 현황 진단 (직접 검증 데이터)

### 1.1 정량 지표 (2026-07-02 검증)

| 지표 | 측정값 | 비고 |
|---|---|---|
| lib 도메인 수 | **50개** | 평면 구조 (lib/*/ ) |
| schema.ts | **3,232줄 / 86 pgTable / 53 pgEnum** | 단일 파일 (이전 3,473줄/95/57에서 감소) |
| migration | **106개** | 선형 체인 |
| FK REFERENCES | **261개** | 도메인 간 결합 |
| ALTER TABLE | **140개** | 기존 테이블 수정 일상화 |
| 회귀 테스트 | **4,815+ passed** | 보존 필수 (L-007/L-013) |
| 아카이브 대상 | **334 files / 18 도메인** | lib 171 + app 115 + tests 9 + migrations 40 + specs 16 |

### 1.2 아카이브 대상 도메인 결합도 검증 (핵심 근거)

**도메인 간 cross-import** (공유 인프라 제외, 다른 아카이브 도메인을 import하는 횟수):

| 도메인 | cross-import | 평가 |
|---|---|---|
| clinical-investigation, cyberdevice, model-governance, traceability, standards, change-control, corpus-license, pccp, knowledge-promo, project-memory, risk, dhf, pms, samd, esubmit | **0** | 완전 독립 |
| knowledge-gap | 1 | 낮음 |
| labeling, rlhf | 2 | 낮음 |

**KEEP 도메인이 아카이브 도메인을 참조하는 경우** (아카이브 전제 조건):

| KEEP 도메인 | 참조하는 아카이브 도메인 | 해결책 |
|---|---|---|
| `lib/ai` | `lib/rlhf` | 어댑터 stub 또는 기능 축소 (SHRINK) |
| `lib/radar` | `lib/knowledge-gap` | 어댑터 stub 또는 기능 축소 (SHRINK) |

→ **아카이브 안전성 검증 완료**. 2개 의존성만 어댑터 처리하면 334 files 물리 이동 가능.

### 1.3 공유 인프라 결합도 (kernel 추상화 근거)

| 공유 모듈 | 참조 파일 수 | 의미 |
|---|---|---|
| `lib/auth` | **178 파일** | 모든 도메인이 인증/RBAC 의존 |
| `lib/db` | **173 파일** | 모든 도메인이 단일 DB 클라이언트 |
| `lib/audit` (writeAudit) | **116 파일** | 모든 도메인이 감사 로그 호출 |

→ 이것이 kernel 추상화의 정당성. 공유 인프라를 `lib/kernel/`로 격리하면 도메인이 kernel에만 의존하게 되어 독립성 확보.

### 1.4 기존 v3 관련 인프라 (재사용 가능)

| 항목 | 상태 | 비고 |
|---|---|---|
| `lib/impact/` | **존재** (6 files) | analyzer, portfolio-scanner, section-mapper — v3 Impact wizard 기반 |
| `lib/api/hybrid-ra-client.ts` | **존재** | BFF 서버 사이드 HTTP 클라이언트 |
| `lib/api/evidence-client.ts` | **존재** | Evidence API BFF (Issue #168) |
| `lib/api/traceability-client.ts` | **존재** | Traceability API BFF (Issue #169) |
| `lib/api/authoring-client.ts` | **존재** | Authoring API BFF (Issue #171) |
| `lib/feature-flags.ts` | **존재** | 계층 1 (이전 제안 구현) — 런타임 토글 유지 |
| `lib/inbox`, `lib/triage` | **미존재** | v3 신규 구현 필요 |
| `lib/ai/consult` (스트리밍) | **존재** | v3 Consult 마이그레이션 기반 |
| `lib/knowledge-sources` + delta-sync | **존재** | Phase D 완결 — per-corpus RAG 인프라 |

---

## 2. 타겟 아키텍처 (Target Architecture)

### 2.1 3-Tier 모듈 계층 구조 (계층 2.5)

```
ra-med-bot/
├── lib/
│   ├── kernel/                    ← 신규: 공유 인프라 추상화 계층
│   │   ├── db/                    ← 기존 lib/db/ 이동 (client, schema-kernel.ts)
│   │   ├── auth/                  ← 기존 lib/auth/ 이동
│   │   ├── audit/                 ← 기존 lib/audit/ 이동 (hash chain 강화)
│   │   ├── ratelimit/             ← 기존 lib/ratelimit/ 이동
│   │   ├── storage/               ← 기존 lib/storage/ 이동
│   │   ├── schemas/               ← 기존 lib/schemas/ (Zod 공유)
│   │   └── index.ts               ← 공개 API (도메인은 kernel에만 의존)
│   │
│   ├── domains/                   ← 비즈니스 도메인 (kernel에만 의존)
│   │   ├── ai/                    ← 기존 lib/ai/ (RAG, consult, retrievers)
│   │   ├── knowledge-sources/     ← 기존 (per-corpus 5종 + delta-sync)
│   │   ├── ingest/                ← 기존 (Inngest 인제스트)
│   │   ├── impact/                ← 확장 (v3 4-layer wizard 기반)
│   │   ├── radar/                 ← 기존
│   │   ├── predicate/             ← 기존 (KEEP)
│   │   ├── cer/                   ← 기존 (KEEP)
│   │   ├── signature/             ← 기존 (Part 11 전자서명)
│   │   ├── expert-review/         ← 기존 (Expert Review Gate 불변)
│   │   ├── digest/                ← 기존
│   │   ├── export/                ← 기존
│   │   ├── notifications/         ← 기존
│   │   ├── workflows/             ← 기존 (PMS/PMCF executors)
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

### 2.2 schema.ts 분할 전략 (Drizzle 다중 스키마 파일)

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

### 2.3 공유 인프라 경계 (kernel 추상화 원칙)

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

**과도한 추상화 지양 (TRUST 5 Readable)**:
- kernel은 인터페이스가 아닌 **re-export 레이어** (thin wrapper). 새로운 추상층을 만들지 않고 기존 함수를 그대로 노출.
- 의존성 역전 인터페이스(Interface segregation) 도입 안 함. 6-8명 팀에 불필요.

---

## 3. 모듈 재설계 — lib/ 50도메인 매핑 테이블

### 3.1 재사용 (KEEP — kernel로 이동 또는 domains/ 유지)

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

### 3.2 신규 (v3 도메인)

| 신규 위치 | 역할 | 기반 |
|---|---|---|
| `lib/domains/inbox/` | Kanban 4-column, triage_state, ESIG 승인 | 신규 (v3 02_data_model.md) |
| `lib/domains/triage/` | Auto-Triage 파이프라인 (RAG+LLM+confidence) | 신규 (v3 05_playbook.md 의사코드) |
| `lib/domains/consult/` | Power Chat 세션 (관할권 비교, 저장) | lib/ai/consult 분리 |
| `lib/domains/registry/` | 제품 자동 추출 (BK-033), product_markets | 신규 |

### 3.3 아카이브 (archive/qms-pms/로 이동)

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
| ~~`lib/pccp/`~~ | 14 | 6 | SPEC-REGULA-PCCP-001 | **정정(2026-07-18, #521): 아카이브 대상 아님 — KEEP(보존).** PCCP는 규제 제출물(Predetermined Change Control Plan)로 CAPA 같은 QMS가 아니라 FDA/EU MDR 인허가 산출물. 라이브 유지(lib/pccp·lib/workflows/pccp·route 실재), product.md "CER/PCCP/Predicate 보존"과 일치, §6.4 역할 표도 "KEEP". 본 §3.3 아카이브 표 등재는 오기. Regula vs hybrid-ra-saas 저작 역할 분담은 Phase E(BFF) 결정으로 defer. |
| `lib/knowledge-gap/` | 13 | 4 | SPEC-REGULA-KNOWLEDGE-GAP-001 | SHRINK: detector만 |
| `lib/knowledge-promo/` | 5 | 4 | SPEC-REGULA-KNOWLEDGE-PROMO-001 | RETIRE |
| `lib/project-memory/` | 4 | 4 | SPEC-REGULA-PROJECT-MEMORY-001 | SHRINK: 수동 메모만 |
| `lib/risk/` | 11 | 13 | SPEC-REGULA-RISK-001 | v3 SaaS 연동으로 이관 |
| `lib/dhf/` | 1 | 11 | (SPEC 없음) | QMS 핵심 |
| `lib/pms/` | 1 | 0 | SPEC-REGULA-PMS-001 | QMS (라우트는 workflows 사용) |
| `lib/samd/` | 1 | 7 | (SPEC 없음) | QMS 보조 |
| `lib/esubmit/` | 1 | 9 | (SPEC 없음) | stub, UI 0 |

**아카이브 합계**: lib 171 + app 115 + tests 9 + migrations 40 (참조만, 이동 안 함) + specs 16 = **334 files + 40 migration 참조**

---

## 4. 아카이브 계획 (Phase A 상세)

### 4.1 의존성 분석 (이동 전제 조건)

**아카이브 도메인 → KEEP 도메인 역참조 2건**:

1. **`lib/ai` → `lib/rlhf`**: RAG 응답 품질 피드백 루프
   - **해결책**: `lib/domains/ai/feedback-adapter.ts` stub 생성. rlhf 아카이브 시 어댑터가 no-op 반환. SHRINK 정책에 따라 feedback 수집 + heatmap만 `lib/domains/ai/` 내부로 가져오고 나머지 아카이브.

2. **`lib/radar` → `lib/knowledge-gap`**: 레이더 항목의 지식 갭 감지
   - **해결책**: `lib/domains/radar/gap-adapter.ts` stub 생성. knowledge-gap 아카이브 시 어댑터가 no-op 반환. SHRINK 정책에 따라 detector만 `lib/domains/radar/` 내부로 가져오고 나머지 아카이브.

### 4.2 schema.ts 교차 참조 (마이그레이션 영향)

아카이브 도메인 테이블은 schema.ts에서 **삭제하지 않음**:

| 도메인 | schema.ts 참조 라인 | 처리 |
|---|---|---|
| labeling | 50 라인 | `@deprecated` 주석 + 코드 이동 |
| risk | 56 라인 | 위와 동일 |
| standards | 66 라인 | 위와 동일 |
| traceability | 22 라인 | 위와 동일 |
| rlhf | 28 라인 | 위와 동일 |
| pccp | 24 라인 | 위와 동일 |
| dhf | 23 라인 | 위와 동일 |
| (나머지) | 각 6-20 라인 | 위와 동일 |

**이유**: migration 261 FK가 이 테이블들을 참조. schema.ts에서 테이블 정의를 제거하면:
- Drizzle 타입 추론 에러
- 마이그레이션 체인 깨짐
- 4,815 회귀 테스트 중 다수 실패

**대신**: 아카이브 도메인의 **라우트와 lib 코드를 이동**하여 런타임 접근을 차단하고, 스키마 정의는 레거시 섹션에 보존.

### 4.3 RLS / audit enum 교차 참조

| 항목 | 영향 | 완화 |
|---|---|---|
| RLS 정책 | 아카이브 도메인 테이블에 RLS 적용 가능성 | migration 유지 → RLS도 유지 (데이터 보존) |
| audit enum (53개) | 도메인별 action enum (예: `traceability.action`) | enum 값은 코드에서 미사용 → 자연 소멸 |
| permissions.ts | 178 action 중 아카이브 도메인 것 | feature-flags.ts off로 런타임 차단 |

### 4.4 아카이브 이동 순서 (안전 순서)

```
Step 1: 어댑터 stub 생성 (lib/ai, lib/radar에 stub 추가)
Step 2: SHRINK 도메인에서 KEEP 부분 발췌 (rlhf feedback, knowledge-gap detector)
Step 3: feature-flags.ts에서 아카이브 도메인 flag off 확인
Step 4: lib/ 18도메인 → archive/qms-pms/lib/ 로 git mv
Step 5: app/ 라우트 → archive/qms-pms/app/ 로 git mv
Step 6: tests/ → archive/qms-pms/tests/ 로 git mv
Step 7: .moai/specs/ 16 SPEC → archive/qms-pms/specs/ 로 git mv
Step 8: migrations/는 제자리 유지 (선형 체인 보존)
Step 9: .archive-manifest.json 생성 (체크섬 + 복원 매핑)
Step 10: 회귀 테스트 실행 — 게이트: 4,815 tests green
```

### 4.5 archive/ 디렉토리 구조

```
archive/
└── qms-pms/
    ├── README.md                  ← 아카이브 사유, 복원 방법, 의존성 매핑
    ├── .archive-manifest.json     ← {원본 경로: 체크섬, 복원 경로}
    ├── lib/                       ← 171 files
    ├── app/                       ← 115 files
    ├── tests/                     ← 9 files
    └── specs/                     ← 16 SPEC 디렉토리
```

### 4.6 회귀 테스트 보존 전략

- 아카이브 도메인 테스트(9 files)는 `archive/qms-pms/tests/`로 이동하여 **별도 실행** (CI에서 archive 테스트 스킵 또는 별도 job)
- KEEP 도메인 테스트(4,806 files)는 제자리 유지 → 4,815 - 9 = 4,806 tests green 유지
- **게이트**: 각 Phase 종료 시 `pnpm test` 실행, 4,806+ tests passed 확인

---

## 5. v3 신규 기능 로드맵 (Phase C-D)

### 5.1 Phase 매핑 및 SPEC-ID

| Phase | SPEC-ID | 기능 | 도메인 | 의존성 |
|---|---|---|---|---|
| C-1 | **SPEC-V3-INBOX-001** | RA Inbox 4-column Kanban | `lib/domains/inbox/` | kernel/db, kernel/audit |
| C-2 | **SPEC-V3-TRIAGE-001** | Auto-Triage 파이프라인 | `lib/domains/triage/` | domains/ai (RAG), domains/inbox, gx10 Ollama |
| C-3 | **SPEC-V3-IMPACT-001** | Change Impact 4-layer wizard | `lib/domains/impact/` (확장) | 기존 lib/impact 6 files + retestMatrix 데이터 |
| C-4 | **SPEC-V3-REGISTRY-001** | 제품 자동 추출 (BK-033) | `lib/domains/registry/` | domains/knowledge-sources (ra-llm-wiki 파싱) |
| C-5 | **SPEC-V3-CONSULT-001** | Power Chat 세션 (관할권 비교) | `lib/domains/consult/` | lib/ai/consult 분리 |
| D-1 | **SPEC-V3-AUDIT-CHAIN-001** | audit_log SHA-256 hash chain 강화 | `lib/kernel/audit/` | 기존 append-only + previous_hash BYTEA |
| D-2 | **SPEC-V3-UI-001** | 3-tier PersonaBar + components/ 재작성 | `components/` | 전체 (신규 UI) |
| E-1 | **SPEC-V3-BFF-001** | hybrid-ra-saas BFF 정식 레이어 | `lib/bff/` | 기존 lib/api/ 4 클라이언트 통합 |

### 5.2 v3 데이터 모델 매핑 (docs/v3/02_data_model.md 기준)

| v3 테이블 | schema 파일 | 마이그레이션 |
|---|---|---|
| `users` | `schema-kernel.ts` | 기존 (확장: role CHECK 제약) |
| `inbox_tickets` | `schema-inbox.ts` (신규) | migration 0107 |
| `approved_answers` | `schema-inbox.ts` (신규) | migration 0108 |
| `products` + `product_markets` | `schema-registry.ts` (신규) | migration 0109 |
| `audit_log` (hash chain) | `schema-kernel.ts` (수정) | migration 0110 (previous_hash BYTEA 추가) |
| `embeddings` | `schema-ai.ts` | 기존 유지 (pgvector) |
| `submissions` | `schema-registry.ts` | migration 0111 |

### 5.3 retestMatrix 데이터 통합

`docs/v3/reference/data.jsx:1203`의 retestMatrix (7 changeTypes × 5 markets = 35셀)는 `lib/domains/impact/retest-matrix-data.ts`로 변환하여 코드 내장. 이유: 결정론 데이터이므로 DB 저장 불필요, 코드로 임베드하면 즉시 구현 가능 (v3 05_playbook.md "계층 1은 즉시 구현 가능").

---

## 6. hybrid-ra-saas 연동 설계 (Phase E)

### 6.1 기존 BFF 인프라 (lib/api/)

| 클라이언트 | 현재 위치 | 이슈 | 역할 |
|---|---|---|---|
| `hybrid-ra-client.ts` | lib/api/ | #156, #170 | 서버 사이드 HTTP 클라이언트 (Azure api-prod) |
| `evidence-client.ts` | lib/api/ | #168 | Evidence API (requirement-evidence link) |
| `traceability-client.ts` | lib/api/ | #169 | Traceability API (노드/엣지 스캔) |
| `authoring-client.ts` | lib/api/ | #171 | Authoring API (세션, 드래프트) |
| `checklist-client.ts` | lib/api/ | (추정) | Checklist API |
| `with-auth.ts` | lib/api/ | (공통) | 인증 헬퍼 |

### 6.2 BFF 정식 레이어 (lib/bff/)

**통합 방향**: 기존 6개 클라이언트를 `lib/bff/`로 이동하고, 공통 에러 처리, 재시도, 타임아웃, 인증 일원화.

```
lib/bff/
├── hybrid-ra-client.ts      ← Azure api-prod 서버 사이드
├── evidence-client.ts       ← Evidence API (브라우저 BFF)
├── traceability-client.ts   ← Traceability API (브라우저 BFF)
├── authoring-client.ts      ← Authoring API (브라우저 BFF)
├── checklist-client.ts      ← Checklist API
├── with-auth.ts             ← 공통 인증 헬퍼
├── error-handling.ts        ← HybridRaClientError, 재시도 정책
└── index.ts                 ← 공개 API
```

### 6.3 hybrid-ra-saas 연동 흐름 (6 integration points)

| # | Regula 측 | SaaS 측 | 방향 | 이슈 |
|---|---|---|---|---|
| 1 | `lib/domains/impact/` | Evidence API | Regula → SaaS | 변경 영향 평가 결과를 SaaS Evidence로 전송 (#168) |
| 2 | (아카이브) traceability | Traceability API | SaaS → Regula | SaaS가 노드/엣지 스캔 요청 (#169). 아카이브 후 어댑터로 우회 |
| 3 | `lib/domains/consult/` | Authoring API | Regula → SaaS | Consult 세션에서 초안 작성 시 SaaS Authoring 세션 생성 (#171) |
| 4 | `lib/domains/inbox/` | Hybrid-Ra API | 양방향 | 승인 답변을 SaaS로 전송, SaaS에서 리비전 동기화 (#156, #170) |
| 5 | `lib/domains/registry/` | Hybrid-Ra API | Regula → SaaS | 제품 마스터 동기화 (BK-033 자동 추출 결과) |
| 6 | `lib/kernel/audit/` | (없음) | Regula 내부 | 감사 로그는 SaaS로 전송 안 함 (21 CFR Part 11 내부 통제) |

### 6.4 역할 분담 (Regula vs hybrid-ra-saas)

| 기능 | Regula (본 시스템) | hybrid-ra-saas (별도 SaaS) |
|---|---|---|
| RAG Q&A (Ask) | **주** | 보조 (Evidence 조회) |
| Inbox Kanban / Auto-Triage | **주** | 미관여 |
| Impact Check | **주** (4-layer) | Evidence 수신 |
| 제품 마스터 | **주** (자동 추출) | 동기화 수신 |
| Consult (관할권 비교) | **주** | Authoring 세션 제공 |
| Traceability Matrix | (아카이브) | **주** (SaaS에서 소유) |
| CER/PCCP 작성 | (KEEP이지만 SaaS 연동) | **주** (문서 작성 워크벤치) |
| 감사 로그 | **주** (내부 Part 11) | 미관여 |
| 승인 답변집 | **주** (DB + git 스냅샷) | 리비전 참조 |

---

## 7. 마이그레이션 Phase A-E (회귀 위험 낮은 순)

### Phase A — 아카이브 (Archive 334 files)

| 항목 | 내용 |
|---|---|
| **목표** | QMS/PLM 18 도메인 334 files 물리 이동 → archive/qms-pms/ |
| **산출물** | archive/qms-pms/ 디렉토리, .archive-manifest.json, 어댑터 stub 2개 (ai, radar) |
| **게이트** | 4,806+ tests green (아카이브 9 tests 제외), 기능 동일 |
| **회귀 전략** | git mv이므로 복원 용이. 실패 시 `git revert` + `git mv` 역순 |
| **SPEC** | SPEC-V3-ARCHIVE-001 (신규) |
| **위험** | ai→rlhf, radar→knowledge-gap 2 의존성. 어댑터 stub로 완화 |

**세부 단계**:
1. 어댑터 stub 생성 (lib/ai/feedback-adapter.ts, lib/radar/gap-adapter.ts)
2. SHRINK 발췌 (rlhf feedback/heatmap → lib/ai/, knowledge-gap detector → lib/radar/)
3. feature-flags.ts 아카이브 flag off 확인
4. lib/ 18도메인 git mv → archive/qms-pms/lib/
5. app/ 라우트 git mv → archive/qms-pms/app/
6. tests/ git mv → archive/qms-pms/tests/
7. .moai/specs/ 16 SPEC git mv → archive/qms-pms/specs/
8. migrations/ 제자리 유지
9. .archive-manifest.json 생성
10. 회귀 테스트 게이트

### Phase B — Kernel 추출 (lib/kernel/ 경계 확립)

| 항목 | 내용 |
|---|---|
| **목표** | 공유 인프라(db/auth/audit/ratelimit/storage)를 lib/kernel/로 격리 |
| **산출물** | lib/kernel/ 디렉토리, schema-kernel.ts, kernel/index.ts (re-export) |
| **게이트** | 4,806+ tests green, 모든 import 경로 정상 |
| **회귀 전략** | kernel은 re-export 레이어이므로 기존 함수 시그니처 불변. import 경로만 변경 |
| **SPEC** | SPEC-V3-KERNEL-001 (신규) |
| **위험** | 178+ 파일이 auth를 참조 → 일괄 import 경로 변경. 자동화 스크립트 필요 |

**세부 단계**:
1. lib/kernel/ 디렉토리 생성
2. lib/db/ → lib/kernel/db/ (schema-docingest.ts 동반)
3. lib/auth/ → lib/kernel/auth/
4. lib/audit/ → lib/kernel/audit/ (hash chain 강화는 Phase D)
5. lib/ratelimit/, lib/storage/, lib/schemas/ → lib/kernel/
6. schema.ts에서 kernel 테이블(users, audit_log 등) 발췌 → schema-kernel.ts
7. lib/kernel/index.ts 공개 API 작성
8. codemod 스크립트로 import 경로 일괄 변경 (`@/lib/db` → `@/lib/kernel/db`)
9. 회귀 테스트 게이트

### Phase C — v3 도메인 구현 (신규 기능)

| 항목 | 내용 |
|---|---|
| **목표** | inbox, triage, impact wizard, registry, consult 신규 구현 |
| **산출물** | lib/domains/inbox/, lib/domains/triage/, lib/domains/impact/ (확장), lib/domains/registry/, lib/domains/consult/ |
| **게이트** | 신규 도메인 단위 테스트 통과, 기존 4,806 tests green 유지 |
| **회귀 전략** | 신규 도메인이므로 기존 코드 영향 없. 다만 consult 분리 시 lib/ai/consult 참조 처리 |
| **SPEC** | SPEC-V3-INBOX-001, SPEC-V3-TRIAGE-001, SPEC-V3-IMPACT-001, SPEC-V3-REGISTRY-001, SPEC-V3-CONSULT-001 |
| **위험** | triage가 ai(RAG) + inbox를 조합 → 오케스트레이션 복잡도. 문서화로 완화 |

**세부 단계**:
1. lib/domains/ 디렉토리 생성 + KEEP 도메인 이동 (lib/ai, lib/impact 등)
2. lib/domains/inbox/ 구현 (Kanban, triage_state, ESIG)
3. lib/domains/triage/ 구현 (Auto-Triage 파이프라인, gx10 Ollama 연동)
4. lib/domains/impact/ 확장 (4-layer wizard, retestMatrix 데이터 임베드)
5. lib/domains/registry/ 구현 (제품 자동 추출, product_markets)
6. lib/domains/consult/ 분리 (lib/ai/consult 기반 Power Chat)
7. 각 도메인별 단위 테스트 + 통합 테스트
8. 회귀 테스트 게이트

### Phase D — UI 재작성 + Audit hash chain

| 항목 | 내용 |
|---|---|
| **목표** | 3-tier PersonaBar, components/ 전면 재작성, audit_log hash chain 강화 |
| **산출물** | components/ (shell/employee/ra/admin/shared), audit previous_hash BYTEA 추가 |
| **게이트** | E2E (Playwright) 3 페르소나 화면 통과, hash chain 검증 크론 동작 |
| **회귀 전략** | UI는 신규이므로 기존 components/는 archive/로 이동 가능. audit hash chain은 migration 추가 |
| **SPEC** | SPEC-V3-UI-001, SPEC-V3-AUDIT-CHAIN-001 |
| **위험** | UI 전면 재작성은 일정 지연 가능성. audit hash chain은 데이터 마이그레이션 필요 (기존 audit_log에 previous_hash 채우기) |

**세부 단계**:
1. components/ 기존 코드 → archive/legacy-ui/ 이동 (선택적)
2. components/shell/PersonaBar.tsx (3-tier 스위치)
3. components/shell/SidebarV3.tsx (페르소나 인지)
4. components/employee/ (5화면: Ask, MyQuestions, Products, Guides, Impact)
5. components/ra/ (6화면: Inbox, Consult, Submissions, Registry, Radar, Knowledge)
6. components/admin/ (12화면, 5 카테고리)
7. components/shared/ (SearchPalette, ModalHost, ToastHost)
8. app/ 라우트 재구성 ((employee), (ra), admin)
9. audit_log migration (previous_hash BYTEA, hash BYTEA 추가)
10. audit_log_hash_trigger() 함수 배포
11. verify-audit-chain Inngest 크론 (월간)
12. E2E 게이트

### Phase E — BFF 통합 + hybrid-ra-saas 심화 연동

| 항목 | 내용 |
|---|---|
| **목표** | lib/api/ 6 클라이언트 → lib/bff/ 통합, 6 integration points 활성화 |
| **산출물** | lib/bff/ 정식 레이어, integration 흐름 6종 구현 |
| **게이트** | BFF 클라이언트 단위 테스트, integration E2E (mock SaaS) |
| **회귀 전략** | 기존 lib/api/ 클라이언트를 이동하므로 함수 시그니처 유지. import 경로만 변경 |
| **SPEC** | SPEC-V3-BFF-001 |
| **위험** | Azure api-prod 인증 만료, SaaS 측 API 스키마 변경. mock 테스트로 완화 |

**세부 단계**:
1. lib/api/ → lib/bff/ 이동
2. lib/bff/error-handling.ts 통합 (HybridRaClientError 재사용)
3. lib/bff/index.ts 공개 API
4. integration #1: impact → evidence-client 연동
5. integration #2: traceability 어댑터 (아카이브 우회)
6. integration #3: consult → authoring-client 연동
7. integration #4: inbox → hybrid-ra-client 양방향
8. integration #5: registry → hybrid-ra-client 제품 동기화
9. codemod: lib/api/ import 경로 일괄 변경
10. integration 테스트 (mock SaaS + real Azure staging)

---

## 8. Phase별 산출물 및 게이트 요약

| Phase | SPEC-ID | 산출물 | 게이트 | 회귀 위험 |
|---|---|---|---|---|
| A | SPEC-V3-ARCHIVE-001 | archive/qms-pms/ (334 files), 어댑터 2개 | 4,806 tests green | 낮음 (어댑터로 완화) |
| B | SPEC-V3-KERNEL-001 | lib/kernel/, schema-kernel.ts | 4,806 tests green | 낮음 (re-export 레이어) |
| C | SPEC-V3-INBOX/TRIAGE/IMPACT/REGISTRY/CONSULT-001 | lib/domains/ 5 신규 도메인 | 도메인별 테스트 + 4,806 green | 중간 (triage 오케스트레이션) |
| D | SPEC-V3-UI-001, SPEC-V3-AUDIT-CHAIN-001 | components/ 재작성, hash chain | E2E 3 페르소나 + hash chain 크론 | 중간 (UI 일정, audit 데이터 마이그레이션) |
| E | SPEC-V3-BFF-001 | lib/bff/, 6 integration points | BFF 단위 + integration E2E | 낮음 (함수 시그니처 유지) |

---

## 9. 회귀 위험 Top 3 및 완화 전략

### 위험 1: schema.ts 분할 시 Drizzle FK 관계 깨짐 (261 FK)

**시나리오**: schema-kernel.ts로 users/audit_log를 분리할 때, 다른 도메인 테이블(inbox_tickets.from_user REFERENCES users.id)이 users를 참조하지 못해 Drizzle 타입 에러.

**완화**:
- Drizzle은 다중 스키마 파일을 지원하며, 모든 파일을 `drizzle.config.ts`에서 glob 로드 (schema-docingest.ts 선례)
- kernel 테이블을 분리할 때 references는 `schema-kernel.ts`의 export를 import하여 사용
- Phase B에서 schema 분할 후 즉시 `pnpm drizzle-kit check`로 타입 검증
- 실패 시 kernel 테이블을 schema.ts에 잔류시키고 import만 분리 (점진적)

### 위험 2: 아카이브 이동 시 RLS 정책 또는 audit enum 참조 붕괴

**시나리오**: archive/qms-pms/lib/traceability/ 이동 후, 데이터베이스의 traceability 테이블 RLS 정책이나 audit enum(`traceability.action`)이 코드 부재로 에러.

**완화**:
- **migrations는 이동하지 않음** (선형 체인 보존). 테이블 정의 + RLS + enum은 DB에 그대로 존재
- schema.ts에서 아카이브 도메인 테이블을 **삭제하지 않고** `@deprecated` 주석 처리
- 아카이브 도메인 라우트가 없으므로 런타임 접근 차단됨
- enum 값은 코드에서 미사용하므로 자연 소멸 (DB에 남아도 무해)

### 위험 3: Migration 체인 꼬임 (아카이브 도메인 테이블 DROP 시)

**시나리오**: 아카이브 도메인 테이블(clinical_investigation 등)을 DROP하는 migration 작성 시, 다른 테이블이 FK로 참조하고 있어 CASCADE 필요, 예상치 못한 데이터 손실.

**완화**:
- **테이블 DROP 금지**. 아카이브는 코드/라우트 이동만. DB 테이블은 보존
- 데이터가 필요 없으면 별도 `purge` migration에서 `TRUNCATE` (DROP 아님)
- L-013 교훈 적용: 실DB에서 직접 `\d tablename`으로 의존성 확인 후 작업
- Phase A 게이트: 아카이브 후 실DB 스키마 일관성 검증 (`drizzle-kit check` + 수동 `\d`)

---

## 10. 이전 제안서 결론 번복 근거 (감사 추적용)

### 이전 제안서 (`scope-rationalization-2026-06-28.md`)의 계층 3 보류 사유

> "6~8명 내부 팀에는 정당화되지 않음. 필요 시점(예: 외부 납품/팀 20+명/도메인 독립 배포 필요)까지 연기."

### 번복 근거 (2026-07-02 검증)

1. **결합도 재측정**: 이전 제안은 "공유 인프라(db/auth/audit)에 190+ 파일 결합"을 근거로 보류. 그러나 아카이브 대상 도메인 자체의 cross-import는 **0~2건**으로 매우 낮음. 공유 인프라 결합은 높지만, 이는 kernel 추상화(re-export)로 해결 가능 — 도메인이 직접 db 클라이언트를 호출하든 kernel을 통해 호출하든 함수 시그니처는 동일.

2. **트리거 조건 충족**: 이전 제안이 명시한 "명시적 트리거" 중 **"도메인 독립 배포 필요"** 가 v3 요구사항("모듈 단위 추가/삭제 가능 구조", 방향 #5)으로 발생. 340 files 제거 + 5 신규 도메인 추가 + UI 전면 재작성이 동시에 일어나는 시나리오는 flat 구조로 불가능.

3. **대안 검증**: 계층 1(feature flags)은 이미 구현되었으나 "숨김"만 가능하고 물리적 격리 불가. 사용자가 "전면 개편"을 명시하며 계층 1의 한계 인정. 계층 3(모노레포 패키지)은 과잉 추상화. 계층 2.5(kernel/domain/archive)가 유일한 실용적 옵션.

4. **회귀 위험 완화**: 이전 제안의 "물리적 삭제 시 migration 체인 꼬임" 우려는 **"migrations는 이동하지 않음"** 원칙으로 해결. 테이블 정의 + RLS + FK는 DB에 보존하고 코드만 이동.

### 번복 요약

| 항목 | 이전 (2026-06-28) | 본 제안 (2026-07-02) |
|---|---|---|
| 계층 3 (물리적 분리) | 보류 | **선택적 채택** (kernel/domain/archive) |
| 아카이브 방식 | UI 숨김 + 동결 (코드 보존) | **물리 이동** (archive/qms-pms/) |
| schema.ts 분할 | 섹션 마커만 | **다중 파일 분할** (schema-kernel + per-domain) |
| 트리거 | 외부 납품 시 | **v3 전면 개편 요구** (방향 #5) |

---

## 11. Charter 준수 검증

| Charter 원칙 | 본 계획 준수 | 비고 |
|---|---|---|
| [지양-1] 일반 KB ❌ | 준수 | RAG 코퍼스는 FDA/EU MDR/MFDS/NMPA/PMDA + 내부 SOP 전용 유지 |
| [지양-2] 가짜 신뢰 ❌ | 준수 | Expert Review Gate 불변, lib/domains/expert-review/ 유지 |
| [지양-3] QMS 대체 ❌ | 준수 | QMS 18 도메인 아카이브 (Charter 위반 도메인 제거) |
| [지양-4] AI 규제 판단 ❌ | 준수 | 모든 ESIG 승인은 RA Lead 필수 (inbox.approve) |
| [지양-5] SaaS 외판 ❌ | 준수 | hybrid-ra-saas는 별도 시스템, Regula는 내부 6-8명용 |

---

## 12. 실행 현황 (2026-07-18 정정, #519)

원 "승인 대기 항목"을 실제 진행 상태로 갱신:

1. **계층 2.5 채택** (kernel/domain/archive) — 🟡 부분: `lib/domains/`(consult/impact/inbox/triage) 생성, `lib/kernel`·`lib/bff`·`lib/infra` 미착수
2. **아카이브 물리 이동** — 🟡 부분: archive/qms-pms/에 8도메인(+ audit-response CAPA #525) 이동. 원 계획 18도메인 대비 진행 중
3. **Phase A-E** — 🟡 C/D 완료, A/B/E 미착수 (실행 순서가 계획의 A→B→C→D→E와 달리 C/D 선행됨)
4. **SPEC-V3-* 등록** — ✅ INBOX/TRIAGE/CONSULT/IMPACT/AUDIT-CHAIN/PERSONA 등 존재. REGISTRY/BFF는 SPEC 미작성
5. **회귀 게이트** — ✅ 유지 (pre-push full regression green)

⚠️ 공식 실행 승인 기록 없음(§상태 정정 참조). Phase A/B/E 재개는 별도 판단 필요.

---

**버전**: 1.0.0
**작성일**: 2026-07-02
**관련 문서**: `docs/v3/` (README + 5개 하위 문서), `docs/proposals/scope-rationalization-2026-06-28.md`
**관련 메모리**: product-charter.md, project-state.md, lessons.md (L-007, L-013)
