# 세션 요약 — 목적 정합성 감사 및 후속 처리

> 기간: 2026-07-16 ~ 2026-07-18
> 시작점: `/moai "프로젝트의 목적과 목표를 점검하고, 목적에 맞게 계획·설계됐는지 검토·보고"`
> 결과: 감사 → 거버넌스 복구 → RAG 코퍼스 근본원인 수정 → 범위 이탈 처분까지 PR 5건 머지

---

## 0. TL;DR

프로젝트의 **목적·목표 자체는 명확하고 건강**하다 (Regula = RA 게이트웨이, Employee 26 / RA 3 / Admin 1). 무너져 있던 것은 목적이 아니라 **목적을 강제하는 장치**와 **핵심 가치의 실운영 공백**이었다.

4축 전수 감사(SPEC 75종 / 코드 / 문서 계층 / 이슈 20건)로 시작해, 다음을 처리했다:

| # | 발견 | 처리 | PR |
|---|---|---|---|
| 1 | 헌장(CHARTER)이 워크플로우에 미연동 — 지양 5종 체크가 한 번도 실행된 적 없음 | CHARTER v2.0.0 재작성 + manager-spec 실연결 | #522 |
| 2 | RAG 코퍼스 실질 공백 — PII 가드가 URL을 차단해 규제문서 74% 드롭 | URL 가드 제거 + 코퍼스 실적재(623 sources) + M0~M4 | #523 |
| 3 | BLOCK-2 executor "가짜 출력"은 이미 #417로 실구현 완료 (stale 문서) | 해소 마킹 + audit-response 범위 경고 | #524 |
| 4 | audit-response executor = CAPA 생성기, Charter 지양-3 위반 | archive/qms-pms/ 아카이브 | #525 |
| 5 | #520 잔여 4건(위반 3 + AMBIGUOUS 3) | 판정·문서 정정 (코드 변경 0) | #526 |

**PR #522~#526 전부 머지. #520 close.**

---

## 1. 발단 — 4축 정합성 감사

`.moai/project/product.md` v3.0.0(RA 게이트웨이)을 기준으로 4개 축을 병렬 감사. 보고서: `docs/purpose-alignment-audit-2026-07-16.md`.

핵심 발견 (심각도 순):

- 🔴 **RAG 코퍼스 실질 공백** — `source_sections=19`, 핵심 가치(인용 기반 Q&A) 실운영 작동 불가
- 🔴 **헌장 미연동** — `grep -rln "CHARTER" .claude/` → 0 hits. 지양 5종 체크가 SPEC 작성 시 한 번도 실행되지 않음
- 🟠 **미승인 제안서가 사실상 헌법** — v3 계획서는 "승인 대기"인데 product/structure/tech가 기준 문서로 인용
- 🟠 **범위 이탈** — SPEC 3건 + 이슈 2건이 지양 조항 위반
- 🟡 **stale 문서 다수** — `docs/architecture.md`가 아직 Vercel+Neon+Anthropic 서술

SPEC 75종 판정: ALIGNED 57 / ARCHIVE-TARGET 12 / SCOPE-VIOLATION 3 / AMBIGUOUS 3.

---

## 2. PR별 상세

### PR #522 — CHARTER v3 재작성 + 워크플로우 연동 (거버넌스 복구)

- `CHARTER.md`를 v1.0.0(RA 워크스테이션, 6~8명, 6 corpus) → **v2.0.0**(RA 게이트웨이, 30명, 3 git repo)로 전면 재작성
- **핵심**: `manager-spec.md` Step 1에 CHARTER 로드를 **실제로 연결**. `grep -rln "CHARTER" .claude/`가 **0 → 1 hit**. 이제 지양 5종 체크가 SPEC 작성 시 실제로 동작
- 감사에서 배운 규칙 삽입: "도메인 이름이 아닌 기능의 실질로 판단"(CAPA 우회 사례), "게이팅 없는 추천만 금지"(STRATEGY-001 선례)

### PR #523 — RAG 코퍼스 공백 복구 (핵심 가치 복구)

