# Regula v3 · Design Handoff for Implementation

**Target audience**: Claude Code · 백엔드/프런트 통합 구현 담당자
**Design frozen**: 2026-07-01 (M-014까지 이 세션의 실 의사결정 반영)
**Prototype entry**: `Regula v3 - RA Gateway.html` (인터랙티브) · `Regula v3 - Standalone.html` (오프라인 검증용)

---

## 0. 이 시스템은 무엇인가

**Regula = RA (Regulatory Affairs) 게이트웨이.** 의료기기 인허가 담당자 3명과 사내 임직원 26명 사이의 커뮤니케이션 · 셀프서비스 · 이력 관리를 통합하는 사내 웹앱.

**아닌 것**: QMS (CAPA/Change Control/Audit/PMS 등 워크벤치는 v2에서 폐기 · M-001에서 확정 · QMS 도메인 소유는 QA팀 · BK-201 참조).

**핵심 가치**:
1. Employee가 규제 질문을 자연어로 묻고 답을 받음 (RA를 매번 붙잡지 않음)
2. RA가 사내 질의를 Kanban Inbox 하나에서 트리아지 · 승인 (분산된 채팅/메일 폐지)
3. Admin이 사용자 · 데이터 소스 · 감사 로그를 감시 · 21 CFR Part 11 준수 유지

---

## 1. 3-tier Persona 아키텍처

상단에 페르소나 스위치 (`PersonaBar`) · 3-tier: **Employee · RA · Admin** · 각각 별도 사이드바 IA. 페르소나별 화면 접근권한은 서버에서 강제 (SSO claim → `role` 필드 → route guard).

### 1.1 Employee (5화면 · 26명)

일반 임직원 (R&D · Marketing · Reg Ops · Clinical 등). 규제 셀프서비스가 목적.

| id | 라벨 | 목적 |
|---|---|---|
| `ask` | Ask | 자연어로 규제 질문 · 답변 스트리밍 · 각주 인용 · **BK-101 간단히 보기/상세히 토글** · **BK-106 도메인 용어 Autocomplete** |
| `myqs` | 내 질의 | 내가 물어본 질문의 상태/답변 확인 (자동응답 · 검토중 · 승인 · 에스컬 · 대기) |
| `products` | 제품 카드 | 사내 전 제품의 시장별 인허가 상태 (BK-032로 담당 제품 개념 폐기 · 전 임직원 자유 조회) |
| `guides` | Guides & FAQ | RA가 사내 승인한 답변집 (승인 답변집 DB에서 조회) |
| `impact` | 변경 영향 자가진단 | 4-step 위저드 · 신호등 결과 · 노랑/빨강이면 RA 티켓 자동 생성 |

### 1.2 RA (6화면 · 3명)

RA 담당자 (Manager 1 · Member 2). 사내 질의 처리와 인허가 워크플로우.

| id | 라벨 | 목적 |
|---|---|---|
| `inbox` | Inbox | **핵심 화면.** 사내 질의 4-column Kanban · triageStates (auto / needs-review / escalated / waiting) · Kanban ↔ List 뷰 토글 |
| `consult` | Consult · Power Chat | 규제 딥리서치 세션 · 관할권 다중 비교 · 세션 저장 · 5개 실 세션 시드 |
| `submissions` | Submissions | 510(k) · CE MDR · MFDS · NMPA · PMDA 제출 워크플로우 · 진행률 |
| `registry` | Product Registry | RA 관점 제품 · 시장 상태 편집 (Employee "제품 카드"는 read-only) |
| `radar` | Regulatory Radar | 신규 규제 · 사내 제품별 임팩트 평가 · **BK-103 중문/일문 원문 카드** |
| `knowledge` | Knowledge | 승인 답변집 관리 (published/draft/deprecated) |

### 1.3 Admin (5 카테고리 · 12화면 · 1명)

플랫폼 관리자. 사이드바 5 카테고리로 분리:

**Workspace**
- `a-overview` — 시스템 헬스 + KPI + 최근 감사 로그

**사용자 관리 (User)**
- `a-users` — 사용자 · 역할 · RBAC (5 역할 · viewer/employee/ra-member/ra-lead/admin)

**데이터 · 지식 (Data & Knowledge)**
- `a-corpus` — RAG 코퍼스 (3 Git 레포 + 5 DB 스토어) · **BK-104 크론 03:00/03:20/03:40**
- `a-radar-src` — 외부 규제 레이더 스크래퍼 8종 (RSS + Scraper · ON/OFF)

