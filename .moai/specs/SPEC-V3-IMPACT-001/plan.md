# SPEC-V3-IMPACT-001: Change Impact 4-Layer Wizard

## Implementation Plan

---
**SPEC ID:** SPEC-V3-IMPACT-001
**Version:** 1.0.0
**Status:** planned
**Created:** 2026-07-05
**Phase:** Wave 3 Phase C-3
---

## Overview

v3 Phase C-3 **Change Impact 4-Layer Wizard** 구현 계획. 기존 SPEC-REGULA-IMPACT-001(RADAR 기반 자동 평가)를 확장하여 Employee-facing 자가진단 위저드를 구현.

**핵심 목표:**
- 4계층 평가 엔진 구현 (retestMatrix → LLM → 티켓 → RAG)
- 신호등 결과 시스템 (green/yellow/red)
- 기존 기능 비회귀 (API 호환성, DB 보존)
- 백엔드 도메인 전용 구현 (UI는 Phase D 이월)

## Implementation Milestones

### Milestone 1: Foundation (Priority: High)

**목표:** 기본 구조 마련 및 기존 코드 이전

**작업 항목:**
1. `lib/domains/impact/` 디렉토리 생성
2. 기존 `lib/impact/` 6개 파일 이전 및 재사용:
   - `types.ts`: 공통 타입 확장
   - `audit-wiring.ts`: 감사 추적 레이어 재사용
   - `action-queue.ts`: 액션 아이템 생성 로직 재사용
3. `lib/domains/impact/` re-export 레이어 생성 (기존 API 호환성)
4. 기존 테스트 79개 통과 검증

**산출물:**
- `lib/domains/impact/` 디렉토리 구조
- 기존 기능 비회귀 검증 테스트 결과

**완료 기준:**
- [ ] 기존 `/api/ra/impact` API가 여전히 동작한다
- [ ] 기존 테스트 79개가 전체 통과한다
- [ ] Drizzle Kit check가 통과한다

**의존성:**
- SPEC-REGULA-IMPACT-001 기존 코드
- kernel/db (Drizzle ORM)

### Milestone 2: retestMatrix Data Embedding (Priority: High)

**목표:** retestMatrix 35셀 데이터 코드 임베드

**작업 항목:**
1. `docs/v3/reference/data.jsx:1203`에서 retestMatrix 데이터 추출
2. `lib/domains/impact/retest-matrix-data.ts` 생성:
   - 7 changeTypes (bom, sw, sw-minor, label, warn, process, sterile)
   - 5 markets (us, eu, kr, cn, jp)
   - 35셀 (7 × 5) 셀 데이터
3. TypeScript 타입 정의:
   - `RetestMatrixCell` 인터페이스
   - `RetestMatrixData` 인터페이스
4. 단위 테스트 작성:
   - 35셀 데이터 구조 검증
   - 셀 조회 < 1ms 성능 검증

**산출물:**
- `lib/domains/impact/retest-matrix-data.ts` (결정론 데이터)
- `lib/domains/impact/__tests__/retest-matrix-data.test.ts`

**완료 기준:**
- [ ] 35셀 데이터가 모두 정의되었다
- [ ] 단위 테스트가 통과한다
- [ ] 조회 성능 < 1ms

**의존성:**
- docs/v3/reference/data.jsx

### Milestone 3: Layer 1 - retestMatrix Lookup Engine (Priority: High)

**목표:** Layer 1 결정론 룰 조회 엔진 구현

**작업 항목:**
1. `lib/domains/impact/layer1-matrix-lookup.ts` 생성:
   - `lookupRetestMatrix(changeType, market)` 함수
   - 35셀 조회 로직
   - 누락 셀 검증 및 에러 처리
2. 신호등 계산 로직:
   - `calculateSignal(matrixResults)` 함수
   - green/yellow/red 규칙 구현
3. 단위 테스트 작성:
   - 모든 35셀 조회 테스트
   - 누락 셀 에러 처리 테스트
   - 신호등 계산 테스트 (green/yellow/red)

**산출물:**
- `lib/domains/impact/layer1-matrix-lookup.ts`
- `lib/domains/impact/signal-calculator.ts`
- `lib/domains/impact/__tests__/layer1.test.ts`

