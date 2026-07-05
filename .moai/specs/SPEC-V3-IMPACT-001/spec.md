---
id: SPEC-V3-IMPACT-001
version: 0.1.0
status: planned
phase: C-3
priority: High
created: 2026-07-05
updated: 2026-07-05
author: manager-spec
issue_number: TBD
depends_on:
  - SPEC-REGULA-IMPACT-001
  - SPEC-V3-INBOX-001
  - SPEC-V3-REGISTRY-001
blocks: []
parent_spec: SPEC-REGULA-IMPACT-001
---

# SPEC-V3-IMPACT-001: Change Impact 4-Layer Wizard

## Specification Document

> SPEC-V3-AUDIT-CHAIN-001 의존성: M9 previous_hash 체인은 자체 구현(옵션 B)하므로 depends_on에서 제외. AUDIT-CHAIN-001 완료 전까지 previous_hash nullable/optional.

## 개요 (Overview)

의료기기 규제 전문가(Regulatory Affairs)가 제품 변경이 시장별 규제에 미치는 영향을 자가진단하는 4계층 워크벤치. RADAR 기반 자동 평가(SPEC-REGULA-IMPACT-001)를 확장하여 Employee가 직접 변경 영향을 평가할 수 있는 위저드를 제공.

**핵심 가치:**
- **자가진단:** RA 전문가뿐만 아니라 모든 역할이 변경 영향 평가 가능
- **신호등 결과:** 즉시 시각적 피드백 (green/yellow/red)
- **유사 사례:** 과거 변경 사례 RAG 검색으로 결정 근거 제공
- **자동 티켓:** confidence < 80% 시 RA Inbox 자동 생성

## 배경 (Context)

### 문제 정의

현재 Regula 시스템은 RADAR 규제 업데이트를 기반으로 포트폴리오 전체에 대한 영향 평가를 자동으로 수행하지만, Employee가 특정 제품 변경을 자가진단하는 워크벤치가 부족함.

**기존 한계 (SPEC-REGULA-IMPACT-001):**
- RA 전문가만 사용 가능 (ra-member, ra-lead)
- RADAR 감지 트리거에만 의존
- Employee가 특정 변경을 미리 평가하는 수단 부족
- 유사 사례 참조 없이 즉시 결정 필요

### 해결 방안

Employee-facing 4-layer wizard 도입:

1. **Layer 1:** retestMatrix 결정론 룰 (7 × 5 = 35셀)
2. **Layer 2:** LLM 카테고리 분류 (gx10 Ollama gpt-oss:120b)
3. **Layer 3:** confidence < 80% 시 RA Inbox 자동 티켓
4. **Layer 4:** ra-llm-wiki RAG 유사 사례 3건

## 기능 요구사항 (Functional Requirements)

### REQ-V3-IMP-001: 위저드 Step 1 - 제품 선택

**WHEN** Employee가 위저드를 시작하고 Step 1에 도달하면, **THE SYSTEM SHALL** 제품 선택 UI를 제공하고 제품 목록을 표시한다.

**WHILE** 제품 목록을 표시할 때, **THE SYSTEM SHALL** 다음 필드를 포함한다:
- 제품 ID (product.id)
- 제품명 (product.name)
- 제품 타입 (product.type)
- 등록된 시장 목록 (product_markets 테이블)

**IF** 제품 목록이 비어 있으면, **THE SYSTEM SHALL** 안내 메시지를 표시하고 등록된 제품이 없음을 알린다.

**WHERE** 제품을 선택했을 때, **THE SYSTEM SHALL** 선택된 제품의 등록된 시장 정보를 Step 4로 전달한다.

### REQ-V3-IMP-002: 위저드 Step 2 - 변경 카테고리 선택

**WHEN** Employee가 Step 2에 도달하면, **THE SYSTEM SHALL** 변경 카테고리 선택 UI를 제공하고 다음 7개 카테고리를 표시한다:
1. BOM 변경 (부품 교체)
2. SW 알고리즘 재학습
3. SW 마이너 (버그픽스)
4. 라벨 문구 변경
5. Critical Warning 개정
6. 생산공정 변경
7. 멸균 조건 변경

**WHILE** 카테고리를 선택할 때, **THE SYSTEM SHALL** 각 카테고리에 대한 설명을 제공한다.

**IF** 카테고리 선택이 완료되면, **THE SYSTEM SHALL** 선택된 카테고리 ID를 Step 3으로 전달한다.