- **SPEC의 근본원인 진단이 틀렸음을 실행 중 발견**. "데이터 연결만 부재"가 아니라 `lib/ingest/embed.ts`의 PII 가드가 **URL을 PII로 간주**해 규제문서 136개 중 101개(URL 87 + email 14) 차단 → 코퍼스 74% 드롭. `syncStatus=synced`로 은폐(L-013류)
- 원인: URL 가드는 외부 API(GitHub Models) 임베딩 시절 방어책. #318이 gx10 온프레미스로 옮기며 obsolete + 치명적이 됨
- 수정: URL 패턴만 제거(email/SSN/phone/card 유지) + 재현 테스트(Rule 4)
- **실증(실DB·실임베딩·실검색)**: `source_sections 19 → 2187`, `sources 1 → 623`(승인 622). RAG 인용 실검색 PASS("FDA 510(k)" → 510k Summary DB, "EU MDR" → MDR AnnexII Template)
- M0~M4 전 구간 완료 (문서 정정 + REQ-KB-022 신설 + seed 스크립트 stale heuristic 제거)

### PR #524 — BLOCK-2 해소 마킹 (stale 문서 정정)

- `production-deployment-gap` BLOCK-2("executor 가짜 출력")는 **PR #417(2026-07-10)로 이미 실구현 완료**된 stale 문서
- 3개 executor 모두 실제 gx10 LLM 사용, `_mock` 런타임 0건, promptfoo eval 존재 — 검증 후 해소 마킹
- audit-response가 CAPA 생성기라는 범위 경고 추가

### PR #525 — audit-response CAPA 워크플로우 아카이브 (지양-3)

- audit-response executor = CAPA 생성기(`corrective_action_plan`, "21 CFR 820.100"). Charter 지양-3(CAPA=QMS) 위반
- **핵심 구분**: 워크플로우 executor(CAPA 생성)만 아카이브, 문서 분류 클래스(`DocClass.audit_response`, FDA 483 청커)는 보존 — Charter가 보존하는 "검색·분류 도메인"
- git mv로 lib+route+test 9파일 → `archive/qms-pms/`. registry(5→4), 타입 유니온, eval(6→4) 정리
- DB `workflowTypeEnum` `'audit_response'` 값은 유지(migration 참조, DROP 금지)
- 커버리지 부수효과: 잘 테스트된 executor 아카이브로 funcs 66.29→65.98 하락 → funcs floor 66→65 정정(문서화)

### PR #526 — #520 잔여 판정 (문서, 코드 변경 0)

| SPEC | 판정 | 근거 |
|---|---|---|
| AUDITOR-VIEW-001 (위반 3) | ✅ 범위 내 | 외부 감사관 read-only는 SaaS 외판이 아니라 21 CFR Part 11 감사 대응. CHARTER 지양-5에 좁은 예외 명시(read-only 강제+초대 범위+SSO 3조건). status Draft→Completed(실제 라이브였음) |
| BREADTH-001 (AMBIGUOUS) | ✅ ALIGNED | 8-view가 v3 앱에 살아 흡수됨 |
| TENANT-001 (AMBIGUOUS) | ✅ 범위 내 | 구현(부서 RBAC)은 범위 내, 제목만 오해 소지 → 정정 |
| REIMBURSEMENT-001 (AMBIGUOUS) | 🚫 범위 외 | 건강경제/급여(CPT/HCPCS), 미구현 draft → deferred-out-of-scope |

---

## 3. 이슈 현황

**등록**: #517(코퍼스) · #518(헌장 미연동) · #519(v3 승인상태) · #520(범위 이탈) · #521(PCCP 모순) + #40·#55 판정 코멘트

**close**: #520 (전 항목 처리 완료)

**주의 — 실질 해소됐으나 OPEN인 이슈**:
- **#517** — #523으로 코퍼스 실제 복구됨(623 sources 적재·검증). 그러나 이슈는 OPEN
- **#518** — #522로 헌장 연결됨(grep 0→1). 그러나 이슈는 OPEN