**완료 기준:**
- [ ] 35셀 모두 정상 조회된다
- [ ] 누락 셀 시 런타임 에러 발생
- [ ] 신호등 계산이 정확하다
- [ ] 단위 테스트 통과

**의존성:**
- Milestone 2 (retest-matrix-data.ts)

### Milestone 4: Layer 2 - LLM Category Classification (Priority: High)

**목표:** Layer 2 LLM 카테고리 분류 구현

**작업 항목:**
1. `lib/domains/impact/layer2-llm-classifier.ts` 생성:
   - `classifyChangeCategory(changeDetail)` 함수
   - gx10 Ollama (gpt-oss:120b via lib/ai/llm-provider.ts getLlmModel()) 호출
   - 응답 파싱 (category, confidence, reason)
   - confidence < 80 재시도 로직
2. gx10 Ollama 프롬프트 작성:
   - 시스템 프롬프트 정의
   - 카테고리 분류 지시어 작성
3. 에러 처리:
   - LLM API 실패 재시도 (최대 3회)
   - 타임아웃 핸들링
4. 단위 테스트 작성:
   - LLM 호출 성공 시나리오
   - LLM 호출 실패 시나리오
   - confidence < 80 시나리오

**산출물:**
- `lib/domains/impact/layer2-llm-classifier.ts`
- `lib/domains/impact/__tests__/layer2.test.ts`

**완료 기준:**
- [ ] gx10 Ollama API가 정상 호출된다
- [ ] 응답 파싱이 정확하다
- [ ] confidence < 80 시 재확인 요청
- [ ] 단위 테스트 통과

**의존성:**
- gx10 Ollama (gpt-oss:120b via lib/ai/llm-provider.ts)
- lib/domains/ai/ (LLM 클라이언트 래퍼)

### Milestone 5: Layer 3 - RA Inbox Ticket Auto-Creation (Priority: Medium)

**목표:** Layer 3 RA Inbox 자동 티켓 생성 구현

**작업 항목:**
1. `lib/domains/impact/layer3-ticket-creator.ts` 생성:
   - `createInboxTicket(context)` 함수
   - domains/inbox 티켓 생성 API 호출
   - 티켓 상태: 'needs-review'
   - 티켓 컨텍스트: 모든 위저드 입력 포함
2. domains/inbox API 연동:
   - `POST /api/inbox` 호출
   - 티켓 생성 성공/실패 처리
3. audit 로깅:
   - `impact.ticket.create` audit 로그 기록
4. 단위 테스트 작성:
   - 티켓 생성 성공 시나리오
   - 티켓 생성 실패 시나리오
   - audit 로깅 검증

**산출물:**
- `lib/domains/impact/layer3-ticket-creator.ts`
- `lib/domains/impact/__tests__/layer3.test.ts`

**완료 기준:**
- [ ] RA Inbox 티켓이 정상 생성된다
- [ ] 티켓 ID가 반환된다
- [ ] `impact.ticket.create` audit 로그가 기록된다
- [ ] 단위 테스트 통과

**의존성:**
- SPEC-V3-INBOX-001 (domains/inbox)
- kernel/audit

### Milestone 6: Layer 4 - RAG Similar Cases Lookup (Priority: Medium)

**목표:** Layer 4 ra-llm-wiki RAG 유사 사례 조회 구현

**작업 항목:**
1. `lib/domains/impact/layer4-rag-similar-cases.ts` 생성:
   - `lookupSimilarCases(productId, changeCategory, markets)` 함수
   - embeddings 테이블 pgvector 코사인 유사도 검색
   - 필터: source_repo='ra-llm-wiki', product_id, change_type
   - 최대 3건 반환
2. RAG 패턴 재사용:
   - domains/ai/run-rag-query.ts 패턴 참조
   - pgvector 검색 쿼리 작성
3. Citation 강제:
   - 출처 인용 포맷팅 (<sup class="cite">)
   - 출처 누락 시 제외 로직
4. 에러 처리:
   - 타임아웃 (10초)
   - 빈 결과 반환 및 계속 진행
