---
document_id: MASTER-ROADMAP-REGULA-V2
version: 2.0.0
created: 2026-04-23
author: manager-strategy
supersedes:
  - .moai/plans/master-roadmap.md (v1.0.0, Phase 0-6 한정)
related_inputs:
  - .moai/plans/ultra-plan-brainstorm.md (PRIMARY 단일 진실원)
  - .moai/plans/harness-gap-audit.md (Phase 0 Critical 4건)
  - .moai/plans/master-roadmap.md (v1.0.0 Phase 0-6 절차 인계)
  - 12 SPEC documents (FOUNDATION/CHAT/STRUCTURED/BREADTH/ENTERPRISE/LAUNCH/CLOUDFLARE/DOCINGEST/WORKFLOWS/TENANT/NETWORK/RADAR)
related_documents:
  - RA-bot-design/design_handoff_regula/README.md (handoff §20)
  - .claude/skills/regula/SKILL.md (Phase × Team 매트릭스)
context_pivot:
  user_scale: 6-8 internal users (RA 1-2 + Dev 2 + Exec 1 + External 2-3)
  market_tier_1: FDA + EU MDR/IVDR + MFDS K-MDR (full depth)
  market_tier_2: PMDA + NMPA (best-effort, corpus only)
  mvp_scope: Wave 1+2+3+4 일괄 빌드 (PMF 검증 단계 생략)
  operating_model: Hybrid (사내 민감 데이터 + 클라우드 컴퓨트/UI)
target_req_count: ~765 (12 SPEC 715 + 신규 4 SPEC 115 - Phase 9/10/11 흡수 65)
---

# Master Roadmap — Regula v2.0 (Internal RA Operating System)

본 문서는 Regula 프로젝트의 v2.0 실행 전략을 정의한다. v1.0.0(Phase 0-6 외부 출시 가정)을 supersede 하며, **6-8명 내부 전용 사용 컨텍스트**로 pivot한다. 12개 기존 SPEC + 4건 신규 SPEC을 4-Wave 모델로 재구조화한다.

본 문서는 개별 SPEC 본문의 REQ 상세를 중복 기술하지 않는다. SPEC ID + 그룹 번호로 참조하며, 본문은 (1) Wave 구조, (2) Phase 영향 매트릭스, (3) 신규 SPEC 스켈레톤, (4) 의존성 그래프, (5) 운영 모델, (6) 팀 재구성, (7) 우선순위, (8) 리스크, (9) 의사결정 트레이서빌리티, (10) Definition of Done에 집중한다.

---

## Section 1. Executive Summary

### 1.1 v2.0이 v1.0.0과 다른 점 (Changelog)

| 항목 | v1.0.0 (2026-04-22) | v2.0.0 (2026-04-23) |
|---|---|---|
| 범위 | Phase 0-6 (6 SPEC, 349 REQ) | Phase 0-12 + Wave 4 신규 4건 (~765 REQ) |
| 사용자 가정 | enterprise SaaS (다수 외부 고객) | 사내 6-8명 (RA 1-2 + Dev 2 + Exec 1 + External 2-3) |
| 시장 깊이 | FDA + EU + KR + JP + CN 동등 | Tier 1 (FDA/EU MDR-IVDR/MFDS) full depth, Tier 2 (PMDA/NMPA) best-effort |
| 외부 감사 | SOC 2 Type II + ISO 27001 (Phase 6/12) | 폐기 — 내부 정책 체크리스트 + 21 CFR Part 11 / HIPAA 자체 준수 |
| RBAC | 4-role × 2-tier × 3-layer isolation (Phase 5/12) | 2-role (admin/member) + 부서 attribute (RA/Dev/Exec/External) |
| 운영 모델 | Vercel cloud full | Hybrid (민감 데이터 사내 MinIO+KMS+Postgres / 컴퓨트·UI cloud) |
| MVP 전략 | 외부 PMF 단계적 출시 | 일괄 대대적 (Wave 1+2+3+4 한 번에) |
| 신규 SPEC | 없음 | 4건 (PREDICATE / PCCP / CER / COEDIT) Wave 3-4에 통합 |
| 폐기/축소 | — | Phase 10 TENANT (-55 REQ), Phase 11 NETWORK (-38 REQ), 외부 감사 항목 (-15 REQ) |

### 1.2 규모 집계

| 지표 | v1.0.0 | v2.0.0 |
|---|---|---|
| 총 Phase 수 | 7 (Phase 0-6) | 13 (Phase 0-12, Wave 4-Wave) |
| SPEC 문서 수 | 6 | 12 기존 + 4 신규 = 16 |
| 총 REQ 수 (목표) | 349 | ~765 |
| 신규 테이블 (Drizzle) | 13 (FOUNDATION) | 13 + DOCINGEST 4 + WORKFLOWS 1 + COEDIT 2 + RADAR 2 = ~22 |
| 외부 의존성 (cloud) | Vercel/Neon/Anthropic/OpenAI/Cohere/Sentry/PostHog/Langfuse | + 사내 MinIO + 사내 KMS (Vault 또는 AWS KMS) + Cloudflare Workers/DO/R2 hybrid |

### 1.3 핵심 비전 (변경 없음)

production-ready Regula 챗봇으로서 다음을 동시에 충족:

1. handoff §20 launch readiness checklist 25항목 전원 통과 (단, SOC 2 항목은 사내 정책 체크리스트로 대체)
2. 21 CFR Part 11 자체 준수 (append-only audit, 7-year retention, TRUNCATE/role bypass 봉쇄)
3. WCAG 2.1 AA compliant (axe-core 0 violations)
4. 한/영 이중언어 first-class
5. 7개 Non-Obvious Constraints 전면 완결
6. P95 latency: first token ≤ 1.5s, LCP ≤ 2.0s, hybrid search ≤ 500ms
7. **신규**: Wave 3 Predicate/CER/PCCP drafter 정확도 ≥ 75% (eval rubric), Wave 4 Yjs 5명 동시 편집 안정성

---

## Section 2. Wave 구조 (4-Wave Model)

### Wave 1 — Foundation Stack (Phase 1-4)

| 항목 | 값 |
|---|---|
| 목표 | 대화형 RAG 챗봇 + 5 관할권 corpus 작동 (Tier 1 full + Tier 2 best-effort) |
| 포함 SPEC | FOUNDATION(74-3=71), CHAT(60), STRUCTURED(37), BREADTH(57-8=49) — 약 217 REQ |
| 신규 스택 | Next.js 15 + Vercel + Neon Postgres + pgvector + Auth.js v5 (사내 IdP 단일) |
| 완료 게이트 | (a) first token P95 ≤ 1.5s, (b) Tier 1 3 corpora + Tier 2 2 corpora ingestion 완료, (c) 13-table schema 안정, (d) 사내 SSO 1개 로그인 작동 |
| 완료 후 시나리오 | RA 사용자가 한국어 질문 입력 → 5 corpora 검색 → citation 100% 답변 + 4 structured block (checklist/comparison/timeline/related) 표시 |

### Wave 2 — Trust + Documents (Phase 5-Lite + Phase 8 + Phase 6)

| 항목 | 값 |
|---|---|
| 목표 | 부서 RBAC + 자사 인증 문서 ingestion + audit immutable + 자체 launch readiness 통과 |
| 포함 SPEC | ENTERPRISE-Lite(73-25=48), DOCINGEST(78+10=88), LAUNCH(48-15=33) — 약 169 REQ |
| 신규 스택 | + 사내 KMS (HashiCorp Vault 또는 AWS KMS) + MinIO/S3 호환 + Inngest (DOCINGEST upload pipeline) |
| 완료 게이트 | (a) HIPAA Safe Harbor 18 ID redaction 100%, (b) audit-completeness CI gate 0 violations, (c) 자사 prior submissions 인덱싱 ≥ 10건, (d) Trade Secret tagging 100% (REQ-DOC-085+), (e) 부서 attribute 기반 RBAC 작동, (f) 내부 LR-001~LR-025 (외부 감사 항목 제외) PASS |
| 완료 후 시나리오 | RA 사용자가 자사 510(k) submission 업로드 → 자동 redaction → corpus 인덱싱 → 차후 신규 submission 검색 시 자사 자료 우선 매칭 |

### Wave 3 — Workflows + Intelligence (Phase 9 확장 + Phase 12 RADAR + 신규 3건)

| 항목 | 값 |
|---|---|
| 목표 | 510(k)/CER/De Novo/PCCP drafter + 규제 변동 push (3 regulator 집중) |
| 포함 SPEC | WORKFLOWS(68+60=128, De Novo/PMA/CER/PCCP wizard 흡수), RADAR(55-15=40, 3-regulator), 신규 PREDICATE(30), 신규 PCCP(25), 신규 CER(40) — 약 263 REQ |
| 신규 스택 | + Predicate Search Engine (FDA 510(k) DB Open API + Vectorize rerank) + PubMed E-utilities API + MEDDEV 2.7/1 Rev4 templates + AI/ML PCCP guidance templates |
| 완료 게이트 | (a) 510(k) draft eCopy validator pass, (b) RADAR 3 regulators (FDA + EU OJ + MFDS) 작동 + 3-tier classifier accuracy tier1 ≥ 95% / tier2 ≥ 85%, (c) CER PubMed 자동 인용 ≥ 50건/draft, (d) PCCP modification protocol generator 동작, (e) 모든 draft `review_required=true` enforcement (게이팅 우회 0건) |
| 완료 후 시나리오 | RA 사용자가 신규 510(k) wizard 시작 → predicate 자동 매칭 (top-5) → subject vs predicate 비교표 자동 → section-별 draft Sonnet 생성 → expert review queue → MDX 편집 → PDF export. 별도로 EU MDR Class IIa CER 작성 시 PubMed 50건+ 자동 인용 |

