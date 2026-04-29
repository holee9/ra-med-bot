---
document_id: ULTRA-PLAN-BRAINSTORM-001
version: 1.0.0
created: 2026-04-23
author: MoAI orchestrator (with user)
session_type: ultraplan_brainstorming
purpose: |
  "지구 최강 RA 전문가 사이트" 비전을 12개 기존 SPEC + 운영 컨텍스트(내부 6-8명)에
  맞춰 재정의. master-roadmap v2.0 재작성을 위한 입력 자료.
inputs:
  - 12개 SPEC (Phase 1-12, 753 REQ)
  - .moai/plans/master-roadmap.md v1.0.0 (Phase 0-6 한정)
  - .moai/plans/harness-gap-audit.md
  - RA-bot-design/design_handoff_regula/README.md (handoff)
outputs:
  - master-roadmap v2.0 (manager-strategy 위임 산출물 — 본 문서 다음에 작성)
  - Wave 4 4건 신규 SPEC 스켈레톤 (manager-spec 후속 위임)
---

# Ultra-Plan Brainstorming — Regula → Internal RA Operating System

## 1. 사용자 컨텍스트 (Locked)

### 1.1 사용자 규모 (총 6-8명)
- RA 팀: 1-2명 (코어 사용자, 510(k)/CER/Audit Response 작성 주체)
- 개발팀장: 2명 (R&D 컨텍스트 입력 — design output, predicate device 비교 자료)
- 총괄본부장: 1명 (대시보드 + 결정 지원 위주)
- 외부 요청부서 (마케팅/영업/규제대응): 2-3명 (Q&A + Indication 영향 조회 위주)

### 1.2 주력 시장
- **Tier 1 (full depth)**: 미국 FDA (510(k) / De Novo / PMA), EU MDR / IVDR, 한국 MFDS K-MDR
- **Tier 2 (best-effort)**: 일본 PMDA, 중국 NMPA — corpus 유지하되 RADAR/WORKFLOWS 깊이는 제한

### 1.3 운영 모델 (Hybrid)
- **사내 (on-prem)**: 민감 데이터 — 인증 문서, audit_logs, secrets, KMS, R2 대안(MinIO/S3 호환)
- **클라우드**: 컴퓨트 + UI — Next.js (Vercel 또는 Cloudflare Workers), Workers AI 가능
- **DevOps 인력**: 1명 미만 가정 → managed 서비스 우선

### 1.4 MVP 스코프
- **일괄 대대적 접근** — Wave 1+2+3+4 한 번에 전부 빌드
- 외부 SaaS 출시 압박 없음 → PMF 검증 단계 생략
- Wave 4 4건 (Predicate / PCCP / CER / Co-editing) 모두 포함

---

## 2. 12 SPEC × Internal-Only 영향 매트릭스

| Phase | 원래 SPEC | Internal Pivot 결정 | REQ 변화 |
|---|---|---|---|
| 1 FOUNDATION | 74 REQ — Auth.js v5 SSO 4-provider | **Auth: 사내 IdP 1개만** (Microsoft Entra ID 또는 Google Workspace OIDC). 나머지 유지 | -3 REQ |
| 2 CHAT | 60 REQ — SSE RAG + Citation enforcement | **유지 100%** — 내부도 정확성 핵심 | 변경 없음 |
| 3 STRUCTURED | 37 REQ | **유지 100%** | 변경 없음 |
| 4 BREADTH | 57 REQ — 5 corpora (US/EU/KR/JP/CN) | **PMDA/NMPA best-effort 강등** — 코퍼스만 ingest, retriever 최적화 생략 | -8 REQ |
| 5 ENTERPRISE | 73 REQ — 4-role × 2-tier RBAC | **2-role (admin / member) + 부서 attribute (RA/Dev/Exec/External)**. Expert review 단순화 | -25 REQ |
| 6 LAUNCH | 48 REQ — SOC2/ISO 외부 감사 | **외부 감사 폐기** — 내부 정책 체크리스트로 대체. 21 CFR Part 11 / HIPAA 자체 준수만 | -15 REQ |
| 7 CLOUDFLARE | 85 REQ — Workers + Vectorize + R2 + WAF/Turnstile/mTLS + EU residency | **하이브리드 적용**: Workers/KV/Cache cloud, R2 cold storage 사내(MinIO)로 대체, WAF/Turnstile/mTLS 폐기 (사내 VPN 1차 방어), Vectorize는 옵션 (pgvector 우선) | -40 REQ |
| 8 DOCINGEST | 78 REQ — 14 chunkers + ACL 매트릭스 + HIPAA 18 ID redaction | **유지 90%** + **자사 prior submissions 1순위 corpus 추가** (REQ-DOC-079+) + **Trade Secret tagging 추가** (REQ-DOC-085+) | +10 REQ |
| 9 WORKFLOWS | 68 REQ — 510(k) + Audit Response + Indication Impact | **유지 100%** + **De Novo / PMA / CER / PCCP wizard 추가** (Wave 4 흡수) | +60 REQ |
| **10 TENANT** | 70 REQ — 3-layer isolation, RLS | **"Phase 10-Lite" 축소** — 단일 tenant 가정, 부서 attribute만, RLS 폐기. SOC2/ISO 외부 감사 폐기 | -55 REQ |
| **11 NETWORK** | 48 REQ — k-anonymity opt-in aggregate | **재정의 또는 폐기** — N=1 무의미. 대신 "external public dataset enrichment" (FDA 510(k) DB, MAUDE, Eudamed 등 공개 데이터 자동 enrichment)로 5-10 REQ 보존 | -38 REQ |
| 12 RADAR | 55 REQ — 6 regulator crawlers | **3-regulator 집중** (FDA/EU OJ/MFDS), PMDA/NMPA는 best-effort | -15 REQ |

