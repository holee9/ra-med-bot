# SPEC-V3-IMPACT-001: Change Impact 4-Layer Wizard

## Acceptance Criteria Document

---
**SPEC ID:** SPEC-V3-IMPACT-001
**Version:** 1.0.0
**Status:** planned
**Created:** 2026-07-05
---

## Acceptance Criteria (AC)

### AC-IMP-01: 위저드 Step 1 - 제품 선택

**Given:** Employee가 위저드를 시작하고 Step 1에 도달했을 때
**When:** 제품 목록을 로드할 때
**Then:**
- 제품 목록이 표시된다 (product.id, product.name, product.type, product_markets)
- 최소 1개 이상의 제품이 표시된다 (등록된 제품이 있는 경우)
- 제품이 없으면 안내 메시지가 표시된다

**Given:** 제품을 선택했을 때
**When:** Step 2로 이동할 때
**Then:**
- 선택된 제품의 등록된 시장 정보가 Step 4로 전달된다

### AC-IMP-02: 위저드 Step 2 - 변경 카테고리 선택

**Given:** Employee가 Step 2에 도달했을 때
**When:** 카테고리 목록을 표시할 때
**Then:**
- 7개 카테고리가 표시된다 (BOM, SW, SW-minor, label, warn, process, sterile)
- 각 카테고리에 설명이 제공된다

**Given:** 카테고리를 선택했을 때
**When:** Step 3로 이동할 때
**Then:**
- 선택된 카테고리 ID가 Step 3으로 전달된다

### AC-IMP-03: 위저드 Step 3 - 변경 상세 입력

**Given:** Employee가 Step 3에 도달했을 때
**When:** 자유 텍스트 입력 필드를 표시할 때
**Then:**
- 입력 필드가 표시된다 (최소 10자, 최대 2000자)
- 안내 메시지가 표시된다 ("변경 내용을 구체적으로 기술하세요")

**Given:** 변경 상세를 입력했을 때
**When:** Step 4로 이동할 때
**Then:**
- 입력된 텍스트가 Layer 2 LLM 분석으로 전달된다

### AC-IMP-04: 위저드 Step 4 - 영향 시장 선택

**Given:** Employee가 Step 4에 도달했을 때
**When:** 시장 목록을 표시할 때
**Then:**
- 5개 시장이 표시된다 (FDA/US, MDR/EU, MFDS/KR, NMPA/CN, PMDA/JP)
- Step 1에서 선택한 제품의 등록된 시장이 기본값으로 설정된다

**Given:** 시장을 선택하고 "평가 시작"을 클릭했을 때
**When:** 4계층 평가를 트리거할 때
**Then:**
- 선택된 시장 목록이 평가 엔진으로 전달된다

### AC-IMP-05: Layer 1 - retestMatrix 룰 조회

**Given:** changeType='bom'이고 market='us'일 때
**When:** Layer 1 retestMatrix 조회를 수행할 때
**Then:**
- 'bom-us' 셀이 조회된다
- level='conditional', ref='FDA Design Change §III.A', note='Special 510(k) 검토 필요'가 반환된다

**Given:** changeType='sw'이고 market='eu'일 때
**When:** Layer 1 retestMatrix 조회를 수행할 때
**Then:**
- 'sw-eu' 셀이 조회된다
- level='required', ref='MDR Art. 10(9), MDCG 2024-9', note='CIP 없으면 TR 개정 필수'가 반환된다

**Given:** 선택된 모든 시장에 대해 조회할 때
**When:** Layer 1이 완료될 때
**Then:**
- 5개 시장 모두에 대한 retestMatrix 셀 값이 반환된다
- 조회 시간이 < 10ms이다 (in-memory 데이터)

### AC-IMP-06: Layer 2 - LLM 카테고리 분류

**Given:** Step 3에서 입력한 change_detail="BLE 4.2 → 5.3 SoC 교체 및 안테나 재설계"일 때
**When:** Layer 2 LLM 분류를 수행할 때
**Then:**
- gx10 Ollama API가 호출된다
- 응답: {"category": "bom", "confidence": 92, "reason": "SoC 교체는 BOM 변경 패턴"}
- confidence >= 80이므로 Layer 4로 진행한다