### REQ-V3-IMP-003: 위저드 Step 3 - 변경 상세 입력

**WHEN** Employee가 Step 3에 도달하면, **THE SYSTEM SHALL** 자유 텍스트 입력 필드를 제공한다.

**WHILE** Employee가 변경 상세를 입력할 때, **THE SYSTEM SHALL** 다음 안내를 제공한다:
- "변경 내용을 구체적으로 기술하세요 (예: 부품 모델번호, 변경 사유, 영향 범위)"
- 최소 10자, 최대 2000자 제한

**IF** 입력이 완료되면, **THE SYSTEM SHALL** 입력된 텍스트를 Layer 2 LLM 분석으로 전달한다.

### REQ-V3-IMP-004: 위저드 Step 4 - 영향 시장 선택

**WHEN** Employee가 Step 4에 도달하면, **THE SYSTEM SHALL** 영향 시장 다중 선택 UI를 제공하고 다음 5개 시장을 표시한다:
1. FDA (US)
2. MDR (EU)
3. MFDS (KR)
4. NMPA (CN)
5. PMDA (JP)

**WHILE** 시장을 선택할 때, **THE SYSTEM SHALL** Step 1에서 선택한 제품의 등록된 시장 정보를 기반으로 기본값을 설정한다.

**IF** 등록되지 않은 시장을 선택하면, **THE SYSTEM SHALL** 경고 메시지를 표시하고 확인을 요구한다.

**WHEN** 시장 선택이 완료되면, **THE SYSTEM SHALL** 4계층 평가를 트리거한다.

### REQ-V3-IMP-005: Layer 1 - retestMatrix 룰 조회

**WHEN** 4계층 평가가 트리거되면, **THE SYSTEM SHALL** Layer 1 retestMatrix 룰 조회를 수행한다.

**THE SYSTEM SHALL** 선택된 changeType과 market 조합에 해당하는 retestMatrix 셀을 조회한다:
- 셀 키: `{changeType}-{market}` (예: `bom-us`, `sw-eu`)
- 셀 값: `{ level, ref, note }`

**THE SYSTEM SHALL** 각 시장별 다음 정보를 계산한다:
- **level:** `required` | `conditional` | `not-required`
- **ref:** 규정 참조 (예: "FDA Design Change §III.A")
- **note:** 설명 (예: "Special 510(k) 검토 필요")

**IF** retestMatrix 셀이 누락되면, **THE SYSTEM SHALL** `level: 'unknown'`으로 처리하고 관리자에게 알림을 생성한다.

**WHERE** 모든 시장 조회가 완료되면, **THE SYSTEM SHALL** 결과를 Layer 2로 전달한다.

### REQ-V3-IMP-006: Layer 2 - LLM 카테고리 분류

**WHEN** Layer 1이 완료되면, **THE SYSTEM SHALL** Layer 2 LLM 카테고리 분류를 수행한다.

**THE SYSTEM SHALL** gx10 Ollama (gpt-oss:120b via lib/ai/llm-provider.ts getLlmModel())를 호출하고 다음 프롬프트를 전달한다:
```
사용자가 입력한 변경 상세를 다음 카테고리로 분류:
[bom, sw, sw-minor, label, warn, process, sterile]
출력: JSON {"category": string, "confidence": 0-100, "reason": string}
```

**THE SYSTEM SHALL** LLM 응답에서 다음 필드를 추출한다:
- `category`: 분류된 카테고리 (Step 2 선택과 일치 여부 검증)
- `confidence`: 0-100 사이 신뢰도 점수
- `reason`: 분류 사유

**IF** confidence < 80이면, **THE SYSTEM SHALL** 사용자에게 재확인 요청 메시지를 표시하고 Layer 3 티켓 생성을 트리거한다.

**WHERE** confidence >= 80이면, **THE SYSTEM SHALL** 결과를 Layer 4로 전달한다.

### REQ-V3-IMP-007: Layer 3 - RA Inbox 자동 티켓 생성

**WHEN** Layer 2 confidence < 80이면, **THE SYSTEM SHALL** Layer 3 RA Inbox 자동 티켓 생성을 수행한다.

**THE SYSTEM SHALL** domains/inbox 티켓 생성 API를 호출하고 다음 정보를 전달한다:
- `source`: 'impact-wizard'
- `state`: 'needs-review'
- `question`: `"confidence < 80% 자동 분류 실패. RA 전문가 검토 필요."`
- `context`: {
    `product_id`: 선택된 제품 ID,
    `change_category`: 선택된 카테고리,
    `change_detail`: 입력된 변경 상세,
    `markets`: 선택된 시장 목록,
    `llm_result`: Layer 2 분석 결과,
    `retest_matrix_results`: Layer 1 결과
  }