5. 단위 테스트 작성:
   - RAG 조회 성공 시나리오
   - RAG 조회 타임아웃 시나리오
   - 출처 누락 처리 시나리오

**산출물:**
- `lib/domains/impact/layer4-rag-similar-cases.ts`
- `lib/domains/impact/__tests__/layer4.test.ts`

**완료 기준:**
- [ ] RAG 조회가 정상 동작한다
- [ ] 최대 3건의 유사 사례가 반환된다
- [ ] 모든 사례에 출처 인용이 포함된다
- [ ] 타임아웃 시 빈 결과 반환
- [ ] 단위 테스트 통과

**의존성:**
- SPEC-V3-INBOX-001 (embeddings 테이블)
- domains/ai (RAG 쿼리 래퍼)
- pgvector (PostgreSQL 확장)

### Milestone 7: API Routes Implementation (Priority: High)

**목표:** 위저드 API 엔드포인트 구현

**작업 항목:**
1. `app/api/impact-check/route.ts` 생성:
   - `POST /api/impact-check` 엔드포인트
   - 요청 바디 검증 (Zod schema)
   - RBAC 권한 검사 (impact.self_check)
2. 4계층 순차 실행 오케스트레이션:
   - Layer 1 → Layer 2 → Layer 3/4 (confidence 분기)
   - 각 레이어 에러 처리
3. 응답 포맷팅:
   - 신호등 결과
   - retestMatrix 셀
   - LLM 분석 결과
   - 유사 사례 3건
   - 티켓 ID (있으면)
4. 통합 테스트 작성:
   - end-to-end 시나리오
   - 권한 검사 시나리오
   - 에러 처리 시나리오

**산출물:**
- `app/api/impact-check/route.ts`
- `app/api/impact-check/__tests__/route.test.ts`

**완료 기준:**
- [ ] POST /api/impact-check가 정상 동작한다
- [ ] 4계층이 순차적으로 실행된다
- [ ] confidence < 80 시 티켓이 생성된다
- [ ] confidence >= 80 시 유사 사례가 조회된다
- [ ] RBAC 권한 검사가 동작한다
- [ ] 통합 테스트 통과

**의존성:**
- Milestone 3, 4, 5, 6 (각 레이어 구현)

### Milestone 8: Database Migration (Priority: High)

**목표:** regulatory_impact_assessments 테이블 확장 및 audit_logs.previous_hash 추가

**작업 항목:**
1. `migrations/0109_impact_wizard_columns.sql` 생성:
   - ALTER TABLE regulatory_impact_assessments
   - 7개 신규 컬럼 추가 (nullable)
   - 2개 인덱스 추가
   - audit_logs.previous_hash BYTEA 추가 (SPEC-V3-AUDIT-CHAIN-001 자체 구현)
2. Drizzle Kit migration:
   - `drizzle-kit generate` 실행
   - migration SQL 검증
3. 비회귀 검증:
   - 기존 레코드 보존 확인
   - Drizzle Kit check 통과
4. 롤백크 테스트:
   - migration 적용 전/후 DB 상태 확인
   - 롤백크 SQL 준비

**산출물:**
- `migrations/0109_impact_wizard_columns.sql`
- `lib/db/schema.ts` (신규 컬럼 정의)

**완료 기준:**
- [ ] Migration이 성공적으로 적용된다
- [ ] 기존 레코드가 보존된다
- [ ] 신규 컬럼이 NULL로 추가된다
- [ ] Drizzle Kit check가 통과한다
- [ ] 롤백크 SQL이 준비된다

**의존성:**
- kernel/db (Drizzle ORM)
- PostgreSQL 15+

### Milestone 9: Audit Logging (Priority: High)

**목표:** 21 CFR Part 11 감사 로깅 구현

**작업 항목:**
1. `lib/domains/impact/audit-logger.ts` 생성 (또는 기존 audit-wiring.ts 확장):
   - `logImpactCheck()` 함수
   - `logTicketCreate()` 함수
   - `logCriticalDetected()` 함수
2. audit_log 레코드 삽입:
   - audit_action enum 활용
   - user_id, context, previous_hash 포함