### Wave 4 — Edge + Co-editing (Phase 7-Hybrid + 신규 COEDIT + Inspector Mode 준비)

| 항목 | 값 |
|---|---|
| 목표 | Cloudflare hybrid 컴퓨트 + 부서간 real-time co-editing + (Phase 5+ 후보) Inspector/Desktop 진입로 |
| 포함 SPEC | CLOUDFLARE-Hybrid(85-40=45), 신규 COEDIT(20) — 약 65 REQ |
| 신규 스택 | + Cloudflare Workers (compute/cache only) + Cloudflare Durable Objects (Yjs co-editing) + Cloudflare R2 (hot/공개 corpus만) + Yjs 13.6+ + y-protocols + Tauri Desktop (Wave 5 후보) |
| 완료 게이트 | (a) Workers Compat Audit pass (Auth.js v5 / Drizzle Edge / SSE 호환성 0 critical issue), (b) Yjs 5명 동시 편집 1 hour 안정 (no merge conflict, no data loss), (c) WAF/Turnstile/mTLS 폐기 — 사내 VPN + Cloudflare Access만, (d) hybrid router (public corpus → Vectorize / internal → 사내 pgvector) silent-failure 0건 |
| 완료 후 시나리오 | RA + Dev 2명이 동시에 같은 510(k) draft 편집 → Yjs CRDT 머지 → expert review 동시 코멘트 → reviewer가 approve → audit 기록 |

### Wave 별 진행 모드

각 Wave는 **순차 진행**한다. Wave 내부 Phase는 의존성 허용 한도 내에서 병렬 가능 (§5 의존성 그래프 참조).

```
Wave 1 (Foundation)
   └── Wave 2 (Trust+Docs) — Wave 1 게이트 통과 필수
            └── Wave 3 (Workflows+Intel) — Wave 2 게이트 통과 + 4 신규 SPEC 작성 선결
                     └── Wave 4 (Edge+Co-editing) — Wave 3 게이트 통과
```

### 폐기 또는 재정의되는 Phase

| Phase | 원래 SPEC | v2.0 결정 | 후속 처리 |
|---|---|---|---|
| Phase 10 TENANT | 70 REQ — 3-layer isolation, RLS, SOC 2/HIPAA BAA chain, Multi-region | **"Phase 10-Lite" 축소 — 5 REQ** | 단일 tenant 가정. 부서 attribute만. RLS 폐기. SOC 2/HIPAA BAA chain 폐기. Phase 5 RBAC에 5 REQ로 흡수 |
| Phase 11 NETWORK | 48 REQ — k-anonymity opt-in aggregate (조직간 통계) | **재정의 또는 폐기 — 10 REQ** | N=1 무의미. "External Public Data Enrichment" (FDA 510(k) DB / MAUDE / Eudamed 자동 enrichment)로 10 REQ 보존. Phase 8 부속으로 재배치 |

---

## Section 3. Phase 영향 매트릭스 (12 Phase × Internal Pivot)

본 매트릭스는 ultra-plan-brainstorm §2를 v2.0에서 **확장하여 명시**한다.

### 3.1 Phase 1 FOUNDATION

| 항목 | 결정 |
|---|---|
| 원래 SPEC | SPEC-REGULA-FOUNDATION-001 v0.3.0 (74 REQ) — Auth.js v5 SSO 4-provider (Microsoft Entra / Google / Okta / Auth0) |
| v2.0 결정 | **유지 (축소)** — Auth: 사내 IdP **1개만** (Microsoft Entra ID 또는 Google Workspace OIDC, 회사 표준에 따라 1개 선정) |
| REQ 변화 | -3 REQ (provider 3개 제거) → 71 REQ |
| 영향 받는 acceptance | REQ-FND-051~053 (auth provider 정의 그룹), REQ-FND-010a (env 검증) |
| 기타 | 13-table schema, append-only audit trigger, Source Serif 4 폰트 스택, lib/env.ts Zod 검증 모두 변경 없음 |

### 3.2 Phase 2 CHAT

| 항목 | 결정 |
|---|---|
| 원래 SPEC | SPEC-REGULA-CHAT-001 (60 REQ) — SSE RAG + Citation enforcement |
| v2.0 결정 | **유지 100%** — 내부 사용자도 정확성 핵심. citation enforcement는 RA workflow의 신뢰성 기반 |
| REQ 변화 | 0 |
| 영향 받는 acceptance | 없음 |

### 3.3 Phase 3 STRUCTURED

| 항목 | 결정 |
|---|---|
| 원래 SPEC | SPEC-REGULA-STRUCTURED-001 (37 REQ) — 6 block types + 4 SSE additional events |
| v2.0 결정 | **유지 100%** |
| REQ 변화 | 0 |
| 영향 받는 acceptance | 없음 |

### 3.4 Phase 4 BREADTH

| 항목 | 결정 |
|---|---|
| 원래 SPEC | SPEC-REGULA-BREADTH-001 (57 REQ) — 5 corpora (US/EU/KR/JP/CN) full depth + 8 views + 10 APIs + 5 retrievers |
| v2.0 결정 | **PMDA/NMPA best-effort 강등** — 코퍼스만 ingest, retriever 인터페이스만 구현. router intent 매핑 약식. eval harness 제외. 8 views + 10 APIs + Tier 1 3 retrievers는 full depth |
| REQ 변화 | -8 REQ (Tier 2 retriever 최적화 / eval / regression 제외) → 49 REQ |
| 영향 받는 acceptance | Group D (PMDA / NMPA retriever 그룹) — basic ingestion + naive cosine similarity만 |

### 3.5 Phase 5 ENTERPRISE

| 항목 | 결정 |
|---|---|
| 원래 SPEC | SPEC-REGULA-ENTERPRISE-001 (73 REQ) — 4-role × 2-tier RBAC + Expert Review 전체 + 4-way 관측성 + i18n + dark mode |
| v2.0 결정 | **2-role + 부서 attribute로 단순화** — admin / member 2-role + 부서 attribute (RA/Dev/Exec/External). organization/project 2-tier scope 폐기. 4-role granular permission 폐기. Expert review 큐 단순화 (RA-lead 1명 reviewer). |
| REQ 변화 | -25 REQ (RBAC granularity / Expert review 큐 multi-reviewer / Expert review escalation 그룹) → 48 REQ |
| 영향 받는 acceptance | Group A (RBAC), Group B (Expert review escalation) |
| Phase 10-Lite 흡수 | +5 REQ — 부서 attribute (`users.department text not null check (department in ('ra','dev','exec','external'))`) + audit_logs 부서 표시 |
| 최종 | 48 + 5 = 53 REQ |

### 3.6 Phase 6 LAUNCH

| 항목 | 결정 |
|---|---|
| 원래 SPEC | SPEC-REGULA-LAUNCH-001 (48 REQ) — 25 launch readiness items 포함 SOC 2 / 외부 감사 / pen-test |
| v2.0 결정 | **외부 감사 폐기** — 내부 정책 체크리스트로 대체. 21 CFR Part 11 / HIPAA 자체 준수만 검증. promptfoo eval / k6 load / Playwright E2E / OWASP 자체 점검은 유지 |
| REQ 변화 | -15 REQ (SOC 2 / external pen-test / external audit log review 그룹) → 33 REQ |
| 영향 받는 acceptance | LR-022~LR-025 (external audit), LR-018~LR-020 (compliance certification) |
| 대체 acceptance | 내부 보안 정책 체크리스트 (LR-IN-001~LR-IN-010, 신규 10항목) |

### 3.7 Phase 7 CLOUDFLARE

| 항목 | 결정 |
|---|---|
| 원래 SPEC | SPEC-REGULA-CLOUDFLARE-001 (85 REQ) — Workers + Vectorize + R2 + WAF/Turnstile/mTLS + EU residency + AutoRAG |
| v2.0 결정 | **하이브리드 부분 적용 — Wave 4** | (a) Workers/KV/Cache/공개 corpus Vectorize: cloud 채택, (b) R2 cold storage: 사내 MinIO로 대체 (audit_logs 7-year 사내), (c) WAF/Turnstile/mTLS: 폐기 (사내 VPN + Cloudflare Access 1차 방어), (d) Vectorize: 옵션 (pgvector 우선, public corpus만 Vectorize), (e) AutoRAG: 폐기 (자체 ingestion 유지, Phase 8과 통합), (f) EU-only routing: 단일 시장 가정 폐기 |
| REQ 변화 | -40 REQ (Group F WAF + Turnstile + mTLS, Group D R2 audit cold + Iceberg, Group H EU residency, Group B AutoRAG full migration) → 45 REQ |
| 영향 받는 acceptance | Groups B(50%축소) / D(완전 사내 이관) / F(폐기) / H(EU residency 폐기, HIPAA BAA scope만 유지) |

### 3.8 Phase 8 DOCINGEST

