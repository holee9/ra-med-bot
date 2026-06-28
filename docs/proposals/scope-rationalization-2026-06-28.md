# Regula 범위 합리화 제안서 (Scope Rationalization)

> **작성일**: 2026-06-28
> **상태**: ✅ 채택됨 (Adopted) — 2026-06-28. Step 1-2 구현 완료 (feature flag 8종 도입 + layout.tsx 게이팅 → FREEZE/RETIRE 8개 사이드바 링크 숨김). Step 3-4 진행 중.
> **작성자**: MoAI 오케스트레이터 (사용자 요청: `/moai:design --path B`)
> **근거**: Design Handoff + `.moai/specs/CHARTER.md` + 현재 코드베이스 정량 분석
> **원칙**: "무리하지 않게 안전하게" — 물리적 삭제가 아닌 **숨김 + 동결 + 문서화**

---

## 0. 요약 (Executive Summary)

Regula는 원래 **"RA Lead 1~2명이 FDA/EU MDR 규제 문서를 법적으로 방어 가능한 형태로 더 빠르게 만들기 위한, 좁고 깊은 컴플라이언스-어웨어 RA 워크스테이션"** 으로 설계되었습니다(Design Handoff 기준 **8개 화면** MVP). 그러나 구현 과정에서 Charter가 명시적으로 "하지 말 것"이라고 한 **QMS 도메인(CAPA·Change Control·DHF)** 과 Design Handoff가 "MVP 범위 외"로 분류한 **15개 후보 기능의 상당수**가 추가 구현되어, 현재는 **30개 노출 기능 + 95개 DB 테이블 + 99개 migration + 68개 SPEC** 규모로 팽창했습니다.

본 제안은 세 가지를 다룹니다:
1. **서비스 정체성 정밀 분석** — 이 서비스가 무엇을 위한 디자인인지
2. **안전한 정리 방안** — KEEP/SHRINK/FREEZE/RETIRE 4단계 분류 + 3계층 접근
3. **모듈화/탈부착 가능성 검토** (추가 요청) — 왜 처음에 모듈화하지 않았는지, 지금이라도 가능한지

---

## 1. 현재 상태 진단 (정량)

| 지표 | 현재 규모 | 비고 |
|---|---|---|
| Migration 파일 | **99개** | 선형 체인, ALTER TABLE 38개 |
| SPEC 디렉토리 | **68개** | `SPEC-REGULA-*` |
| DB 테이블 (pgTable) | **95개** | schema.ts 단일 파일 |
| DB enum (pgEnum) | **57개** | |
| schema.ts 라인 수 | **3,473줄 / 156KB** | 단일 파일 |
| lib 도메인 폴더 | **40+개** | 평면 구조 |
| 사용자 노출 기능 | **~30개** | (CORE 7 + SUPPORT 11 + PERIPHERAL 12) |
| 사이드바 네비 | **24개** | (기본 10 + 조건부 14) |
| 권한 (PermissionAction) | **178개** | permissions.ts 480줄 |
| 회귀 테스트 | **4,760+ passed** | v1.0.0 |

**대조**: Design Handoff의 원래 MVP는 **8개 화면**. Charter의 핵심 자동화는 **5개**(CER·Predicate·PCCP·모니터링·RAG). 현재 규모는 **설계 의도 대비 ~4배 확장**.

---

## 2. 서비스 정체성 정밀 분석

### 2.1 Single Source of Truth 기준 정의

> **Regula = RA Lead 1~2명이 FDA/EU MDR 규제 문서를 '법적으로 방어 가능한 형태'로 더 빠르게 만들기 위한, 좁고 깊은 컴플라이언스-어웨어 RA 워크스테이션.** (abyz 내부 6~8명용, SaaS 외판 아님)

### 2.2 Charter가 정의한 핵심 (여기에 자원을 쏟아야 할 곳)

**5대 핵심 자동화 구간**:

| 구간 | 기존 | Regula 완성 후 |
|---|---|---|
| CER PubMed 수집 + SIGN 50 평가 | 40-80시간 | 10-15시간 |
| Predicate 비교 분석 | 수 시간 | 수십 분 |
| PCCP 초안 작성 | 수동 가이던스 참조 | 4단계 위저드 |
| 규제 변동 모니터링 | 수동 확인 | 자동 알림 |
| RAG Q&A (6개 corpus) | 수동 검색 | 인용 기반 즉답 |

