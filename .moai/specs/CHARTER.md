# Regula 제품 포지션 헌장

> **이 파일은 모든 SPEC 작성 전 자동 로드됩니다.**
> manager-spec은 새 SPEC을 작성하기 전에 아래 지양점 체크리스트를 먼저 검토해야 합니다.

기록일: 2026-06-11 | 분석: ultrathink

---

## 한 줄 정의

> Regula는 RA Lead 1~2명이 FDA/EU MDR 규제 문서를 **법적으로 방어 가능한 형태로 더 빠르게** 만들기 위한 컴플라이언스-어웨어 RA 워크스테이션이다.

MVP가 아닌 **좁은 범위의 깊은 전문 도구**. 6~8명 내부팀에 큰 레버리지를 주는 설계.

---

## 주 사용자 우선순위

**1순위 — RA Lead (1~2명)** = 실질 파워유저. 전체 기능의 80%+ 가 이 역할을 위해 설계됨.

보조 역할 (기능 확장 우선순위 낮음):
- Dev: 규제 맥락 이해 보조 (읽기 + 코멘트)
- Exec: 제출 진행상황 가시성 (읽기 + 요약 대시보드)
- External: 외부 컨설턴트 협업 (초대된 문서 한정)

**새 기능을 설계할 때 "RA Lead에게 직접적 가치가 있는가?"가 1차 기준.**

---

## 핵심 가치 명제 — 자동화해야 할 구간

| 구간 | 기존 | Regula |
|---|---|---|
| CER PubMed 수집 + SIGN 50 평가 | 40-80시간 | 10-15시간 |
| Predicate 비교 분석 | 수 시간 | 수십 분 |
| PCCP 초안 작성 | 수동 가이던스 참조 | 4단계 위저드 |
| 규제 변동 모니터링 | 수동 확인 | 자동 알림 |
| RAG Q&A (6개 corpus) | 수동 검색 | 인용 기반 즉답 |

---

## 범위 경계선 — 지양점 (SPEC 작성 전 체크리스트)

새 SPEC 또는 기능 요청 시, 아래 5가지 중 하나라도 해당되면 범위 이탈. SPEC 작성 중단 후 MoAI에 보고.

### [지양-1] 일반 기업 지식베이스 ❌
RAG corpus는 FDA/EU MDR/MFDS/NMPA/PMDA + internal SOP 전용.
영업/마케팅/인사 지식 검색, Notion/Confluence 대체 기능 → 범위 외.

### [지양-2] 가짜 신뢰 생성기 ❌
아래 3가지는 아키텍처 결정으로 어떤 기능 추가로도 풀 수 없음:
- Expert Review Gate 없이 시스템 출력이 최종본이 되는 흐름
- Draft watermark를 우회하는 export 경로
- 인용 근거 없는 주장이 export되는 흐름

### [지양-3] QMS 대체 ❌
SOP 관리, 변경 제어(Change Control), CAPA, 불만 처리 → 범위 외.
DOCINGEST는 SOP를 RAG corpus로 참조할 뿐이지, SOP를 관리하는 것이 아님.
Veeva Vault, MasterControl, Arena PLM 대체 포지션 아님.

### [지양-4] AI가 규제 판단을 대신하는 도구 ❌
모든 법적 주장(predicate 선정, equivalence claim, PCCP 적용 범위)은 RA Lead 확인·승인 필수.
Article 61(4) disclaimer 등 법적 경고 텍스트는 SPEC에서 제거 불가.

### [지양-5] SaaS 외판 ❌
abyz 내부 6~8명용 설계. 외부 고객 온보딩, 결제, 다중 조직 관리 기능 → 현재 범위 외.

---

## SPEC 작성 전 자가 점검 (manager-spec 필수)

새 SPEC REQ 작성 시 각 요건에 대해:

```
□ 이 요건은 RA Lead의 직접적 작업 시간을 단축하거나 제출 품질을 높이는가?
□ 지양-1~5 중 해당 사항 없는가?
□ Expert Review Gate 또는 audit_logs를 우회하지 않는가?
□ 기존 워크플로우(Predicate/CER/PCCP/RADAR/COEDIT)의 아키텍처와 일관성이 있는가?
```

하나라도 No이면 해당 REQ를 SPEC에 포함하기 전 MoAI와 재논의.

---

## 아키텍처 결정 불변 목록

아래는 설계 상 변경 불가. SPEC이 이를 변경하는 요건을 포함하면 SPEC이 잘못된 것:

| 결정 | 이유 |
|---|---|
| `audit_logs` append-only | 21 CFR Part 11 전자기록 |
| Expert Review Gate (HARD) | 규제 제출 법적 책임 |
| Draft watermark 강제 | 미승인 문서 제출 방지 |
| 인용 없는 주장 export 차단 | NB/FDA 재현성 요건 |
| Article 61(4) disclaimer 강제 | EU MDR 의무 공개 |

---

Version: 1.0.0
Source: ultrathink 분석 (2026-06-11)
GitHub Issue: #129