3. previous_hash 체인 구현 (자체 구현, 의존성 제거):
   - audit_logs.previous_hash BYTEA 컬럼 (migration 0109에 포함)
   - 이전 레코드 SHA-256 해시 조회
   - append-only 체인 보장
   - SPEC-V3-AUDIT-CHAIN-001 완료 전까지 nullable/optional 동작
4. 단위 테스트 작성:
   - audit 로깅 검증
   - previous_hash 체인 검증

**산출물:**
- `lib/domains/impact/audit-logger.ts`
- `lib/domains/impact/__tests__/audit-logger.test.ts`

**완료 기준:**
- [ ] `impact.check` audit 로그가 기록된다
- [ ] `impact.ticket.create` audit 로그가 기록된다
- [ ] `impact.critical_detected` audit 로그가 기록된다
- [ ] previous_hash 체인이 정상 동작한다
- [ ] 단위 테스트 통과

**의존성:**
- kernel/audit
- SPEC-V3-AUDIT-CHAIN-001 (previous_hash 체인 - AUDIT-CHAIN-001 완료 전까지 previous_hash는 nullable/optional)

### Milestone 10: RBAC Integration (Priority: High)

**목표:** RBAC 권한 검사 구현 및 audit_action enum 확장

**작업 항목:**
1. Migration 0110 생성 (별도 파일):
   - `migrations/0110_audit_impact_actions.sql`
   - `ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'impact.check'`
   - `ALTER TYPE audit_action ADD VALUE IF NOT EXISTS 'impact.ticket.create'`
   - PostgreSQL 트랜잭션 분리 규칙 준수 (ALTER TYPE ... ADD VALUE는 트랜잭션 내 불가)
2. `lib/auth/permissions.ts` PERMISSION_MAP 추가 (신규 권한 3종):
   - `impact.view`: 위저드 실행 권한 (employee, viewer, ra-member, ra-lead, admin)
   - `impact.self_check`: 자가진단 권한 (employee, viewer)
   - `impact.ra_escalate`: RA 티켓 에스컬레이션 권한 (ra-member, ra-lead, admin)
3. `permissions.test.ts` EXPECTED_ACTIONS 카운트 갱신
4. API 라우트 권한 미들웨어:
   - `impact.view` 검증
   - `impact.self_check` 검증
5. 403 에러 처리:
   - 권한 없는 접근 차단
   - `auth.forbidden` audit 로그
6. 단위 테스트 작성:
   - 권한 있는 사용자 접근
   - 권한 없는 사용자 접근 (403)
   - Cross-org 접근 시도

**산출물:**
- `lib/auth/permissions.ts` (수정)
- `app/api/impact-check/route.ts` (권한 미들웨어 추가)
- `app/api/impact-check/__tests__/rbac.test.ts`

**완료 기준:**
- [ ] `impact.view` 권한이 정상 동작한다
- [ ] `impact.self_check` 권한이 정상 동작한다
- [ ] 권한 없는 접근이 403로 차단된다
- [ ] `auth.forbidden` audit 로그가 기록된다
- [ ] 단위 테스트 통과

**의존성:**
- kernel/auth
- lib/auth/permissions.ts
- migrations/0104 (audit_action enum 기존 값)
- enterprise-migrations (audit_action enum lock-step 게이트)

## New and Modified Files

### 신규 파일 (New Files)

**도메인 로직:**
```
lib/domains/impact/
├── retest-matrix-data.ts              # M2: retestMatrix 35셀 데이터
├── layer1-matrix-lookup.ts           # M3: Layer 1 조회 엔진
├── layer2-llm-classifier.ts          # M4: Layer 2 LLM 분류
├── layer3-ticket-creator.ts          # M5: Layer 3 티켓 생성
├── layer4-rag-similar-cases.ts       # M6: Layer 4 RAG 조회
├── signal-calculator.ts              # M3: 신호등 계산
├── audit-logger.ts                   # M9: audit 로깅
├── types.ts                         # 도메인 타입 (확장)
└── index.ts                         # re-export 레이어
```

**API 라우트:**
```
app/api/impact-check/
├── route.ts                          # M7: POST /api/impact-check
└── __tests__/
    └── route.test.ts                 # 통합 테스트
```