| 항목 | 결정 |
|---|---|
| 원래 SPEC | SPEC-REGULA-DOCINGEST-001 (78 REQ) — 14 chunkers + ACL 매트릭스 + HIPAA 18 ID redaction + 5 ingestion sources |
| v2.0 결정 | **유지 90%** + **자사 prior submissions 1순위 corpus 추가** + **Trade Secret tagging 추가** |
| REQ 변화 | +10 REQ (REQ-DOC-079~085 신규: 자사 510(k) clearance가 매칭에서 1순위 가중치, REQ-DOC-085~090 신규: Trade Secret tagging + R2 access policy + audit 기록) → 88 REQ |
| 영향 받는 acceptance | Group F ACL 확장, Group G Retrieval Integration 확장 |
| Phase 11 흡수 | + 10 REQ (External Public Data Enrichment: FDA 510(k) DB / MAUDE / Eudamed 공개 데이터 자동 enrichment) → 98 REQ |
| 최종 | 98 REQ (78 + 10 + 10) |

### 3.9 Phase 9 WORKFLOWS

| 항목 | 결정 |
|---|---|
| 원래 SPEC | SPEC-REGULA-WORKFLOWS-001 (68 REQ) — 510(k) Submission + Audit Response + Indication Impact 3 workflows |
| v2.0 결정 | **유지 100%** + **Wave 4 4건 중 PCCP/CER 흡수** + **De Novo / PMA wizard 추가** |
| REQ 변화 | +60 REQ — De Novo wizard (15 REQ), PMA wizard (10 REQ, Class III 한정), CER wizard 흡수 (35 REQ, MEDDEV 2.7/1 Rev4 + PubMed 자동 인용), PCCP wizard 흡수 (25 REQ, AI/ML predetermined change control), Predicate finder 분리 흡수 (separate SPEC PREDICATE에 30 REQ로 분리) → 68 + 25 + 35 = 128 REQ (PCCP/CER 흡수, De Novo/PMA 추가). Predicate는 별도 SPEC |
| 영향 받는 acceptance | Group A 확장 (510(k) → De Novo / PMA / CER / PCCP 5-pathway) |
| 최종 | 128 REQ |

### 3.10 Phase 10 TENANT

| 항목 | 결정 |
|---|---|
| 원래 SPEC | SPEC-REGULA-TENANT-001 (70 REQ) — 3-layer isolation, RLS, SOC 2 Type II, HIPAA BAA chain, ISO 27001 ISMS |
| v2.0 결정 | **"Phase 10-Lite" 축소** — 단일 tenant 가정. 부서 attribute만 (Phase 5 흡수). RLS 폐기. SOC 2/ISO 외부 감사 폐기. HIPAA BAA chain 폐기 (자체 준수). |
| REQ 변화 | -55 REQ → 5 REQ (Phase 5 ENTERPRISE에 흡수 — Section 3.5 참조) |
| 영향 받는 acceptance | 사실상 SPEC 본문 폐기. Phase 5 RBAC + Phase 8 DOCINGEST RLS 양 layer만 유지. Phase 10 SPEC 자체는 archived 표기 |

### 3.11 Phase 11 NETWORK

| 항목 | 결정 |
|---|---|
| 원래 SPEC | SPEC-REGULA-NETWORK-001 (48 REQ) — k-anonymity opt-in aggregate (조직간 통계 공유) |
| v2.0 결정 | **재정의** — 단일 조직(N=1) 컨텍스트에서 k-anonymity 무의미. **"External Public Data Enrichment"** 로 재정의 — FDA 510(k) DB / MAUDE / Eudamed 공개 데이터 자동 enrichment. Phase 8 DOCINGEST 부속으로 재배치 |
| REQ 변화 | -38 REQ → 10 REQ (Phase 8에 흡수 — Section 3.8 참조) |
| 영향 받는 acceptance | NETWORK SPEC 본문 archived 표기. 새 10 REQ는 SPEC-REGULA-DOCINGEST-001 v0.2.0 amendment로 추가 |

### 3.12 Phase 12 RADAR

| 항목 | 결정 |
|---|---|
| 원래 SPEC | SPEC-REGULA-RADAR-001 (55 REQ) — 11 crawlers (FDA 4 + EU 2 + MFDS 2 + PMDA + NMPA + ISO/IEC) + 3-tier classifier + impact scoring |
| v2.0 결정 | **3-regulator 집중 (Tier 1)** — FDA (4 crawlers) + EU (OJ + NB-MED) + MFDS (notice + approval) 만 full depth. PMDA/NMPA crawler best-effort (수동 알림으로 대체 가능). ISO/IEC 메타만 |
| REQ 변화 | -15 REQ (PMDA + NMPA full pipeline, 알림 채널 PMDA/NMPA 분기, 분류 한국어 비-Tier-1 외 verbose) → 40 REQ |
| 영향 받는 acceptance | Group A (REQ-RADAR-011, 012, NMPA crawler 그룹), Group B (Tier 2 device class 분류 PMDA/NMPA 강등) |

### 3.13 Phase 영향 합산표 (REQ 변화)

| Phase | 원본 REQ | v2.0 REQ | 변화 |
|---|---:|---:|---:|
| 1 FOUNDATION | 74 | 71 | -3 |
| 2 CHAT | 60 | 60 | 0 |
| 3 STRUCTURED | 37 | 37 | 0 |
| 4 BREADTH | 57 | 49 | -8 |
| 5 ENTERPRISE | 73 | 53 | -20 (Phase 10 5 흡수) |
| 6 LAUNCH | 48 | 33 | -15 |
| 7 CLOUDFLARE | 85 | 45 | -40 |
| 8 DOCINGEST | 78 | 98 | +20 (Phase 11 10 흡수 + 자사+TS 10) |
| 9 WORKFLOWS | 68 | 128 | +60 (CER + PCCP + De Novo + PMA) |
| 10 TENANT | 70 | 0 (archived) | -70 (5는 Phase 5 흡수) |
| 11 NETWORK | 48 | 0 (archived) | -48 (10은 Phase 8 흡수) |
| 12 RADAR | 55 | 40 | -15 |
| **소계** | **753** | **614** | **-139** |
| 신규 PREDICATE | — | 30 | +30 |
| 신규 PCCP | — | (Phase 9 흡수 25) | (위 Phase 9에 포함) |
| 신규 CER | — | (Phase 9 흡수 35) | (위 Phase 9에 포함) |
| 신규 COEDIT | — | 20 | +20 |
| External Enrichment | — | (Phase 8 흡수 10) | (위 Phase 8에 포함) |
| **신규 합산** | — | **50** (외부 SPEC만) | **+50** |
| **총계** | **753** | **664** | **-89** |

총 v2.0 REQ는 약 664건이다. (ultra-plan-brainstorm §2.1 추정 ~765 대비 -101 차이는 Phase 9 흡수 REQ(60건)이 신규 SPEC 본문 작성 시 일부 중복 정리되어 나타난 결과이며, 본 v2.0 작성 시점 기준 정량 추정. 실제 SPEC 작성 시 ±10% 범위에서 조정 가능.)

---

## Section 4. 신규 SPEC 스켈레톤 (Wave 3-4 핵심 4건)

각 신규 SPEC은 Phase 0 manager-spec 위임으로 별도 작성한다. 본 Section은 manager-spec에게 전달할 **스켈레톤(아웃라인)** 만 제공한다.

### 4.1 SPEC-REGULA-PREDICATE-001 — FDA 510(k) Predicate Device Search Engine

| 항목 | 값 |
|---|---|
| Phase 위치 | Wave 3 (Phase 9 의존, 별도 SPEC) |
| Priority | High (Wave 3 진입 차단 항목) |
| Depends_on | FOUNDATION, CHAT, BREADTH, DOCINGEST, CLOUDFLARE-Hybrid |
| REQ 추정 | 30 (Group A Search 10 + Group B Comparison Builder 10 + Group C Cache + DB 5 + Group D UI 5) |
| 핵심 산출물 (5건) | (1) `lib/predicate/openfda-client.ts` — FDA openFDA 510(k) API 클라이언트 (rate limit + retry + paging), (2) `lib/predicate/cascade-search.ts` — device name → product code → panel cascade 검색 + Vectorize FDA corpus rerank top-5, (3) `lib/predicate/comparison-builder.ts` — subject vs predicate 다차원 비교 (intended use / indications / technological characteristics / materials / performance), (4) `lib/predicate/cache.ts` — predicate search result KV cache (24h TTL), (5) `app/(app)/predicate/page.tsx` — 사용자 명시 선택 강제 UI (top-5 후보 카드 + "선택" 강제, auto-select 금지) |
| 핵심 위험 | (R1) openFDA API rate limit (240 req/min anonymous, 1000 req/min with key) 초과, (R2) 2004년 이전 510(k) 미커버, (R3) substantial equivalence 자동 판단 금지 — 사용자 명시 선택 강제 |

### 4.2 SPEC-REGULA-PCCP-001 — AI/ML Predetermined Change Control Plan Builder

