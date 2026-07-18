# Regula 제품 포지션 헌장

> **[HARD] manager-spec은 SPEC 작성 전 이 파일을 로드하고 §3 지양 5종 체크리스트를 통과시켜야 합니다.**
> 연결 지점: `.claude/agents/moai/manager-spec.md` Step 1 (Load Project Context)

기준 정의: `.moai/project/product.md` v3.0.0
관련 감사: `docs/purpose-alignment-audit-2026-07-16.md`

---

## 1. 한 줄 정의

> Regula는 **RA(Regulatory Affairs) 게이트웨이**다.

의료기기 인허가 담당자 3명과 사내 임직원 26명 사이의 커뮤니케이션·셀프서비스·이력 관리를 통합하는 **사내 웹앱**.

핵심 목표는 RA 3명이 병목이 되는 구조를 깨는 것이다. 전사 직원이 인용 기반 RAG Q&A로 자주 묻는 인허가 질문을 셀프서비스로 해결하고, RA는 Kanban Inbox 1개에서 트리아지·승인만 한다.

**QMS도 PLM도 아니다 — 오직 인허가 게이트웨이.**

---

## 2. 3-tier 페르소나

| Persona | 인원 | 니즈 | 화면 |
|---|---|---|---|
| **Employee** | 26 | 규제 셀프서비스, 변경 영향 자가진단 | 5 (Ask, 내 질의, 제품 카드, Guides, Impact) |
| **RA** | 3 (Lead 1 + Member 2) | 사내 질의 처리, 인허가 워크플로우, 문서 작성 | 6 (Inbox, Consult, Submissions, Registry, Radar, Knowledge) |
| **Admin** | 1 | 시스템 감시, 거버넌스, 사용자 관리 | 12 (Workspace/User/Data/Governance/Design) |

**총 대상 30명.** 외부 당사자(고객, 컨설턴트, 감사관)는 페르소나에 없다.

**새 기능 설계 1차 기준**: "Employee의 인허가 Q&A 부담을 줄이는가? 또는 RA 워크벤치 가치인가? 또는 Admin 거버넌스인가?"

---

## 3. 지양 5종 — SPEC 작성 전 [HARD] 체크리스트

새 SPEC 또는 기능 요청이 아래 5가지 중 하나라도 해당되면 범위 이탈이다. SPEC 작성을 중단하고 MoAI에 보고한다.

### [지양-1] 일반 기업 지식베이스 ❌

RAG 데이터 소스는 **3개 지식 repo 연동**(`ra-project` / `MD-process` / `ra-llm-wiki`)이 전부다.

> **주의 — 흔한 오해**: FDA/EU MDR/MFDS/NMPA/PMDA/SOP는 **저장소가 아니라 검색·분류 도메인**이다. "6개 코퍼스를 수집한다"는 이전 문서들의 서술은 데이터 소싱에 대한 잘못된 표현이며 무효다. 근거: `docs/architecture/knowledge-base.md` (2026-07-10)

영업/마케팅/인사 지식 검색, Notion/Confluence 대체 기능 → 범위 외.

### [지양-2] 가짜 신뢰 생성기 ❌

아래 3가지는 **아키텍처 결정**이며 어떤 기능 추가로도 풀 수 없다:

- Expert Review Gate 없이 시스템 출력이 최종본이 되는 흐름
- Draft watermark를 우회하는 export 경로
- 인용 근거 없는 주장이 export되는 흐름

### [지양-3] QMS 대체 ❌

**SOP 관리, 변경 제어(Change Control), CAPA, 불만 처리, PMS/PMCF, Vigilance, DHF/Risk Management → 범위 외.** QMS 소유는 QA 팀이며, 해당 18개 도메인은 `archive/qms-pms/`로 이동한다.

DOCINGEST는 SOP를 RAG corpus로 **참조**할 뿐이지 SOP를 **관리**하는 것이 아니다.
Veeva Vault, MasterControl, Arena PLM 대체 포지션이 아니다.

