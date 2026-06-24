# Session Memo

> 세션 연결용. 상세 작업 맥락은 auto-memory `project-state.md`(~/.claude/projects/.../memory/)가 1차 진실원 — 항상 로드됨. 본 파일은 빠른 시작 요약.

## 현재 세션 (2026-06-24) — follow-up 3종 순차 진행 중 (#251 ✅ → #247 → #243)

**main HEAD: `3e8d6c3`** (#247 머지 후). 오픈 PR 0건. main 클린.

### ✅ #251 CAPA 보안 정리 — MERGED PR #253 (`6bc9dc6`, #251 CLOSED)
- 코드 직검(L-007): C-1/H-1/H-2/H-3/M-1/M-2/M-3 은 **이미 fix됨** 확인 (보고만 잔존).
- 잔존 2종 fix: **M-4** `dispatchEffectivenessReminders` 실제 발송 wiring (notifications/dispatcher + digest 패턴, SENDGRID 미설정 시 no-op, never-throws 보존, `dispatched` 정직 카운트) + **route-level runtime IDOR 테스트 신규** (`capa-idor-runtime.test.ts` 10건, pms-idor-runtime 미러링 — TRACEABILITY H1 결함 클래스 폐쇄).
- 게이트 직검: typecheck 0 · biome clean · 타깃 70/70 · build 0 · **전체 3733 passed** (baseline 3721 +12, 회귀 0).
- sync Phase 0.55 expert-security: **PASS-WITH-CONDITIONS** (CRITICAL/HIGH 0, LOW 3 비차단 — reportability 403 런타임 미포함·mock-the-leaf·seed UUID).
- CI 전체 pass (CI Gates·Dep Scan·E2E Smoke·LLM Eval·Playwright 3·gitleaks·vercel-preview).

### ✅ #247 CC PDF 실바이트 — MERGED PR #254 (`3e8d6c3`, #247 CLOSED)
- `lib/change-control/exporters/pdf.tsx` 신규 (`@react-pdf/renderer`, PCCP 패턴) + export 라우트 `format=pdf` 바이트 스트림 (pdf-json 보존) + filename 2중 살균 + magic-bytes 테스트.
- 게이트 직검: typecheck 0 · biome clean · 타깃 32/32 · build 0 · **전체 3745 passed** (baseline 3733 +12, 회귀 0).
- sync Phase 0.55 expert-security: **PASS-WITH-CONDITIONS** (CRITICAL/HIGH 0). MEDIUM-1(filename 보안 코멘트 사실 오류 — changeType이 `text` 컬럼이므로 정규치환+sanitizeFilename이 유일 방어벽임 명시) 본 PR 정정. 비차단: format=pdf 런라운 게이트 테스트(소스레벨 커버)/console.error 원시 에러/입력 길이 cap.

### 🎯 다음: #243 (PMS CER 로컬 영속화)

### 무엇을 했나 (3 SPEC 동일 /moai run 사이클)
1. **CHANGE-CONTROL #54** (PR #248, `4bb1478`): manager-strategy 분석 → 백엔드(0071) + 프론트 → expert-security **머지차단 6건 fix**(C-1 IDOR/H-1 LLM wiring/H-2 인젝션/H-3 audit tx/H-4 export_blocked/M-1 risk org).
2. **LABELING #66** (PR #250, `27bb163`): 백엔드(0072) + 프론트 → expert-security **CRITICAL/HIGH 없음**(CC 결함 클래스 재발 없음) + evaluator AC-06 데드코드 fix(approve 라우트 live 호출).
3. **CAPA #68** (PR #252, `a941cb0`): 백엔드(0073) + 프론트 + Inngest → expert-security **머지차단 5건 fix**(C-1 vigilance org 스코프/H-1 ESIG binding/H-2 audit tx/H-3 createdBy/evaluator linkage). 재사용 #61/#54/#46/#64/#53/ESIG.
4. **게이트 직검(L-007)**: CC 3571 / LABELING 3652 / CAPA 3721 passed · build 0 · CI 전체 pass(3 SPEC 모두).

### 상태
- main HEAD: `a941cb0`. 오픈 PR 0건.
- 회귀(누적): workflow_type 13→16 · audit_action 127→146 · PermissionAction 44→58 · migration 0073.
- AC: CC AC-01~08(05→#247) · LABELING AC-01~06·08(07→#249) · CAPA AC-01~04·06~08(05→#57).
- Follow-up: **#247**(CC PDF) · **#249**(LABELING eSubmit) · **#57**(CAPA QMS) · **#251**(CAPA 보안 트래킹) · PMS #243/#244/#245.

## 🎯 다음 세션 시작 지점

### 다음 착수 후보 (READY)
1. 미구현 high SPEC: CLINICAL-INVESTIGATION #69 · CYBERDEVICE #67 · MODEL-GOVERNANCE #71 · CORPUS-LICENSE #72.
2. PMS follow-up: #243(외부 블로커 hybrid-ra-saas) · #244(PMCF Eval UI) · #245(E2E).
3. follow-up: #247(CC PDF) · #249(LABELING eSubmit) · #57(QMS) · #251(CAPA 보안).

### tier1 착수 절차 (L-001 + L-007 + 본 세션 3-SPEC 패턴)
- main 기반 `feat/issue-{N}` → 이슈 코멘트 → manager-strategy 분석(tasks.md 선행).
- **★베이스라인 카운트 직검**(wf_type/audit/권한/migration) — manager-strategy 보고가 본 세션에서 매번 틀림(CC: 12/107/43 실제 13/127/44; CAPA: audit 166 실제 146). 오케스트레이터 grep/파싱 필수.
- phase별 구현 + 매 phase 게이트 직검.
- ★**sync Phase 0.55 expert-security + evaluator-active 병렬 리뷰 필수** — 본 세션 3 SPEC 모두 결함 포착(CC 6건/LABELING 데드코드/CAPA 5건). 특히 **audit tx 비원자성 결함 클래스 반복** + **교차 SPEC org_id 누락**(vigilance 테이블).
- **route-level anti-mock 테스트** + 데드코드 live 호출 검증(evaluator가 AC 형식적 충족 잡음).
- `Fixes #{N}` PR → CI watch → squash merge.

### 핵심 교훈 (본 세션 3 SPEC)
- **L-007**: 베이스라인 카운트·게이트·결함 보고 전부 오케스트레이터 직검 — 에이전트 보고 신뢰 금지.
- **교차 SPEC org_id**: org_id 없는 테이블(vigilance/adverse_events) 재사용 시 테넌트 격리 사전 확인 — workflow_runs 체인 또는 org_id 추가.
- **audit 트랜잭션**: writeAudit 항상 mutation과 동일 tx(Part 11). 3회 반복 결함 클래스.

### hybrid-ra-saas 연동 — 사실상 완료 (T3610 로컬 실제 프로덕션)
- 실제 프로덕션 = T3610 로컬 Next.js + Cloudflare Tunnel (`regula.abyz-lab.work`). GitHub Actions Vercel/CF 잡은 secrets 미설정으로 스킵(정상).

## 이전 세션 히스토리 (상세는 git log + project-state.md)
- 2026-06-24: tier1 CHANGE-CONTROL #54 + LABELING #66 + CAPA #68 main 머지 (3 SPEC).
- 2026-06-24(이전): PMS #53.
- 2026-06-23: tier0 KNOWLEDGE-GAP #35 · tier1 CLASSIFY #59 · TRACEABILITY #47 main 머지. 26개 SPEC 배치.