**거버넌스 (Governance)**
- `a-logs` — 감사 로그 · **BK-105 HASH CHAIN OK 배지 + 자동 검증**
- `a-settings` — SLA · 자동 트리아지 임계값 · ESIG · 통합 · 데이터 보관

**제품 디자인 (Product Design · 이 프로젝트 산출물)**
- `a-personas` — 9 페르소나 프로필 (Employee 5 · RA 3 · Admin 1)
- `a-usability` — 사용성 검증 회의록 (M-001~M-014)
- `a-backlog` — Product Backlog (필수 31 · 권장 1 · 기각 7)

---

## 2. 데이터 소스 · 스토리지 계층 (BK-011/012/013)

### 2.1 Git 레포 3종 (RAG 코퍼스 · 매일 크론)

| 레포 | URL | 크론 | 역할 |
|---|---|---|---|
| **ra-llm-wiki** | `http://10.11.1.40:7001/DR_RnD/ra-llm-wiki.git` (사내 NAS) | 03:00 KST | 사내 NAS 인제스트 · 제품 STED · DHF · RMF · 승인 이력 · **제품 카드/유사 사례 SOR (M-014)** |
| **MD-process** | `github.com/holee9/MD-process` | 03:20 KST | 의료기기 제조사 프로세스 · SOP · DCN · CAPA 템플릿 |
| **ra-project** | `github.com/holee9/ra-project` | 03:40 KST | 인허가 지식베이스 · 실 제품 3종 기술파일 (`02_제품별_기술파일/`) |

> 크론 시각은 이전에 모두 `03:18`에 몰려 있었음 (BK-104에서 20분 간격으로 분산).

### 2.2 DB 스토어 8종 (Git 부적합 리소스)

**PostgreSQL 6종**:
- `users` — 사용자 · 역할 · 소속 (SSO 연동)
- `products` — 제품 마스터 (ra-llm-wiki 자동 추출 + Admin override · **BK-035**)
- `submissions` — 제출 트랜잭션 · stage · due · owner
- `audit_log` — 감사 로그 · **append-only** · SHA-256 hash chain (§11.10(e))
- `inbox_tickets` — 사내 질의 큐 · triage state
- `approved_answers` — 승인 답변집 (Inbox 승인 시 저장)

**pgvector 1종**:
- `embeddings` — RAG 임베딩 벡터 (3 레포 인제스트 결과)

**Object Storage 1종**:
- `visual_assets` — flow chart · 도해 · 첨부 파일

### 2.3 Hybrid 정책 (BK-013)

**승인 답변집** = DB 실시간 저장 + 야간 03:20 KST git 스냅샷 (`regula-approved-answers` 별도 레포). 이유: 실시간 검색은 DB · 이력 감사와 리뷰는 Git.

---

## 3. 핵심 판정 로직

### 3.1 Inbox Auto-Triage (RA 자동 응답)

```
사용자 질문 →
  ├─ RAG 검색 (embeddings)
  ├─ LLM 답변 생성 (Claude Sonnet · window.claude.complete)
  ├─ Confidence 계산
  └─ Triage 결정:
     · confidence >= 85% && 화이트리스트 카테고리 → auto (24h 유예 · RA 감사)
     · confidence >= 60% → needs-review (12h SLA)
     · confidence < 60% || danger keyword → escalated (48h SLA)
     · 5일간 사용자 회신 없음 → waiting → 자동 취소
```

임계값은 `AdminSettings > triage`에서 편집 (`auto-threshold` · `review-threshold` · `safe-domains` · `danger-keywords`).

### 3.2 Change Impact Check 4-계층 (BK-034)

Employee 위저드 4단계 → 판정 엔진:

```
Step 1: 제품 선택 (products 테이블)
Step 2: 변경 카테고리 (sw/hw/label/process/sterilize 등)
Step 3: 변경 상세 (자유 텍스트)
Step 4: 영향 시장 선택
   ↓
계층 1 · retestMatrix 룰 조회 (결정론)
   → 7 변경유형 × 5 시장 = 35 셀 · 필요/조건부/불필요 + 근거 조항
계층 2 · LLM 카테고리 분류 (Claude API)
   → 자유 텍스트 → 카테고리 confidence 계산
계층 3 · confidence < 80% 시 → RA Inbox 자동 티켓 생성
계층 4 · ra-llm-wiki RAG 조회 → 과거 유사 사례 3건 인용 (SimilarCasesCard)
   ↓
결과 페이지: 신호등 + retestMatrix 셀 + 유사 사례 + (필요시) 티켓 CTA
```