**IF** 티켓 생성이 성공하면, **THE SYSTEM SHALL** 티켓 ID를 사용자에게 표시하고 `impact.ticket.create` audit 로그를 기록한다.

**WHERE** 티켓 생성이 완료되면, **THE SYSTEM SHALL** 최종 결과 페이지에 티켓 CTA를 표시한다.

### REQ-V3-IMP-008: Layer 4 - ra-llm-wiki RAG 유사 사례 조회

**WHEN** Layer 2 confidence >= 80이면, **THE SYSTEM SHALL** Layer 4 ra-llm-wiki RAG 유사 사례 조회를 수행한다.

**THE SYSTEM SHALL** embeddings 테이블을 pgvector 코사인 유사도 검색으로 쿼리한다:
- 필터: `source_repo = 'ra-llm-wiki'`
- 필터: `chunk_meta->>'product_id'` = 선택된 제품 ID
- 필터: `chunk_meta ? 'change_type'` (변경 이력이 있는 청크만)
- 정렬: embedding <=> 쿼리 벡터 (코사인 유사도)
- 제한: LIMIT 3

**THE SYSTEM SHALL** 각 유사 사례에서 다음 정보를 추출한다:
- `chunk_text`: 사례 내용
- `chunk_meta->>'change_type'`: 변경 유형
- `chunk_meta->>'source_path'`: 출처 문서 경로
- 유사도 점수

**IF** RAG 조회가 실패하거나 타임아웃(10초)이면, **THE SYSTEM SHALL** 빈 결과를 반환하고 계속 진행한다.

**WHERE** 유사 사례 조회가 완료되면, **THE SYSTEM SHALL** SimilarCasesCard 형식으로 결과를 정리하고 최종 결과 페이지로 전달한다.

### REQ-V3-IMP-009: 최종 결과 페이지 - 신호등 계산

**WHEN** 모든 4계층 평가가 완료되면, **THE SYSTEM SHALL** 최종 결과 페이지를 생성하고 신호등 결과를 계산한다.

**THE SYSTEM SHALL** 다음 규칙으로 신호등 색상을 결정한다:
- **Green:** 모든 시장 where `level = 'not-required'`
- **Yellow:** 일부 시장 where `level = 'conditional'` OR confidence < 90
- **Red:** 어떤 시장 where `level = 'required'` OR confidence < 70

**THE SYSTEM SHALL** 결과 페이지에 다음을 표시한다:
1. 신호등 결과 (green/yellow/red)
2. retestMatrix 셀 표시 (시장별 level, ref, note)
3. LLM 분석 결과 (category, confidence, reason)
4. 유사 사례 3건 (Layer 4 결과)
5. (필요 시) 티켓 CTA (Layer 3에서 생성된 티켓 링크)

**IF** 신호등이 yellow 또는 red이면, **THE SYSTEM SHALL** `impact.check` audit 로그를 기록한다.

### REQ-V3-IMP-010: retestMatrix 데이터 코드 임베드

**THE SYSTEM SHALL** retestMatrix 데이터를 `lib/domains/impact/retest-matrix-data.ts`로 코드 임베드한다.

**THE SYSTEM SHALL** 다음 구조로 데이터를 정의한다:
```typescript
export const RETEST_MATRIX = {
  changeTypes: [
    { id: 'bom', label: 'BOM 변경 (부품 교체)' },
    { id: 'sw', label: 'SW 알고리즘 재학습' },
    { id: 'sw-minor', label: 'SW 마이너 (버그픽스)' },
    { id: 'label', label: '라벨 문구 변경' },
    { id: 'warn', label: 'Critical Warning 개정' },
    { id: 'process', label: '생산공정 변경' },
    { id: 'sterile', label: '멸균 조건 변경' },
  ],
  markets: [
    { id: 'us', label: 'FDA (US)', color: 'var(--brand-700)' },
    { id: 'eu', label: 'MDR (EU)', color: 'var(--d-pms)' },
    { id: 'kr', label: 'MFDS (KR)', color: 'var(--brand-800)' },
    { id: 'cn', label: 'NMPA (CN)', color: 'var(--danger)' },
    { id: 'jp', label: 'PMDA (JP)', color: 'var(--d-cc)' },
  ],
  cells: {
    // 35셀 (7 × 5)
    'bom-us': { level: 'conditional', ref: 'FDA Design Change §III.A', note: 'Special 510(k) 검토 필요 · Letter to File 가능 케이스' },
    'bom-eu': { level: 'required', ref: 'MDR Art. 120(3), Annex II', note: 'NB 통보 · TR 개정 · 성능시험 재수행' },
    // ... 나머지 33셀
  }
};
```