**Given:** confidence < 80일 때 (예: confidence=65)
**When:** Layer 2가 완료될 때
**Then:**
- 사용자에게 재확인 요청 메시지가 표시된다
- Layer 3 티켓 생성이 트리거된다

**Given:** LLM API 호출이 실패했을 때
**When:** 재시도 3회 모두 실패할 때
**Then:**
- 에러 메시지가 표시된다
- 사용자에게 수동 RA 상담 제안이 표시된다

### AC-IMP-07: Layer 3 - RA Inbox 자동 티켓 생성

**Given:** Layer 2 confidence < 80일 때
**When:** Layer 3 티켓 생성을 수행할 때
**Then:**
- domains/inbox 티켓 생성 API가 호출된다
- 티켓 state='needs-review'
- 티켓 question="confidence < 80% 자동 분류 실패. RA 전문가 검토 필요."
- 티켓 context에 모든 위저드 입력이 포함된다

**Given:** 티켓 생성이 성공했을 때
**When:** audit 로깅을 수행할 때
**Then:**
- `impact.ticket.create` audit 로그가 기록된다
- 티켓 ID가 사용자에게 표시된다

**Given:** 티켓 생성이 실패했을 때 (예: inbox API 다운)
**When:** 에러 처리를 수행할 때
**Then:**
- 에러 메시지가 표시된다
- 위저드 결과는 여전히 표시된다 (티켓 생성 실패는 평가 결과에 영향하지 않음)

### AC-IMP-08: Layer 4 - ra-llm-wiki RAG 유사 사례 조회

**Given:** confidence >= 80이고 product_id='xray-src'일 때
**When:** Layer 4 RAG 조회를 수행할 때
**Then:**
- embeddings 테이블이 pgvector 코사인 유사도 검색으로 쿼리된다
- 필터: source_repo='ra-llm-wiki', product_id='xray-src'
- 최대 3건의 유사 사례가 반환된다
- 각 사례에 chunk_text, source_path, change_type, similarity가 포함된다

**Given:** RAG 조회가 완료되었을 때
**When:** SimilarCasesCard를 렌더링할 때
**Then:**
- 각 유사 사례에 출처 인용이 표시된다 (<sup class="cite">1</sup>)
- 출처를 클릭하면 원본 문서 링크로 이동한다

**Given:** RAG 조회가 타임아웃(10초)했을 때
**When:** 에러 처리를 수행할 때
**Then:**
- 빈 결과가 반환된다
- 위저드는 계속 진행된다
- 사용자에게 "유사 사례 조회 실패" 메시지가 표시된다

### AC-IMP-09: 최종 결과 페이지 - 신호등 계산

**Given:** 모든 시장 where level='not-required'일 때
**When:** 신호등을 계산할 때
**Then:**
- 결과는 **Green**이다
- "모든 시장에서 재시험 불필요" 메시지가 표시된다

**Given:** 일부 시장 where level='conditional' 또는 confidence < 90일 때
**When:** 신호등을 계산할 때
**Then:**
- 결과는 **Yellow**이다
- "일부 시장에서 조건부 재시험 필요" 메시지가 표시된다

**Given:** 어떤 시장 where level='required' 또는 confidence < 70일 때
**When:** 신호등을 계산할 때
**Then:**
- 결과는 **Red**이다
- "적어도 하나의 시장에서 필수 재시험 필요" 메시지가 표시된다

**Given:** 신호든 결과가 계산되었을 때
**When:** 최종 결과 페이지를 표시할 때
**Then:**
- 신호등 색상이 표시된다 (Green/Yellow/Red)
- retestMatrix 셀이 표시된다 (시장별 level, ref, note)
- LLM 분석 결과가 표시된다 (category, confidence, reason)
- 유사 사례 3건이 표시된다 (Layer 4 결과)
- (필요 시) 티켓 CTA가 표시된다

