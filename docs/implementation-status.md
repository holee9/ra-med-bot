# Regula Implementation Status

Reviewed: 2026-06-23 KST (post-PR #234 documentation sync)
Implementation review baseline commit: `4f17b51` (`main` after PR #218 / Issue #74 Gate 0 SPEC promotion merge)

This document includes the 2026-06-18 PR cleanup after PR #184 merge,
PR #177 superseded closure, the completed Predicate Visualization addendum
for Issue #185 / PR #186, E2E validation MRD completion for Issue #182,
the Issue #188 hybrid-ra-saas inbound webhook hardening pass,
the Issue #156 hybrid-ra-saas outbound typed adapter merge,
the 2026-06-20 security/quality fixes (#162 RBAC, #164 Predicate E2E, #152 workflow mock audit, #163 onboarding E2E seed),
the Issue #46 / PR #195 ISO 14971 Risk Management integration plus the follow-up `8065cc8` CI restoration commit, PR #204 / Issue #88 21 CFR Part 11 electronic signatures, PR #205 ESIG Part 11 signature workflow documentation, PR #206 / Issue #92 external auditor read-only view with 1-click audit package, PR #208 / Issue #86 personal RA library, PR #209 / Issue #44 regulatory calendar, PR #211 / Issue #45 corpus delta sync, the QA Gate 0-5 documentation/SPEC sync through PR #218, and PR #234 / Issue #35 Knowledge Gap Loop. This review also covers PR #196, PR #197, the #166 hydration mismatch fixes, and the QA Gate/Wave 5 SPEC documentation commits now present on `main`.

## Executive State

PR #184 was merged to main after CI recovery. The merged state includes the
E2E user validation framework and Traceability integration surface. PR #177 was
closed as superseded because its substantive Traceability changes were already
present on main and the branch was stale/conflicting.

PR #186 (Predicate Visualization) was completed and merged to main, adding
interactive chart-first view for Predicate comparison results with Bar/Radar/Table
modes, Before-After comparison, and demo animation capabilities.

Issue #182 E2E validation framework is complete with Smoke Test 8/8 specs passing
and comprehensive MRD documentation at `docs/e2e-validation-mrd.md`.

CI Gates, Playwright chromium/firefox/webkit, LLM Eval Harness, E2E Smoke,
Vercel preview, and Security Scan all passed for PR #184 before merge.

Issue #188 is closed. The final review pass hardened the inbound webhook
boundary by returning 400 for malformed JSON, comparing SHA-256 digests via
`crypto.timingSafeEqual`, removing production no-op logging, and adding focused
unit coverage for webhook error handling and timing-safe comparison behavior.

Issue #156 is complete via PR #192. Regula now has a server-only typed adapter
for outbound hybrid-ra-saas calls with endpoint-specific request/response
types, Bearer + tenant header injection, 30 second timeout handling, and
classified `HybridRaClientError.kind` values for unconfigured, auth, schema,
server, timeout, and network failures.

Issue #46 is complete via PR #195. Regula now includes an ISO 14971 Risk
Management workflow with hazard identification, severity/probability risk
matrix, control hierarchy, residual risk evaluation, GSPR mapping, DOCX export,
and RA-lead approval gate. The follow-up commit `8065cc8` restored the build,
lint, unit, E2E, security, and deploy gates on `main`.

The 2026-06-20 implementation review found one post-merge regression on the
latest `main`: the #166 hydration mismatch follow-up added correct
`suppressHydrationWarning` boundaries, but three files were not formatted by
Biome, causing the `CI Gates` lint/format path to fail. The review fix formats
those files and refreshes the current verification evidence.

The 2026-06-21 review of PR #204 found and fixed two signature-specific security regressions before merge: signature endpoints now authorize the requested `messageId` through the caller's conversation/project scope before signing, manifestation lookup, or revocation; `qa-lead` no longer inherits every `ra-lead` permission and is instead allowlisted only for `signature.sign`.

Issue #92 is complete via PR #206. Regula now ships a read-only `auditor`
persona plus a 1-click audit package builder. The read-only guarantee is
enforced centrally inside `withPermission` (all write methods return 403 with
an `audit.denied` record), the audit package is assembled as an in-memory ZIP
with a SHA-256 per-file manifest, and a watermark component marks every screen
during an auditor session.

After PR #206, main continued through the Wave 5 and QA meta loop: PR #208
merged the personal RA library, PR #209 merged the regulatory calendar, PR #211
merged corpus delta sync, PR #212 promoted Gate 1-5 SPECs from Draft to Active,
PR #217 reconciled the Gate 5 SSoT scope from 13 to 9 tracked items, and PR
#218 promoted the Gate 0 SPEC. As of commit `4f17b51`, all Gate 0-5 SPECs are
Active and the README dashboard, changelog, QA matrix, and gate definitions use
that post-PR #218 main baseline.

PR #234 (Issue #35) is now OPEN on branch `feat/issue-35-knowledge-gap` and
stacked on PR #233. The Knowledge Gap Loop is fully implemented with 4-condition
detection, clustering, GitHub auto-issue, RA classification UI, daily digest,
and closed-loop replay verification. Awaiting security review and merge.

## Verified Repository State (2026-06-23)

| Area | State | Evidence |
|---|---|---|
| Active branch | `feat/issue-35-knowledge-gap` | PR #234 pending merge |
| Completed PRs/issues | #184, #186, #188, #192/#156, #190/#182, #193/#162, #194, #195/#46, #196, #197, #204/#88, #205, #206/#92, #208/#86, #209/#44, #210/#73, #211/#45, #212/#75-#79, #217/#213, #218/#74, #166, #234/#35 | #234 open, others merged/closed |
| E2E Validation | COMPLETE | Go/No-Go spec, Smoke Test 8/8 specs, MRD complete |
| Traceability Integration | COMPLETE | BFF routes, UI, RBAC all implemented |
| Webhook Integration | COMPLETE | `/api/webhooks/audit`, `ifu`, `knowledge-sync` hardened |
| hybrid-ra-saas typed adapter | COMPLETE | `createHybridRaClient()` covers 7 upstream endpoint contracts |
| hybrid-ra-saas 운영 배포 상태 | ✅ 정상 | 코드 구현 완료 · 백엔드 Azure Container Apps 배포 · 실제 프로덕션(T3610 로컬+CF Tunnel) `.env.local`에 `HYBRID_RA_*` 3개 SET → hybrid 활성. GitHub Actions Vercel/CF 배포는 Secrets 미설정으로 스킵 중(별개 이슈). 남은: #202 E2E. |
| ISO 14971 Risk Management | COMPLETE | `/workflows/risk`, `/api/ra/risk/*`, `lib/risk/*`, risk DB tables, RA-lead approval |
| 21 CFR Part 11 Electronic Signature | COMPLETE | `/api/ra/messages/[messageId]/signature`, `answer_signatures`, answer lock, §11.50/§11.70 linkage |
| External Auditor Read-Only View | COMPLETE | `auditor` role, central write-block, `/api/ra/audit-log`, `/api/ra/audit-package` ZIP + SHA-256 manifest |
| Personal RA Library (#86) | COMPLETE | bookmarks, tags, notes, search, `personal_bookmarks`, `personal.view` |
| Regulatory Calendar (#44) | COMPLETE | deadlines table, calendar view, deadline API, deadline permissions |
| Corpus delta sync (#45) | COMPLETE | Radar delta sync, retrying upsert, `source_sections` and `corpus_sync_runs` persistence |
| Submission drafter contract (#196) | COMPLETE | build env bypass path, `workflow_runs` status contract, source health-check import fixed |
| Hydration mismatch (#166) | COMPLETE | date render boundaries plus 2026-06-20 Biome format recovery |
| QA Gate 0 helper (#74) | COMPLETE | `scripts/qa-gate-0-checklist.ts`, shared checklist template, ignored generated outputs |
| QA Gate 0–5 SPEC promotion (#74–#79) | COMPLETE | All 6 gate SPECs promoted Draft → Active with expanded EARS REQs, Application Scope, Evidence Artifacts, SSoT Alignment sections (PR #212 Gate 1–5, PR #218 Gate 0); `docs/qa/qa-gate-definitions.md` Owner SPEC markers synced from `(planned)` to actual status |
| RBAC security (#162) | COMPLETE | ra-lead → /403 redirect E2E validated (PR #193) |
| Predicate E2E stability (#164) | COMPLETE | hydration + RBAC locator fixed (in PR #190) |
| Mock workflow audit (#152) | COMPLETE | mock_data, workflow_run_id metadata connected (in PR #190) |
| Onboarding E2E seed (#163) | COMPLETE | globalSetup.ts bootstrapProjects + empty-state CTA in Sidebar |
| Knowledge Gap Loop (#35) | COMPLETE (PR #234 pending merge) | 4-condition detection, clustering, GitHub auto-issue, classify UI, daily digest, gap-replay closed loop |
| **Change Control (#54)** | **COMPLETE** (2026-06-24) | 설계 변경 규제 영향 자동 평가기 — migration 0071(workflow_type +1, audit_action +6, 테이블 4 + RLS), lib/change-control 8모듈(types/classify/engine/jurisdictions/verdict/version-metadata/risk-linkage), API 4종(run/[id]/review/export), UI(app/(app)/change-control), 권한 change.assess/view/export. **결정 근거**: createHybridRaFetch 실구현(H-1), CLASSIFY/PMS 패턴 재사용(jurisdictions verdict 로직). **보안 fix**: C-1 IDOR(assertPmsProjectAccess) · H-1 실제 LLM wiring(REQ-006 reject live) · H-2 프롬프트 인젝션(<change_description>+UNTRUSTED DATA) · H-3 catch audit tx · H-4 change.export_blocked audit · M-1 risk-linkage org 검증. **게이트**: 3571 passed | 7 skipped · build 0. **AC 완료**: AC-01~04·06~08 ✅ · AC-05 ⏸️ DEFERRED(JSON shape만, 실제 PDF → #247) |
| Work gate | #18 active | mandatory before new P0 work |

## SPEC-REGULA-CAPA-001 (#68) — 불만·CAPA 폐루프 관리

**Status**: 구현 완료 (2026-06-24, feat/issue-68 브랜치)

### Summary

Regula가 불만 접수부터 CAPA 완료, 효과성 확인, DHF/Risk/PMS 반영까지 하나의 추적 가능한 워크플로우로 관리합니다. complaint intake 구조화 폼, reportability assessment(#61 Vigilance 연결), root cause analysis(5 Whys, Fishbone), corrective/preventive action 분리 관리, CAPA owner·due date·effectiveness check 관리, 반복 불만 trend detection(#53 PMS 연결)이 통합되었습니다.

### What's Implemented

**Phase 0: 기반 (DB + 권한 + 열거형)**
- `migrations/0073_capa.sql`: workflow_type enum +1(`complaint_intake`, 15→16), audit_action enum +7(139→146), 테이블 5개(complaints/capa_records/capa_root_causes/capa_links/capa_effectiveness_checks) + RLS
- `lib/auth/permissions.ts`: 권한 3종 추가(capa.*, capa.close, capa.qms_sync — ra-lead 전용)

**Phase 1: CAPA 코어 모듈 (lib/capa/ 10모듈)**
- `intake.ts`: complaint 구조화 접수
- `reportability.ts`: reportability assessment + Vigilance 연결(#61 재사용)
- `root-cause.ts`: 5 Whys / Fishbone RCA 작성 지원
- `records.ts`: CAPA 레코드 관리(corrective/preventive 분리)
- `effectiveness.ts`: effectiveness check 스케줄링(Inngest cron, REQ-006 재사용)
- `trend-detector.ts`: 반복 불만 trend detection → PMS 연결(#53 pms_inputs 재사용)
- `linkage.ts`: #46 Risk, #54 Change Control, #64 DHF 자동 연결(REQ-008 linkage 패턴 재사용)
- `close-gate.ts`: reportability·링크 검증 후 전자서명(ESIG computeAnswerHash 재사용, REQ-010)
- `qms-sync.ts`: QMS 양방향 동기화(REQ-009 stub, AC-05 DEFERRED)
- `audit.ts`: audit_logs 기록(모든 단계)

**Phase 2: API 7종**
- `POST /api/capa/complaints` — complaint intake
- `POST /api/capa/complaints/[id]/reportability` — assessment + Vigilance 연결
- `POST /api/capa/records` — CAPA 생성 (corrective/preventive)
- `POST /api/capa/records/[id]/root-cause` — RCA 작성
- `POST /api/capa/records/[id]/effectiveness` — effectiveness check
- `POST /api/capa/records/[id]/close` — reportability·링크 검증 후 전자서명
- `GET/POST /api/capa/qms-sync` — QMS 양방향 동기화

**Phase 3: UI 워크벤치**
- `app/(app)/capa/page.tsx`: CAPA 폐루프 워크벤치(intake 폼 + CAPA 목록 + RCA 작성 + effectiveness check + close 게이트)

**Phase 4: 보안 강화 (expert-security 리뷰)**
- **C-1 (CRITICAL → RESOLVED)**: vigilance/adverse_events org 스코프 수정 — workflowRunId 기반 anchor 추가, 타 org 접근 차단
- **H-1 (HIGH → RESOLVED)**: ESIG 서명자 해시 binding — §11.70 서명자 userId 강제 binding
- **H-2 (HIGH → RESOLVED)**: 7 라우트 audit tx 래핑 — db.transaction()으로 상태 전이와 audit log 기록 원자성 보장
- **H-3 (MEDIUM → RESOLVED)**: createdBy userId 검증 — CAPA 생성자 검증 로직 추가
- **evaluator linkage 검증**: getCapaLinkCount count(*) 추가, linkage pms/risk 검증 로직 강화

### Environment Variables (Optional)

```bash
# CAPA (#68) — 별도 env 변수 없음. 기존 DB/AI/Inngest/ESIG 설정 공유.
```

### Verification Results

```bash
corepack pnpm typecheck              # PASS: 0 에러
corepack pnpm exec biome check .     # PASS: 0 에러
corepack pnpm run lint:hex           # PASS: 0 에러
corepack pnpm test                   # PASS: 3721 passed | 7 skipped | 0 failed
corepack pnpm build                  # PASS
```

Integration test coverage: AC-01(complaint→reportability→CAPA), AC-02(effectiveness 알림), AC-03(linkage 누락 0건), AC-04(전자서명 100%), AC-05(QMS stub DEFERRED), AC-06(trend→PMS), AC-07(reportable 미연결 close 차단), AC-08(권한 거부).

### Security Hardening (run 단계 expert-security + evaluator-active)

**C-1 (CRITICAL → RESOLVED)**: vigilance/adverse_events org 스코프 수정 — workflowRunId 기반 anchor 추가, 타 org 접근 차단(IDOR 방지).

**H-1 (HIGH → RESOLVED)**: ESIG 서명자 해시 binding — §11.70 서명자 userId 강제 binding(21 CFR Part 11 준수).

**H-2 (HIGH → RESOLVED)**: 7 라우트 audit tx 래핑 — db.transaction()으로 상태 전이와 audit log 기록 원자성 보장.

**H-3 (MEDIUM → RESOLVED)**: createdBy userId 검증 — CAPA 생성자 검증 로직 추가.

**evaluator linkage 검증**: getCapaLinkCount count(*) 추가, linkage pms/risk 검증 로직 강화.

### Divergences from Spec (spec-anchored Level 2)

1. **AC-05 QMS 실제 통신**: ⏸️ DEFERRED — REQ-009 stub만 구현, 실제 QMS 시스템 연동은 #57 follow-up 이슈
2. **RCA 작성 지원**: 5 Whys/Fishbone 템플릿만 제공, AI 자동 판정은 out-of-scope(사용자/expert 판정)

### Follow-ups (Unlocked by #68)

1. **#57 (AC-05 DEFERRED)**: QMS 실제 통신 — REQ-009 stub 교체, 실제 QMS 시스템 연동

---

## SPEC-REGULA-KNOWLEDGE-GAP-001 (#35) — 미답변 자동 이슈화 및 지식베이스 보강 루프

**Status**: 구현 완료 (PR #234, 리뷰/머지 대기)

### Summary

Regula가 단순 답변 도구가 아니라 현장 질문을 통해 지식베이스를 지속 보강하는 운영 시스템으로 진화합니다. 4-condition 감지(confidence/citation/no_results/policy) → PII redaction → unanswered_queue 적재 → cosine clustering(≥0.85) → GitHub Issue 자동 생성/append → RA 4카테고리 분류 → 일일 Digest(08:00 Inngest) → KB 보강 후 gap-replay 폐쇄 루프(resolved)가 완성되었습니다.

### What's Implemented

**Phase 0: 기반 (DB + 권한 + 열거형)**
- `migrations/0066_knowledge_gap.sql`: gap_reason/gap_status/gap_classification ENUM 3종, unanswered_queue 테이블(13컬럼), messages.knowledge_gap_required 컬럼, audit_action enum +4 values(knowledge_gap_created/classified/digest_sent/resolved)
- `lib/auth/permissions.ts`: 권한 3종 추가(knowledgegap.classify/view/replay) — 총 41개 권한
- RLS 정책: org_id 기반 격리 상속(unanswered_queue)

**Phase 1: 미답변 감지 (lib/knowledge-gap/*)**
- `lib/knowledge-gap/detector.ts`: 4-condition 감지(low_confidence <0.5, low_citation <80%, no_results 0 chunks, policy_blocked LLM 실패)
- `lib/knowledge-gap/redaction.ts`: PII/영업비밀 redaction 래퍼 + SHA-256 hash 기록
- `lib/ai/consult.ts`: 감지 후크 추가(Stage 7 post-process)

**Phase 2: GitHub Issue 자동화**
- `lib/knowledge-gap/clustering.ts`: Embedding 기반 cosine similarity 클러스터링(≥0.85 threshold)
- `lib/knowledge-gap/github-issue.ts`: createGitHubIssue(신규 클러스터), appendGitHubIssue(기존 이슈), fetch 기반 plain HTTP client(@octokit/rest 미사용)
- Labels: knowledge-gap, ra-auto, needs-classification
- Body: 질문 요약, 실패 원인, 누락 출처 후보, conversation_id/message_id, redaction_hash

**Phase 3: 폐쇄 루프 (gap-replay 실구현)**
- `lib/knowledge-gap/replay.ts`: replayGapTest(failed scenario 재실행, citation 포함 답변 검증)
- `lib/radar/delta-sync/gap-replay.ts`: 스텁 완성(triggerGapReplay 실제 replay 호출, matchedGapIds[] → replayOutcome)
- markGapResolved: status='resolved', resolved_at=NOW(), GitHub Issue comment(증거 문서+결과)

**Phase 4: UI/분류 워크플로우**
- `app/(app)/knowledge-gap/page.tsx`: KnowledgeGapPage(큐 목록 + 분류 UI)
- `app/api/knowledge-gap/classify/route.ts`: POST /api/knowledge-gap/classify(body: {queueId, classification, note?})
- `app/api/knowledge-gap/queue/route.ts`: GET /api/knowledge-gap/queue(페이지네이션 + 필터)
- `components/knowledge-gap/QueueActions.tsx`: classify/replay 액션 버튼
- `components/knowledge-gap/QueueFilters.tsx`: 필터 dropdown(gap_reason, status, classification)
- `templates/knowledge-gap-handoff.md`: handoff Markdown 템플릿

**Phase 5: Digest + 테스트**
- `lib/knowledge-gap/digest.ts`: generateDailyDigest(08:00 UTC 스케줄, Inngest `knowledge-gap-daily-digest`)
- 반복 미답변 top topics, 긴급도, 미처리 SLA 집계
- Digest 발송 실패 시 audit_logs에 error 기록(knowledge_gap_digest_sent)
- `tests/integration/knowledge-gap.test.ts`: 통합 테스트 17개(AC-01~08全覆盖)

### Environment Variables (Optional)

```bash
# Knowledge Gap (#35) — optional. 미설정 시 GitHub 이슈 자동화 생략(큐는 정상 동작).
KNOWLEDGE_GAP_GITHUB_TOKEN=ghp_xxx
KNOWLEDGE_GAP_GITHUB_REPO=owner/repo

# SendGrid — 일일 digest 이메일 발송 (email dispatcher 공유 키). 미설정 시 audit에 failed 기록 후 no-crash.
SENDGRID_API_KEY=SG.xxx
```

### Verification Results

```bash
corepack pnpm typecheck              # PASS
corepack pnpm exec biome check .      # PASS
corepack pnpm run lint:hex            # PASS
corepack pnpm test                   # PASS: 3165 passed / 7 skipped (knowledge-gap suite + real-replay/org-scoping regression guards)
SKIP_ENV_VALIDATION=1 REGULA_ALLOW_ENV_VALIDATION_SKIP=build corepack pnpm build  # PASS
```

Integration test coverage: AC-01(4-condition detection), AC-02(redaction+hash), AC-03(clustering), AC-04(classify+audit), AC-05(digest 08:00), AC-06(replay→resolved), AC-07(audit 4종), AC-08(RBAC reject).

### Security Hardening (sync review — 2026-06-23)

sync Phase 0.55 보안 리뷰에서 발견·수정된 머지 차단 결함:
- **C1 (CRITICAL)**: `consult()`에 비지속 `mode:'replay'` 추가 — Stage 7 gap 재캡처 + Stage 8 persistMessage 스킵. 기존 동작 보전(옵션 미사용 시 동일). 신규 real-replay 통합테스트가 pre-fix 코드에서 FAIL 검증(regression guard).
- **H1 (HIGH)**: classify/replay 라우트에 `org_id` 소유권 검증 추가 — 타 org 큐 ID에 404 (403 아님, 존재 누출 방지).
- **H2**: `replayGapTest`/`markGapResolved`에 `orgId` 파라미터 추가; delta-sync `triggerGapReplay`는 org 미확정 시 skip (시스템 actor 크로스-org 해금 금지).
- **M1**: `knowledge_gap_resolved` audit을 `markGapResolved` 성공 후로 이동 (replay 전 기록 제거, 21 CFR Part 11 감사 무결성).
- **M2**: `KNOWLEDGE_GAP_GITHUB_API_BASE` `https://` 강제 (SSRF 완화).

### Divergences from Spec (spec-anchored Level 2)

1. **GitHub client**: Plain `fetch` + injectable interface(재사용 가능한 mock) — @octokit/rest 의존성 추가 회피(2개 endpoint만 필요, 신규 dep 방지)
2. **Clustering storage**: pgvector column 없음(unanswered_queue by design) — pure-TS cosine over batched embeddings, cluster_id TEXT만 저장
3. **RLS convention**: `current_setting('app.current_org_id')` 기존 패턴 따름 — 신규 RLS 정책 없이 org_members 경유 기존 격리 상속
4. **GitHub unconfigured**: null sentinel 반환(크래시 방지) — KNOWLEDGE_GAP_GITHUB_TOKEN 미설정 시 GitHub 자동화 skip, 큐는 정상 동작
5. **Replay verdict**: `detectKnowledgeGap` 재사용(`passed` verdict) — 중복 검증 로직 회피, Phase-1 감지 함수 활용

### Follow-ups (Unlocked by #35)

1. **KNOWLEDGE-PROMO-001 (#50)**: 우수 답변 팀 지식 승격 — 미답변과 반대 방향(unsatisfactory → excellent 답변 KB 등록)
2. **RLHF-001 (#56)**: Answer Quality RLHF Loop — 사용자 피드백 기반 RAG 품질 연속 개선(gap-replay와 상호 보완)
3. **SOURCE-GOVERNANCE-001 (#48)**: 규제·SOP 출처 권위도·버전·유효일·폐기 상태 관리 — gap-replay resolved 시 증거 문서 출처 메타데이터 연동 필요

---

## SPEC-REGULA-PMS-001 (#53) — EU MDR 출시 후 임상 감시 (PMS 보고서 & PMCF 계획 생성기)

**Status**: 구현 완료 (PR #246, 2026-06-24 머지, commit `8a513cc`)

### Summary

Regula가 EU MDR Article 83-86 Post-Market Surveillance(PMS) 시스템을 완성했습니다. PMS 보고서(PMSR) 구조화 자동 작성, PMCF 계획 템플릿 생성 및 AI 지원 작성, PMCF 평가 보고서 초안 생성, CER 데이터 자동 연계, complaint/vigilance 데이터 입력 통합, SUSAR·트렌드 리포팅, Article 83-86 자동 컴플라이언스 체크, expert review 게이팅이 통합되었습니다.

### What's Implemented

**Phase 0: 기반 (DB + 권한 + 열거형)**
- `migrations/0069_pms.sql`: workflow_type enum +3(`pms_report`, `pmcf_plan`, `pmcf_evaluation`), pms_inputs/pms_documents 테이블, audit_action enum +7 PMS 관련 액션
- `migrations/0070_pms_export_gating.sql`: PMS export 게이팅 정책
- `lib/auth/permissions.ts`: 권한 2종 추가(`pms.view`, `pms.manage`) — 총 43개 권한
- RLS 정책: org_id 기반 격리 상속(pms_inputs, pms_documents)

**Phase 1: 워크플로우 Executor**
- `lib/workflows/pms-report/executor.ts`: PMS 보고서 생성(MDCG 2022-21 섹션 구조)
- `lib/workflows/pmcf-plan/executor.ts`: PMCF 계획 생성(Annex XIV Part B 체크리스트)
- `lib/workflows/pmcf-evaluation/executor.ts`: PMCF 평가 보고서 생성
- `lib/workflows/_shared/compliance-check.ts`: Article 83-86 자동 컴플라이언스 체크

**Phase 2: PMS 모듈**
- `lib/pms/inputs.ts`: complaint/vigilance 데이터 입력 처리(수동/파일 업로드)
- `lib/pms/cer-linkage.ts`: CER 데이터 자동 연계 모듈(같은 프로젝트 내 CER 문서 #23)

**Phase 3: API 라우트 (5개)**
- `POST /api/workflows/pms-report/run`: PMS 보고서 생성
- `POST /api/workflows/pmcf-plan/run`: PMCF 계획 생성
- `POST /api/workflows/pmcf-evaluation/run`: PMCF 평가 보고서 생성
- `POST /api/pms/inputs`: complaint/vigilance 데이터 입력·업로드
- `GET /api/pms/[projectId]/compliance`: Article 83-86 체크 결과 조회
- `POST /api/pms/[projectId]/documents/[documentId]/close`: expert review 게이팅(close 차단)

**Phase 4: UI 컴포넌트 (8개)**
- `app/(app)/pms/page.tsx`: PMS 워크벤치 메인
- `app/(app)/pms/report/page.tsx`: PMS 보고서 생성 UI
- `app/(app)/pms/pmcf-plan/page.tsx`: PMCF 계획 작성 UI
- `app/(app)/pms/evaluation/page.tsx`: PMCF 평가 보고서 UI
- `components/pms/PmsSidebar.tsx`: 사이드바 네비게이션(조건부 15→16)
- `components/pms/ComplianceChecklist.tsx`: 컴플라이언스 체크리스트(Article 83-86)
- `components/pms/CerLinkageCard.tsx`: CER 데이터 연계 카드
- `components/pms/ExpertReviewGating.tsx`: expert review 게이팅 UI

**Phase 5: 보안 강화**
- `validatePmsCitations`: citation 환각 방지(모든 판단의 근거 citation 검증)
- IDOR cross-org runtime test: 15건 테스트 케이스로 타 org 접근 차단
- Audit 트랜잭션 원자성: `db.transaction()`으로 상태 전이와 audit log 기록 원자성 보장(21 CFR Part 11 §11.10)
- RLS org-isolation: `WITH CHECK` 옵션으로 pms_inputs/pms_documents 테이블 org_id 기반 격리
- Expert review 서버사이드 게이팅: close 라우트에 `review_status: 'approved'` 체크(AC-07)
- 0결과 pending: compliance check에서 0결과 발생 시 pending 상태 자동 전환

### Environment Variables (Optional)

```bash
# PMS (#53) — 별도 env 변수 없음. 기존 DB/AI/Inngest 설정 공유.
```

### Verification Results

```bash
corepack pnpm typecheck              # PASS: 0 에러
corepack pnpm exec biome check .     # PASS: 0 에러
corepack pnpm run lint:hex           # PASS: 0 에러
corepack pnpm test                   # PASS: 3443 passed | 7 skipped | 0 failed
corepack pnpm build                  # PASS
```

Integration test coverage: AC-01(enum +3), AC-02(PMSR MDCG 2022-21), AC-03(PMCF Annex XIV Part B), AC-04(CER 연계 수동만), AC-05(complaint/vigilance 입력·업로드), AC-06(Article 83-86 체크), AC-07(expert review 게이팅), AC-08(audit logs 100%).

### Security Hardening (run 단계 expert-security + evaluator-active)

**C1 (CRITICAL → RESOLVED)**: expert가 AC-07 서버 게이팅 누락 BLOCKER 포착 → close 라우트에 `review_status` 체크 추가하여 수정.

**H1 (HIGH)**: citation 환각 방지(`validatePmsCitations`) — 모든 PMS/PMCF 판단의 근거 citation이 실제 claim을 지지하는지 강제 검증.

**H2**: IDOR cross-org runtime test — 15건 테스트 케이스로 타 org 접근 차단 검증, `withOrgAccessControl` 데코레이터로 모든 PMS API 라우트 보호.

**M1**: Audit 트랜잭션 원자성 — `db.transaction()`으로 상태 전이와 audit log 기록 원자성 보장(21 CFR Part 11 §11.10).

**M2**: RLS org-isolation — `WITH CHECK` 옵션으로 pms_inputs/pms_documents 테이블 org_id 기반 격리 강화.

**M3**: 0결과 pending — compliance check에서 0결과 발생 시 pending 상태 자동 전환, 재시도 메커니즘 추가.

### Divergences from Spec (spec-anchored Level 2)

1. **CER 연계**: AC-04 ⏸️ DEFERRED — CER 로컬 영속화 아키텍처 블로커로 수동 연계만 동작(자동 연계는 #243)
2. **PMCF 평가 UI 탭**: 현재 단일 페이지, 탭 구조로 개선 필요(#244)
3. **E2E 테스트**: 현재 단위 테스트만, E2E/통합테스트 필요(#245)

### Follow-ups (Unlocked by #53)

1. **#243 (AC-04 DEFERRED)**: CER 로컬 영속화 아키텍처 구현 — REQ-PMS-004 자동 CER 연계 완성
2. **#244**: PMCF 평가 보고서 UI 탭 추가 — 현재 단일 페이지, 탭 구조로 개선
3. **#245**: PMS E2E 테스트 및 통합 테스트 확대 — 현재 단위 테스트만, E2E 필요

---

## Codebase Analysis Update (2026-06-19)

### Latest Documentation Updates

**Documentation Completeness**:
- E2E validation MRD: `docs/e2e-validation-mrd.md` — Persona Go/No-Go criteria, Smoke Test specs, validation framework
- README.md updates: Predicate visualization demo, Evidence/Authoring integration, E2E execution methods
- Implementation status: Updated with all completed PRs (#184, #186) and E2E validation framework
- Persona analysis: `docs/persona-deep-dive-analysis.md` — 3-user deep dive with quality addendum

**Project Health Metrics**:
- TypeScript files: 377 (stable)
- API routes: 67 (stable)
- Database tables: 18 (includes new predicate tables)
- Test coverage: 2,556 tests passing, 7 skipped on the current review baseline (239 passed test files, 1 skipped)
- E2E specs: 8 Smoke Test specs complete, 3 Integration Test specs in progress

**Wave 3 Status**:
- PREDICATE-001: Complete (PR #126, PR #186 addendum)
- Traceability Integration: Complete (PR #184)
- E2E Validation Framework: Complete (Issue #182)
- Next: CER-001 (#23), PCCP-001 (#24)

### Latest Architecture Documentation

**Project Scale Analysis**:
- TypeScript files: 377 (updated from baseline)
- API routes: 67 (stable across Wave 3)
- Database tables: 18 (includes new predicate tables)
- lib modules: 27 (comprehensive coverage)
- components categories: 11 (full UI coverage)

**Architecture Documentation Updates**:
- `.moai/project/codemaps/overview.md` - Updated with 2026-06-17 timestamp
- `.moai/project/codemaps/modules.md` - 12 core modules documented
- `.moai/project/codemaps/dependencies.md` - 110+ dependencies analyzed
- `.moai/project/codemaps/entry-points.md` - 67 API routes catalogued
- `.moai/project/codemaps/data-flow.md` - RAG pipeline and data flows documented

**README.md Integration**:
- Added codebase analysis section with project scale metrics
- Integrated architecture overview with latest module structure
- Updated technical stack breakdown with current versions
- Connected documentation references for detailed architecture

**Documentation Status**:
- ✅ README.md - Updated with codebase analysis
- ✅ docs/architecture.md - Enhanced with latest codebase metrics
- ✅ docs/implementation-status.md - This file updated (2026-06-23: PR #234 Knowledge Gap Loop)
- ✅ `.moai/project/codemaps/` - All 5 codemap files current |
