# SPEC-REGULA-KNOWLEDGE-GAP-001 — Implementation Tasks

> design.md 기반 DDD ANALYZE-PRESERVE-IMPROVE 단위 작업 분해.
> 각 작업은 기존 동작 보전 (characterization test) 후 개선.
> 우선순위: P(High/Medium/Low). 시간 추정 금지 — 순서만 명시.

---

## Phase 0: 기반 (DB + 권한 + 열거형) — Priority High

선행: 다른 모든 Phase의 전제. CER Builder/RISK 패턴 재사용.

| # | 작업 | 산출물 | REQ | Migration# | 테스트 |
|---|------|--------|-----|-----------|--------|
| T0.1 | pgEnum 확장 (gap_reason, gap_status, gap_classification) | `lib/db/schema.ts` | 001, 004, 008, 009 | 0066 | enum 타입 컴파일 + enum 값 단위 테스트 |
| T0.2 | messages.knowledge_gap_required 컬럼 추가 | `lib/db/schema.ts` | 003 | 0066 | insert/select drizzle 통합 테스트 |
| T0.3 | unanswered_queue 테이블 정의 | `lib/db/schema.ts` | 004 | 0066 | insert/select/drizzle 통합 테스트 |
| T0.4 | audit_action enum +4 values (knowledge_gap_*) | `lib/db/schema.ts` | 016 | 0066 | enum 값 존재 단위 테스트 |
| T0.5 | RLS 정책 (workflow_runs/org 기반 격리 상속) | migration SQL | — | 0066 | 타 org 접근 차단 통합 테스트 |
| T0.6 | 마이그레이션 생성·검토 | `migrations/0066_knowledge_gap.sql` | — | 0066 | migration up/down 검증 |
| T0.7 | 권한 knowledgegap.classify/view/replay 추가 | `lib/auth/permissions.ts` | 008 | — | role→permission 매핑 단위 테스트 (classify/replay=ra-lead only) |

## Phase 1: 미답변 감지 (lib/knowledge-gap/*) — Priority High

기존 consult.ts 파이프라인에 훅 추가. Characterization test 선행.

| # | 작업 | 산출물 | REQ | 테스트 |
|---|------|--------|-----|--------|
| T1.1 | detectKnowledgeGap (4-condition: confidence/citation/no_results/policy) | `lib/knowledge-gap/detector.ts` | 001 | 각 조건별 gap 발생 단위 테스트 |
| T1.2 | redactQuestion (기존 유틸리티 래퍼, hash 기록) | `lib/knowledge-gap/redaction.ts` | 002 | redaction 후 원문 복원 불가 검증 |
| T1.3 | consult.ts에 감지 후크 추가 (4개 지점) | `lib/ai/consult.ts` | 001 | consult characterization test (기존 동작 보전) |
| T1.4 | unanswered_queue.insert (redaction 후 저장) | `lib/knowledge-gap/detector.ts` | 002, 004 | DB insert + redaction hash 검증 |

## Phase 2: GitHub Issue 자동화 — Priority High

| # | 작업 | 산출물 | REQ | 테스트 |
|---|------|--------|-----|--------|
| T2.1 | clusterSimilarGaps (embedding 기반 유사도 그룹화) | `lib/knowledge-gap/clustering.ts` | 005 | 유사한 질문 2건 동일 cluster_id 할당 테스트 |
| T2.2 | createGitHubIssue (신규 클러스터) | `lib/knowledge-gap/github-issue.ts` | 006, 007 | GitHub API create + label 부여 통합 테스트 |
| T2.3 | appendGitHubIssue (기존 이슈) | `lib/knowledge-gap/github-issue.ts` | 005 | GitHub API comment append 통합 테스트 |
| T2.4 | POST /api/knowledge-gap/queue (목록 조회) | `app/api/knowledge-gap/queue/route.ts` | — | RBAC + pagination 통합 테스트 |

## Phase 3: 폐쇄 루프 (gap-replay 실구현) — Priority High