> **[HARD] 재구현 금지**: 아카이브 대상 도메인의 기능을 **다른 SPEC 이름으로 재구현하는 것**도 위반이다. 실제 사례로 `SPEC-REGULA-WORKFLOWS-001`이 `capa-generator.ts`로 CAPA 초안 생성을 재구현해 아카이브를 무력화했다 (이슈 #520). 도메인 이름이 아니라 **기능의 실질**로 판단할 것.

### [지양-4] AI가 규제 판단을 대신하는 도구 ❌

**모든 법적 주장(predicate 선정, equivalence claim, PCCP 적용 범위, 규제 경로 선택)은 RA Lead 확인·승인 필수.**

"AI가 판단했으니 제출 가능" 흐름 → 허용 안 됨.
Article 61(4) disclaimer 등 법적 경고 텍스트는 SPEC에서 제거 불가.

> **판정 기준**: 기능 자체가 금지된 게 아니라 **게이팅 없는 추천**이 금지된다. 선례로 `SPEC-REGULA-STRATEGY-001`은 다중 관할권 전략 생성이라는 고위험 기능이지만 `REQ-STRATEGY-012`에서 **confidence < 0.8 시 expert review 강제**를 명시해 통과했다. 같은 영역의 이슈 #40은 게이팅 미명시로 판정 대기 중이다.

### [지양-5] SaaS 외판 ❌

**abyz 내부 30명(Employee 26 + RA 3 + Admin 1)용 설계.** 외부 고객 온보딩, 결제, 다중 조직 관리, enterprise upsell → 범위 외.

멀티테넌시 구조는 있으나 목적은 **내부 팀 역할 분리**다.

**예외 — 허용됨**:
- `hybrid-ra-saas` 별도 SaaS와의 **BFF 연동**(`lib/bff/`, 6 integration points). 이는 외판이 아니라 내부 시스템 간 연동이다.
- **규제 감사관(FDA inspector / MFDS reviewer / NB) read-only 감사 대응 접근**(`auditor` RBAC 역할, `SPEC-REGULA-AUDITOR-VIEW-001`). 이는 고객 온보딩·결제·멀티조직·외판이 아니라 21 CFR Part 11 시스템의 본질인 **감사 대응**이다. 단, (a) read-only 강제(모든 write 차단, `lib/auth/with-permission.ts`), (b) 초대된 감사 범위 한정, (c) SSO 인증 재사용 — 이 3조건을 벗어나는 외부 tier 확장은 지양-5 위반이다. (#520 판정, 2026-07-18)

---

## 4. SPEC 작성 전 자가 점검 (manager-spec 필수)

새 SPEC의 각 REQ에 대해:

```
□ 이 요건은 Employee의 Q&A 부담을 줄이거나, RA 워크벤치 가치이거나, Admin 거버넌스인가?
□ 지양-1~5 중 해당 사항이 없는가?
□ (지양-3) 아카이브 대상 도메인의 기능을 다른 이름으로 재구현하고 있지 않은가?
□ (지양-4) 법적 주장을 생성한다면 Expert Review Gate가 REQ로 명시되어 있는가?
□ Expert Review Gate 또는 audit_logs를 우회하지 않는가?
□ 기존 워크플로우(Inbox/Triage/Consult/Impact/Predicate/CER/RADAR)의 아키텍처와 일관성이 있는가?
```

하나라도 No이면 해당 REQ를 SPEC에 포함하기 전 MoAI와 재논의한다.

---

## 5. 아키텍처 결정 불변 목록

아래는 설계상 변경 불가. SPEC이 이를 변경하는 요건을 포함하면 **SPEC이 잘못된 것**이다.

| 결정 | 이유 |
|---|---|
| `audit_logs` append-only | 21 CFR Part 11 전자기록 |
| Expert Review Gate (HARD) | 규제 제출 법적 책임 — 시스템이 자기 출력을 승인 불가 |
| Draft watermark 강제 | 미승인 문서 제출 방지 |
| 인용 없는 주장 export 차단 | NB/FDA 재현성 요건 |
| Article 61(4) disclaimer 강제 | EU MDR 의무 공개 |
| LLM 백엔드 = gx10 온프레미스 Ollama 단일 | 외부 API 배제 (#318, 이행 완료) |
| 환자정보(PHI) 도메인 부재 | 취급 자체를 하지 않음 (#319, 이행 완료) |

---

## 6. 핵심 가치 명제 — 자동화 구간

| 구간 | 기존 | Regula |
|---|---|---|
| Employee 규제 질문 | RA를 매번 붙잡음 | 자연어 질문 → 인용 기반 RAG 답변 |
| RA 질의 처리 | 분산된 채팅/메일 | Kanban Inbox 1개 (4-column triage) |
| Auto-Triage | 수동 분류 | RAG + LLM confidence 기반 자동 응답 (24h 유예) |
| Change Impact 진단 | 수십 분 조사 | 4-layer 위저드 (결정론 + LLM 분류 + RA 티켓 + 유사 사례) |
| CER PubMed 수집 + SIGN 50 | 40-80시간 | 10-15시간 |
| Predicate 비교 분석 | 수 시간 | 수십 분 |
| 규제 변동 모니터링 | 수동 확인 | 자동 알림 (Radar) |
| 감사 추적 | 수동 기록 | audit_log append-only + SHA-256 hash chain |

---

## 7. 미해결 쟁점 (SPEC 작성 시 주의)

아래는 문서 간 상충이 해소되지 않은 지점이다. 관련 SPEC 작성 전 확인할 것.

2026-07-18 기준 아래 쟁점은 전부 해소됨 (이력 참조용 보존).

| 쟁점 | 상태 |
|---|---|
| **PCCP 보존 vs 아카이브** | ✅ 해소(#521): PCCP는 규제 제출물(QMS 아님), 라이브 유지 = "보존". v3 계획서 §3.3 아카이브 등재는 오기로 정정. Regula vs SaaS 저작 역할은 Phase E defer |
| **RAG 코퍼스 공백** | ✅ 해소(#517→#523): PII 가드 URL 차단 제거 후 코퍼스 실적재 `source_sections 19→2187, sources 1→623`, RAG 인용 검증 PASS |
| **v3 승인 상태** | ✅ 해소(#519): 상태란 "승인 대기"→"부분 실행 중" 정정. Phase C/D 완료, A/B/E 미착수. 공식 승인 기록 부재 명시 |
| **범위 이탈 5건** | ✅ 해소(#520): CAPA 아카이브(#525), AUDITOR-VIEW 범위 내(#526), #40/#55 판정 코멘트 |

---

Version: 2.0.0
Supersedes: v1.0.0 (2026-06-11) — RA 워크스테이션 시대 문서. 정체성·주 사용자·팀 규모(6~8명)·corpus 정의(6 코퍼스)가 v3 피벗으로 전부 무효화되어 폐기.
Source: `.moai/project/product.md` v3.0.0 (2026-07-02), `docs/purpose-alignment-audit-2026-07-16.md`
Related: #518 (헌장 연동), #519 (v3 승인상태), #520 (범위 이탈), #517 (코퍼스 공백)
