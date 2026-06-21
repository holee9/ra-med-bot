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