| # | 작업 | 산출물 | REQ | 테스트 |
|---|------|--------|-----|--------|
| T3.1 | replayGapTest (failed scenario 재실행) | `lib/knowledge-gap/replay.ts` | 014 | citation 포함 답변 재현 단위 테스트 |
| T3.2 | gap-replay.ts 스텁 완성 (실제 replay 호출) | `lib/radar/delta-sync/gap-replay.ts` | 014, 015 | delta-sync → replay 호출 흐름 통합 테스트 |
| T3.3 | markGapResolved (status='resolved' + GitHub 코멘트) | `lib/knowledge-gap/replay.ts` | 015 | DB update + GitHub comment API 통합 테스트 |
| T3.4 | POST /api/knowledge-gap/replay/:queueId | `app/api/knowledge-gap/replay/[queueId]/route.ts` | 015 | RBAC + replay execution 통합 테스트 |

## Phase 4: UI/분류 워크플로우 — Priority Medium

| # | 작업 | 산출물 | REQ | 테스트 |
|---|------|--------|-----|--------|
| T4.1 | POST /api/knowledge-gap/classify (RA 분류) | `app/api/knowledge-gap/classify/route.ts` | 008, 009 | RBAC (ra-lead only) + audit 기록 통합 테스트 |
| T4.2 | GET /api/knowledge-gap/queue (미답변 큐 목록) | `app/api/knowledge-gap/queue/route.ts` | — | pagination + filter 통합 테스트 |
| T4.3 | KnowledgeGapPage (큐 목록 + 분류 UI) | `app/(app)/knowledge-gap/page.tsx` | 008, 009 | 4개 카테고리 분류 + audit 확인 RTL 테스트 |
| T4.4 | handoff 템플릿 (Markdown) | `templates/knowledge-gap-handoff.md` | 010 | 템플릿 변수 치환 단위 테스트 |

## Phase 5: Digest + 테스트 — Priority Medium

| # | 작업 | 산출물 | REQ | 테스트 |
|---|------|--------|-----|--------|
| T5.1 | generateDailyDigest (08:00 스케줄) | `lib/knowledge-gap/digest.ts` | 011, 012, 013 | 반복 미답변 top topics + 긴급도 집계 단위 테스트 |
| T5.2 | Digest 발송 실패 시 audit 기록 | `lib/knowledge-gap/digest.ts` | 013 | 에러 핸들링 + writeAudit 호출 단위 테스트 |
| T5.3 | 통합 테스트 (전체 플로우) | `tests/integration/knowledge-gap.test.ts` | AC-01~08 | 감지 → 이슈 → 분류 → digest → replay → resolved E2E |

## 의존 그래프

```
Phase 0 (DB/권한/열거형)
   ├──> Phase 1 (미답변 감지)
   │       └──> Phase 2 (GitHub Issue) ──> Phase 4 (UI/분류)
   │                          └──> Phase 3 (폐쇄 루프)
   └──> Phase 5 (Digest/테스트, 최종)
```

병렬 가능: Phase 1 (감지)는 Phase 0 완료 후 즉시 시작 가능. Phase 2 (GitHub)와 Phase 3 (replay)는 병렬 가능. UI(Phase 4)는 해당 API 완료 후 순차.

## 완료 기준 (Definition of Done)

- [x] unanswered_queue 테이블 생성 + RLS 정책 적용
- [x] messages.knowledge_gap_required 컬럼 추가
- [x] gap_reason/gap_status/gap_classification enum 정의
- [x] knowledgegap.{classify/view/replay} 권한 추가
- [x] 4-condition 미답변 감지 로직 구현
- [x] PII/영업비밀 redaction + hash 기록
- [x] GitHub Issue 자동 생성/append (라벨 포함)
- [x] RA 분류 API + UI (4개 카테고리)
- [x] 일일 Digest 생성 (08:00 스케줄)
- [x] gap-replay 스텁 완성 (폐쇄 루프)
- [x] audit_logs 기록 (4종 이벤트)
- [x] 통합 테스트 통과 (AC-01~AC-08)

검증 명령:

```bash
corepack pnpm typecheck
corepack pnpm exec biome check .
corepack pnpm run lint:hex
corepack pnpm test
SKIP_ENV_VALIDATION=1 REGULA_ALLOW_ENV_VALIDATION_SKIP=build corepack pnpm build
```

## Notes

- **Fixes #35**: 본 SPEC 구현은 Issue #35를 해결한다.
- **기존 동작 보전**: consult.ts 변경 전 characterization test로 기존 파이프라인 동작 확보.
- **Redaction 재사용**: 기존 PII redaction 유틸리티를 래퍼하여 새 구현 금지 (SPEC Out of Scope).
- **Gap-replay 통합**: delta-sync의 gap-replay.ts 스텁 인터페이스 유지하면서 실제 replay 로직 구현.