**THE SYSTEM SHALL** DB 저장 없이 코드로만 데이터를 제공한다 (결정론 데이터).

**IF** retestMatrix 데이터가 누락된 셀이 있으면, **THE SYSTEM SHALL** 런타임 에러를 발생시키고 관리자에게 알림을 생성한다.

### REQ-V3-IMP-011: DB 테이블 확장

**THE SYSTEM SHALL** regulatory_impact_assessments 테이블을 확장하고 다음 신규 컬럼을 추가한다 (nullable):
- `wizard_type`: text ('radar-auto' | 'employee-self-check' | NULL)
- `change_category`: text (bom | sw | sw-minor | label | warn | process | sterile | NULL)
- `change_detail`: text (NULL)
- `markets`: jsonb (['us', 'eu', 'kr', 'cn', 'jp'] | NULL)
- `retest_matrix_results`: jsonb (Layer 1 결과 | NULL)
- `llm_category`: jsonb (Layer 2 결과 | NULL)
- `rag_similar_cases`: jsonb (Layer 4 결과 | NULL)

**THE SYSTEM SHALL** migration 0109를 생성하고 ALTER TABLE 문으로 컬럼을 추가한다.

**THE SYSTEM SHALL** migration 0109에 audit_logs.previous_hash BYTEA 컬럼 추가를 포함한다 (SPEC-V3-AUDIT-CHAIN-001 자체 구현, 의존성 제거).

**IF** 기존 레코드가 있으면, **THE SYSTEM SHALL** 모든 신규 컬럼을 NULL로 설정하고 데이터를 보존한다.

**THE SYSTEM SHALL** 다음 인덱스를 추가한다:
- `idx_wizard_type`: wizard_type
- `idx_change_category`: change_category

### REQ-V3-IMP-012: 21 CFR Part 11 감사 로깅

**WHEN** 위저드가 실행되면, **THE SYSTEM SHALL** 21 CFR Part 11 감사 로그를 기록한다.

**THE SYSTEM SHALL** 다음 audit 이벤트를 기록한다:
- `impact.check`: 위저드 실행 (Employee 자가진단) [신규, migration 0110]
- `impact.ticket.create`: RA Inbox 티켓 생성 (Layer 3) [신규, migration 0110]
- `impact.critical_detected`: critical 영향 감지 (신호등 red) [기존, migration 0104]

**THE SYSTEM SHALL** 각 audit 레코드에 다음 정보를 포함한다:
- `action`: audit_action enum 값
- `user_id`: 실행자 UUID
- `context`: {
    `product_id`: 제품 ID,
    `wizard_type`: 'employee-self-check',
    `change_category`: 변경 카테고리,
    `markets`: 시장 목록,
    `result`: 신호등 결과
  }
- `previous_hash`: 이전 레코드의 SHA-256 해시 (append-only 체인)

**WHERE** audit 로깅이 완료되면, **THE SYSTEM SHALL** audit_log 테이블에 INSERT하고 previous_hash를 업데이트한다.

### REQ-V3-IMP-013: RBAC 권한 검사

**WHEN** Employee가 위저드에 접근하면, **THE SYSTEM SHALL** RBAC 권한 검사를 수행한다.

**THE SYSTEM SHALL** 다음 권한을 검사한다:
- `impact.view`: 위저드 실행 권한 (employee, viewer, ra-member, ra-lead, admin) [신규]
- `impact.self_check`: 자가진단 권한 (employee, viewer) [신규]
- `impact.ra_escalate`: RA 티켓 에스컬레이션 권한 (ra-member, ra-lead, admin) [신규]

**IF** 권한이 없으면, **THE SYSTEM SHALL** 403 Forbidden 응답을 반환하고 `auth.forbidden` audit 로그를 기록한다.

**WHERE** 권한 검사가 통과하면, **THE SYSTEM SHALL** 위저드를 계속 진행한다.

### REQ-V3-IMP-014: RAG Citation 강제 (Charter [지양-2])

