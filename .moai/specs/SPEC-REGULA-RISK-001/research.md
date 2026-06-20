# SPEC-REGULA-RISK-001 — Domain Research

> ISO 14971:2019 위험관리, EU MDR GSPR 매핑, 위험 매트릭스 패턴 도메인 조사.
> 본 문서는 spec.md의 규제 근거를 뒷받침하는 배경 자료이며, 구현은 design.md/tasks.md를 따른다.

---

## 1. ISO 14971:2019 위험관리 프로세스

### 1.1 프로세스 개요

ISO 14971:2019는 의료기기 위험관리를 다음 단계로 정의한다 (top-down):

| 단계 | ISO 14971:2019 조항 | 내용 | 본 SPEC 매핑 |
|------|---------------------|------|--------------|
| 위험관리 계획 | §4.4 | 계획 수립, 허용 기준 정의 | 조직 설정 / run 메타 |
| 위험 분석 | §5 | 의도 사용, hazard 식별, 위험 추정 | Group A (식별) + Group B (추정) |
| 위험 평가 | §6 | 허용 가능 위험 판단 | Group B (매트릭스 분류) |
| 위험 통제 | §7 | 통제 옵션 분석·실행·잔류 위험 | Group C |
| 전체 잔류 위험 평가 | §8 | 종합 잔류 위험 + 편익 분석 | Group C + Group D 보고서 |
| 위험관리 보고서 | §9 | RMF 검토·결론 | Group D |
| 생산·시판후 활동 | §10 | PMS 피드백 | Non-Goal (Vigilance cross-link) |

### 1.2 핵심 용어 (§3 Terms)

- **Hazard**: 잠재적 harm의 원천
- **Hazardous situation**: 사람·재산·환경이 하나 이상의 hazard에 노출된 상황
- **Sequence of events**: hazard → hazardous situation으로 이어지는 사건 연쇄
- **Harm**: 사람의 건강 손상, 재산·환경 피해
- **Severity**: harm의 가능한 결과의 정도
- **Probability of occurrence of harm**: harm 발생 확률 (P1 hazardous situation 발생 × P2 hazardous situation → harm 전이)
- **Residual risk**: 위험 통제 조치 이후 남은 위험

> 구현 함의: 위험 항목 스키마는 hazard / sequence_of_events / hazardous_situation / harm 4필드를 분리 저장해야 한다 (REQ-RISK-006).

### 1.3 §7.1 위험 통제 옵션 우선순위 (Risk Control Option Hierarchy)

ISO 14971:2019 §7.1은 통제 옵션을 **반드시 다음 우선순위 순서로** 고려할 것을 요구한다:

1. **Inherently safe design and manufacture** (본질적 안전 설계) — 최우선
2. **Protective measures in the device itself or in the manufacturing process** (보호 조치)
3. **Information for safety** (안전 정보 제공: 경고, IFU, 라벨) — 최후 수단

> 구현 함의: 통제 추천(REQ-RISK-021)은 3계층 각각에 후보를 생성해야 하며, information-only 통제 채택 시 상위 계층 미적용 사유를 강제(REQ-RISK-023)해야 한다.

### 1.4 Annex E — 위험 개념 (Severity / Probability 분류)

Annex E는 정성적/반정량적 척도 예시를 제공한다. 본 SPEC은 5단계 척도를 채택한다:

**Severity (심각도) 5단계 예시:**

| 레벨 | 라벨 | 정의 |
|------|------|------|
| 5 | Catastrophic | 사망 |
| 4 | Critical | 영구적 손상 / 생명 위협 |
| 3 | Serious | 의료 개입 필요한 손상 |
| 2 | Minor | 경미, 일시적 손상 |
| 1 | Negligible | 불편, 손상 없음 |

**Probability (발생 확률) 5단계 예시:**

| 레벨 | 라벨 | 정의 (빈도 예시) |
|------|------|-------------------|
| 5 | Frequent | 빈번 (≥ 10⁻³) |
| 4 | Probable | 가능 (10⁻³ ~ 10⁻⁴) |
| 3 | Occasional | 가끔 (10⁻⁴ ~ 10⁻⁵) |
| 2 | Remote | 드묾 (10⁻⁵ ~ 10⁻⁶) |
| 1 | Improbable | 거의 없음 (< 10⁻⁶) |

> 구현 함의: 척도 라벨/빈도 임계값은 ISO/TR 24971 권고대로 제조자(조직) 설정이어야 한다 (REQ-RISK-013). 본 SPEC은 기본값을 제공하되 조직 override를 허용한다.

---

## 2. 위험 매트릭스(Risk Acceptability Matrix) 패턴

### 2.1 5×5 매트릭스 위험도 영역 (3-tier)

업계 표준 3-tier 분류 (ISO/TR 24971 Annex C 예시 기반):

```
Probability →
Severity ↓   1(Improb) 2(Remote) 3(Occas) 4(Prob)  5(Freq)
5 (Catastr)    ALARP     UNACC     UNACC    UNACC    UNACC
4 (Critical)   ACC       ALARP     UNACC    UNACC    UNACC
3 (Serious)    ACC       ALARP     ALARP    UNACC    UNACC
2 (Minor)      ACC       ACC       ALARP    ALARP    UNACC
1 (Negligible) ACC       ACC       ACC      ALARP    ALARP
```

- **ACC (Acceptable)**: 추가 통제 불필요 (그러나 ALARP 검토 권장)
- **ALARP (As Low As Reasonably Practicable)**: 합리적으로 실행 가능한 한 위험 저감 + 편익 정당화
- **UNACC (Unacceptable)**: 통제 필수, 미통제 시 출시 불가