### 2.1 순 변화
- 원래 753 REQ → **~715 REQ** (38 REQ 순감소)
- 그러나 Wave 4 통합: +50 REQ (Predicate / Co-editing — PCCP/CER는 Phase 9 흡수)
- **최종: ~765 REQ** (변화 폭이 작은 이유: Wave 4 통합 + Phase 8/9 강화가 Phase 10/11 축소를 상쇄)

---

## 3. Wave 재구조화 (4 Wave Model)

```
WAVE 1 — Foundation Stack (Phase 1-4)              236 REQ
  목표: 대화형 RAG 챗봇 + 5 관할권 corpus 작동
  스택: Next.js 15 (Vercel) + Neon Postgres + pgvector
  완료 게이트: 첫 token < 1.5s, 5 corpora 작동, 13-table schema 안정

WAVE 2 — Trust + Documents (Phase 5-Lite + 8 + 6)  ~140 REQ
  목표: 부서 RBAC + 자사 인증 문서 ingestion + audit immutable
  스택: + 사내 KMS (HashiCorp Vault 또는 AWS KMS), MinIO/S3
  완료 게이트: HIPAA Safe Harbor 18 ID redaction 100%, audit gap 0건,
              자사 prior submissions 인덱싱 완료

WAVE 3 — Workflows + Intelligence (Phase 9 확장 + 12)  ~140 REQ
  목표: 510(k)/CER/De Novo/PCCP drafter + 규제 변동 push
  스택: + Predicate Search Engine (FDA 510(k) DB) + PubMed API
  완료 게이트: 510(k) draft eCopy validator pass, RADAR 3 regulators 작동,
              CER PubMed 자동 인용 50건+

WAVE 4 — Edge + Co-editing (Phase 7-Hybrid + 신규 Co-edit + Inspector Mode)  ~150 REQ
  목표: Cloudflare hybrid + 부서간 Real-time co-editing + Desktop app
  스택: + Cloudflare Workers (compute/cache) + Durable Objects (Yjs co-edit) + Tauri Desktop
  완료 게이트: Workers Compat Audit pass, Yjs 5명 동시 편집 안정, Desktop offline 작동
```

### 3.1 폐기 또는 재정의되는 SPEC
- **Phase 10 TENANT**: → **Phase 10-Lite** (5 REQ, Phase 5 RBAC에 흡수)
- **Phase 11 NETWORK**: → **재정의 "External Public Data Enrichment"** (10 REQ, Phase 8 부속) 또는 v3 보류

---

## 4. 신규 SPECs 스켈레톤 (Wave 4 핵심)

다음 4건 신규 SPEC을 manager-spec 후속 위임으로 작성 권고:

| SPEC ID | 제목 | 흡수 위치 | REQ 추정 |
|---|---|---|---|
| SPEC-REGULA-PREDICATE-001 | FDA 510(k) Predicate Device Search Engine | Wave 3 (Phase 9 의존) | 30 |
| SPEC-REGULA-PCCP-001 | AI/ML Predetermined Change Control Plan Builder | Wave 3 (Phase 9 확장) | 25 |
| SPEC-REGULA-CER-001 | EU MDR Annex XIV Clinical Evaluation Report Builder | Wave 3 (Phase 9 + PubMed) | 40 |
| SPEC-REGULA-COEDIT-001 | Real-time Multi-user Document Co-editing (Yjs + DO) | Wave 4 (Phase 7 의존) | 20 |