**WHEN** Layer 4 RAG 조회가 완료되면, **THE SYSTEM SHALL** 모든 유사 사례에 출처 인용을 포함한다.

**THE SYSTEM SHALL** 각 유사 사례에 다음 형식으로 출처를 표기한다:
```html
<sup class="cite" data-src="{source_path}">{번호}</sup>
```

**IF** 출처가 없는 유사 사례가 있으면, **THE SYSTEM SHALL** 해당 사례를 제외하고 "출처 없는 사례는 신뢰도가 낮습니다" 메시지를 표시한다.

**WHERE** 모든 유사 사례에 출처 인용이 완료되면, **THE SYSTEM SHALL** SimilarCasesCard를 렌더링한다.

### REQ-V3-IMP-015: 기존 SPEC-REGULA-IMPACT-001 비회귀

**THE SYSTEM SHALL** 기존 SPEC-REGULA-IMPACT-001 기능을 보존한다.

**THE SYSTEM SHALL** 기존 API 경로를 유지한다:
- `GET /api/ra/impact`: 영향 평가 목록
- `GET /api/ra/impact/[assessmentId]`: 상세 조회
- `POST /api/admin/radar/impact`: 어드민 트리거

**THE SYSTEM SHALL** 기존 DB 테이블 구조를 보존한다:
- regulatory_impact_assessments 기존 컬럼 유지
- impact_action_items 기존 컬럼 유지
- 기존 audit action enum 값 유지

**IF** 신규 컬럼 추가가 필요하면, **THE SYSTEM SHALL** nullable로 추가하고 기존 레코드를 NULL로 설정한다.

**WHERE** 기존 기능과 신규 기능이 공존할 수 있도록 **THE SYSTEM SHALL** re-export 레이어를 유지한다 (lib/impact/ → lib/domains/impact/).

## 비기능 요구사항 (Non-Functional Requirements)

### REQ-V3-IMP-NFR-001: 성능

**THE SYSTEM SHALL** 다음 성능 목표를 달성한다:
- retestMatrix 조회: < 10ms (in-memory)
- Layer 2 LLM 분류: < 5초 (gx10 Ollama API 호출)
- Layer 4 RAG 조회: < 10초 (pgvector 검색, 타임아웃)
- 전체 위저드 응답 시간: < 20초 (4계층 포함)

### REQ-V3-IMP-NFR-002: 보안

**THE SYSTEM SHALL** 다음 보안 요구사항을 준수한다:
- 모든 위저드 실행은 audit 로깅 (21 CFR Part 11)
- RBAC 권한 검사 (impact.view, impact.self_check)
- SQL Injection 방지 (Drizzle ORM parameterized queries)
- XSS 방지 (자유 텍스트 입력 sanitization)

### REQ-V3-IMP-NFR-003: 신뢰성

**THE SYSTEM SHALL** 다음 신뢰성 요구사항을 준수한다:
- RAG 타임아웃 시 빈 결과 반환하고 계속 진행
- LLM API 실패 시 재시도 최대 3회
- DB 트랜잭션 실패 시 rollback 에러 처리
- 모든 에러는 사용자에게 명확한 메시지로 표시

### REQ-V3-IMP-NFR-004: 유지보수성

**THE SYSTEM SHALL** 다음 유지보수성 요구사항을 준수한다:
- retestMatrix 데이터는 코드 임베드 (DB 아님)
- 타입 안전 TypeScript (strict mode)
- 단위 테스트 커버리지 85% 이상
- Drizzle ORM 타입 안전 쿼리

## 제외 사항 (Exclusions)

### [HARD] 제외 항목 (Phase D 이월)

1. **UI 컴포넌트** (`components/impact-wizard/`)
   - 이유: Phase D-2 SPEC-V3-UI-001에서 통합 구현
   - 백엔드 API만 제공

2. **실시간 알림** (Slack, 이메일)
   - 이유: Phase C 범위 초과
   - 향후 별도 SPEC으로 구현

3. **외부 크롤러** (Radar 웹사이트 크롤링)
   - 이유: domains/radar 도메인 책임
   - RADAR 데이터는 기존 방식대로 공급

4. **ESIG 전자서명**
   - 이유: Phase D-2 구현
   - 현재는 audit 로깅만 수행

### [HARD] 기존 기능 비회귀

1. **기존 API 호환성**
   - `/api/ra/impact` 경로 유지
   - `/api/admin/radar/impact` 경로 유지
   - 기존 클라이언트 깨짐 방지