**계층 1은 결정론 · 즉시 구현 가능** (retestMatrix 데이터 이미 있음 · `src/v3/data.jsx:1203`).
**계층 2/4는 Claude API + pgvector 검색 필요.**

### 3.3 ESIG · Audit Log (21 CFR Part 11)

- 모든 승인/거절 액션은 `esig` 이벤트 (§11.50 서명 · §11.200 두 인증자)
- `audit_log`는 append-only · SHA-256 previous_hash chain
- 매월 1일 00:00 KST `verify_audit_chain` 크론 (BK-105) · 실패 시 알림
- Admin > 감사 로그 화면에 `HASH CHAIN OK · 12,480/12,480` 상시 배지

---

## 4. 실 제품 3종 (ra-project 기반)

Employee/Products와 Admin/Products 모두 여기서 렌더. 데이터는 `src/v3/data.jsx:28~76`.

| id | name | 유형 | 표준 |
|---|---|---|---|
| `xray-det` | X-ray Detector | a-Si/a-Se/CMOS Solid State X-Ray Imager | IEC 60601-1 Ed 3.2 · IEC 62220-1-1 DQE · IEC 62304 · IEC 81001-5-1 |
| `xray-src` | Handheld X-ray Source | 배터리 · 관전압 프로그램형 | IEC 60601-2-28 · IEC 60601-2-54 · IEC 62133-2 · 21 CFR 1020.30~1020.33 |
| `gui-sw` | 촬영실 GUI SW | SaMD · DICOM/HL7 · AI/ML 옵션 | IEC 62304 Class B · IEC 82304-1 · MDCG 2019-11 Rev.1 · FDA PCCP 2024-12 |

각 제품에 `source` 필드 (ra-llm-wiki 경로) · `standards` 배열 · `predicate` · `markets[]` (US/EU/KR/CN/JP × status/path/since/next).

---

## 5. 파일 인벤토리 (source of truth)

프로토타입 소스 위치:

```
src/v3/
├── data.jsx          ← 모든 시드 데이터 · 실제 백엔드 스키마의 기준점
├── App.jsx           ← 라우팅 · 페르소나 스위치
├── Shell.jsx         ← PersonaBar · Sidebar · Topbar
├── Employee.jsx      ← 5화면 (Ask · MyQuestions · Products · Guides · Impact)
├── RA.jsx            ← 6화면 · RegulationOriginalCard (BK-103) 포함
├── RaConsult.jsx     ← Consult 세션 (별도)
├── Admin.jsx         ← 12화면 (Overview · Users · Corpus · Radar · Logs · Settings · Personas · Usability · Backlog)
├── SearchPalette.jsx ← ⌘K 전역 검색 (BK-007)
└── UI.jsx            ← ProductDetailModal + 재시험 매트릭스 탭 (BK-107) · GuideDetailModal · QuestionDetailModal · ToastHost · ModalHost

styles/
├── tokens.css        ← v1부터 유지 · 브랜드 컬러 · 시맨틱 · 다크모드 var
├── components.css    ← 기본 컴포넌트
├── v2.css            ← v2 잔재 (일부 재사용)
└── v3.css            ← v3 페르소나·사이드바·인박스·페르소나 카드 등

Regula v3 - RA Gateway.html      ← 프로토타입 entry (Babel 인라인)
Regula v3 - Standalone.html      ← super_inline 번들 (오프라인)
```

**Claude Code 구현 시 `src/v3/data.jsx`가 백엔드 스키마의 기준**입니다. 모든 화면이 이 데이터 모양을 그대로 사용하므로, DB 테이블 컬럼과 1:1 매핑.

---

## 6. 구현 로드맵 (Recommended Order)

### Phase 1 · MVP (Read-only Bootstrap)
1. SSO + 사용자·역할 테이블 (Google Workspace)
2. `ra-llm-wiki` · `MD-process` · `ra-project` 3레포 인제스트 파이프라인 (크론 03:00/20/40)
3. pgvector 임베딩 + RAG 검색
4. Employee/Ask · Employee/Products 읽기 전용
5. Admin/Overview · Admin/Corpus 관리
6. `audit_log` append-only + hash chain