> 구현 함의:
> - REQ-RISK-012 자동 분류 로직은 위 매트릭스를 데이터로 표현 (조직 설정 가능).
> - REQ-RISK-014: ALARP/UNACC는 통제 강제.
> - REQ-RISK-016: 색상 코딩 (ACC=녹, ALARP=황, UNACC=적).

### 2.2 ALARP 판단 요구사항

- 허용 가능(acceptable) 판단 시 justification 필수 (REQ-RISK-015)
- ALARP 영역: "더 낮출 수 없거나, 추가 저감 비용이 편익에 비해 과도하게 불균형함"을 입증해야 함

---

## 3. EU MDR GSPR 매핑

### 3.1 GSPR (Annex I) 구조

EU MDR Annex I — General Safety and Performance Requirements:

- **Chapter I (§1~§9)**: General requirements
  - §1: 의도 성능 달성, 환자·사용자 안전
  - §2: risk reduction (가능한 한 위험 제거/저감)
  - §3: **위험관리 시스템 (ISO 14971 직접 참조 지점)**
  - §4: risk control measures
  - §5: risks related to use error
  - §8: 감염·미생물 오염
  - §9: 에너지·물질 관련 위험
- **Chapter II (§10~§22)**: Design and manufacture requirements
- **Chapter III (§23)**: Information supplied with the device (라벨/IFU)

### 3.2 위험 통제 → GSPR 매핑 패턴

보고서의 GSPR 매핑 테이블(REQ-RISK-032)은 각 식별 위험·통제를 해당 GSPR 항목으로 연결:

| 위험 항목 ID | 통제 조치 | 관련 GSPR | 적합성 근거 |
|--------------|-----------|-----------|-------------|
| RISK-A-001 | 본질적 안전 설계 X | GSPR §4 | 통제 후 잔류 위험 ACC |
| RISK-A-002 | 사용 오류 경고 라벨 | GSPR §5, §23 | IFU 섹션 Y |

> 구현 함의: `risk_gspr_mappings` 테이블 (risk_item_id, control_id, gspr_clause, justification). RA-lead 검토 후 확정 (자동 승인 금지, R4).

---

## 4. 참조 기기 도메인 (promptfoo eval 대상)

### 4.1 인슐린 펌프 (Insulin Pump) — 대표 위험

- **Over-delivery (과다 주입)**: severity=5 (저혈당 사망), 통제 = occlusion sensor + dose limit (본질적 설계)
- **Under-delivery (과소 주입)**: severity=4 (고혈당/DKA), 통제 = flow sensor + alarm (보호 조치)
- **Use error (잘못된 용량 설정)**: severity=4, 통제 = confirmation UI + IFU (정보 제공)
- **Software failure**: severity=5, 통제 = watchdog + fail-safe (본질적 설계)
- 관련 표준: IEC 60601-2-24 (infusion pump), IEC 62304 (software)

### 4.2 인공호흡기 (Ventilator) — 대표 위험

- **Apnea / failure to ventilate (환기 실패)**: severity=5, 통제 = backup ventilation mode (보호 조치)
- **Over-pressure (기압 손상, barotrauma)**: severity=4, 통제 = pressure relief valve (본질적 설계)
- **Disconnection (회로 분리)**: severity=5, 통제 = disconnect alarm (보호 조치)
- **Power failure**: severity=5, 통제 = battery backup (본질적 설계)
- 관련 표준: ISO 80601-2-12 (critical care ventilator), IEC 62304

> 구현 함의: promptfoo eval suite는 위 기기들의 알려진 위험 프로파일을 ground truth로 사용하여, 생성된 위험관리 계획의 hazard 식별 recall과 통제 계층 적합성을 측정 (>85%).

---

## 5. 기존 코드베이스 재사용 분석

| 재사용 대상 | 출처 | RISK 적용 |
|-------------|------|-----------|
| `workflowRuns` multi-step run 모델 | `lib/db/schema.ts` | `risk` workflow type 추가 |
| `expertReviews` + review gate | `lib/db/schema.ts` | RA-lead 승인 게이트 |
| `auditLogs` append-only (21 CFR Part 11) | `lib/db/schema.ts` | risk.* audit actions |
| `cerLiterature` child-table cascade 패턴 | `lib/db/schema.ts` | risk_items/controls/gspr_mappings |
| `createHybridRaFetch` + Rag* 타입 | `lib/api/hybrid-ra-client.ts` | 위험 식별·통제 RAG |
| `withPermission` BFF wrapper | `lib/auth/with-permission.ts` | risk.* permission |
| DOCX export (`docx@^9.7.1`) | CER Builder (SPEC-REGULA-CER-001) | ISO 14971 보고서 |
| BFF proxy route 패턴 | `app/api/ra/checklists/generate/route.ts` | `app/api/ra/risk/*` |

> 결론: RISK 모듈은 신규 인프라 없이 CER Builder 패턴을 확장한다. 신규는 (1) risk 도메인 로직(lib/risk/*), (2) 매트릭스 UI 컴포넌트, (3) 3개 child 테이블, (4) risk.* audit/permission이다.

---

## 6. 참고 표준·문헌

- ISO 14971:2019 — Medical devices — Application of risk management to medical devices
- ISO/TR 24971:2020 — Guidance on the application of ISO 14971
- Regulation (EU) 2017/745 (MDR) — Annex I (GSPR)
- IEC 62304 — Medical device software lifecycle
- IEC 60601-2-24 — Infusion pumps / ISO 80601-2-12 — Critical care ventilators
- US FDA 21 CFR Part 11 — Electronic records (audit trail 근거)