2. **기존 DB 테이블 구조**
   - regulatory_impact_assessments 기존 컬럼 삭제 금지
   - impact_action_items 기존 컬럼 삭제 금지
   - 신규 컬럼만 nullable 추가

3. **기존 audit action enum**
   - `impact.assessment_created` 유지
   - `impact.critical_detected` 유지
   - `impact.action_item_created` 유지
   - 신규 action만 추가

## 데이터 모델 (Data Model)

### 신규 컬럼 (regulatory_impact_assessments)

| 컬럼명 | 타입 | NULL | 설명 |
|--------|------|------|------|
| wizard_type | text | Y | 'radar-auto' \| 'employee-self-check' |
| change_category | text | Y | bom \| sw \| sw-minor \| label \| warn \| process \| sterile |
| change_detail | text | Y | 변경 상세 자유 텍스트 |
| markets | jsonb | Y | ['us', 'eu', 'kr', 'cn', 'jp'] |
| retest_matrix_results | jsonb | Y | Layer 1 결과 (35셀) |
| llm_category | jsonb | Y | Layer 2 결과 (category, confidence, reason) |
| rag_similar_cases | jsonb | Y | Layer 4 결과 (유사 사례 3건) |

### retestMatrix 데이터 구조

```typescript
interface RetestMatrixCell {
  level: 'required' | 'conditional' | 'not-required';
  ref: string;  // 규정 참조
  note: string; // 설명
}

interface RetestMatrixData {
  changeTypes: Array<{ id: string; label: string }>;
  markets: Array<{ id: string; label: string; color: string }>;
  cells: Record<string, RetestMatrixCell>;  // Key: '{changeType}-{market}'
}
```

## API 계약 (API Contract)

### POST /api/impact-check

**Request:**
```json
{
  "product_id": "uuid",
  "change_category": "bom | sw | sw-minor | label | warn | process | sterile",
  "change_detail": "string (10-2000자)",
  "markets": ["us", "eu", "kr", "cn", "jp"]
}
```

**Response:**
```json
{
  "assessment_id": "uuid",
  "result": {
    "signal": "green | yellow | red",
    "retest_matrix": {
      "us": { "level": "conditional", "ref": "...", "note": "..." },
      "eu": { "level": "required", "ref": "...", "note": "..." },
      // ... 나머지 시장
    },
    "llm_analysis": {
      "category": "bom",
      "confidence": 85,
      "reason": "BOM 변경 패턴 일치"
    },
    "similar_cases": [
      {
        "text": "과거 변경 사례 내용",
        "source": "ra-llm-wiki/doc123.md",
        "similarity": 0.92,
        "change_type": "bom",
        "market": "us"
      }
      // ... 최대 3건
    ],
    "ticket_id": "uuid | null"  // Layer 3에서 생성된 티켓 ID
  }
}
```

## 의존성 (Dependencies)

### 내부 의존성

- `kernel/db`: DB 쿼리, 트랜잭션
- `kernel/audit`: 21 CFR Part 11 로깅
- `domains/ai` (RAG): Layer 4 유사 사례 검색
- `domains/inbox`: Layer 3 티켓 생성
- `domains/registry`: 제품/시장 데이터 조회

### 외부 의존성

- gx10 Ollama (gpt-oss:120b via lib/ai/llm-provider.ts getLlmModel()): Layer 2 LLM 분류
- pgvector: RAG 벡터 검색
- Drizzle ORM: DB 쿼리 빌더

## 마이그레이션 (Migration)

### Migration 0109: impact_wizard_columns

```sql
-- Note: SPEC-V3-AUDIT-CHAIN-001 previous_hash 컬럼 추가 (자체 구현, 의존성 제거)
ALTER TABLE regulatory_impact_assessments
  ADD COLUMN wizard_type text,
  ADD COLUMN change_category text,
  ADD COLUMN change_detail text,
  ADD COLUMN markets jsonb,
  ADD COLUMN retest_matrix_results jsonb,
  ADD COLUMN llm_category jsonb,
  ADD COLUMN rag_similar_cases jsonb;

CREATE INDEX idx_wizard_type ON regulatory_impact_assessments(wizard_type);
CREATE INDEX idx_change_category ON regulatory_impact_assessments(change_category);
```

---

**생성일:** 2026-07-05  
**버전:** 1.0.0  
**상태:** planned  
**다음 단계:** plan.md 구현 계획 수립