### AC-IMP-10: retestMatrix 데이터 코드 임베드

**Given:** 애플리케이션이 시작될 때
**When:** retestMatrix 데이터를 로드할 때
**Then:**
- `lib/domains/impact/retest-matrix-data.ts`가 로드된다
- 7 changeTypes가 정의된다
- 5 markets가 정의된다
- 35개 셀 (7 × 5)이 정의된다

**Given:** retestMatrix 셀을 조회할 때
**When:** 'bom-us' 키로 조회할 때
**Then:**
- 해당 셀 값이 반환된다 (level, ref, note)
- 조회 시간이 < 1ms이다 (in-memory object)

**Given:** retestMatrix 데이터에 누락된 셀이 있을 때
**When:** 런타임에 조회할 때
**Then:**
- 런타임 에러가 발생한다
- 관리자에게 알림이 생성된다

### AC-IMP-11: DB 테이블 확장

**Given:** migration 0109가 실행될 때
**When:** regulatory_impact_assessments 테이블을 확장할 때
**Then:**
- 7개 신규 컬럼이 추가된다 (wizard_type, change_category, change_detail, markets, retest_matrix_results, llm_category, rag_similar_cases)
- 모든 신규 컬럼은 nullable이다
- 기존 레코드는 모든 신규 컬럼이 NULL이다

**Given:** 기존 regulatory_impact_assessments 레코드가 있을 때
**When:** migration 0109를 실행할 때
**Then:**
- 기존 레코드가 보존된다 (삭제/변경 없음)
- wizard_type = NULL (기존 레코는 radar-auto임)
- 신규 컬럼 모두 NULL

**Given:** 신규 컬럼이 추가된 후
**When:** Drizzle Kit check를 실행할 때
**Then:**
- 타입 검증이 통과한다
- FK 관계가 깨지지 않는다

### AC-IMP-12: 21 CFR Part 11 감사 로깅

**Given:** Employee가 위저드를 실행했을 때
**When:** audit 로깅을 수행할 때
**Then:**
- `impact.check` audit 로그가 기록된다
- user_id가 실행자 UUID로 기록된다
- context에 product_id, wizard_type, change_category, markets, result가 포함된다
- previous_hash가 이전 레코드의 SHA-256 해시로 설정된다

**Given:** Layer 3에서 티켓이 생성되었을 때
**When:** audit 로깅을 수행할 때
**Then:**
- `impact.ticket.create` audit 로그가 기록된다
- context에 ticket_id가 포함된다

**Given:** 신호등이 Red일 때
**When:** audit 로깅을 수행할 때
**Then:**
- `impact.critical_detected` audit 로그가 기록된다
- context에 critical_reason이 포함된다

### AC-IMP-13: RBAC 권한 검사

**Given:** Employee 역할이 impact.view 권한이 있을 때
**When:** 위저드에 접근할 때
**Then:**
- 접근이 허용된다
- 위저드 Step 1이 표시된다

**Given:** Employee 역할이 impact.view 권한이 없을 때
**When:** 위저드에 접근할 때
**Then:**
- 403 Forbidden 응답이 반환된다
- `auth.forbidden` audit 로그가 기록된다

**Given:** Employee 역할이 impact.self_check 권한이 있을 때
**When:** POST /api/impact-check를 호출할 때
**Then:**
- 요청이 처리된다
- 4계층 평가가 수행된다

**Given:** Employee 역할이 impact.self_check 권한이 없을 때
**When:** POST /api/impact-check를 호출할 때
**Then:**
- 403 Forbidden 응답이 반환된다

### AC-IMP-14: RAG Citation 강제 (Charter [지양-2])

**Given:** Layer 4 유사 사례가 조회되었을 때
**When:** SimilarCasesCard를 렌더링할 때
**Then:**
- 모든 유사 사례에 출처 인용이 포함된다 (<sup class="cite" data-src="...">번호</sup>)
- 출처를 클릭하면 원본 문서로 이동한다

