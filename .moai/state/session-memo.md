# Session Memo

## 현재 세션 (2026-06-21) — 백엔드 Tech debt 3종 일괄 + 리뷰 픽스

**베이스: `origin/main` (`4f17b51`)**. 3 PR 모두 main에서 독립 분기 (서로 다른 파일 영역, 충돌 없음). 모두 리뷰 대기 중.

### PR #220 — #214 이메일 디스패처 SendGrid 연동 (priority/medium)
- 브랜치: `fix/issue-214-email-sendgrid` (HEAD `c6ab7ef`)
- `lib/notifications/dispatcher.ts`: RESEND stub → SendGrid v3 REST API (fetch 기반, fire-and-forget). **리뷰 픽스**: SENDGRID_API_KEY 미설정 시 'error'가 아닌 'skipped' 반환 (radar/email.ts 일관성)
- `lib/radar/notifier-channels/email.ts`: placeholder 주소 → `orgDigestPreferences.recipientEmails` DB 조회 (lazy import로 env side-effect 회피)
- 테스트 11개 (lib/notifications + lib/radar)
- 검증: typecheck·biome·audit:check PASS

### PR #221 — #215 문서 렌더링 실구현 (priority/high)
- 브랜치: `fix/issue-215-document-rendering` (HEAD `a8de60e`)
- `lib/pccp/exporters/pdf.tsx`: react-pdf 실구현 (placeholder 제거, DRAFT watermark, content_jsonb 구조화)
- `lib/pccp/exporters/docx.ts`: docx lib 실구현 (TITLE/HEADING_1/key-value)
- `lib/pccp/exporters/content-flatten.ts`: **리뷰 DRY 픽스** — flattenContent 공유 유틸 추출 (pdf/docx 중복 제거)
- `lib/pccp/types.ts`: PccpComponentRecord 추가
- `app/api/ra/workflows/pccp/[id]/export/route.ts`: DB 행 → PccpComponentRecord 매핑 (잘못된 cast 수정)
- Export-Hub pdf-exporter stale TODO 정리
- 테스트 8개 (PDF/DOCX magic bytes 검증)

### PR #222 — #216 Inngest 클라이언트 wiring (priority/high)
- 브랜치: `fix/issue-216-inngest-wiring`
- `inngest@^4.7.0` 의존성 추가
- `lib/inngest/client.ts` (싱글톤, id=regula) + `lib/inngest/functions.ts` (레지스트리) + `app/api/inngest/route.ts` (serve endpoint GET/POST/PUT)
- `lib/inngest/digest/weekly-digest.ts`: cron(매주 월 00:00 UTC) + event 트리거 실등록, per-org step.run
- `lib/inngest/docingest/upload-processed.ts`: 6단계 파이프라인 step.run 래핑. **파이프라인 모듈 dynamic import 전환** (openai 미설치 잠재 버그 회피)
- 테스트 6개

### 공통 검증
- 각 PR typecheck·biome·audit:check PASS, 전체 회귀 0 failed
- 신규 테스트 25개 (+11, +8, +6)

### 후속 (별도 이슈 권장)
- upload-processed helper stubs (`insertChunks`, `updateDocumentStatus`) 실구현 — DOCINGEST Phase 3
- CER PDF rich-layout (현재 minimal이지만 valid PDF)
- 수동 트리거 API → `inngest.send()` 연결
- Inngest dev server 로컬 구동 검증

### 기술 결정 근거 (모두 코드베이스 기반)
- #214 SendGrid: RADAR digest·digest/email-sender가 이미 SendGrid 사용 (프로젝트 표준)
- #215 react-pdf + docx: 둘 다 이미 package.json 의존성
- #216 Inngest SDK: 5개 stub이 이미 Inngest API shape로 작성됨

