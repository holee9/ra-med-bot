# Session Memo

> 세션 연결용. 상세 맥락은 auto-memory `project-state.md`가 1차 진실원. 본 파일은 빠른 시작 요약.

## 현재 세션 (2026-06-27) — #158 후속 백엔드 7개(#149~#157) 전부 완료

사용자: `/moai ultracode "남은 작업 모두 완료까지 계속 가자"` → 진입 그룹 선택(AskUserQuestion: **#158 후속 백엔드 #149~#157**) → **7개 전부 완료**.

### ✅ 완료 — main HEAD `f1a5aa8` · OPEN PR 0건 · **#158 CLOSED**
| 이슈 | 결과 | PR / 비고 |
|---|---|---|
| #149 quality gate | closed (코드 0) | 2주 전 상태(243fcda) 오탐 정정, main 기준 게이트 green 직검 |
| #150 RBAC membership | closed (코드 0) | Next.js 15 Promise params + isProjectMember 이미 구현 |
| #151 redaction map | MERGED | PR #286 — saveRedactionMap 활성화 + Part 11 audit(mapPersisted) |
| #154 provenance + IDOR | MERGED | PR #287 — citation provenance + cross-org filter(RLS 허위 주석 정정) |
| #156 hybrid adapter | closed | AC4(hybrid error→integration-gap)를 #157로 통합, AC1/2/3/5 MET |
| #157 owning routing + #156 AC4 | MERGED | PR #288 — 4-way 결정적 router + link-back + integration-gap recorder + migration 0091 + token 분리 |
| #155 Gitea provider | MERGED | PR #289 — ingestion hardening + Gitea issue provider + lib/gitea/url-guard(internal host SSRF 정책) |

### ★ 핵심 패턴 (L-007 정신)
- 이슈 기준 커밋이 2주 전(243fcda) → **read-only 워크플로우(5에이전트 병렬)** 로 현재 main 잔존 상태 직검 → 대부분 "이미 60~95% 구현, 좁은 갭". #149/#150/#156은 코드 변경 없이 close.
- 매 PR 오케스트레이터 게이트 직견(typecheck/lint(biome+lint:hex)/test FULL/build skip L-012) + expert-security. #155는 **BLOCK-MERGE**(internal Gitea http SSRF reject) → fix(lib/gitea/url-guard internal host 허용) → 재리뷰 PASS.
- migration 0091 실DB 적용(L-010): **docker exec psql** 경로(host psl 없음, L-006 대안 성공).

### 회귀
- main 기준 **4638 passed | 21 skipped** (+111 vs 4527).
- 사전 존재 결함 2건(#283): audit-retention(파티션 guard) + evidence-synthesis(CER 매핑) — 환경 의존, 본 작업 무관.

### 🎯 다음 세션 시작 지점 (2026-06-27)
- **#158 CLOSED** — 페르소나 85% UI(#285) + 백엔드 후속(#286~#289) 전부 완료.
- **전략 Killer Features**(LLM 환각·인젝션 리스크 최대, 별도 세션 + 풀 리뷰): #40 STRATEGY · #42 CROSSMARKET · #43 BATCH.
- **기술부채**(회귀 낮음, 즉각 레버리지): #39 WORKFLOWS-LLM-002(510(k)/CER/PCCP executor 실구현).
- **시스템/외부**: #49 VALIDATION(IQ/OQ/PQ) · #202 hybrid E2E · #283(사전 존재 테스트 실패 2건).
- **follow-up**: #278(Standards 라이브 크롤러) · #275(messages backfill) · #264(RLHF) · #280(samd org_id text) · #284(viewer seed).

## 이전 세션 히스토리
- 2026-06-27 전반: #158 UI 개편 PR #285/#282 머지.
- 2026-06-26: #239 RLS Phase 1~4 + Knowledge/RAG #50/#51/#62. DB fix-up #279/#281.
- 2026-06-25: #269/#270/#266/#268. 2026-06-24~25: 7-PR 파이프라인. 2026-06-23: tier0 #35 · tier1 #59/#47.