### 4.1 차순위 신규 SPEC (Wave 5 후보, 본 세션 결정 대상 아님)
- SPEC-REGULA-INSPECTOR-001 — FDA on-site EIR Inspector Mode (offline-first)
- SPEC-REGULA-DESKTOP-001 — Tauri Desktop App
- SPEC-REGULA-PMS-001 — Post-Market Surveillance Plan Generator
- SPEC-REGULA-RMF-001 — ISO 14971 Risk Management File Builder

---

## 5. Critical Risks (인력 6-8명 컨텍스트에서 재평가)

### R1. 510(k) Drafter Hallucination
- **영향**: 사내 사용 → FDA RTA 시 회사 직접 손실
- **대응**: SPEC-REGULA-PREDICATE-001로 Predicate matching 정확도 확보 + Wave 3 expert review 100% 강제 (자동 게이팅 우회 금지)

### R2. Cloudflare Workers 호환성 (Phase 7 일부 적용)
- **영향**: Auth.js v5 / ts-morph / Drizzle Edge 호환성 미지수
- **대응**: Wave 4 진입 전 Workers Compat Audit gate (별도 SPEC-REGULA-WORKERS-COMPAT-001 권고)

### R3. PII / Trade Secret 누출
- **영향**: 영업비밀 510(k) 자료 leak → 회사 치명상
- **대응**: Phase 8 Trade Secret tagging (REQ-DOC-085+) + Phase 5 audit gap 0 + 사내 KMS 마스터키

### R4. 운영 부담 (DevOps 1명 미만)
- **영향**: 자체 호스팅 부분(MinIO + KMS + Postgres) 운영 실패 가능
- **대응**: Phase 6 launch readiness checklist에 "DevOps runbook" 추가, single-command 자동화 (terraform / docker-compose)

### R5. Context Window Overflow (RA 1-2명이 모든 SPEC 검토)
- **영향**: 765 REQ는 1-2명에게 과부하 → 실수
- **대응**: SPEC당 50-80 REQ 상한, MX 태그로 검토 우선순위 자동 표시

---

## 6. Decision Log (본 세션 사용자 답변)

| 결정 사항 | 답변 | 영향 |
|---|---|---|
| 서비스 진입 전략 | 내부 최소인력 전용 | Phase 10/11 축소·폐기, 외부 감사 폐기 |
| Wave 4 차별화 결정타 | Predicate Search + PCCP + CER + Co-editing 모두 | Wave 3-4에 4건 신규 SPEC 통합 |
| Wave 2-3 통합 전략 | master-roadmap v2.0 재작성 | manager-strategy 위임 |
| Git 커밋 전략 | 브레인스토밍 결과 + 사분면 커밋 | manager-strategy 완료 후 일괄 커밋 |
| 사용자 규모 | 6-8명 (RA 1-2 + Dev 2 + Exec 1 + External 2-3) | RBAC 2-role + 부서 attribute |
| 주력 시장 | FDA + EU MDR/IVDR + MFDS | PMDA/NMPA best-effort 강등 |
| MVP 스코프 | 모두 포함 (Wave 1+2+3+4 일괄) | 4-Wave roadmap 단일 트랙 |
| 운영 채널 | Hybrid (민감 사내 + 컴퓨트 cloud) | Phase 7 부분 적용, MinIO + 사내 KMS 추가 |

---

## 7. 다음 단계 (Sequential)

1. **(완료)** 본 브레인스토밍 결과 저장
2. **(다음)** manager-strategy 위임 → master-roadmap v2.0 작성 (.moai/plans/master-roadmap-v2.md)
3. **(검토)** v2.0 검토 + 사용자 승인
4. **(후속)** manager-spec 위임 → Wave 4 4건 신규 SPEC 스켈레톤 작성
5. **(마무리)** git commit (사분면별)
   - docs(plan): ultra-plan-brainstorm.md + master-roadmap-v2.md + 기존 plans
   - docs(spec): 12개 SPEC + 신규 4건
   - docs(agent): 9개 regula agents
   - docs(skill): 7개 regula skills
   - chore(config): CLAUDE.md + .moai/config + .mcp.json + .gitignore

---

## 8. 본 문서 사용 안내 (manager-strategy 위임 시)

manager-strategy는 본 문서를 master-roadmap v2.0 작성의 **단일 진실원**으로 참조한다. 본 문서와 master-roadmap.md v1.0.0의 충돌 시:
- §2 영향 매트릭스 = 우선
- §3 Wave 재구조화 = 우선
- §4 신규 SPECs = 우선
- 기존 v1.0.0의 Phase 0-6 세부사항은 v2.0에서 변경된 부분을 명시적으로 표기

본 문서는 plan 단계 산출물이며 EVOLVABLE 영역에 속한다. 이후 사용자 결정 변경 시 manager-strategy가 v2.0을 amend하는 방식으로 진화.