| 항목 | 값 |
|---|---|
| Phase 위치 | Wave 3 (Phase 9 흡수 — Phase 9 SPEC v0.2.0에 25 REQ로 통합) |
| Priority | High |
| Depends_on | FOUNDATION, WORKFLOWS, DOCINGEST |
| REQ 추정 | 25 (Group A Modification Protocol 10 + Group B SPS / Algorithm Change 8 + Group C Output + Audit 7) |
| 핵심 산출물 (5건) | (1) `lib/pccp/modification-protocol.ts` — 4-component PCCP 생성 (modification description / SPS Software Pre-Spec / Algorithm Change Protocol / Impact Assessment), (2) `lib/pccp/templates/` — FDA "Marketing Submission Recommendations for a Predetermined Change Control Plan" guidance (2024-04) 매핑 템플릿, (3) `lib/pccp/validator.ts` — PCCP 4-component 완전성 검증 + section coverage SLO 100%, (4) `lib/pccp/audit-wiring.ts` — workflow.start / step.complete / pending_review / approve audit 기록, (5) `app/(app)/workflows/pccp/page.tsx` — wizard UI (4-step navigation + draft preview) |
| 핵심 위험 | (R1) FDA PCCP guidance 변경 추적 (Phase 12 RADAR 의존), (R2) AI/ML model의 retraining 빈도 vs PCCP scope 매핑 자동화 어려움 — 사용자 입력 강제, (R3) PCCP는 일반 510(k)와 다른 구조 — Workflow A와 별도 wizard |

### 4.3 SPEC-REGULA-CER-001 — EU MDR Annex XIV Clinical Evaluation Report Builder

| 항목 | 값 |
|---|---|
| Phase 위치 | Wave 3 (Phase 9 흡수 — Phase 9 SPEC v0.2.0에 35 REQ로 통합) |
| Priority | High |
| Depends_on | FOUNDATION, WORKFLOWS, DOCINGEST, BREADTH (EU MDR retriever) |
| REQ 추정 | 40 (Group A MEDDEV 2.7/1 Rev4 10-stage 15 + Group B PubMed integration 10 + Group C Output 10 + Group D Audit 5) |
| 핵심 산출물 (5건) | (1) `lib/cer/meddev-stages.ts` — MEDDEV 2.7/1 Rev4 10-stage CER 구조 (Scope / State of the Art / Equivalence / Literature Search / Clinical Investigation / Clinical Experience / PMS / Risk-Benefit / Conclusions / Annexes), (2) `lib/cer/pubmed-client.ts` — PubMed E-utilities API 클라이언트 (esearch + efetch + abstract retrieval) + 자동 인용 50건+/draft, (3) `lib/cer/literature-appraisal.ts` — SIGN 50 / GRADE 평가 휴리스틱 + LLM 보조, (4) `lib/cer/equivalence-builder.ts` — Article 61(4) equivalent device claim 비교표 (clinical / technical / biological 3-차원), (5) `app/(app)/workflows/cer/page.tsx` — 10-stage wizard UI + PubMed 결과 review UI |
| 핵심 위험 | (R1) PubMed API rate limit (3 req/sec without key, 10 req/sec with key), (R2) EU MDR Annex XIV literal compliance 자동 검증 어려움 → expert review 강제, (R3) MEDDEV 2.7/1 Rev4 → MDCG 2020-13 전환 시 template 갱신 필요 (RADAR 추적), (R4) 10 stage 전체 자동화 시 토큰 비용 ($5+/draft Sonnet) — Haiku fallback 지점 명시 |

### 4.4 SPEC-REGULA-COEDIT-001 — Real-time Multi-user Document Co-editing (Yjs + Durable Objects)

| 항목 | 값 |
|---|---|
| Phase 위치 | Wave 4 (Phase 7 의존, 별도 SPEC) |
| Priority | Medium (Wave 4 진입 차단 항목 아님 — Wave 3 완료 후 progressive enhancement) |
| Depends_on | FOUNDATION, ENTERPRISE, WORKFLOWS, CLOUDFLARE-Hybrid |
| REQ 추정 | 20 (Group A Yjs schema 5 + Group B Durable Objects WebSocket 5 + Group C Presence + Comment 5 + Group D Audit + Export 5) |
| 핵심 산출물 (5건) | (1) `lib/coedit/yjs-schema.ts` — Yjs document schema (Y.Map content + Y.Array comments + Y.Text body), (2) `workers/coedit-room-do.ts` — Cloudflare Durable Object WebSocket gateway (1 DO per workflow_run.id, 5명 동시 편집 sustained), (3) `components/coedit/CollaborativeEditor.tsx` — Yjs + ProseMirror 또는 TipTap React component, (4) `lib/coedit/audit-events.ts` — coedit.session_open / coedit.edit / coedit.comment / coedit.session_close audit, (5) `lib/coedit/export-snapshot.ts` — Yjs CRDT → Markdown snapshot (`workflow_runs.last_snapshot_md`) |
| 핵심 위험 | (R1) Durable Objects scale-out (5명 → 20명+ 시 DO migration), (R2) Yjs CRDT memory footprint (1MB+ document × 5 sessions = 5MB DO RAM), (R3) Authority gating (admin/member 부서 attribute로 read/write 분기 — write는 RA만), (R4) Audit log volume polluting (per-keystroke 기록 시 audit 폭증 → debounced batch 5sec) |

### 4.5 차순위 신규 SPEC (Wave 5 후보, v2.0 결정 대상 아님)

다음 4건은 Wave 5 (post-Wave-4) 후보로 기록만 한다:
- SPEC-REGULA-INSPECTOR-001 — FDA on-site EIR Inspector Mode (offline-first PWA)
- SPEC-REGULA-DESKTOP-001 — Tauri Desktop App (offline + 사내 KMS 로컬 캐시)
- SPEC-REGULA-PMS-001 — Post-Market Surveillance Plan Generator
- SPEC-REGULA-RMF-001 — ISO 14971 Risk Management File Builder

---

## Section 5. Phase 의존성 그래프 (4-Wave 흐름)

### 5.1 Wave 간 의존성

```
Wave 1 Foundation Stack
   Phase 1 FOUNDATION (71)
       └── Phase 2 CHAT (60)
               ├── Phase 3 STRUCTURED (37)
               │       └── Phase 4 BREADTH (49)
               └── Phase 4 BREADTH도 CHAT message_sources 직접 의존
                                   │
Wave 2 Trust + Documents          ▼
   Phase 5-Lite ENTERPRISE (53) — Phase 4 완료 의존
       └── Phase 8 DOCINGEST (98) — Phase 5 RBAC + Phase 4 retriever 의존
               └── Phase 6 LAUNCH (33, 내부) — Phase 5 + Phase 8 의존
                                   │
Wave 3 Workflows + Intelligence   ▼
   Phase 9 WORKFLOWS (128, CER+PCCP+De Novo+PMA 흡수) — Phase 8 + Phase 6 의존
       ├── 신규 PREDICATE (30) — Phase 9와 병렬 가능, Phase 8 의존
       └── Phase 12 RADAR (40, 3-regulator) — Phase 8 + Phase 9 의존
                                   │
Wave 4 Edge + Co-editing          ▼
   Phase 7-Hybrid CLOUDFLARE (45) — Wave 3 완료 의존
       └── 신규 COEDIT (20) — CLOUDFLARE Durable Objects 의존
```

### 5.2 Wave 내 병렬 가능 Phase

| Wave | 병렬 가능 그룹 | 비병렬 (sequential) 항목 |
|---|---|---|
| Wave 1 | Phase 3 + Phase 4 (Phase 2 완료 후 두 Phase 병렬 진행) | Phase 1 → Phase 2 sequential |
| Wave 2 | Phase 5 + Phase 8 partial (Phase 5 RBAC stub 완료 후 Phase 8 schema 병렬) | Phase 6 LAUNCH은 Phase 5 + Phase 8 완료 후 |
| Wave 3 | Phase 9 + 신규 PREDICATE + Phase 12 RADAR (Phase 8 완료 후 3 Phase 병렬) | 신규 PCCP/CER은 Phase 9 내부 sequential |
| Wave 4 | Phase 7-Hybrid + 신규 COEDIT 일부 (Phase 7 KV/Workers 완료 후 COEDIT 병렬) | DO 의존 | 

### 5.3 의존성 세부 (REQ 레벨)

- Phase 2 ← Phase 1: REQ-FND-035~039 (schema), REQ-FND-044/046/047 (audit), REQ-FND-051~053 (auth — 사내 IdP 1개로 축소)
- Phase 3 ← Phase 2: types/streaming.ts (12 event), useStreamingAnswer, lib/ai/consult.ts generator
- Phase 4 ← Phase 3: structured-schema.ts (read-only import for History 렌더)
- Phase 5 ← Phase 4: 8 views + 10 APIs + 5 retrievers (Tier 2 best-effort)
- Phase 8 ← Phase 5: withPermission middleware + 부서 attribute (RA/Dev/Exec/External)
- Phase 9 ← Phase 8: organization_documents corpus + DOCINGEST chunkers + ACL matrix
- 신규 PREDICATE ← Phase 8: Vectorize FDA corpus + DOCINGEST 자사 510(k) 1순위
- 신규 CER ← Phase 9 + Phase 4 EU MDR retriever
- 신규 PCCP ← Phase 9 (workflow_runs 테이블 + 10 audit_action enum)
- Phase 12 RADAR ← Phase 8 + Phase 9 (organization_documents portfolio + workflow draft API)
- Phase 7-Hybrid ← Wave 1+2+3 전체 (Workers 이식 시 모든 API surface 검증)
- 신규 COEDIT ← Phase 7 KV + Durable Objects + Phase 9 workflow_runs 테이블

### 5.4 금지된 역방향 변경 (v1.0.0과 동일 유지)