**단위 테스트:**
```
lib/domains/impact/__tests__/
├── retest-matrix-data.test.ts        # M2
├── layer1.test.ts                    # M3
├── layer2.test.ts                    # M4
├── layer3.test.ts                    # M5
├── layer4.test.ts                    # M6
└── audit-logger.test.ts              # M9
```

**마이그레이션:**
```
migrations/
├── 0109_impact_wizard_columns.sql    # M8
└── 0110_audit_impact_actions.sql    # M10 (audit_action enum)
```

### 수정 파일 (Modified Files)

**DB 스키마:**
```
lib/db/schema.ts                       # M8: regulatory_impact_assessments 확장
```

**권한 (필요 시):**
```
lib/auth/permissions.ts               # M10: 신규 권한 추가
```

**기존 코드 이전:**
```
lib/impact/ → lib/domains/impact/
├── portfolio-scanner.ts              # M1: 이전 (재사용 보존)
├── section-mapper.ts                 # M1: 이전 (재사용 보존)
├── action-queue.ts                   # M1: 이전 (재사용 보존)
├── audit-wiring.ts                   # M1: 이전 (재사용, 확장)
├── analyzer.ts                       # M1: 이전 (재사용 보존)
└── types.ts                          # M1: 이전 (확장)
```

## Technical Approach

### 아키텍처 패턴

**계층형 아키텍처 (Layered Architecture):**
```
API Layer (app/api/impact-check/)
    ↓
Service Layer (lib/domains/impact/)
    ↓ 4계층 순차 실행
Layer 1: retestMatrix Lookup
    ↓
Layer 2: LLM Classification
    ↓ confidence 분기
Layer 3: Ticket Creation (confidence < 80)
Layer 4: RAG Similar Cases (confidence >= 80)
    ↓
Data Layer (kernel/db, domains/ai)
```

**의존성 주입 (Dependency Injection):**
- LLM 클라이언트: domains/ai 래퍼 재사용
- RAG 쿼리: domains/ai/run-rag-query 패턴 재사용
- 티켓 생성: domains/inbox API 호출
- Audit 로깅: kernel/audit 래퍼 재사용

### 데이터 흐름 (Data Flow)

**Normal Flow (confidence >= 80):**
```
User Input → Step 1~4
    ↓
Layer 1: retestMatrix Lookup (35셀)
    ↓
Layer 2: LLM Classification (confidence >= 80)
    ↓
Layer 4: RAG Similar Cases (3건)
    ↓
Signal Calculator (green/yellow/red)
    ↓
Result Page + SimilarCasesCard
```

**Low Confidence Flow (confidence < 80):**
```
User Input → Step 1~4
    ↓
Layer 1: retestMatrix Lookup (35셀)
    ↓
Layer 2: LLM Classification (confidence < 80)
    ↓
Layer 3: RA Inbox Ticket Creation
    ↓
Result Page + Ticket CTA
```

### 에러 처리 전략

**Layer 1 (retestMatrix):**
- 셀 누락: 런타임 에러 → 관리자 알림
- 데이터 오류: 기본값 반환 → 계속 진행

**Layer 2 (LLM):**
- API 실패: 재시도 3회 → 에러 메시지
- 타임아웃: 에러 메시지 → 수동 RA 상담 제안

**Layer 3 (Ticket):**
- API 실패: 에러 메시지 → 위저드 결과는 계속 표시
- 타임아웃: 티켓 생성 스킵 → 위저드 결과는 계속 표시

**Layer 4 (RAG):**
- 타임아웃 (10초): 빈 결과 반환 → 계속 진행
- 조회 실패: 빈 결과 반환 → 계속 진행

## Testing Strategy

### 단위 테스트 (Unit Tests)

**커버리지 목표:** 85% 이상

**테스트 대상:**
- retestMatrix 데이터 구조 (M2)
- Layer 1 조회 로직 (M3)
- Layer 2 LLM 파싱 (M4)
- Layer 3 티켓 생성 (M5)
- Layer 4 RAG 조회 (M6)
- 신호등 계산 (M3)
- Audit 로깅 (M9)
- RBAC 권한 검사 (M10)