### Phase 2 · Inbox (Core Loop)
7. Inbox 4-column Kanban (백엔드)
8. Auto-Triage 파이프라인 (Claude API + confidence)
9. 승인/거절 ESIG + `approved_answers` 저장
10. Employee/MyQuestions 이력
11. Guides & FAQ 조회 (approved_answers에서)

### Phase 3 · Impact Check (High Value)
12. Change Impact 위저드 4-step
13. retestMatrix 결정론 판정 (계층 1 · 즉시)
14. LLM 카테고리 분류 (계층 2)
15. 유사 사례 RAG (계층 4)
16. 필요/조건부 시 RA 티켓 자동 생성 (계층 3)

### Phase 4 · RA Workflow
17. Submissions 워크플로우 · Product Registry 편집
18. Regulatory Radar + 임팩트 평가
19. Consult 세션 (Power Chat) + 저장

### Phase 5 · Admin + Compliance
20. Admin/Settings 편집 UI
21. `verify_audit_chain` 월간 크론
22. Admin/Personas · Usability · Backlog 관리 (내부 협업용)

---

## 7. 21 CFR Part 11 · MDR / MFDS 준수 체크리스트

| 요구 | 구현 |
|---|---|
| §11.10(a) 시스템 유효성 검증 | 배포 전 IQ/OQ/PQ 문서화 |
| §11.10(e) 감사 로그 append-only | `audit_log` INSERT-only · SHA-256 chain · 월간 자동 검증 |
| §11.30 개방 시스템 | HTTPS + WAF · 내부 NAS는 VPN 게이트웨이 |
| §11.50 서명 표시 | ESIG 이벤트에 이름 · 시각 · 의미 (`meaning: Authored/Reviewed/Approved`) |
| §11.100 고유 사용자 | SSO Google Workspace · 이메일 = unique key |
| §11.200 두 인증자 | password re-auth (WebAuthn 로드맵) |
| §11.300 세션 관리 | 30분 재인증 (`adminSettings.esig.reauth`) |
| MDR Art. 10(8) 문서 보관 | `audit_log` 10년 · `inbox_tickets` 7년 · `consult` 5년 |

---

## 8. 이 세션에서의 의사결정 이력

- **회의록 (M-001 ~ M-014)** 원본: `src/v3/data.jsx:572` (`usabilityMeetings`)
- **백로그** 원본: `src/v3/data.jsx:843` (`backlog`)
- **페르소나 프로필** 원본: `src/v3/data.jsx:437` (`personas`)

주요 결정:
- v2 QMS 방향 폐기 → Regula = RA 게이트웨이 (M-001 · BK-201)
- 담당 제품 개인화 폐기 → 전 임직원 자유 조회 (M-013 · BK-032)
- 자동 감지(BK-108) 기각 → PLM/QMS webhook 통합 필요
- Slack 통합(BK-102) 기각 → 사내 미사용
- ra-llm-wiki 재정의 → SOR (제품 · 유사 사례 · 이력) (M-014 · BK-033)

기각 항목 7건은 반드시 재도입 금지 · 예: QMS 워크벤치는 **QA 팀 별도 시스템** 소유.

---

## 9. 남은 오픈 항목

**Recommended · 미착수 (1건)**:
- `BK-106` 도메인 용어 Autocomplete는 UI만 반영됨. **초기 용어 사전 200-300개는 RA 팀 협업 필요.**

**Deferred to v3.1**:
- BK-035 Admin > Products 편집 UI (데이터 소스는 준비됨 · 편집 화면만 미구현)
- BK-102 재검토 (사내 커뮤니케이션 채널 확정 후)
- BK-108 재검토 (사내 PLM/QMS webhook 통합 확정 후)

---

## 10. 하위 문서

- [`01_architecture.md`](./01_architecture.md) — 시스템 다이어그램 · 배포 · 통합점
- [`02_data_model.md`](./02_data_model.md) — DB 스키마 (PostgreSQL DDL)
- [`03_api_contract.md`](./03_api_contract.md) — REST API 엔드포인트
- [`04_backlog.md`](./04_backlog.md) — 필수 31 · 권장 1 · 기각 7 상세

---

**최종 검증**: 2026-07-01 · 콘솔 에러 없음 · 다운로드 번들 `Regula v3 - Standalone.html` 11MB · 오프라인 완전 자체포함
