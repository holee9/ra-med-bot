# Regula 목적·목표 정합성 검토 보고서

> 작성일: 2026-07-16
> 검토 방식: 4축 병렬 감사 (SPEC 전수 / 코드 정합성 / 문서 계층 / 이슈·로드맵)
> 검토 기준: `.moai/project/product.md` v3.0.0 (2026-07-02) — 최신 정체성 정의
> 원칙: 문서의 자기주장을 신뢰하지 않고 디스크·gh CLI로 직접 반증

---

## 0. 요약

Regula의 목적·목표 자체는 **명확하고 일관된 방향**을 갖고 있다. v3 피벗(RA 워크스테이션 → RA 게이트웨이)은 승인·착수되었고, SPEC 75종 중 57종(76%)이 목적에 부합한다. LLM 온프레미스 전환(#318)과 PHI 도메인 제거(#319)는 문서 주장대로 **실제로 이행 완료**되었다.

문제는 목적이 아니라 **목적을 강제하는 구조**와 **핵심 가치의 실운영 공백**에 있다.

| 심각도 | 발견 | 성격 |
|---|---|---|
| 🔴 CRITICAL | RAG 코퍼스 실질 공백 (`source_sections=19`) | 핵심 가치 작동 불가 |
| 🔴 CRITICAL | 헌장(CHARTER.md)이 워크플로우에 미연동 | 거버넌스 결함 |
| 🟠 HIGH | 미승인 제안서가 사실상 헌법 역할 | 거버넌스 결함 |
| 🟠 HIGH | 범위 이탈 SPEC 3건 · 이슈 2건 | 범위 규율 |
| 🟡 MEDIUM | v3 Phase A/B/E 미착수 + 추적 공백 | 실행 편차 |
| 🟡 MEDIUM | stale 문서 다수 (architecture.md 등) | 문서 위생 |

---

## 1. 목적·목표 (숙지 결과)

### 최신 정의 — `.moai/project/product.md` v3.0.0 (2026-07-02)

**Regula는 RA(Regulatory Affairs) 게이트웨이이다.**
의료기기 인허가 담당자 3명과 사내 임직원 26명 사이의 커뮤니케이션·셀프서비스·이력 관리를 통합하는 사내 웹앱.

| Persona | 인원 | 니즈 | 화면 |
|---|---|---|---|
| Employee | 26 | 규제 셀프서비스, 변경 영향 자가진단 | 5 |
| RA | 3 (Lead 1 + Member 2) | 사내 질의 처리, 인허가 워크플로우 | 6 |
| Admin | 1 | 감시·거버넌스·Part 11 준수 | 12 |

### 핵심 목표

RA 담당자(3명)가 병목이 되는 구조를 깨는 것. 전사 직원이 인용 기반 RAG Q&A로 자주 묻는 인허가 질문을 셀프서비스로 해결하고, RA는 Kanban Inbox 1개에서 트리아지·승인만 한다.

### 지양 5종 (범위 경계선)

1. 일반 기업 지식베이스 ❌ (Notion/Confluence 대체 아님)
2. 가짜 신뢰 생성기 ❌ (Expert Review Gate 우회 / draft watermark 우회 / 무인용 export — 아키텍처 결정이며 기능 추가로 풀 수 없음)
3. QMS 대체 ❌ (SOP 관리·CAPA·변경제어·불만처리는 QA팀 소유)
4. AI가 규제 판단을 대신함 ❌ (모든 법적 주장은 RA Lead 확인·승인 필수)
5. SaaS 외판 ❌ (내부 전용 설계)

### 아키텍처 불변 목록

- `audit_logs` append-only — 21 CFR Part 11
- Expert Review Gate (HARD) — 시스템이 자기 출력을 승인 불가
- Draft watermark 강제
- 인용 없는 주장 export 차단
- Article 61(4) disclaimer 강제 — EU MDR 의무 공개

---

## 2. 🔴 CRITICAL — RAG 코퍼스 실질 공백

`docs/proposals/production-deployment-gap-2026-07-10.md`가 실측으로 자인:

```
BLOCK-1 CRITICAL: sources=1, source_sections=19, knowledge_sources=0
```

모든 정체성 문서가 1순위 가치로 내건 "인용 기반 RAG Q&A"가 **실운영 데이터 기준 작동 불가** 상태다.

이것이 최상위 발견인 이유: 정체성 정의를 어느 문서로 통일하든, 코퍼스가 비어 있으면 "Employee 26명이 셀프서비스로 질문을 해결한다"는 목표는 **문서상으로만 존재**한다. v3 Phase A/B/E 아키텍처 정리보다 우선순위가 높다.

**연관**: 열린 이슈 #412(토큰 평문 저장), #413(SSRF guard)는 `knowledge_sources` 파이프라인의 보안 결함으로, 코퍼스 적재를 실제로 가동하기 전에 선결되어야 한다.

---

## 3. 🔴 CRITICAL — 헌장이 워크플로우에 연결되어 있지 않음

`.moai/specs/CHARTER.md:3-4`의 자기선언:

> **이 파일은 모든 SPEC 작성 전 자동 로드됩니다.**
> manager-spec은 새 SPEC을 작성하기 전에 아래 지양점 체크리스트를 먼저 검토해야 합니다.

**검증 결과 — 이 메커니즘은 구현된 적이 없다.**

```
grep -rln "CHARTER" .claude/   →  0 hits
```

`manager-spec.md:92`의 "Step 1: Load Project Context"가 실제로 로드하는 것:

```
- Read `.moai/project/{product,structure,tech}.md`
```

즉 **지양 5종 체크리스트가 SPEC 작성 시 한 번도 실행된 적이 없다.** §5의 범위 이탈 3건이 통과된 구조적 원인이 이것이다.

---

## 4. 🟠 HIGH — 미승인 제안서가 사실상 헌법 역할

`docs/proposals/v3-architecture-revamp-plan-2026-07-02.md:4`:

```
> **상태**: 제안 (Proposal) — 사용자 승인 대기
```

그런데 `product.md:6`, `structure.md:6`, `tech.md:6` 세 문서가 **이 미승인 제안서를 "기준 문서"로 인용**하며 정체성·사용자·아키텍처를 확정 사실로 서술한다. 그리고 이 세 문서가 manager-spec이 실제로 자동 로드하는 유일한 문서다.

**결과**: 새 SPEC은 (a) 지양점 검증 없이, (b) 미승인 제안 기반 정의를 자동 흡수하며 작성된다.

**단, 실질은 승인된 것으로 보인다.** v3 Phase C/D(INBOX/TRIAGE/CONSULT/UI/AUDIT-CHAIN)가 이미 구현·종결되었고 이슈(#320/#321/#339/#341/#357)로 정상 추적되었다. 즉 **"승인 대기" 문구 자체가 stale**이며, 승인 사실을 기록한 문서가 없어 감사 추적이 비어 있다.

### 문서 상태 표기 문제 일반화

| 문서 | 자칭 상태 | 실제 취급 |
|---|---|---|
| `v3-architecture-revamp-plan-2026-07-02.md` | 제안 — 승인 대기 | product/structure/tech가 기준 문서로 인용, Phase C/D 구현 완료 |
| `docs/v3/README.md` | Design Handoff (구현 대상) | product.md가 정체성 문구를 그대로 이식 |
| `llm-backend-migration-2026-07-01.md` | DESIGN ONLY (구현 미포함) | 9일 뒤 production-deployment-gap이 "완료"로 서술 |
| `scope-rationalization-2026-06-28.md` | ✅ 채택됨(Adopted) | **정상 사례** — 승인 도장이 찍힌 유일한 문서 |

---

## 5. 🟠 HIGH — 범위 이탈

### SPEC (전수 75종 판정)

| 판정 | 수 |
|---|---|
| ALIGNED | 57 |
| ARCHIVE-TARGET (v3 계획대로 아카이브 예정) | 12 |
| **SCOPE-VIOLATION** | **3** |
| AMBIGUOUS | 3 |

**SCOPE-VIOLATION 3건**

| SPEC-ID | 위반 | 근거 |
|---|---|---|
| `SPEC-REGULA-WORKFLOWS-001` | 지양-3 | `lib/workflows/audit-response/capa-generator.ts`가 "CAPA 7-field draft" 생성. CAPA는 QA팀 소유로 범위 밖 |
| `SPEC-REGULA-WORKFLOWS-LLM-002` | 지양-3 | 위 executor의 실행형 구현 |
| `SPEC-REGULA-AUDITOR-VIEW-001` | 지양-5 인접 | "external auditors (FDA inspectors, MFDS reviewers, BSI/TÜV notified body)" 전용 페르소나 — v3 3-tier에 외부 당사자 없음 |

> **구조적 주의**: `SPEC-REGULA-CAPA-001`은 아카이브 대상인데, `WORKFLOWS-001`이 **동일 기능(CAPA 생성)을 다른 SPEC으로 재구현**하고 있다. CAPA 도메인을 아카이브해도 이 경로로 되살아난다. 아카이브 작업 시 반드시 함께 처리해야 한다.

**AMBIGUOUS 3건**

- `SPEC-REGULA-BREADTH-001` — v2 8-view 확장. v3 3-tier UI로 대체된 레거시인지 불명확
- `SPEC-REGULA-REIMBURSEMENT-001` — CPT/HCPCS/DRG 급여 분석. RA 인허가가 아닌 상업전략 도메인
- `SPEC-REGULA-TENANT-001` — 제목("Multi-Tenancy + SOC2/HIPAA")과 실제 구현(부서 RBAC 5 REQ)이 불일치. 재명명 필요

### 오픈 이슈 (전수 20건 판정)

| 이슈 | 판정 | 근거 (본문 인용) |
|---|---|---|
| #55 ROI 대시보드 | **SCOPE-VIOLATION [지양-5]** | "SaaS 갱신 결정과 추가 도입 확대(**enterprise upsell**)는 ROI 증명에 달려 있습니다" — 내부 전용 원칙과 정면 충돌 |
| #40 규제 전략 생성기 | **SCOPE-VIOLATION [지양-4]** | "단순 질의응답이 아니라 **전략 합성(strategy synthesis)**" / "각 관할권별 최적 경로 추천" — AI 단독 규제 판단 |
| #42 크로스마켓 갭 분석 | AMBIGUOUS | "갭 해소 최적 순서 제안… 경로 추천" — #40과 동일 경계 |
| #38 Adoption Analytics | AMBIGUOUS | KPI 자체는 무해하나 #55와 결합 시 SaaS 지향. `PII-safe aggregate만` 명시로 일부 완화 |
| #9, #18, #25, #70, #1 | STALE | Wave 3~5 백로그 잔존. v3 Phase A-E 어디에도 없음 |
| 나머지 11건 | ALIGNED | 보안·QA·RAG 파이프라인·Expert Review 강화 |

---

## 6. 🟡 MEDIUM — v3 실행 편차

### 계획 vs 실제 (디스크 직검)

| v3 주장 | 실제 | 진행률 |
|---|---|---|
| kernel/domains/bff/infra 4계층 | `lib/kernel`·`lib/bff`·`lib/infra` **디렉터리 없음**. `lib/domains/`엔 신규 4종만 | 사실상 미착수 |
| QMS 18도메인 / 334 files 아카이브 | 7도메인 / 139 files | ~41% |
| schema.ts 분할 | 3,531줄 · 93 pgTable 단일 파일 | 4/93 (4.3%) |
| components/ + app/ 페르소나 재편 | `employee`/`ra`/`shared`, `(employee)`/`(ra)` 없음 | 미착수 |
| audit hash chain | **기능 구현됨**. 단 DB 트리거 아닌 앱 레벨, BYTEA 아닌 TEXT | 설계 상이 |
| LLM gx10 Ollama 단일 (#318) | `lib/ai/llm-provider.ts` → `192.168.100.1:11434`, `@anthropic-ai/sdk`는 pnpm override로만 잔존 | **주장대로 완료** |
| PHI 도메인 제거 (#319) | vigilance/complaint/capa 도메인 폴더 부재 확인 | **주장대로 완료** (단 `patient` 키워드는 CER·리스크 맥락에 21파일 잔존 — "완전 제거" 표현은 과장) |

### 작업 우선순위 어긋남

최근 병합 PR 30건(#414~#443)은 전부 **커버리지 래칫업(#402)**, 보안/RLS, E2E 문서화, v2 계열 후속작업이다. **v3 Phase A/B/E를 진전시키는 PR은 0건.**

v3 계획의 실행 순서는 "아카이브 → kernel → v3 도메인 → UI → BFF"였으나, 실제로는 **C/D(도메인·UI)를 먼저 하고 A/B(아카이브·kernel)를 건너뛴 뒤 지금은 커버리지 축으로 이동**한 상태다. Phase A/B를 건너뛴 채 C/D를 올렸기 때문에 아카이브 대상 코드가 여전히 살아 있고, §5의 CAPA 재구현 문제가 방치된다.

### 추적 공백

| 항목 | 문제 |
|---|---|
| `SPEC-V3-RESTRUCTURE-001` (Phase A+B) | status: planned, **추적 이슈 없음**. frontmatter `issue_number: 35`는 무관한 CLOSED 이슈 오기재 |
| `SPEC-V3-REGISTRY-001` (Phase C-4) | **SPEC 문서 자체가 없음** |
| `SPEC-V3-BFF-001` (Phase E) | **SPEC 문서 자체가 없음** |
| `SPEC-V3-IMPACT-001` / `IMPACT-UI-001` / `PERSONA-001` | status: completed인데 **추적 이슈 전무** |
| `SPEC-V3-UI-001` | SPEC status: draft ↔ 이슈 #326/#328/#329 CLOSED("Phase D 완료") — 상태 불일치 |

> 21 CFR Part 11 감사 추적을 제품 원칙으로 내세우는 프로젝트에서 자기 개발 이력의 추적 공백은 프로세스 정합성 리스크다.

---

## 7. 🟡 MEDIUM — 문서 계층 불일치

### 정체성 3종 병존

| 문서 | 날짜 | 정체성 | 1순위 사용자 | 팀 규모 |
|---|---|---|---|---|
| `.moai/specs/CHARTER.md` | 2026-06-11 | RA **워크스테이션** | RA Lead 1~2명 (80%+) | **6~8명** |
| `docs/scope-boundary.md` / `README.md` | 2026-06-29 | 전사 인허가 **도우미** | 전사 직원 | — |
| `.moai/project/product.md` v3.0.0 | 2026-07-02 | RA **게이트웨이** | Employee 26 (1순위) | **30명** |

세 라벨이 지향(RA 병목 분산)은 겹치지만, 어느 문서도 서로를 동의어로 연결하지 않는다. **팀 규모 가정이 6~8명 vs 30명으로 4배 차이** — 지양-5("6~8명용 설계")의 근거 수치 자체가 무효화되었다.

### corpus 정의 상충

- CHARTER: "FDA/EU MDR/MFDS/NMPA/PMDA + internal SOP" — 6개 코퍼스 직접 수집
- `docs/architecture/knowledge-base.md` (2026-07-10, 최신·명시적 정정): "이전 문서들이 '6개 코퍼스'로 기술했으나 이는 **데이터 소싱에 대한 잘못된 표현**" — 실제 소스는 **3개 git repo**(ra-project/MD-process/ra-llm-wiki)이며, FDA/EU MDR 등은 저장소가 아니라 **검색·분류 도메인**

### product.md 내부 모순

`product.md` "포함 기능" 표는 **"CER/PCCP/Predicate ✅ 보존"**이라 명시하지만, 같은 문서가 기준으로 인용하는 v3 계획서 3.3절은 **PCCP를 아카이브 대상**("v3 SaaS 연동 검토")으로 분류한다.

### stale 문서

| 파일 | 문제 |
|---|---|
| `docs/architecture.md` (v1.2.0, 2026-06-21) | **가장 위험**. 여전히 Vercel + Neon + Anthropic Claude Sonnet + OpenAI 임베딩을 "현재 아키텍처"로 서술 — 온프레미스 gx10 Ollama 전환과 정면 충돌. 신규 합류자가 이 문서를 먼저 읽으면 완전히 틀린 전제를 갖는다 |
| `README.md` | v3(게이트웨이 / 3-tier / PersonaBar / kernel-domain-archive) 언급 **0건** |
| `.moai/project/interview.md` (2026-04-29) | 멀티 LLM(OpenAI 임베딩 + Claude 추론) 서술 — 사문화 |
| `.moai/specs/CHARTER.md` | 사용자 우선순위·corpus·팀 규모 전부 무효화. "자동 로드" 주장 미구현 |
| `docs/scope-boundary.md` | "Charter 메모리 교정" 주장하나 CHARTER.md 원문 미수정 |
| `docs/implementation-status.md` | 기준일 2026-06-23, 3주+ stale |
| `product.md`/`structure.md`/`tech.md` | 미승인 제안서를 기준 문서로 인용. `lib/kernel/` 등 미구현 항목을 현재형 서술 |

---

## 8. 권고 (우선순위 순)

### P0 — 핵심 가치 복구

1. **RAG 코퍼스 적재 가동** — `source_sections=19` 상태 해소. 선결로 #412(토큰 암호화)·#413(SSRF guard) 처리.

### P1 — 거버넌스 복구

2. **헌장을 실제로 연결하거나, 자기주장을 제거** — 둘 중 하나. `manager-spec.md` Step 1에 CHARTER 로드를 추가하든지, CHARTER를 product.md에 흡수하고 "자동 로드" 문구를 삭제하든지. 현재는 문서의 자기주장과 실제 동작이 불일치한다.
3. **v3 승인 상태 명시** — Phase C/D가 이미 구현된 이상 "승인 대기" 문구는 사실이 아니다. 승인 기록을 남기고 상태란을 정정.
4. **범위 이탈 5건 판정** — SPEC 3건(WORKFLOWS-001/LLM-002, AUDITOR-VIEW-001) + 이슈 2건(#40, #55). 특히 CAPA 재구현은 아카이브 작업의 선결 조건.

### P2 — 문서 위생

5. **`docs/architecture.md` 전면 재작성 또는 Superseded 표기** — 가장 위험한 stale 문서.
6. **정체성 라벨 통일** — "게이트웨이"/"도우미"/"워크스테이션" 중 하나로. 팀 규모 6~8 vs 30 확정.
7. **product.md PCCP 내부 모순 해소** — 보존인지 아카이브인지.
8. **README v3 동기화**.

### P3 — 실행 정합

9. **Phase A/B 재개 판단** — 커버리지 축과의 우선순위 결정. A/B를 건너뛴 상태가 CAPA 재구현 문제를 방치하고 있다.
10. **추적 공백 해소** — RESTRUCTURE-001 이슈 등록, REGISTRY/BFF SPEC 작성, 완료 SPEC 3종 소급 이슈화, UI-001 상태 정정.
11. **Wave 백로그 트리아지** — #9/#18/#25/#70 close-or-adopt 결정.

---

## 부록 — 검증 방법

모든 주장은 디스크 또는 gh CLI 직검으로 뒷받침되었으며, 문서의 자기주장은 신뢰하지 않았다.

- 구조: `ls lib/`, `find archive/qms-pms/lib -maxdepth 1`, `ls -d app/*/`
- 규모: `wc -l lib/db/schema.ts` (3,531), `grep -c pgTable` (93)
- 헌장 연동: `grep -rln "CHARTER" .claude/` → 0 hits
- LLM: `lib/ai/llm-provider.ts`, `lib/ai/embedding-provider.ts`, `package.json`
- 이슈: `gh issue list --state open --json number,title,body` (20건 전수)

**검토 중 반증된 초기 가설 3건** (기록 목적):

1. "v3 실행이 시작되지 않았다" → 반증. archive 7도메인 이동 + lib/domains 4종 존재
2. "product.md의 완료 주장(#318 Ollama, #319 PHI)이 허위일 것" → 반증. 둘 다 실제 이행 완료
3. "SPEC-V3-* 8종이 하나도 없다" → 반증. 6종 실재 (`ls | head -50` 잘린 출력을 전수로 오인한 검토자 오류)

이 3건은 모두 동일 방향의 편향이었다 — 초기 프레이밍이 과도하게 비관적이었고, 실제 프로젝트 상태는 그보다 건강하다.