- Wave 2~4는 FOUNDATION SPEC의 REQ-FND를 수정·삭제하지 않는다. 세 가지 확장 인터페이스만:
  1. Schema 확장: 마이그레이션 번호 `0002_*` 이상 추가만 허용
  2. Env 확장: `lib/env.ts` zod schema에 키 추가만 허용 (기존 키 삭제 금지)
  3. 기존 placeholder 페이지 교체: Wave N에서 FOUNDATION placeholder의 의도를 유지한 채 완성형으로 교체 가능

---

## Section 6. 운영 모델 (Hybrid Architecture)

### 6.1 사내 vs 클라우드 컴포넌트 매트릭스

| 컴포넌트 | 사내 (on-prem) | 클라우드 | 사유 |
|---|:---:|:---:|---|
| 인증 데이터 (사용자 자격증명) | ✓ | — | 사내 IdP (Microsoft Entra ID 또는 Google Workspace) — 회사 표준 |
| 자사 510(k) submission 원본 | ✓ | — | Trade secret. MinIO encrypted bucket + AES-256-GCM |
| 자사 CER / PCCP draft 원본 | ✓ | — | Trade secret. MinIO encrypted bucket |
| audit_logs (전 7-year retention) | ✓ | — | 21 CFR Part 11 자체 준수. Postgres self-managed + append-only trigger |
| 사용자 documents redacted body | ✓ | — | PHI 가능성. MinIO + RLS 분리 schema |
| redaction_map (PII original) | ✓ | — | AES-256-GCM + 사내 KMS master key + private schema + RLS + pii_admin_role |
| 사내 SOP / 인증 문서 | ✓ | — | 사내 corpus, 사내 pgvector |
| 공개 corpus (FDA / EU MDR / MFDS public) | — | ✓ | 공개 데이터, Cloudflare Vectorize cloud 가속 |
| Workers compute (Next.js runtime) | — | ✓ | 컴퓨트만, 데이터 통과 (no persistence on edge) |
| Cloudflare KV (session / rate limit cache) | — | ✓ | 비민감 캐시. AES 암호화 token 만 |
| Vercel hosting (Wave 1-3 baseline) | — | ✓ | UI/SSR baseline. Wave 4에서 Cloudflare Workers로 일부 이전 |
| Anthropic API (LLM compute) | — | ✓ | Zero data retention 정책 활용. PHI는 redacted 후 송출만 |
| OpenAI API (embeddings) | — | ✓ | text-embedding-3-small. PHI redacted body만 송출 |
| Cohere Rerank API | — | ✓ | retriever output rerank만, raw doc 송출 안함 |
| Sentry / PostHog / Langfuse | — | ✓ | observability. PII 금지 키 audit-completeness CI gate로 차단 |
| Inngest (Phase 8/9 step function) | — | ✓ | metadata only, raw doc 송출 안함 |
| Cloudflare R2 (cold storage) | **변경: 사내 MinIO** | — | 원래 v1.0.0 R2 → v2.0 사내 MinIO 이관 |
| Cloudflare Email Workers | — | ✓ (선택) | DOCINGEST email source 시 사용. inbound MIME parse만, 본문은 사내로 즉시 회수 |
| Cloudflare Durable Objects | — | ✓ | Wave 4 COEDIT — Yjs CRDT in-memory만, snapshot은 사내 Postgres `workflow_runs.last_snapshot_md` |
| Cloudflare Browser Rendering | — | ✓ | RADAR 동적 JS crawler (Wave 3) — 외부 공개 페이지만 |

### 6.2 데이터 흐름 (민감 데이터 영구 사내 보관)

```
사용자 (사내 LAN 또는 VPN)
     │
     ▼  (HTTPS, 사내 IdP 인증 토큰)
Cloudflare Workers / Vercel Next.js (compute only)
     │
     ├──(retriever query)──► Cloudflare Vectorize (공개 corpus만)
     │                       └── 결과는 Workers 메모리만 통과
     │
     ├──(retriever query)──► 사내 Postgres pgvector (사내 SOP / 자사 submission / redacted PHI)
     │                       └── 결과는 Workers 메모리만 통과
     │
     ├──(LLM call, redacted)──► Anthropic API (zero retention, redacted prompt만)
     │                       └── response는 Workers 메모리만 통과
     │
     └──(audit write)──► 사내 Postgres audit_logs (append-only trigger)
                          └── 영구 사내 보관, 7-year retention

저장소 분리:
- 클라우드: 공개 corpus PDF (Cloudflare R2 public bucket), Vectorize embeddings (공개 corpus only), 세션 토큰 KV (단순 ID, no PII)
- 사내: 자사 submission, redacted PHI 본문, redaction_map (암호화), audit_logs, SOP, secrets master key

네트워크 분리:
- 사내 → 클라우드 outbound: 화이트리스트 (Anthropic / OpenAI / Cohere / Sentry / Cloudflare API endpoints)
- 클라우드 → 사내 inbound: 차단 원칙. Cloudflare Tunnel + 단일 outbound port (443) for Workers → 사내 Postgres / MinIO 콜백
- 사내 ↔ 사내: 표준 사내 LAN, mTLS 옵션
```

### 6.3 사내 의존성 추가 (v1.0.0 대비 신규)

| 컴포넌트 | 선택 옵션 | 운영 부담 |
|---|---|---|
| Object Storage (S3 호환) | **MinIO (1순위)** 또는 Ceph RGW | docker-compose 1-command 설치, 단일 노드 + RAID로 충분 (사내 6-8명, ~100GB/년) |
| KMS (master key store) | **HashiCorp Vault (1순위)** 또는 AWS KMS (사내 외부 vault 가능) 또는 단순 OS-level keystore | Vault docker single-node 또는 sealed key file |
| Postgres self-managed | **Neon self-host 가능 또는 표준 Postgres 16+ + pgvector** | docker-compose 또는 사내 RHEL 표준 |
| Backup (audit_logs 7-year) | **MinIO + 정기 cold copy to NAS** | 월 1회 cron, 자동 |

### 6.4 클라우드 의존성 (외부 SaaS, 변경 없음)

| 컴포넌트 | 사용처 | 비용 가드 |
|---|---|---|
| Vercel (Wave 1-3) | UI/SSR baseline | Pro plan 1seat (~$20/mo) — 사내 6-8명 sufficient |
| Cloudflare Workers (Wave 4) | Edge compute hybrid | Workers Paid ($5/mo) + Vectorize free tier (5M vectors) |
| Anthropic API | Sonnet 4 (RA) + Haiku (low/medium) | 사내 6-8명 × 월 1000 query × $0.5/query estimate ≤ $500/mo |
| OpenAI API | text-embedding-3-small | 월 ingestion 100MB × $0.02/MB ≤ $20/mo |
| Cohere Rerank v3 | retriever rerank | ≤ $100/mo |
| Sentry / PostHog / Langfuse | observability | free tier 또는 Hobby plan ≤ $50/mo total |
| Inngest | step function | Hobby (free) for 6-8 users |

### 6.5 DevOps 부담 가정 (1명 미만)

- 사내 의존성 (MinIO + Vault + Postgres): single-node docker-compose, 운영 자동화 (Section 11 DoD 항목)
- 모든 cloud 컴포넌트는 managed (Vercel / Cloudflare / Anthropic / OpenAI / Cohere / Sentry / PostHog / Langfuse / Inngest) — 운영 부담 0
- single-command 자동화: `make deploy` 또는 `terraform apply` 1회 실행으로 사내+클라우드 동시 배포

---

## Section 7. 팀 재구성 매트릭스 (Wave별)

각 Wave에 대해 (a) 권고 agent team, (b) 신규 agent (Wave 진입 시 작성 필요), (c) read-only vs implementation 구분.

### 7.1 Wave별 Team 구성 권고

| Wave | 권고 Team (agent) | 신규 agent | 신규 agent 위치 |
|---|---|---|---|
| Wave 0 (preparation) | manager-spec, builder-agent, builder-skill, plan-auditor | regula-corpus-ingestion, regula-security-audit, regula-observability (harness gap audit C1+C3) | `.claude/agents/regula/` |
| Wave 1 Phase 1 | regula-architect, regula-design-system, regula-backend, regula-compliance-qa, **regula-corpus-ingestion** | — | — |
| Wave 1 Phase 2 | regula-frontend, regula-rag-pipeline, regula-backend, regula-compliance-qa, **regula-corpus-ingestion** | — | — |
| Wave 1 Phase 3 | regula-frontend, regula-rag-pipeline, regula-compliance-qa | — | — |
| Wave 1 Phase 4 | regula-frontend, regula-backend, regula-compliance-qa, **regula-design-system**, **regula-corpus-ingestion** | — | — |
| Wave 2 Phase 5 | regula-backend, regula-rag-pipeline, regula-design-system, regula-compliance-qa, **regula-frontend**, **regula-security-audit**, **regula-observability** | — | — |
| Wave 2 Phase 8 | regula-backend, regula-rag-pipeline, regula-compliance-qa, regula-corpus-ingestion, **regula-security-audit** (Trade Secret tagging + redaction_map 암호화) | — | — |
| Wave 2 Phase 6 | regula-compliance-qa (lead), regula-architect, regula-backend, regula-rag-pipeline, regula-security-audit, **regula-devops** (사내 docker-compose 자동화) | regula-devops | `.claude/agents/regula/regula-devops.md` |
| Wave 3 Phase 9 + new PREDICATE/CER/PCCP | regula-backend, regula-rag-pipeline, regula-frontend, regula-compliance-qa, **regula-predicate** (신규), **regula-cer** (신규), **regula-pccp** (신규) | regula-predicate, regula-cer, regula-pccp | `.claude/agents/regula/` |
| Wave 3 Phase 12 RADAR | regula-backend, regula-rag-pipeline, regula-corpus-ingestion, regula-frontend, regula-compliance-qa | — | — |
| Wave 4 Phase 7-Hybrid | regula-architect, regula-backend, regula-frontend, regula-security-audit, regula-observability, regula-devops | — | — |
| Wave 4 new COEDIT | regula-frontend, regula-backend, **regula-coedit** (신규) | regula-coedit | `.claude/agents/regula/regula-coedit.md` |