## 다음 세션 시작 지점
1. PR #220/#221/#222 리뷰 피드백 반영 (있을 경우)
2. 3 PR 머지 후 main 기준 implementation-status.md 최종 동기화
3. 후속 이슈(#39 워크플로우 LLM 실구현 등) 착수 여부 결정

## 이전 세션 히스토리 (참고용)

- 2026-06-21 QA Gate 0~5 SPEC 패밀리 Active 통일 완료 (PR #217, #218)
- 2026-06-21 ESIG #88 (PR #204), AUDITOR-VIEW #92 (PR #206) 머지 완료
- 2026-06-21 PERSONAL-LIB #86 (PR #208), CALENDAR #44 (PR #209) 머지 완료
- Branch: `feat/issue-92`
- PR: #206 `feat(audit): 외부 감사관 읽기 전용 페르소나 및 1-클릭 감사 패키지 (Issue #92)`
- Issue: #92; duplicate-work prevention checked via Issue #18.
- Main checked: `origin/main` fetched before review-fix work; only open PR is #206.
- Review fix scope: allow auditor `POST /api/ra/audit-package` through `withPermission`, add persisted `auditor` `user_role`, and ship `audit.access` / `audit.denied` / `audit.package.generated` enum migration.
- Local verification: targeted auditor tests PASS, `pnpm typecheck` PASS, `pnpm lint` PASS, `pnpm ci:migrations` PASS, `pnpm audit:check` PASS, full `pnpm test` PASS (2854 passed / 7 skipped).

## Active Work — 2026-06-21 QA 메타 루프 마무리 + 프로덕션 감사

### 병합된 작업 (main)
- **PR #212** — Gate 1~5 SPEC(#75-79) Draft→Active 승격 + 문서 동기화. Closes #75~#79.

### 진행 중 (오픈 PR)
- **PR #217** `fix/issue-213-gate5-ssot` — Gate 5 SSoT 범위 정합 13→9건 (#213). MERGEABLE.
- **PR #218** `fix/issue-74-gate0-spec` — Gate 0 SPEC Draft→Active (#74). MERGEABLE. **Gate 0~5 패밀리 전체 Active 통일 완료.**

### 프로덕션 준비도 감사로 신규 등록된 gap 이슈
- **#214** 이메일 디스패처 stub (Resend/SendGrid 미연동) — 착수 전 결정: provider 통합(Resend vs SendGrid), API key 프로비저닝 필요
- **#215** 문서 렌더링 placeholder (PCCP/CER/Export-Hub PDF·DOCX) — 착수 전 결정: 렌더링 엔진(react-pdf vs Puppeteer vs docx lib)
- **#216** Inngest 백그라운드 잡 인프라 unwired — 착수 전 결정: Inngest vs Cloudflare Cron(#9 정합) vs QStash
- 기존 추적: #35 (gap-replay stub), #39 (워크플로우 LLM synthetic) — OPEN

### 다음 세션 시작 지점
1. PR #217, #218 병합 → QA Gate 프레임워크 100% 완결
2. #214 이메일: provider 결정 + API key 확보 후 착수 (digest email-sender가 SendGrid 사용 중 → 통합 권장)
3. Tier 2(#215/#216)는 기술 결정 후 착수. Tier 3(#39)는 /moai plan 선후.

## ✅ 완료 — 2026-06-21 QA 메타 루프 완결 (Tier 1)

**main HEAD: `4f17b51`** (모든 CI PASS, 열린 PR 0건, main only)

- ✅ **PR #217** Gate 5 SSoT 정합 #213 — squash merge (`6e117f2`). #213 CLOSED.
  - 리뷰(manager-quality) HIGH fix: qa-matrix §Gate Assignment Summary per-row 정합 (Gate 2: 38→34, Gate 5: 11→9), drift 방지 노트 추가
- ✅ **PR #218** Gate 0 SPEC 승격 #74 — squash merge (`4f17b51`). #74 CLOSED.
  - 리뷰(manager-quality) PASS (LOW fix: AC #6 impact axis SSoT 9축 정합)
  - sync: implementation-status.md "Gate 0-5 SPEC promotion" 행 확장

### 결과: Gate 0~5 SPEC 패밀리 6개 전부 Active 통일 완료
- SPEC-REGULA-QA-{SPEC-READINESS, IMPLEMENTATION-CHECKPOINT, PR-ACCEPTANCE, WAVE-INTEGRATION, DOMAIN-UAT, OPERATIONS}-001 → 모두 Active

### 다음 세션 시작 지점 (Tier 1 잔여 → Tier 2)
1. **#214 이메일 연동** — provider 결정(Resend vs SendGrid, SendGrid 권장) + API key 프로비저닝 후 착수
2. **#215 문서 렌더링** — 엔진 결정(react-pdf vs Puppeteer vs docx lib) 후 착수
3. **#216 Inngest infra** — 잡 인프라 결정(Inngest vs Cloudflare Cron vs QStash) 후 착수
4. **#39 워크플로우 LLM** — /moai plan 으로 SPEC-REGULA-WORKFLOWS-LLM-002 구현 계획 수립 후 착수 (CRITICAL, 대규모)
