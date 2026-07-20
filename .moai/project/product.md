# 제품 정의 — Regula (v3)

> 버전: 3.0.0
> 최종 업데이트: 2026-07-02
> 개정 사유: v3 아키텍처 마스터 계획 기반 전면 재정의
> 기준 문서: docs/proposals/v3-architecture-revamp-plan-2026-07-02.md

---

## 제품 정체성

**Regula는 RA(Regulatory Affairs) 게이트웨이이다.**

의료기기 인허가 담당자 3명(RA Lead 1명 + RA Member 2명)과 사내 임직원 26명(Employee) 사이의 커뮤니케이션 · 셀프서비스 · 이력 관리를 통합하는 사내 웹앱.

### 핵심 역할

1. **Employee(26명)** → 규제 질문 자연어 셀프서비스 (RA를 매번 붙잡지 않음)
2. **RA(3명)** → 사내 질의 Kanban Inbox 1개에서 트리아지 · 승인 (분산된 채팅/메일 폐지)
3. **Admin(1명)** → 사용자 · 데이터 소스 · 감사 로그 감시 · 21 CFR Part 11 준수 유지

### 아닌 것 (범위 외)

- **QMS 대체** (CAPA/Change Control/Audit/PMS 등 워크벤치는 v2에서 폐기, QMS 소유는 QA 팀)
- **일반 KB** (Notion/Confluence 대체, 영업/마케팅/인사 지식 검색)
- **가짜 신뢰 생성기** (Expert Review Gate 없이 시스템 출력이 최종본이 되는 흐름)
- **AI 규제 판단 대신** (모든 법적 주장은 RA Lead 확인·승인 필수)
- **SaaS 외판** (abyz 내부 6-8명용 설계, 외부 고객 온보딩 불가)

---

## 3-tier 타겟 사용자 (v3 Persona 아키텍처)

| Persona | 인원 수 | 주요 니즈 | 화면 수 |
|---------|---------|----------|--------|
| **Employee** | 26명 | 규제 셀프서비스, 변경 영향 자가진단 | 5 (Ask, 내 질의, 제품 카드, Guides, Impact) |
| **RA** | 3명 (Lead 1 + Member 2) | 사내 질의 처리, 인허가 워크플로우, 문서 작성 | 6 (Inbox, Consult, Submissions, Registry, Radar, Knowledge) |
| **Admin** | 1명 | 시스템 감시, 거버넌스, 사용자 관리 | 12 (5 카테고리: Workspace/User/Data/Governance/Design) |

> **v3 변경사항**: Employee "담당 제품" 개인화 폐기 (M-013 결정). 전 임직원 자유 조회.

---

## 핵심 가치

| 가치 | 기존 | v3 Regula |
|------|------|-----------|
| **Employee 규질 질문** | RA를 매번 붙잡음 | 자연어로 질문 → RAG 답변 (인용 기반) |
| **RA 질의 처리** | 분산된 채팅/메일 | Kanban Inbox 1개 (4-column · triage state) |
| **Auto-Triage** | 수동 분류 | RAG + LLM confidence 기반 자동 응답 (24h 유예) |
| **Change Impact 진단** | 수십 분 조사 | 4-layer 위저드 (계층 1 결정론 + 계층 2 LLM 분류 + 계층 3 RA 티켓 + 계층 4 유사 사례) |
| **감사 추적** | 수동 기록 | audit_log append-only + SHA-256 hash chain (월간 자동 검증) |
| **승인 답변집** | 메일/문서 공유 share | DB 실시간 + git 스냅샷 (Hybrid, 03:20 KST) |

---

## v3 범위 (QMS 명시적 제외)

### 포함 기능

| 기능 | v3 상태 | 비고 |
|------|---------|------|
| RAG Q&A (3개 지식 repo 연동) | ✅ 보존 (개선) | ra-project/MD-process/ra-llm-wiki 연동 + per-domain retrievers + delta-sync (Phase D 완결). 데이터 소싱(3 repo) vs 검색 도메인(FDA/EU MDR/...) 분리 — docs/architecture/knowledge-base.md |
| Inbox Kanban + Auto-Triage | 🆕 신규 | 4-column (auto/needs-review/escalated/waiting), confidence 임계값 |
| Change Impact Check | 🆕 신규 | 4-layer wizard, retestMatrix (7×5=35셀) |
| Consult (Power Chat) | 🆕 신규 | 관할권 다중 비교, 세션 저장, 5개 실 세션 시드 |
| CER/PCCP/Predicate | ✅ 보존 | Expert Review Gate 불변 |
| Standards/Radar | ✅ 보존 | 규제 레이더, 임팩트 평가 |
| Audit hash chain | 🆕 강화 | previous_hash BYTEA + 월간 자동 검증 (BK-105) |
| 3-tier PersonaBar | 🆕 신규 | Employee/RA/Admin 스위치 |
| BFF (hybrid-ra-saas) | 🆕 신규 | lib/bff/ 정식 레이어, 6 integration points |

### 제외 기능 (QMS — v2에서 폐기)