**Given:** 출처가 누락된 유사 사례가 있을 때
**When:** SimilarCasesCard를 렌더링할 때
**Then:**
- 해당 사례는 제외된다
- "출처 없는 사례는 신뢰도가 낮습니다" 메시지가 표시된다

**Given:** 모든 유사 사례에 출처가 있을 때
**When:** SimilarCasesCard를 렌더링할 때
**Then:**
- 최대 3건의 유사 사례가 표시된다
- 각 사례에 출처 인용이 표시된다

### AC-IMP-15: 기존 SPEC-REGULA-IMPACT-001 비회귀

**Given:** 기존 `/api/ra/impact` API가 존재할 때
**When:** lib/impact/ → lib/domains/impact/ 이동 후
**Then:**
- `/api/ra/impact` API가 여전히 동작한다
- 기존 클라이언트가 깨지지 않는다
- 기존 테스트 79개가 전체 통과한다

**Given:** 기존 regulatory_impact_assessments 레코드가 있을 때
**When:** migration 0109를 실행할 때
**Then:**
- 기존 레코드가 보존된다
- 기존 컬럼이 삭제되지 않는다
- 신규 컬럼이 NULL로 추가된다

**Given:** 기존 audit action enum이 있을 때
**When:** 신규 audit action을 추가할 때
**Then:**
- 기존 action (impact.assessment_created, impact.critical_detected, impact.action_item_created)이 유지된다
- 신규 action만 추가된다

## Edge Cases

### Edge Case 1: 빈 포트폴리오

**Given:** 제품이 등록되어 있지 않을 때
**When:** Employee가 위저드를 시작할 때
**Then:**
- Step 1에 "등록된 제품이 없습니다" 메시지가 표시된다
- 위저드가 진행되지 않는다

### Edge Case 2: retestMatrix 셀 누락

**Given:** retestMatrix 데이터에 'process-kr' 셀이 누락되었을 때
**When:** changeType='process', market='kr'로 조회할 때
**Then:**
- 런타임 에러가 발생한다
- 관리자에게 "retestMatrix 셀 누락: process-kr" 알림이 생성된다

### Edge Case 3: RAG 타임아웃

**Given:** RAG查询가 10초 이상 소요할 때
**When:** 타임아웃이 발생할 때
**Then:**
- 빈 결과가 반환된다
- 위저드는 계속 진행된다
- "유사 사례 조회 시간 초과" 메시지가 표시된다

### Edge Case 4: Cross-org 접근

**Given:** Organization A의 Employee가 Organization B의 제품에 접근하려 할 때
**When:** 위저드를 실행할 때
**Then:**
- RBAC 권한 검사가 실패한다
- 403 Forbidden 응답이 반환된다
- `auth.forbidden` audit 로그가 기록된다

### Edge Case 5: 동시 변경 평가

**Given:** 동일한 제품에 대해 2명의 Employee가 동시에 위저드를 실행할 때
**When:** 4계층 평가를 수행할 때
**Then:**
- 각 평가가 독립적으로 수행된다
- 각 평가가 별도의 regulatory_impact_assessments 레코드를 생성한다
- DB 트랜잭션 충돌이 발생하지 않는다

### Edge Case 6: LLM API Rate Limit

**Given:** LLM API가 rate limit에 도달했을 때
**When:** Layer 2 분류를 수행할 때
**Then:**
- 재시도가 수행된다 (최대 3회)
- 3회 모두 실패하면 에러 메시지가 표시된다
- "LLM API 일시 오류, 나중에 다시 시도하세요" 메시지가 표시된다

### Edge Case 7: 등록되지 않은 시장 선택

**Given:** 제품이 US, EU에만 등록되어 있을 때
**When:** Employee가 KR, CN, JP를 선택할 때
**Then:**
- 경고 메시지가 표시된다 ("선택한 시장에 제품이 등록되어 있지 않습니다")
- 확인 대화상자가 표시된다
- 확인 시 계속 진행, 취소 시 시장 선택 화면으로 돌아간다

### Edge Case 8: change_detail 2000자 초과