**5대 불변 아키텍처 결정** (제거 불가):
- `audit_logs` append-only (21 CFR Part 11 전자기록)
- Expert Review Gate (시스템이 자기 출력 승인 불가)
- Draft watermark 강제
- 인용 없는 주장 export 차단
- Article 61(4) EU MDR 의무 공개

### 2.3 Charter가 명시한 5대 지양점 (범위 밖)

| 지양점 | 내용 |
|---|---|
| [지양-1] 일반 기업 지식베이스 ❌ | RAG corpus는 FDA/EU MDR/MFDS/NMPA/PMDA + 내부 SOP 전용. Notion/Confluence 대체 ❌ |
| [지양-2] 가짜 신뢰 생성기 ❌ | Expert Review Gate 없는 최종본, Draft watermark 우회, 무인용 export ❌ |
| [지양-3] QMS 대체 ❌ | SOP 관리, 변경 제어(Change Control), CAPA, 불만 처리 ❌. Veeva/MasterControl/Arena PLM 대체 ❌ |
| [지양-4] AI가 규제 판단 대신 ❌ | 모든 법적 주장은 RA Lead 승인 필수 |
| [지양-5] SaaS 외판 ❌ | 외부 고객 온보딩, 결제, 다중 조직 관리 ❌ |

---

## 3. 과도성의 3가지 패턴 (진단)

### 패턴 A — Charter 지양점 위반 (가장 심각)

**[지양-3] "QMS 대체 ❌ — SOP 관리, 변경 제어, CAPA, 불만 처리 → 범위 외"** 를 못 박았으나, QMS의 핵심 3대 축이 구현됨:

| 구현 도메인 | Charter 위반 여부 |
|---|---|
| `lib/capa` (불만·CAPA 폐루프) | **[지양-3] 직접 위반** ("불만 처리" 명시적 범위 외) |
| `lib/change-control` (설계 변경 제어) | **[지양-3] 직접 위반** ("변경 제어" 명시적 범위 외) |
| `lib/dhf` (Design History File) | QMS 핵심 산출물 |
| `lib/vigilance` (안전성 감시) | QMS/Vigilance 도메인 |

→ **제품 정체성 모순**: "QMS 대체 안 함" 선언 vs QMS 3대 축 구현.

### 패턴 B — Design Handoff "MVP 범위 외 15개" 대거 구현

Design Handoff가 명시적으로 **"Out of MVP scope"** 로 분류한 15개 후보 중 상당수가 SPEC화·구현됨:

| Handoff 범위 외 후보 | 현재 상태 |
|---|---|
| #3 Predicate device finder | ✅ CORE로 승격 (PREDICATE-001) |
| #2 Submission planner | ✅ SUBMISSION-LIFECYCLE |
| #5 Email digest | ✅ digest 도메인 |
| #9 Document templating | ✅ templates |
| #10 Confidence calibration | ✅ RLHF calibration (2026-06-28) |
| #11 Public regulator-comparison | ✅ CROSSMARKET SPEC |
| #14 Smart draft mode | ✅ CHANGE-CONTROL·LABELING |
| #15 Saved views + alerts | ✅ 구현 |

### 패턴 C — 내부 6~8명 팀에 과도한 엔터프라이즈 인프라

- `lib/model-governance` (AI 모델 버전 관리·승인 워크플로우) — 6~8명 팀용 MLOps 아님
- `lib/corpus-license` (corpus 라이선스·자격 관리) — [지양-5] SaaS 외판 경계
- `lib/cyberdevice` — UI 노출 0, API-only
- `lib/esubmit` — UI 노출 0, stub 상태
- 4-way observability (Sentry+PostHog+Langfuse+Vercel) — 과잉

---

## 4. 기능 분류 매트릭스 (KEEP / SHRINK / FREEZE / RETIRE)

### 🟢 KEEP — 핵심 9개 (집중 투자)

| 기능 | 도메인 | 근거 |
|---|---|---|
| RAG Q&A 채팅 | `lib/ai` | 서비스 존재 이유. Evidence-first 핵심 |
| CER 작성 | `lib/cer` | Charter 자동화 #1 |
| Predicate 비교 | `lib/predicate` | Charter 자동화 #2 |
| PCCP 위자드 | `lib/pccp` | Charter 자동화 #3 |
| 규제 모니터링/Updates | `lib/digest`+`lib/standards` | Charter 자동화 #4 |
| Expert Review Gate | `lib/expert-review` | [지양-2/4] 불변 |
| Knowledge Base (RAG corpus) | `lib/ingest`+`lib/source-governance` | RAG 전제조건 |
| Traceability 매트릭스 | `lib/traceability` | "법적 방어 가능" 근거 |
| Part 11 전자서명·감사 | `lib/signature`+`lib/audit` | 규제 준수 불변 요건 |