### 7.2 신규 agent 정의 (4건 신규 + Wave 0 Critical 3건 + Wave 2 1건 = 8건)

본 v2.0이 작성 위임을 후속으로 권고하는 agent 목록:

| Agent | Wave | 핵심 책임 |
|---|---|---|
| regula-corpus-ingestion | 0 (Wave 1 진입 전) | Chunking + embedding + crawler + ingestion (harness gap audit C3 해소) |
| regula-security-audit | 0 (Wave 2 진입 전) | OWASP / CSP / HSTS / CSRF / SSRF / 사내 KMS / Trade Secret tagging implementation (harness gap audit C1 해소) |
| regula-observability | 0 (Wave 2 진입 전) | Sentry / Langfuse / PostHog wiring (harness gap audit C1 해소) |
| regula-devops | 2 (Phase 6 진입 전) | 사내 docker-compose + GitHub Actions + 1-command deploy automation (harness gap audit H7) |
| regula-predicate | 3 (Wave 3 진입 전) | FDA openFDA API client + cascade search + Vectorize rerank + cache (PREDICATE SPEC owner) |
| regula-cer | 3 (Wave 3 진입 전) | MEDDEV 2.7/1 Rev4 10-stage CER + PubMed E-utilities + literature appraisal (CER SPEC owner) |
| regula-pccp | 3 (Wave 3 진입 전) | FDA AI/ML PCCP guidance template + 4-component generator + validator (PCCP SPEC owner) |
| regula-coedit | 4 (Wave 4 진입 전) | Yjs schema + Cloudflare Durable Objects WebSocket gateway + ProseMirror/TipTap React component (COEDIT SPEC owner) |

### 7.3 Read-only vs Implementation teammate 분리 (변경 없음)

- Implementation teammate (write): `isolation: "worktree"`, `background: false`, `mode: "acceptEdits"`
- Read-only teammate (verify/research): `permissionMode: "plan"`, `background: true`, no isolation

### 7.4 Skill frontmatter 패치 (harness gap audit C4 해소)

Wave 0 진입 시 모든 regula-* agent의 `skills:` YAML frontmatter 배열을 명시 패치한다. 본 항목은 v1.0.0의 Action Item AI-005와 동일하며, v2.0에서도 변경 없이 유지한다.

---

## Section 8. 운영 일정 우선순위 (시간 추정 금지)

**시간 단위 (예: "2주", "1개월") 일체 사용 금지**. Priority + Phase ordering으로만 표현.

### 8.1 Wave별 우선순위

| Wave | Priority | 선결 조건 | 비고 |
|---|---|---|---|
| Wave 0 (preparation — 4 agents 작성 + skill frontmatter 패치) | **Critical** | 없음 | Wave 1 진입 차단. 본 Roadmap 승인 후 즉시 |
| Wave 1 Foundation Stack | High | Wave 0 완료 + plan-auditor PROCEED_TO_WAVE_1 verdict | 4 Phase 순차+일부 병렬 |
| Wave 2 Trust + Documents | High | Wave 1 완료 + 사내 MinIO + Vault + Postgres 환경 프로비저닝 | Phase 5 + Phase 8 병렬 가능 |
| Wave 3 Workflows + Intelligence | High | Wave 2 완료 + 4 신규 SPEC (PREDICATE / PCCP / CER / COEDIT) 작성 완료 + FDA openFDA API key + PubMed API key | Phase 9 + PREDICATE + RADAR 병렬 가능 |
| Wave 4 Edge + Co-editing | Medium | Wave 3 완료 + Cloudflare Workers Paid plan 활성화 + Workers Compat Audit 통과 | Phase 7-Hybrid + COEDIT 일부 병렬 |

### 8.2 Wave 내 Phase 우선순위 (Wave 1-2 상세)

#### Wave 1 (Foundation Stack)

1. **Critical** — Phase 1 FOUNDATION (사내 IdP 1개 + 13-table + audit trigger). 후속 Phase 차단
2. **High** — Phase 2 CHAT (Phase 1 완료 후, regula-corpus-ingestion으로 FDA corpus 1개 populate 선결)
3. **Medium 병렬** — Phase 3 STRUCTURED + Phase 4 BREADTH (Phase 2 완료 후, 두 Phase 병렬 가능)

#### Wave 2 (Trust + Documents)

1. **High 병렬** — Phase 5 ENTERPRISE-Lite + Phase 8 DOCINGEST (Wave 1 완료 후, Phase 5 RBAC stub 완성 후 Phase 8 schema 시작 가능)
2. **High** — Phase 6 LAUNCH (Phase 5 + Phase 8 완료 후, 내부 LR-001~LR-IN-010 검증)

#### Wave 3 (Workflows + Intelligence)

1. **High 병렬** — Phase 9 WORKFLOWS + 신규 PREDICATE + Phase 12 RADAR (Wave 2 완료 후, Phase 8 corpus 의존)
2. **High** — 신규 PCCP / CER (Phase 9 내부 wizard, Phase 9 진행 중 sequential)

#### Wave 4 (Edge + Co-editing)

1. **Medium** — Phase 7-Hybrid (Wave 3 완료 후 Workers Compat Audit gate 선결)
2. **Medium** — 신규 COEDIT (Phase 7 KV/DO 설정 완료 후)

### 8.3 비차단 부속 작업 (각 Wave와 병렬 가능)

- harness gap audit High 7건 (H1~H7) 해소: Wave 진행 중 부속 작업으로 처리, 차단 사항 아님
- v1.0.0 master-roadmap §10 Decision Points 이월 추적: Wave별 종료 시 갱신
- Wave 5 후보 4 SPEC (INSPECTOR / DESKTOP / PMS / RMF) 스켈레톤 작성: post-Wave 4 결정

---

## Section 9. Critical Risks (Internal-Only 컨텍스트 재평가)

### R1. 510(k) Drafter Hallucination (Highest)

| 항목 | 값 |
|---|---|
| 영향 | 사내 사용 → 자사 510(k) 직접 손실 시 FDA RTA + 시장 출시 지연 |
| Wave | 3 (WORKFLOWS + PREDICATE) |
| Mitigation | (1) Predicate matching 정확도 ≥ 90% top-5 (PREDICATE SPEC REQ-PRED-005), (2) Wave 3 expert review 100% 강제 (review_required=true server-side enforcement, 게이팅 우회 0건), (3) 모든 draft에 21 CFR Part 11 disclaimer modal 강제 (REQ-WF-058), (4) eval rubric promptfoo "510(k) compliance" scorer ≥ 75% Wave 3 완료 게이트 |
| Acceptance | (a) 510(k) draft eCopy validator pass 100%, (b) eval rubric "510(k) compliance" ≥ 75%, (c) expert review queue resolution rate 100% |

### R2. Cloudflare Workers 호환성 (Wave 4 진입 차단 가능)

| 항목 | 값 |
|---|---|
| 영향 | Auth.js v5 / ts-morph / Drizzle Edge 호환성 미지수, Wave 4 진입 시 발견 시 Wave 4 차단 |
| Wave | 4 (CLOUDFLARE-Hybrid) |
| Mitigation | (1) Wave 3 완료 직후, Wave 4 진입 전 별도 Compat Audit gate (별도 SPEC-REGULA-WORKERS-COMPAT-001 권고, 본 v2.0 후속 결정 항목), (2) compat audit checklist: SSE Route Handler / nodejs_compat / Drizzle Edge / Auth.js v5 jwt strategy / WebSocket Durable Objects 5 항목 |
| Acceptance | (a) Compat Audit 5 항목 모두 PASS, (b) Workers preview deploy 1회 성공 |

### R3. PII / Trade Secret 누출 (Catastrophic)

| 항목 | 값 |
|---|---|
| 영향 | 자사 510(k) trade secret leak → 회사 치명상 |
| Wave | 2 (DOCINGEST) |
| Mitigation | (1) Phase 8 Trade Secret tagging (REQ-DOC-085~090, v2.0 신규), (2) Phase 5 audit gap 0 (audit-completeness CI gate), (3) 사내 KMS 마스터키 (Vault 또는 AWS KMS), (4) PII redaction 3-layer (Regex + Workers AI GLiNER + Presidio critical), (5) redaction_map AES-256-GCM + private schema + RLS + pii_admin_role, (6) 사내 ↔ 클라우드 데이터 분리 (Section 6.2 데이터 흐름) |
| Acceptance | (a) HIPAA Safe Harbor 18 ID redaction 100%, (b) Trade Secret tagging coverage 100%, (c) audit-completeness 0 violations, (d) PII unit test 200건 PASS |

### R4. 운영 부담 (DevOps 1명 미만)