**미처리 OPEN**:
- **#519** — v3 계획서 "승인 대기" 문구 stale(Phase C/D 구현 완료). 상태란 정정 + 승인 기록 필요
- **#521** — product.md 내부 모순(PCCP "보존" vs 계획서 "아카이브"). 소유권 결정 필요

---

## 4. 핵심 발견 / 교훈

1. **stale 문서 패턴이 반복됨** — BLOCK-1(코퍼스), BLOCK-2(executor), AUDITOR-VIEW(Draft), v3(승인 대기) 모두 "문서는 미완/미승인이라 하는데 실제 코드는 완료·라이브". 문서 주장을 신뢰하지 말고 디스크·실DB로 검증(L-013).
2. **PII 가드의 근본원인** — #318 온프레미스 전환이 URL-as-PII 가드를 obsolete하게 만들었으나 가드는 남아 코퍼스를 막고 있었음. 마이그레이션의 숨은 부작용.
3. **도메인 이름 ≠ 기능 실질** — CAPA가 `WORKFLOWS-001`로 우회 재구현됨. 아카이브 판단은 이름이 아니라 기능으로.
4. **워크플로우 vs 문서분류 구분** — audit-response는 CAPA 생성(범위 밖)과 FDA 483 문서분류(범위 내)가 한 이름에 섞여 있었음. 정확히 분리.
5. **CI 게이트가 실수를 잡음** — pre-push가 놓친 테스트(#523 embed-guard, #525 registry count, coverage floor)를 반복적으로 포착. 게이트 우회하지 않고 원인 규명.

---

## 5. 검토자(오케스트레이터) 자체 정정 기록

투명성을 위해 세션 중 반증된 자체 오류를 기록:

1. "v3 실행이 시작되지 않았다" → 반증 (archive 진행 중, lib/domains 존재)
2. "product.md 완료 주장(#318 Ollama, #319 PHI)이 허위일 것" → 반증 (실제 이행 완료)
3. "SPEC-V3-* 8종이 하나도 없다" → 반증 (`ls | head -50` 잘린 출력을 전수로 오인 — 6종 실재)
4. "#517 완료조건에 #412/#413 선결" → 정정 (PUBLIC repo라 무관, SPEC EXCL로 명시적 제외)
5. "BLOCK-2 재구현 필요" → 정정 (#417로 이미 완료)

초기 프레이밍이 과도하게 비관적이었고, 실제 프로젝트 상태는 그보다 건강했다.

---

## 6. 현재 저장소 상태 (2026-07-18)

- 브랜치: `main` (원격 동기화, HEAD `62e371c`)
- stash: 없음 (`phase-A-partial-rollback-mess`는 백업 브랜치 `archive/phase-a-rollback-mess`로 보존 후 drop)
- 미커밋: 사용자의 무관한 로컬 변경 9개(effort/config)만 유지 — 이번 세션 작업과 무관
- 백업 브랜치 `archive/phase-a-rollback-mess`(로컬) — 아카이브 되돌리기 잔재 78파일 보존, 불필요 시 `git branch -D`로 제거 가능

---

## 7. 권고 후속 작업

1. **#517 / #518 close** — 각각 #523 / #522로 실질 해소됨. 확인 후 종결
2. **#519** — v3 계획서 상태란 정정 + 승인 기록 추가
3. **#521** — PCCP 소유권 결정(Regula 보존 vs hybrid-ra-saas 이관)
4. **`docs/architecture.md`** — v2 인프라 서술(Vercel/Neon/Anthropic) 전면 재작성 또는 superseded 표기 (신규 합류자 오도 위험)
5. **Phase A/B 재개 판단** — `lib/kernel`·`lib/bff`·`lib/infra` 미착수. 커버리지 축과 우선순위 결정

---

## 관련 문서

- 감사 보고서: `docs/purpose-alignment-audit-2026-07-16.md`
- 헌장: `.moai/specs/CHARTER.md` v2.0.0
- 코퍼스 SPEC: `.moai/specs/SPEC-REGULA-CORPUS-SEED-001/` (v1.2.0, completed)
- 배포 갭: `docs/proposals/production-deployment-gap-2026-07-10.md` (BLOCK-1/2 해소 반영)