### 🟡 SHRINK — 기능은 두되 범위 대폭 축소 (5개)

| 기능 | 현재 | 축소 방안 |
|---|---|---|
| Standards 추적 | 라이브 크롤러·전환·impact 풀스택 | seed 30~50 코어 + 개정 알림만. 크롤러 영구 DEFER (#278) |
| Knowledge Gap | detector+clustering+GitHub+replay 풀파이프라인 | detector + 큐 조회만 |
| RLHF 품질 루프 | 7모듈(calibration/alternate/heatmap) | 피드백 수집 + heatmap만 |
| Project Memory | LLM 감지+승인+주입 풀사이클 | 수동 메모 + 프롬프트 주입만 |
| Personal Library | 북마크 + 팀 지식 승격 | 북마크만 |

### 🔵 FREEZE — 동결 (코드 보존, 확장 금지, 7개)

이미 머지되어 제거 비용이 크지만 Charter 지양점에 걸리거나 과잉인 것들. "있는 것"은 허용하되 "더 만들지"는 않음.

| 기능 | 근거 |
|---|---|
| CAPA (`lib/capa`) | [지양-3] QMS 위반. 이미 #68 머지 → 동결 |
| Change Control (`lib/change-control`) | [지양-3] QMS 위반. 이미 #54 머지 → 동결 |
| Clinical Investigation (`lib/clinical-investigation`) | 임상 도메인. 이미 #69 머지 → 동결 |
| Labeling/IFU (`lib/labeling`) | 경계 도메인. 이미 #66 머지 → 동결 |
| PMS/PMCF (`lib/pms`) | EU MDR 의무라 완전 제거 곤란 → 동결 |
| Model Governance (`lib/model-governance`) | 6~8명 팀엔 과잉 MLOps → 동결 |
| Cyberdevice (`lib/cyberdevice`) | UI 0, API-only → 동결 (사용자 노출 X 유지) |

### ❌ RETIRE 후보 — 합의 하에 숨김/비활성화 검토 (5개)

| 기능 | 근거 | 방식 |
|---|---|---|
| Corpus License (`lib/corpus-license`) | [지양-5] SaaS 경계 | UI 숨김 + API 비활성화 (코드 보존) |
| eSubmit (`lib/esubmit`) | stub, UI 0 | 비활성화 유지 |
| ROI 대시보드 | 6~8명 팀에 과잉 | UI 숨김 |
| CROSSMARKET / STRATEGY / BATCH (미구현 SPEC) | 킬러 기능이나 1차 범위 아님, LLM 리스크 高 | SPEC 보관, 구현 중단 |
| REIMBURSEMENT / WORKFLOWS-LLM-002 (미구현) | 외부 의존 | SPEC 보관, 구현 중단 |

---

## 5. 안전한 정리 방안 — 3계층 (무리하지 않게)

> **원칙**: 코드 물리적 삭제 ❌ → **(a) UI 노출 차단 + (b) 새 투자 중단 + (c) 문서상 범위 명시**. 이 3가지로 "과도함"의 90% 해소. 물리적 삭제는 별도 레버리지 분석 후 신중히.

### 계층 1 — UI 표면 정리 (저비용, 즉시 가시 효과)

사이드바 24개 → **RA Lead 중심 10~12개로 축소**. RETIRE/FREEZE 대상은 role-gating으로 숨김.

```
[RA Lead 기본 네비 — 10개]
홈 · 새 상담(RAG) · CER · Predicate · PCCP · 지식베이스 ·
규제업데이트 · 추적매트릭스 · 히스토리 · 설정
```

→ **구현 방식**: Sidebar 컴포넌트의 navItems 배열을 feature flag 기반으로 필터링 (§7 모듈화 계층 1과 동일 선상).

### 계층 2 — 범위 동결 (Charter 재확인, 문서화)

**새 기능/SPEC 착수 금지 목록**:
- 미구현 "킬러 기능" 4종: #40 STRATEGY · #42 CROSSMARKET · #43 BATCH · #39 WORKFLOWS-LLM-002
- 외부 의존 4종: #236 CLASSIFY deterministic · #278 Standards 크롤러 · #202 Hybrid E2E · #70 Reimbursement

→ "1차 릴리즈 = Charter MVP 완성" 선언에 맞춰 **새 도메인 추가 영구 중단**.

### 계층 3 — 정체성 재확립 (문서 메모)

현재 코드베이스의 "의도치 않은 범위 확장"을 명시적으로 문서화:
- "CAPA/Change Control/DHF는 RA 문서 작성 보조 용도로 한정. QMS 시스템으로 사용 금지" (지양-3 정정 메모)
- "Model Governance/Corpus License는 내부 인프라. SaaS 고객 기능 아님" (지양-5 정정 메모)

---

## 6. 모듈화/탈부착 가능성 검토 (추가 요청 보고)

### 6.1 질문에 대한 직답

> **Q: 축소하는 기능들 포함해서 왜 모듈화해서 탈부착이 유연하도록 설계 못했는지?**

**A: lib 도메인 자체는 이미 느슨하게 결합되어 있으나, (1) 단일 `schema.ts`(95 테이블), (2) 선형 `migration` 체인(231 FK), (3) 공유 인프라(`db`/`auth`/`audit`에 190+ 파일 결합) 세 가지가 도메인을 한 덩어리로 묶고 있어 "독립 탈부착"이 구조적으로 막혀 있었습니다. Next.js + Drizzle 단일 앱 패턴에서 모듈 경계가 "폴더"로만 존재했기 때문입니다.**

> **Q: 지금이라도 모듈러 설계가 가능한지?**

**A: 부분적으로 가능. "기능 플래그 레지스트리" 수준(탈부착의 80% 효과)은 저비용으로 즉시 가능. 그러나 "완전한 모듈 분리(별도 패키지/별도 스키마/별DB)"는 공유 인프라 재추상화가 필요해 6~8명 내부 팀엔 정당화되지 않습니다. 3계층 로드맵을 권장합니다 (§6.4).**

### 6.2 현재 결합도 정량 측정 (근거)

#### 6.2.1 lib 도메인 간 결합 (낮음 — 좋은 소식)

각 비즈니스 도메인이 **다른 비즈니스 도메인**을 import 하는 횟수 (공유 인프라 제외):

| 도메인 | cross-import 수 | 평가 |
|---|---|---|
| `lib/rlhf` | 9 | 유일한 고결합 (RAG/AI 깊이 의존) |
| `lib/traceability` | 4 | 중간 |
| `lib/labeling` | 3 | 중간 |
| `lib/knowledge-gap` | 3 | 중간 |
| `lib/capa` | 2 | 낮음 |
| `lib/pms` | 1 | 낮음 |
| `lib/standards`, `lib/predicate`, `lib/pccp`, `lib/cer`, `lib/change-control`, `lib/model-governance`, `lib/cyberdevice`, `lib/corpus-license`, `lib/clinical-investigation` | **0** | **사실상 독립** |

→ **비즈니스 로직은 이미 도메인별로 잘 격리되어 있음.** 11개 도메인이 cross-import 0~1.

#### 6.2.2 공유 인프라 결합 (높음 — 진짜 장애물)

| 공유 모듈 | 참조 파일 수 | 의미 |
|---|---|---|
| `lib/auth` | **191 파일** | 모든 도메인이 인증/RBAC 의존 |
| `lib/db` | **190 파일** | 모든 도메인이 단일 DB 클라이언트 |
| `lib/audit` (writeAudit) | **159 파일** | 모든 도메인이 감사 로그 호출 |
| `lib/db/client.ts` (withTenantScope) | **177 파일** | org 격리가 도메인 경계 아닌 중앙 제어 |
| `permissions.ts` | 480줄 / **178 action** | 권한이 전역 단일 레지스트리 |

→ **이것이 "도메인을 떼어낼 수 없는" 진짜 이유.** 어떤 도메인을 분리해도 db/auth/audit를 끌고 가야 함.

#### 6.2.3 데이터베이스 결합 (높음)

- **schema.ts**: 단일 파일 156KB / 3,473줄 / 95 테이블 / 57 enum
  - 단, `schema-docingest.ts`가 이미 분리되어 있음 → **분할 패턴 선례 존재**
- **migration**: 99개 선형 체인, 총 **231개 REFERENCES**
  - `organizations`를 27개 migration 참조, `users` 26개, `projects` 14개
  - ALTER TABLE 38개 → 기존 테이블 수정(결합)이 일상화
  - → DB 레벨에서 도메인이 섞여 있어 "도메인별 독립 migration" 불가

#### 6.2.4 라우트 결합 (중간)

| 라우트 | lib 도메인 참조 수 |
|---|---|
| `api/change-control/run` | 7 |
| `api/rlhf/feedback` | 6 |
| `api/change-control/.../export` | 5 |
| `api/traceability/*`, `api/standards/*` | 4 |

→ 라우트가 orchestration layer 역할 (여러 도메인 조합). 라우트 자체는 도메인별 분리 용이.

### 6.3 왜 처음부터 모듈화하지 않았는가 (원인 분석)

| 원인 | 설명 |
|---|---|
| **프레임워크 패턴** | Next.js(단일 앱) + Drizzle(단일 스키마 참조)이 모놀리스를 전제. 모듈 경계가 "폴더"로만 존재, 패키지/마이크로서비스 아님 |
| **MVP 속도 우선** | Charter가 "좁고 깊은 도구"를 지향 → 아키텍처 경계 설정(추상화 비용)을 오버엔지니어링으로 간주. 빠른 구현 우선 |
| **팀 규모** | 6~8명 내부 팀 → 모듈 분리의 운영 이득(독립 배포/스케일일)이 작음. 단일 배포·단일 DB로 충분 |
| **점진적 범위 확장** | SPEC이 26개씩 배치 추가되며 도메인이 불어남. 각 추가 시 "지금 분리할 필요성"이 낮아 monolith가 누적 |
| **공유 인프라 침투** | db/auth/audit가 편리해서 모든 도메인이 직접 참조. 경계 추상화(kernel/domain layer) 부재 |

→ **결론**: 당시 합리적 선택이었으나, 도메인이 40+로 불어난 지금은 한계 도달.

### 6.4 모듈화 가능성 — 3계층 전략 (권장)

#### 계층 1 — 기능 플래그 레지스트리 (저비용, 즉시, **권장**)

**목표**: "탈부착"의 사용자 경험적 효과를 코드 재설계 없이 달성.

**방식**:
- `lib/features/registry.ts` (또는 config)에 각 도메인을 feature로 등록
- 사이드바/라우트가 플래그 기반 렌더
- "탈부착" = 플래그 off → UI/라우트에서 즉시 사라짐 (코드는 보존)

```ts
// 개념 (실제 구현 시 별도 SPEC)
export const FEATURE_FLAGS = {
  rag: true, cer: true, predicate: true, pccp: true,  // KEEP
  standards: true, traceability: true,                // KEEP
  capa: false, changeControl: false,                  // FREEZE → 숨김
  corpusLicense: false, roi: false,                   // RETIRE → 숨김
  // ...
} as const;
```

**효과**: §5 계층 1(UI 축소)과 동일 선상. 정리 작업의 **사실상의 모듈화**. 비용 매우 낮음.

#### 계층 2 — 도메인 응집 정리 (중비용, 점진적)

**목표**: lib 도메인을 "논리적 모듈"로 정리 (물리적 분리 없이 경계 명확화).

**방식**:
- 각 도메인에 `index.ts` (public API) 부여 → 외부에서 내부 파일 직접 import 제한
- schema.ts를 **도메인별 논리 섹션**으로 재조직 (단일 파일 유지하되 `// @domain cer` 마커 + `schema-docingest.ts` 패턴 확장)
- 도메인별 `README.md` + 독립 테스트 경계
- 마이그레이션에 도메인 태그 부여 (`0088_standards.sql` 패턴 정식화)

**효과**: 도메인 경계 가시화, 향후 계층 3 이행 시 마이그레이션 비용 절감. 비용 중간.

#### 계층 3 — 완전 모듈 분리 (고비용, 미래 보류)

**목표**: kernel/domain 분리, 도메인별 schema 파일, 도메인별 migration 그룹.

**방식**:
- 공유 인프라 추상화: `lib/kernel/` (db/auth/audit을 인터페이스로) + 각 도메인이 kernel에만 의존
- schema.ts → `lib/{domain}/schema.ts` 분할 (Drizzle 다중 스키마 파일 지원)
- migration → `migrations/{domain}/` 그룹화 (선형 체인은 유지하되 소유권 명확화)

**판정**: **6~8명 내부 팀에는 정당화되지 않음.** 필요 시점(예: 외부 납품/팀 20+명/도메인 독립 배포 필요)까지 연기. 비용 매우 높음, 회귀 위험 큼.

### 6.5 모듈화 권장사항 (종합)

| 권장 | 근거 |
|---|---|
| **계층 1 즉시 채택** | 정리(§5)와 동일 선상. 탈부착 효과의 80%를 비용 20%로. |
| **계층 2 점진적** | 새 도메인 추가 시마다 적용. 기존 도메인은 리팩터 기회에. |
| **계층 3 보류** | 명시적 트리거(외부 납품 결정 등) 전까지 미실행. |
| **schema-docingest.ts 패턴 확장** | 이미 검증된 분할 선례이므로, 신규 분할 시 이 패턴 사용. |

---

## 7. 리스크 및 주의점

### 7.1 무리한 코드 삭제의 위험 (Push Back)

RETIRE/FREEZE 대상 상당수가 **4,500+ 회귀 테스트와 얽혀 있음**. 물리적 삭제 시:
- migration 체인(99개 선형) 꼬임
- RLS/audit enum(57개) 의존성 붕괴
- L-013 교훈 재발: "정적 테스트 + CI mock 통과해도 실DB 결함"

→ **본 제안은 "삭제"가 아닌 "숨김 + 동결"을 기본으로 함** (코드 보존).

### 7.2 "구현됨" ≠ "사용됨" 검증 필요

CER·Predicate·PCCP가 Charter 핵심이지만, **실제 RA Lead 사용 빈도는 별개 검증** 필요 (L-013 핵심 교훈). 1차 릴리즈 이후 **실사용 로그/분석**이 KEEP vs SHRINK 경계 확정의 전제.

### 7.3 Charter 위반 도메인의 운영적 딜레마

CAPA/Change Control/DHF는 이미 구현되어 일부 워크플로우가 얽혀 있을 수 있음. "동결" 선언 후에도 기존 데이터/사용자가 있으면 즉시 숨김은 곤란 → **점진적 role-gating** 권장.

---

## 8. 실행 로드맵 (승인 대기)

> 본 제안은 **보고 단계**. 아래는 승인 시 순차 진행 예정. 각 단계는 별도 PR/SPEC.

| 단계 | 내용 | 위험 | 예상 산출물 |
|---|---|---|---|
| **Step 0** | 본 제안서 검토 + 사용자 승인 | 없음 | 본 문서 |
| **Step 1** | 기능 플래그 레지스트리 도입 (계층 1) — `lib/features/registry.ts` + Sidebar 연동 | 낮음 | PR + 회귀 테스트 |
| **Step 2** | RETIRE/FREEZE 대상 UI 숨김 (플래그 off) | 낮음 | 사이드바 축소 (24→10~12) |
| **Step 3** | Charter 정정 메모 문서화 (지양-3/5 정정) | 없음 | docs/ 업데이트 |
| **Step 4** | 미구현 킬러 기능 4종 + 외부 의존 4종 구현 중단 공식화 (이슈 close-out) | 낮음 | 이슈 상태 업데이트 |
| **Step 5 (선택)** | 계층 2 도메인 응집 — 신규 도메인부터 `index.ts` 적용 | 중간 | 점진적 리팩터 |
| **Step 6 (보류)** | 실사용 로그 분석 → KEEP/SHRINK 경계 확정 | — | 별세션 |

---

## 9. 부록 — 측정 근거 (재현 가능)

본 제안의 모든 정량 수치는 아래 명령으로 재현 검증 가능:
- migration/SPEC/테이블 수: `ls migrations/*.sql | wc -l` / `ls -d .moai/specs/*/` / `grep -c 'pgTable(' lib/db/schema.ts`
- 도메인 간 결합: `for d in lib/*/; do grep -rh "from '@/lib/" "$d" | grep -vE "from '@/lib/(db|auth|audit|...)" | wc -l; done`
- 공유 인프라 fan-in: `grep -rl "from '@/lib/db" lib/ app/ | wc -l`
- migration FK 결합: `grep -h 'REFERENCES' migrations/*.sql | wc -l`

---

**버전**: 1.0.0
**다음 리뷰 시점**: Step 0 승인 후
**관련 메모리**: `product-charter.md` · `project-state.md` · `lessons.md` (L-013)