| 항목 | 값 |
|---|---|
| 영향 | 자체 호스팅 부분(MinIO + Vault + Postgres) 운영 실패 가능, 사내 다운타임 |
| Wave | 2 (Phase 6 LAUNCH) |
| Mitigation | (1) Phase 6 launch readiness checklist에 "DevOps runbook" 추가 (LR-IN-001~LR-IN-010), (2) single-command 자동화 (terraform / docker-compose / make deploy), (3) 사내 의존성 single-node 운영 (MinIO docker + Vault docker + Postgres docker), (4) 자동 백업 cron (audit_logs → cold copy to NAS 월 1회), (5) Monitoring: Sentry로 사내 컴포넌트도 통합 (Sentry SDK on docker containers) |
| Acceptance | (a) make deploy 1-command 작동, (b) docker-compose 사내 컴포넌트 단일 노드 작동, (c) backup cron 작동 검증, (d) DevOps runbook 작성 |

### R5. Context Window Overflow (RA 1-2명이 모든 SPEC 검토)

| 항목 | 값 |
|---|---|
| 영향 | 765 REQ는 1-2명에게 과부하 → 검토 누락 → 실수 |
| Wave | 모든 Wave |
| Mitigation | (1) SPEC당 50-80 REQ 상한 (Phase 9 128 REQ는 Workflow A/B/C/D/E 5 sub-grouping), (2) MX 태그로 검토 우선순위 자동 표시 (high fan_in + critical = @MX:ANCHOR + @MX:WARN priority high), (3) Wave 단위 검토 게이트 (각 Wave 종료 시 1-2명 RA 명시 승인 필수), (4) plan-auditor 자동 audit (Critical 0건 verdict 발행), (5) RA 사용자 onboarding (regula-handoff-reader skill로 SPEC 빠른 navigation) |
| Acceptance | (a) plan-auditor Critical 0 verdict per Wave, (b) Wave 종료 시 RA 1-2명 explicit approval log, (c) MX tag coverage ≥ 95% on high fan_in functions |

### R6. (신규) Yjs CRDT Memory Footprint (Wave 4 COEDIT)

| 항목 | 값 |
|---|---|
| 영향 | 5명 동시 편집 × 1MB document = 5MB DO RAM. Cloudflare Durable Object 128MB limit 충돌 가능성 |
| Wave | 4 (COEDIT) |
| Mitigation | (1) Document size cap (REQ-COEDIT-008 신규: workflow_runs.body_md ≤ 500KB), (2) Yjs memory profiling Wave 4 진입 전 baseline 측정, (3) DO scale-out fallback (5명 → 20명+ 시 multi-DO sharding + leader election) |
| Acceptance | (a) 5명 1-hour sustained 편집 시 DO RAM ≤ 80MB, (b) document size cap enforcement 100% |

### R7. (신규) PubMed API rate limit (Wave 3 CER)

| 항목 | 값 |
|---|---|
| 영향 | PubMed E-utilities 3 req/sec without key, 10 req/sec with key. CER draft 1건 당 50건+ 인용 시 16+ sec 대기 |
| Wave | 3 (신규 CER) |
| Mitigation | (1) PubMed API key 발급 (NCBI account 무료), (2) Inngest step function으로 비동기 fetch + KV cache 30-day, (3) MEDDEV 10-stage 중 Stage 4 Literature Search은 background 진행, 나머지 stages 병렬 |
| Acceptance | (a) PubMed API key 발급 + .env.example 문서화, (b) CER draft 1건 P95 ≤ 60sec |

---

## Section 10. Decision Log (사용자 결정 트레이서빌리티)

### 10.1 본 세션 (ultra-plan-brainstorm 2026-04-23) 사용자 결정

| 결정 사항 | 답변 | 영향 (v2.0 반영처) |
|---|---|---|
| 서비스 진입 전략 | 내부 최소인력 전용 | Section 3.10 (TENANT 축소), Section 3.11 (NETWORK 폐기), Section 3.6 (LAUNCH 외부 감사 폐기), Section 6 운영 모델 |
| Wave 4 차별화 결정타 | Predicate Search + PCCP + CER + Co-editing 모두 | Section 4 신규 SPEC 4건, Section 2 Wave 3-4, Section 5 의존성 |
| Wave 2-3 통합 전략 | master-roadmap v2.0 재작성 | 본 v2.0 문서 자체 |
| Git 커밋 전략 | 브레인스토밍 결과 + 사분면 커밋 | manager-strategy 완료 후 일괄 커밋 (Wave 0 후속 결정) |
| 사용자 규모 | 6-8명 (RA 1-2 + Dev 2 + Exec 1 + External 2-3) | Section 3.5 (RBAC 2-role + 부서 attribute), Section 6 (single-tenant) |
| 주력 시장 | FDA + EU MDR/IVDR + MFDS (Tier 1) / PMDA + NMPA (Tier 2 best-effort) | Section 3.4 (BREADTH PMDA/NMPA 강등), Section 3.12 (RADAR 3-regulator), Section 4 (CER EU MDR full / PMA US 한정) |
| MVP 스코프 | 모두 포함 (Wave 1+2+3+4 일괄) | Section 2 4-Wave 단일 트랙 |
| 운영 채널 | Hybrid (민감 사내 + 컴퓨트 cloud) | Section 6 운영 모델, Section 3.7 (CLOUDFLARE Hybrid 부분 적용) |

### 10.2 v1.0.0 Decision Points (locked, 변경 없음)

- Vector DB: pgvector (사내) + Vectorize (공개 corpus, Wave 4)
- Queue / Worker: Inngest (Wave 1-3) + Cloudflare Queues (Wave 4 부분)
- LLM Orchestration: Vercel AI SDK + @ai-sdk/anthropic
- Anthropic Prompt Caching: 활성화
- Retrieval 방식: pgvector cosine + Postgres FTS BM25 하이브리드 (0.6/0.4)
- Embedding Provider: OpenAI text-embedding-3-small (1536 dim)
- Structured block 생성 방식: prose 완료 후 Haiku follow-up call
- i18n library: next-intl
- Reranker: Cohere Rerank v3
- Hosting: Vercel (Wave 1-3) + Cloudflare Workers (Wave 4)
- DB hosting: Neon (cloud option) 또는 사내 Postgres self-host (운영 모델 결정에 따름)
- Promptfoo / k6 / Playwright: 유지
- LangFuse / Sentry / PostHog: 유지

### 10.3 v2.0 신규 결정 (본 문서로 lock)

| Decision | 선택 | 사유 | 재평가 조건 |
|---|---|---|---|
| 사내 KMS | HashiCorp Vault (1순위) 또는 AWS KMS | 운영 단순, single-node docker. AWS KMS은 사내 외부 vault 가능 시 | 사내 IT 정책 변경 시 |
| 사내 Object Storage | MinIO (1순위) | S3 호환, docker-compose 1-command, 사내 100GB/년 sufficient | 용량 1TB+ 도달 시 Ceph RGW |
| 사내 Postgres | self-managed Postgres 16+ + pgvector 0.7+ | Neon self-host 옵션. docker-compose 또는 RHEL 표준 | Neon cloud 단일 region 제약 시 |
| Cloudflare R2 | **폐기 (사내 MinIO로 대체)** | 데이터 주권 + 비용 절감 + Wave 1-3 클라우드 의존성 축소 | — |
| Cloudflare WAF/Turnstile/mTLS | **폐기** | 사내 VPN + Cloudflare Access 1차 방어로 충분 | 외부 사용자 추가 시 (Wave 5+) |
| Cloudflare AutoRAG | **폐기** | 자체 ingestion (regula-corpus-ingestion + Phase 8) 일관성 우선 | 운영 부담 폭증 시 |
| Phase 10 TENANT | **5 REQ로 축소 + Phase 5 흡수** | 단일 tenant 가정 | M&A 시나리오 / 외부 고객 추가 시 |
| Phase 11 NETWORK | **재정의 → External Public Data Enrichment 10 REQ + Phase 8 흡수** | N=1 무의미 | 다중 조직 confederation 가능 시 |
| Phase 7 EU residency | **폐기** | 단일 시장 가정 | EU 고객 추가 시 |
| 외부 SOC 2/ISO 외부 감사 | **폐기** | 내부 정책 체크리스트로 대체 | 외부 감사 요구 시 |
| 4 신규 SPEC 작성 우선순위 | PREDICATE → PCCP → CER → COEDIT | Wave 3 진입 차단 항목 우선 | — |

### 10.4 잔존 결정 필요사항 (v2.0 작성 후 후속 결정)

| 결정 | 의사결정자 | 진입 시점 |
|---|---|---|
| D-1 | 사내 KMS: Vault vs AWS KMS 최종 선택 | Wave 2 진입 직전 |
| D-2 | 사내 Postgres host 환경 (RHEL 9 / Ubuntu 22.04) | Wave 2 진입 직전 |
| D-3 | Wave 4 Workers Compat Audit 별도 SPEC 작성 여부 | Wave 3 종료 시 |
| D-4 | Wave 5 진입 여부 (INSPECTOR / DESKTOP / PMS / RMF) | Wave 4 종료 시 |
| D-5 | Cloudflare Workers Paid plan vs free tier 결정 | Wave 4 진입 직전 |

---

## Section 11. Definition of Done (Roadmap 자체의 DoD)

본 v2.0 Roadmap이 "완료"된 상태로 간주되는 조건:

### 11.1 Wave별 완료 조건