**테스트 프레임워크:** Vitest

### 통합 테스트 (Integration Tests)

**테스트 시나리오:**
1. **Happy Path:** confidence >= 80, RAG 성공
2. **Low Confidence Path:** confidence < 80, 티켓 생성
3. **RAG Timeout:** RAG 타임아웃, 빈 결과 반환
4. **LLM Failure:** LLM API 실패, 재시도 후 에러
5. **RBAC Block:** 권한 없는 사용자 접근
6. **Cross-org Attempt:** 다른 조직 사용자 접근

**테스트 프레임워크:** Vitest + MSW (Mock Service Worker)

### Edge Case 테스트

**8개 Edge Cases:**
1. 빈 포트폴리오
2. retestMatrix 셀 누락
3. RAG 타임아웃
4. Cross-org 접근
5. 동시 변경 평가
6. LLM API rate limit
7. 등록되지 않은 시장 선택
8. change_detail 2000자 초과

## Risk Mitigation

### 위험 1: 기존 API 깨짐

**완화:**
- lib/impact/ → lib/domains/impact/ 이동 시 re-export 레이어 유지
- 기존 테스트 79개 전체 통과 검증
- Drizzle Kit check 실행

**검증:**
- M1 완료 후 기존 API 동작 확인

### 위험 2: DB 마이그레이션 실패

**완화:**
- 모든 신규 컬럼 nullable
- 롤백크 SQL 준비
- 기존 레코드 보존 확인

**검증:**
- M8 완료 후 롤백크 테스트

### 위험 3: RAG 타임아웃

**완화:**
- 타임아웃 10초 설정
- 빈 결과 반환 후 계속 진행
- 에러 메시지 표시

**검증:**
- M6 완료 후 타임아웃 시나리오 테스트

## Dependencies Mapping

### 내부 의존성

| 의존 대상 | 용도 | Milestone |
|-----------|------|------------|
| `kernel/db` | DB 쿼리, 트랜잭션 | M1, M8 |
| `kernel/audit` | 21 CFR Part 11 로깅 | M9 |
| `domains/ai` (LLM) | gx10 Ollama 클라이언트 | M4 |
| `domains/ai` (RAG) | RAG 쿼리 래퍼 | M6 |
| `domains/inbox` | 티켓 생성 API | M5 |
| `domains/registry` | 제품/시장 데이터 | M7 |
| `lib/auth/permissions` | RBAC 권한 검사 | M10 |

### 외부 의존성

| 의존 대상 | 용도 | 버전 |
|-----------|------|------|
| gx10 Ollama (gpt-oss:120b) | LLM 분류 | via lib/ai/llm-provider.ts |
| pgvector | RAG 벡터 검색 | PostgreSQL 15+ |
| Drizzle ORM | DB 쿼리 빌더 | 최신 버전 |

## Success Metrics

### 기능 메트릭

- [ ] 15개 AC (AC-IMP-01 ~ AC-IMP-15) 전체 통과
- [ ] 4계층 평가 엔진 정상 동작
- [ ] retestMatrix 35셀 정확도 100%
- [ ] 신호등 계산 정확도 100%
- [ ] RAG 유사 사례 조회 정상 동작

### 성능 메트릭

- [ ] retestMatrix 조회 < 10ms
- [ ] Layer 2 LLM 분류 < 5초
- [ ] Layer 4 RAG 조회 < 10초
- [ ] 전체 위저드 응답 < 20초

### 품질 메트릭

- [ ] 단위 테스트 커버리지 85% 이상
- [ ] 통합 테스트 전체 통과
- [ ] Edge Case 테스트 전체 통과
- [ ] Drizzle Kit check 통과
- [ ] 기존 테스트 79개 통과 (비회귀)

### 보안 메트릭

- [ ] RBAC 권한 검사 100%
- [ ] Audit 로깅 100%
- [ ] SQL Injection 방지
- [ ] XSS 방지

---

**생성일:** 2026-07-05  
**버전:** 1.0.0  
**상태:** planned  
**총 Milestones:** 10개  
**예상 완료:** Phase C-3 종료 시점