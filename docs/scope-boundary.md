# Regula 운영 범위 경계 (Scope Boundary Memo)

> **작성일**: 2026-06-28
> **최종 확정**: 2026-06-29 — 전사 인허가 도우미 정체성 반영
> **목적**: Charter(`.moai/specs/CHARTER.md`) 기반 정체성 최종 확정. 지식베이스 git 연동, 사이드바 role 구조, 사용자 우선순위 명시. 코드를 삭제하지 않고 정체성을 명확히 하여 향후 에이전트/개발자의 범위 오해를 방지.
> **근거 제안서**: [`docs/proposals/scope-rationalization-2026-06-28.md`](proposals/scope-rationalization-2026-06-28.md)

---

## 1. 지양-3 (QMS 대체 ❌) 운영 한정

Charter는 "SOP 관리, 변경 제어(Change Control), CAPA, 불만 처리 → 범위 외. Veeva Vault/MasterControl/Arena PLM 대체 ❌"를 명시합니다. 그러나 구현 과정에서 해당 도메인들이 추가되었습니다. **이들의 운영 범위를 다음과 같이 한정합니다.**

| 구현 도메인 | 사이드바 | 운영 한정 선언 |
|---|---|---|
| `lib/capa` (불만·CAPA 폐루프) | **숨김** (FEATURE_CAPA, 기본 off) | **QMS 시스템이 아님.** RA Lead가 규제 문서 작성 시 참고하는 보조 워크플로우로만 사용. SOP/불만 관리 시스템(Veeva/MasterControl) 대체 불가. |
| `lib/change-control` (설계 변경 제어) | **숨김** (FEATURE_CHANGE_CONTROL) | **QMS 변경 제어 시스템이 아님.** 설계 변경이 RA 문서(510(k)/CER)에 미치는 영향 평가 보조 용도. |
| `lib/dhf` (Design History File) | (별도 라우트) | DHF 관리 시스템이 아님. RA 산출물 패키징 시 DHF 항목 참조 용도. |
| `lib/clinical-investigation` | **숨김** (FEATURE_CLINICAL_INVESTIGATION) | 임상시험 관리 시스템이 아님. RA 문서 작성 보조. |
| `lib/pms` (PMS/PMCF) | **숨김** (FEATURE_PMS_WORKBENCH) | EU MDR 의무 산출물 보조 생성. PMS 시스템 자체는 아님. |
| `lib/labeling` (라벨링·IFU) | **숨김** (FEATURE_LABELING) | 라벨 관리 시스템이 아님. RA 검토 보조. |

**재활성화**: `.env.local`에 `NEXT_PUBLIC_FEATURE_CAPA=true` (등) 설정 시 코드 변경 없이 사이드바 복원.

---

## 2. 지양-5 (SaaS 외판 ❌) 운영 한정

Charter는 "abyz 내부 6~8명용 설계. 외부 고객 온보딩, 결제, 다중 조직 관리 ❌"를 명시합니다. 다음 내부 인프라 도메인을 **SaaS 고객 기능이 아님**을 명시합니다.

| 구현 도메인 | 운영 한정 선언 |
|---|---|
| `lib/model-governance` (AI 모델 버전·승인) | **내부 MLOps 인프라.** 외부 고객向け 기능 아님. 6~8명 팀 내부 모델 운용 용도. |
| `lib/corpus-license` (corpus 라이선스·자격) | **내부 라이선스 관리.** 외부 결제/과금/테넌시 기능 아님. |
| `lib/cyberdevice` (사이버보안·SBOM) | API-only. UI 노출 없음. 제출 증거 보조 생성. |

---

## 3. Charter 핵심 정체성 (최종 확정 — 2026-06-29)

### 3.1 서비스 정체성 (최종)

본 경계 선언은 Charter 핵심 5대 자동화(RAG Q&A·CER·Predicate·PCCP·규제 모니터링)와 5대 불변 아키텍처(Expert Review Gate·Part 11 감사·Draft watermark·인용 강제·Article 61(4))를 **훼손하지 않습니다**.

**최종 확정된 정체성**: **"전사 인허가 도우미(RA 담당자 업무 분산) + RA 담당자 인허가 문서 생성(hybrid-ra-saas Azure SaaS 연동)"**

이는 "좁고 깊은 RA 문서 작성 워크스테이션" 기술 중심 정의에서 **사용자 중심으로 재정립**된 것입니다.

### 3.2 주 사용자 (최종 확정)

| 순위 | 사용자 | 주요 역할 | 사이드바 |
|------|--------|----------|----------|
| **1순위** | 전사 직원 (viewer, 다수) | 인허가 Q&A 셀프서비스 → **RA 담당자 업무 병목 분산** | **4개**: 홈 · 채팅(Q&A) · 히스토리 · 설정 |
| **2순위** | RA 담당자 (ra-member/lead, 1~3명) | 전문 워크벤치(Authoring·Evidence·Traceability) + 전사 Q&A 승격(전문가검토) | viewer 4개 + 전문가 검토 · Authoring(hybrid-ra-saas) · Evidence · Traceability · 프로젝트 스위처 |

> **정정**: 이전 "RA Lead 80%+" 기술 중심 설명을 **사용자 중심으로 재정립**. 진짜 목표는 "전사 인허가 도우미"로서 RA 담당자의 업무 포화를 분산하는 것.

### 3.3 지식베이스 (최종 확정)

**git repo 연동 = 지식베이스 유일/주 소스**:
- 공개 repo: git URL만(인증 없이 clone)
- private repo: org 토큰 옵션
- 매주 자동 동기화(Inngest weekly cron)
- **각 repo별 마지막 동기화 날짜 필수 표시**

**연동 전 지식베이스 상태**:
- 연동 전엔 지식베이스 빈 상태가 **정상**
- 구현+연동 후에야 사이트가 지식베이스 참고

**seed 코퍼스 제거**:
- seed-corpus.ts 하드코딩 샘플(4755청크) 제거
- 진짜 repo 코퍼스로 대체
- 평균 420자의 얕은 발췌 → 팩트 기반 깊은 코퍼스

---

**버전**: 1.0.0
**관련**: Charter(`.moai/specs/CHARTER.md`) · [scope-rationalization 제안서](proposals/scope-rationalization-2026-06-28.md) · `lib/feature-flags.ts`