| Wave | DoD |
|---|---|
| Wave 0 | (a) 4 agents + skill frontmatter 패치 완료, (b) plan-auditor PROCEED_TO_WAVE_1 verdict, (c) MoAI orchestrator는 4 agents 이름 호출 가능 |
| Wave 1 | (a) 217 REQ 중 ≥95% 구현, (b) Wave 1 완료 게이트 4항목 PASS (Section 2.1), (c) Vitest coverage ≥ 70% |
| Wave 2 | (a) 169 REQ 중 ≥95% 구현, (b) Wave 2 완료 게이트 6항목 PASS (Section 2.2), (c) Vitest coverage ≥ 80%, (d) audit-completeness CI gate green |
| Wave 3 | (a) 263 REQ 중 ≥95% 구현, (b) Wave 3 완료 게이트 5항목 PASS (Section 2.3), (c) eval rubric "510(k) compliance" ≥ 75% promptfoo, (d) Vitest coverage ≥ 85%, (e) Playwright E2E 7 spec × 2 browser PASS |
| Wave 4 | (a) 65 REQ 중 ≥95% 구현, (b) Wave 4 완료 게이트 4항목 PASS (Section 2.4), (c) Workers Compat Audit 5 항목 PASS, (d) Yjs 5명 1-hour sustained PASS |

### 11.2 전역 DoD (Wave 4 종료 후)

- 모든 4 Wave의 완료 게이트 통과
- 전체 ~664 REQ 중 ≥95% 구현
- handoff README §20 launch readiness checklist 25항목 전원 통과 (단, SOC 2 / 외부 감사 항목은 사내 정책 체크리스트로 대체 — LR-IN-001~LR-IN-010)
- 사내 보안 정책 + 21 CFR Part 11 / HIPAA 자체 준수 검증 (LR-IN-001~010)
- DevOps runbook 작성 + 1-command 자동화 (terraform / docker-compose / make deploy)
- 7개 Non-Obvious Constraints 전부 eval/E2E 회귀 통과
- Vitest 전체 coverage ≥ 90%
- axe-core 0 violations
- audit-completeness 0 violations
- i18n-completeness 0 violations
- Mozilla Observatory ≥ A
- TypeScript strict 0 errors
- Biome 0 warnings/errors
- 사내 docker-compose stack 단일 노드 작동 검증
- 사용자 6-8명 onboarding 완료 + onboarding modal 적용

---

## Section 12. 관련 문서 인덱스

### 12.1 Plan 문서 (depends_on / supersedes)

| 문서 | 관계 | 비고 |
|---|---|---|
| `.moai/plans/master-roadmap.md` | **superseded by v2.0** | v1.0.0 Phase 0-6 절차 인계. v2.0 frontmatter `supersedes` 표기 권고 |
| `.moai/plans/ultra-plan-brainstorm.md` | depends_on (PRIMARY 단일 진실원) | 본 v2.0의 직접 입력 |
| `.moai/plans/harness-gap-audit.md` | related (Wave 0 Critical findings) | C1+C3+C4 해소가 Wave 0 진입 조건 |
| `.moai/plans/cross-spec-audit.md` | related (병렬 작성 중, v2.0과 통합 권고) | post-v2.0 manager-strategy 후속 작업 |

### 12.2 SPEC 문서 (12 기존 + 4 신규)

| SPEC ID | Phase | 상태 | v2.0 영향 |
|---|---|---|---|
| SPEC-REGULA-FOUNDATION-001 | 1 | v0.3.0 audit-002 PASS | -3 REQ (Auth provider 축소) |
| SPEC-REGULA-CHAT-001 | 2 | v0.1.0 draft | 변경 없음 |
| SPEC-REGULA-STRUCTURED-001 | 3 | v0.1.0 draft | 변경 없음 |
| SPEC-REGULA-BREADTH-001 | 4 | v0.1.0 draft | -8 REQ (Tier 2 강등) |
| SPEC-REGULA-ENTERPRISE-001 | 5 | v0.1.0 draft | -25 REQ + Phase 10 5 흡수 = 53 REQ |
| SPEC-REGULA-LAUNCH-001 | 6 | v0.1.0 draft | -15 REQ (외부 감사 폐기) + LR-IN-001~010 신규 |
| SPEC-REGULA-CLOUDFLARE-001 | 7 | v0.1.0 draft | -40 REQ (Hybrid 부분 적용) |
| SPEC-REGULA-DOCINGEST-001 | 8 | v0.1.0 draft | +20 REQ (자사 + Trade Secret + External Enrichment) = 98 REQ |
| SPEC-REGULA-WORKFLOWS-001 | 9 | v0.1.0 draft | +60 REQ (CER + PCCP + De Novo + PMA 흡수) = 128 REQ |
| SPEC-REGULA-TENANT-001 | 10 | v0.1.0 draft | **archived** (5 REQ Phase 5 흡수) |
| SPEC-REGULA-NETWORK-001 | 11 | v0.1.0 draft | **archived** (10 REQ Phase 8 흡수) |
| SPEC-REGULA-RADAR-001 | 12 | v0.1.0 draft | -15 REQ (3-regulator 집중) = 40 REQ |
| **SPEC-REGULA-PREDICATE-001** | Wave 3 | **신규 — Wave 0 후속 작성** | 30 REQ (Section 4.1 스켈레톤) |
| **SPEC-REGULA-PCCP-001** | Wave 3 (Phase 9 흡수) | **신규 — Wave 0 후속 작성** | 25 REQ (Section 4.2 스켈레톤) |
| **SPEC-REGULA-CER-001** | Wave 3 (Phase 9 흡수) | **신규 — Wave 0 후속 작성** | 40 REQ (Section 4.3 스켈레톤) |
| **SPEC-REGULA-COEDIT-001** | Wave 4 | **신규 — Wave 0 후속 작성** | 20 REQ (Section 4.4 스켈레톤) |

### 12.3 Agent / Skill 문서

| Agent / Skill | 위치 | v2.0 영향 |
|---|---|---|
| `.claude/skills/regula/SKILL.md` | Phase × Team 마스터 | Wave 단위로 갱신 권고 (Section 7.1) |
| `.claude/agents/regula/regula-architect.md` | 기존 | skills frontmatter 패치 + Wave 4 책임 추가 |
| `.claude/agents/regula/regula-design-system.md` | 기존 | skills frontmatter 패치 |
| `.claude/agents/regula/regula-frontend.md` | 기존 | skills frontmatter 패치 + Onboarding (C2) + 키보드 단축키 (H3) 추가 |
| `.claude/agents/regula/regula-rag-pipeline.md` | 기존 | skills frontmatter 패치 |
| `.claude/agents/regula/regula-backend.md` | 기존 | skills frontmatter 패치 + 부서 attribute |
| `.claude/agents/regula/regula-compliance-qa.md` | 기존 | skills frontmatter 패치 |
| `regula-corpus-ingestion` | **신규 (Wave 0)** | C3 해소 |
| `regula-security-audit` | **신규 (Wave 0)** | C1 해소 + Trade Secret tagging |
| `regula-observability` | **신규 (Wave 0)** | C1 해소 |
| `regula-devops` | **신규 (Wave 2)** | H7 해소 + 사내 docker-compose |
| `regula-predicate` | **신규 (Wave 3)** | PREDICATE SPEC owner |
| `regula-cer` | **신규 (Wave 3)** | CER SPEC owner |
| `regula-pccp` | **신규 (Wave 3)** | PCCP SPEC owner |
| `regula-coedit` | **신규 (Wave 4)** | COEDIT SPEC owner |
| `.claude/skills/regula-*` (7 도메인 skills) | 기존 | 변경 없음 — frontmatter 패치만 (Wave 0) |

### 12.4 핸드오프 / 컨텍스트 / 기타

- `RA-bot-design/design_handoff_regula/README.md` — handoff 원본, §20 launch readiness 25항목
- `CLAUDE.md` — Non-Obvious Product Constraints 7항목 원본 (변경 없음)
- `.moai/project/product.md` / `structure.md` / `tech.md` — 갱신 권고 (Wave 4 Hybrid 운영 모델 반영)
- `.moai/config/sections/user.yaml` / `language.yaml` — 변경 없음

---

## 문서 유지보수 정책

- 본 v2.0은 Wave 진행에 따라 cumulative revision 한다:
  - 각 Wave 완료 시 Section 8 우선순위, Section 9 Risk Register, Section 10.4 잔존 결정 갱신
  - SPEC 버전 변경 시 Section 12.2 해당 row 갱신
  - 4 신규 SPEC 작성 완료 시 Section 4 스켈레톤 → 본문 link로 전환
- 본 v2.0은 v1.0.0을 supersede 하나, v1.0.0은 archive 유지 (참조 가능)
- 본 v2.0은 개별 SPEC의 REQ 상세를 중복 기술하지 않는다 — SPEC ID + 그룹 번호로 참조
- ultra-plan-brainstorm §2 영향 매트릭스, §3 Wave 재구조화, §4 신규 SPECs는 v2.0의 단일 진실원으로 유지
- v2.0과 ultra-plan-brainstorm 충돌 시 v2.0 본문이 우선 (v2.0이 ultra-plan-brainstorm을 정제·확장한 결과)
- 사용자 결정 변경 시 manager-strategy가 v2.1로 amend (v2.0 frontmatter `supersedes` 추가)

---

*End of Master Roadmap — Regula v2.0 (Internal RA Operating System)*