**Given:** Employee가 change_detail에 2500자를 입력했을 때
**When:** Step 3에서 "다음"을 클릭할 때
**Then:**
- 입력 검증이 실패한다
- "최대 2000자까지 입력 가능합니다" 에러가 표시된다
- Step 3에 머물러 있다

## Quality Gate Criteria

### Definition of Done (DoD)

**SPEC-V3-IMPACT-001은 다음 조건을 모두 충족할 때 "완료"로 간주한다:**

1. **기능 완료:**
   - [ ] 15개 AC (AC-IMP-01 ~ AC-IMP-15)가 모두 통과한다
   - [ ] 4계층 평가 엔진이 정상 동작한다
   - [ ] retestMatrix 35셀 데이터가 코드 임베드되었다
   - [ ] Layer 4 RAG 조회가 정상 동작한다
   - [ ] Layer 3 RA Inbox 티켓 생성이 정상 동작한다

2. **데이터베이스:**
   - [ ] Migration 0109가 성공적으로 적용되었다
   - [ ] 기존 regulatory_impact_assessments 레코드가 보존되었다
   - [ ] Drizzle Kit check가 통과한다

3. **감사 로깅:**
   - [ ] `impact.check` audit 로그가 정상 기록된다
   - [ ] `impact.ticket.create` audit 로그가 정상 기록된다
   - [ ] `impact.critical_detected` audit 로그가 정상 기록된다
   - [ ] previous_hash 체인이 정상 동작한다

4. **RBAC:**
   - [ ] impact.view 권한 검사가 정상 동작한다
   - [ ] impact.self_check 권한 검사가 정상 동작한다
   - [ ] 권한 없는 사용자 접근이 403로 차단된다

5. **비회귀:**
   - [ ] 기존 `/api/ra/impact` API가 여전히 동작한다
   - [ ] 기존 테스트 79개가 전체 통과한다
   - [ ] 기존 audit action enum이 유지되었다

6. **성능:**
   - [ ] retestMatrix 조회 < 10ms
   - [ ] Layer 2 LLM 분류 < 5초
   - [ ] Layer 4 RAG 조회 < 10초
   - [ ] 전체 위저드 응답 < 20초

7. **보안:**
   - [ ] SQL Injection 방지 (Drizzle ORM)
   - [ ] XSS 방지 (입력 sanitization)
   - [ ] RBAC 권한 검사
   - [ ] Audit 로깅

8. **테스트:**
   - [ ] 단위 테스트 커버리지 85% 이상
   - [ ] 통합 테스트 통과
   - [ ] Edge Case 테스트 통과 (8개 edge cases)

### 테스트 전략

**단위 테스트 (Unit Tests):**
- `lib/domains/impact/retest-matrix-data.ts`: 35셀 데이터 구조 검증
- `lib/domains/impact/layer1-matrix-lookup.ts`: retestMatrix 조회 로직
- `lib/domains/impact/layer2-llm-classifier.ts`: LLM 분류 파싱
- `lib/domains/impact/layer3-ticket-creator.ts`: 티켓 생성 로직
- `lib/domains/impact/layer4-rag-similar-cases.ts`: RAG 조회 로직
- `lib/domains/impact/signal-calculator.ts`: 신호등 계산 로직

**통합 테스트 (Integration Tests):**
- POST /api/impact-check end-to-end 테스트
- 4계층 순차 실행 테스트
- DB transaction 테스트
- Audit 로깅 테스트
- RBAC 권한 검사 테스트

**Edge Case 테스트:**
- 빈 포트폴리오 시나리오
- retestMatrix 셀 누락 시나리오
- RAG 타임아웃 시나리오
- Cross-org 접근 시나리오
- 동시 변경 평가 시나리오
- LLM API rate limit 시나리오
- 등록되지 않은 시장 선택 시나리오
- change_detail 2000자 초과 시나리오

---

**생성일:** 2026-07-05  
**버전:** 1.0.0  
**상태:** planned  
**총 AC 개수:** 15개  
**총 Edge Cases:** 8개