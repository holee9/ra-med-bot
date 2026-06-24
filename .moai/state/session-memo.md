# Session Memo

> 세션 연결용. 상세 작업 맥락은 auto-memory `project-state.md`(~/.claude/projects/.../memory/)가 1차 진실원 — 항상 로드됨. 본 파일은 빠른 시작 요약.

## 현재 세션 (2026-06-24) — tier1 CHANGE-CONTROL-001 #54 main 머지 완료

**main 머지 완료** (squash `4bb1478`, PR #248 MERGED, #54 CLOSED). feat/issue-54 브랜치 정리(원격·로컬) 완료. main 클린.

### 무엇을 했나
1. **Phase 1 분석** (manager-strategy + tasks.md): SPEC 12 REQ 매핑, migration 0071 설계. **★베이스라인 카운트 직검 정정** — manager-strategy 보고(wf_type 12·audit 107·권한 43)가 실제(13·127·44)와 불일치 → 오케스트레이터 grep/파싱으로 정정(L-007).
2. **Phase 2 백엔드** (regula-backend, TDD): migration 0071(workflow_type +1, audit_action +6, 테이블 4 + RLS) + lib/change-control 8모듈(classify/engine/jurisdictions/verdict/version-metadata/risk-linkage/types/api-client) + API 4종(run/[id]/review/export).
3. **Phase 3 프론트엔드** (regula-frontend): app/(app)/change-control(입력 폼 + verdict view + provisional 배지 + expert review + PDF export) + components/change-control + Sidebar 조건부 네비. WCAG 2.1 AA, i18n ko/en. (biome a11y 11 에러 직검 포착 → output 요소/Fragment로 해결.)
4. **sync 0.55 병렬 리뷰**: expert-security **머지차단 결함 6건** 포착(C-1 IDOR / H-1 stub 무력화 / H-2 인젝션 / H-3 audit tx / H-4 action 왜곡 / M-1 risk org) + evaluator PASS-WITH-CONDITIONS(AC-05 PDF MVP). 보안 결함 직접 코드 검증 후 fix.
5. **fix** (regula-backend): C-1 assertPmsProjectAccess / H-1 createHybridRaFetch 실제 LLM wiring / H-2 <change_description>+UNTRUSTED DATA / H-3 catch audit tx / H-4 change.export_blocked 신규 audit / M-1 risk-linkage workflow_runs join + route-level 통합테스트 20개.
6. **게이트 직검(L-007)**: typecheck 0 · biome 0 · test **3571 passed** | 7 skipped · build 0. CI 전체 pass(CI Gates·Dep Scan·E2E Smoke·LLM Eval·Playwright 3종·gitleaks).
7. **PR #248** → squash merge `4bb1478` → #54 CLOSED.

### 상태
- main HEAD: `4bb1478`. 오픈 PR 0건.
- 회귀: workflow_type 13→14 · audit_action 127→133 · PermissionAction 44→47 · migration 0071.
- AC: AC-01~04·06~08 ✅ · AC-05 PDF export MVP(canonical JSON) → **#247** follow-up.
- Follow-up 이슈: **#247**(CHANGE-CONTROL PDF 실제 바이트) · PMS #243/#244/#245.

## 🎯 다음 세션 시작 지점

### 다음 tier1 착수 (READY)
1. **LABELING #66**(priority/high) — TRACEABILITY + CHANGE-CONTROL 해금.
2. **CAPA #68**(priority/high) — CHANGE-CONTROL 해금.
3. PMS follow-up: #243(AC-04, 외부 블로커 hybrid-ra-saas) · #244(PMCF Eval UI) · #245(E2E).
4. CHANGE-CONTROL follow-up: #247(PDF 실제 바이트).

### tier1 착수 절차 (L-001 + L-007 + 본 세션 패턴)
- main 기반 `feat/issue-{N}` → 이슈 코멘트 "작업 시작" → manager-strategy 분석(신규 SPEC은 tasks.md 선행).
- **★베이스라인 카운트(wf_type/audit/권한/migration 번호)는 오케스트레이터가 직접 grep/파싱으로 확인 — 에이전트 보고 신뢰 금지(L-007, 본 세션에서 manager-strategy 카운트 3개 전부 틀림).**
- phase별 구현(regula-backend/frontend) + **매 phase 게이트 직검**.
- ★**`/moai sync` Phase 0.55 expert-security + evaluator-active 병렬 리뷰 필수** — 4세션 연속(tier0 replay → tier1 환각·인젝션 → tier1-trace IDOR·audit tx → tier1-change 6건) 보안 리뷰가 머지 차단 결함 포착.
- **route-level 통합 테스트(anti-mock) 필수** — engine 단위 테스트만으로는 라우트 보안 결함(IDOR, 게이트 우회) 검증 불가.
- `Fixes #{N}` PR.

### hybrid-ra-saas 연동 — 사실상 완료 (T3610 로컬 실제 프로덕션)
- 실제 프로덕션 = T3610 로컬 Next.js + Cloudflare Tunnel (`regula.abyz-lab.work`). GitHub Actions Vercel/CF 잡은 secrets 미설정으로 스킵(정상).
- CHANGE-CONTROL `createHybridRaFetch` wiring: `HYBRID_RA_*` env `.env.local`(T3610) SET 시 실제 LLM 평가 활성, 미설정 시 stub fallback.

## 이전 세션 히스토리 (상세는 git log + project-state.md)
- 2026-06-24: tier1 CHANGE-CONTROL #54 main 머지.
- 2026-06-23: tier0 KNOWLEDGE-GAP #35 · tier1 CLASSIFY #59 · tier1 TRACEABILITY #47 · tier1 PMS #53 main 머지. 26개 SPEC 배치.
- 2026-06-22: 26개 SPEC-REGULA 일괄 작성.