| 도메인 | 사유 팀 | Regula v3 관계 |
|--------|---------|------------------|
| PMS/PMCF | QA 팀 | ❌ 범위 외 (QMS 워크벤치는 별도 시스템) |
| CAPA/Change Control | QA 팀 | ❌ 범위 외 |
| Vigilance/Complaint | QA 팀 | ❌ 범위 외 (환자정보 취급, #319 제거 완료) |
| DHF/Risk Management | QA 팀 | ❌ 범위 외 |

> **Charter 지양-3 준수**: Regula는 QMS를 대체하지 않음. QMS 도메인 8개를 archive/qms-pms/로 물리 이동(2026-07-19 직검 실측, #530). 나머지 QMS 후보 도메인은 외부 런타임 의존성으로 KEEP 재판정됨.

---

## Charter 지양 5종 (SPEC 작성 전 체크리스트)

### [지양-1] 일반 KB ❌

RAG corpus는 **3개 지식 repo(ra-project/MD-process/ra-llm-wiki) 연동**으로만 구축(docs/architecture/knowledge-base.md). 해당 repo 내용은 RA 규제 도메인(FDA/EU MDR/MFDS/NMPA/PMDA/SOP — 검색·분류 도메인) 전용. 영업/마케팅/인사 지식, Notion/Confluence 대체 → 범위 외.

### [지양-2] 가짜 신뢰 ❌

아래 3가지는 아키텍처 결정으로 어떤 기능 추가로도 풀 수 없음:
- **Expert Review Gate 없이 시스템 출력이 최종본이 되는 흐름** (불방: lib/domains/expert-review/ 불변)
- **Draft watermark를 우회하는 export 경로** (해당: export는 draft 상태 표시, RA 승인 후 해제)
- **인용 근거 없는 주장이 export되는 흐름** (해당: 모든 export는 citation 포함)

### [지양-3] QMS 대체 ❌

**SOP 관리, 변경 제어(CAPA), 불만 처리 → 범위 외.**
DOCINGEST는 SOP를 RAG corpus로 참조할 뿐이지, SOP를 관리하는 것이 아님. Veeva Vault, MasterControl, Arena PLM 대체 포지션 아님.

### [지양-4] AI가 규제 판단을 대신하는 도구 ❌

**모든 법적 주장(predicate 선정, equivalence claim, PCCP 적용 범위)은 RA Lead 확인·승인 필수.**
Article 61(4) disclaimer 등 법적 경고 텍스트는 SPEC에서 제거 불가.

### [지양-5] SaaS 외판 ❌

**abyz 내부 6~8명용 설계.** 외부 고객 온보딩, 결제, 다중 조직 관리 기능 → 현재 범위 외.
단, **hybrid-ra-saas 별도 SaaS와 BFF 연동**은 허용 (lib/bff/ 정식 레이어, 6 integration points).

---

## v3 vs 현재 정체성 매핑

| 측면 | 현재 (v2) | v3 타겟 |
|------|-----------|----------|
| **정체성** | RA 문서 작성 워크벤치 (좁고 깊음) | RA 게이트웨이 (전사 인허가 도우미, RA 업무 분산) |
| **사용자** | RA Lead 1~2명 (실질 파워유저) | Employee 26명 (1순위) + RA 3명 (2순위) + Admin 1명 |
| **QMS 범위** | 포함 (PMS/PMCF/CAPA/Vigilance) | **제외** (QMS 도메인 8개 archive 이동, #530) |
| **LLM 백엔드** | 외부 API (OpenAI/Anthropic) | **gx10 온프레미스 Ollama 단일** (gpt-oss:120b, #318) |
| **환자정보** | 포함 (vigilance/complaint/PII redaction) | **제외** (PHI 도메인 138 files 제거, #319) |
| **Inbox** | 미구현 | 🆕 4-column Kanban + Auto-Triage |
| **Impact Check** | 기존 lib/impact (6 files) | 🆕 4-layer wizard (retestMatrix 35셀 임베드) |
| **UI** | v2 잔재 | 🆕 3-tier PersonaBar + components/ 전면 재작성 |
| **BFF** | lib/api/ (fragmentary) | 🆕 lib/bff/ 정식 레이어 (6 integration points) |

---

## 핵심 성공 지표 (KPI)

| 지표 | 현재 | v3 목표 |
|------|------|---------|
| 답변 출처 명시율 | 100% (현재) | 100% (유지) |
| Auto-triage 정확도 | N/A | confidence >= 85% → auto (24h 유예) |
| 미답변 → RA 에스컬레이트 | N/A | escalated 자동 티켓 생성 (48h SLA) |
| 회귀 테스트 | 4,815 passed | 5,450 passed (2026-07-19 실측 baseline, 68 skipped, #530) |
| audit 무결성 | N/A | hash chain 월간 검증 PASS (BK-105) |
| 제품 자동 추출 | N/A | ra-llm-wiki → products 테이블 (BK-033) |

---

## 관련 문서

- **v3 마스터 계획**: docs/proposals/v3-architecture-revamp-plan-2026-07-02.md (676줄)
- **v3 원본 문서**: docs/v3/ (README + 5개 하위 문서)
- **Charter**: .moai/specs/CHARTER.md (지양 5종)
- **기술 명세**: tech.md (v3 스택 통합)
- **구조 명세**: structure.md (v3 3-Tier 아키텍처)
