# SPEC-E2E-USER-VALIDATION-001

## 이슈 정보
- **Issue:** #182
- **Title:** 실사용자 E2E 검증 체계 수립
- **생성일:** 2026-06-18
- **우선순위:** P0 (사용자 직접 요청)

---

## 1. 목적

**핵심 목표:** 페르소나 분석(12-14명 역할 구조)를 적용한 실사용자 E2E 검증 체계를 수립하여, RA Lead 실무 흐름을 검증하고 법적 방어 가능성 평가 기준을 마련한다.

**사용자 피드백 반영:**
- "p0에 대한 e2e 검증 보고 먼저해. 실제로 앱실행하면서 사용자 관점에서 평가한거야? go-no go로 한거야? 실 사용자 관점에서 평가가 되어야하고..."
- "e2e 검증에 이번 페르소나를 적용하는거야? 그래서 1순위인거야?"

---

## 2. 배경

### 2.1 현재 상황

**P0 완료 항목 (2026-06-18 기준):**
- ✅ DB Drift (#161): dev DB migration drift 수정
- ✅ CI Gate (#149): CI Quality Gate 복구
- ✅ RBAC (#150): `/api/ra/projects/[id]` RBAC 누락 수정
- ✅ PII Redaction (#151): 관리자 업로드 PII redaction 3-layer

**P0 누락 항목:**
- ❌ **실사용자 E2E 검증:** 기능적 완료 ≠ 실사용자 관점 검증

### 2.2 페르소나 분석 결과

**확장된 역할 구조 (12-14명):**

| 팀 | 역할 | 인원 | Go/No-Go 기준 |
|---|---|---|---|
| **RA 팀** | RA Lead | 1-2명 | FDA 510(k), EU MDR 제출 경험 5년 이상 |
| | RA Specialist | 1-2명 | 지역별 규제 제출 경험 3년 이상 |
| **임상/의학 팀** | Clinical Lead | 1명 | 의학/임상 경력 10년 이상, 의사 면허 필수 |
| | Medical Writer | 1-2명 | 의학 저술 경력 3년 이상 |
| **R&D/공학 팀** | R&D Lead | 1명 | 의료기기 R&D 경력 10년 이상 |
| | Engineering Specialist | 1-2명 | 공학 경력 5년 이상 |
| **품질경영 팀** | QA Lead | 1명 | QM 자격증, 의료기기 QA 경력 5년 이상 |
| | Documentation Specialist | 1-2명 | 기술 문서 작성 경력 3년 이상 |
| **법무/리스크 팀** | Legal Counsel | 1명 | 의료기기 규제 법무 경력 5년 이상 |
| | Risk Manager | 0-1명 | 위험성 평가 경력 5년 이상 |
| **지원 팀** | Dev | 2명 | Regula 개발 및 유지보수 |
| | Exec | 1명 | 제출 진행상황 모니터링 |

**총 인원:** 12-14명 (현재 6-8명 → 6-9명 추가 필요)

### 2.3 실사용자 검증의 필요성

**문제점 1: 법적 방어 가능성 공백**
- 현재 6-8명 구조로는 임상/의학적 전문성 부족
- CER/PCCP에서 임상적 근거 평가 시 전문성 부족으로 법적 취약점 발생

**문제점 2: 기능적 완료 ≠ 실사용자 관점 검증**
- 자동화 기능이 동작한다 ≠ 실제 업무 흐름에 통합됨
- P0 항목 기능적 완료 이후, 실사용자가 사용하는 Go/No-Go 판단 부족

---

## 3. 요구사항

### 3.1 실사용자 E2E 검증 체계

#### REQ-E2E-001: 페르소나별 시나리오 기반 테스트 계획

**설명:** 각 페르소나별 실제 업무 시나리오를 정의하고, 이를 E2E 테스트로 구현한다.

**수용 기준:**
- [ ] 12-14명 페르소나 각각에 대한 실제 업무 시나리오 정의
- [ ] 각 시나리오별 Regula 활용 포인트 식별
- [ ] 각 시나리오별 Go/No-Go 기준 명시
- [ ] Playwright E2E 테스트로 구현 (시나리오별 최소 1개 이상)

**테스트 방법:**
```bash
# 각 페르소나별 테스트 실행
PLAYWRIGHT_AUTH_STATE=tests/e2e/fixtures/.auth.json \
PLAYWRIGHT_BASE_URL=http://localhost:3000 \
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/snap/bin/chromium \
pnpm exec playwright tests/e2e/scenarios/ra-lead/
```

#### REQ-E2E-002: RA Lead 실무 흐름 검증

**설명:** RA Lead의 일일 타임라인을 기반으로 실제 업무 흐름을 E2E 테스트로 검증한다.

**수용 기준:**
- [ ] 09:00-18:00 일일 타임라인 시나리오 구현
- [ ] CER 문헌 검색 (PubMed 자동 수집) 시나리오
- [ ] Predicate device 비교 분석 시나리오
- [ ] PCCP 4단계 위저드 시나리오
- [ ] 팀 협업 및 리뷰 시나리오
- [ ] Expert Review Gate 승인 시나리오

**테스트 방법:**
```typescript
// tests/e2e/scenarios/ra-lead/daily-workflow.spec.ts
test('RA Lead daily workflow', async ({ page }) => {
  // 09:00: CER 문헌 검색 시작
  await page.goto('/workflows/cer');
  await page.click('[data-testid="pubmed-search"]');
  await page.fill('[data-testid="search-query"]', 'cardiovascular stent clinical outcomes');
  await page.click('[data-testid="search-submit"]');
  
  // 09:30: SIGN 50 평가 기준 1차 필터링
  await page.waitForSelector('[data-testid="search-results"]');
  const results = await page.locator('[data-testid="search-results"] > div').count();
  expect(results).toBeGreaterThan(50);
  
  // 10:00: 임상 Lead와 협의
  await page.click('[data-testid="result-1"]');
  await page.click('[data-testid="collaborate-tab"]');
  await page.fill('[data-testid="collaboration-comment"]', '임상적 타당성 평가 요청');
  await page.click('[data-testid="send-to-clinical-lead"]');
  
  // ... 추가 시나리오
});
```

#### REQ-E2E-003: 법적 방어 가능성 평가 기준

**설명:** 각 페르소나별 Go/No-Go 기준을 정의하고, 이를 자동으로 평가하는 체계를 마련한다.

**수용 기준:**
- [ ] 각 페르소나별 Go/No-Go 기준 문서화
- [ ] Go/No-Go 기준 자동 평가 스크립트
- [ ] 평가 결과 보고서 생성 기능
- [ ] 평가 결과 이력 추적 (audit_logs)

**평가 기준 예시:**
```typescript
// tests/e2e/criteria/ra-lead-go-no-go.spec.ts
const RA_LEAD_GO_CRITERIA = {
  experience: {
    fda_510k: '5년 이상',
    eu_mdr: 'Class IIb/III 제출 경험 2건 이상'
  },
  knowledge: {
    regulation: 'FDA/EU MDR/MFDS/NMPA/PMDA 규제 지식',
    documentation: '영어 문서 작성 능력'
  }
};

test('RA Lead Go/No-Go evaluation', async ({ page }) => {
  // Go/No-Go 기준 평가
  const evaluation = await evaluateGoNoGo(page, RA_LEAD_GO_CRITERIA);
  expect(evaluation.decision).toBe('GO');
  expect(evaluation.score).toBeGreaterThan(0.8);
});
```

#### REQ-E2E-004: Go/No-Go 결정 프로세스

**설명:** 실사용자 E2E 검증 결과를 기반으로 Go/No-Go 결정 프로세스를 정의한다.

**수용 기준:**
- [ ] Go/No-Go 결정 기준 문서화
- [ ] 결정 프로세스 워크플로우 정의
- [ ] 결정 결과 보고서 생성 기능
- [ ] 결정 이력 추적 (audit_logs)

**결정 프로세스:**
```
1. 페르소나별 시나리오 테스트 실행
2. 각 시나리오별 점수 산출 (0.0-1.0)
3. 가중 평균 종합 점수 계산
4. Go/No-Go 기준 비교
   - Go: 종합 점수 >= 0.8
   - No-Go: 종합 점수 < 0.8
5. 결정 결과 보고서 생성
6. 결정 이력 저장 (audit_logs)
```

#### REQ-E2E-005: 실사용자 관점 평가 보고서

**설명:** 실사용자 E2E 검증 결과를 종합한 보고서를 생성한다.

**수용 기준:**
- [ ] 페르소나별 평가 결과 요약
- [ ] 시나리오별 점수 및 피드백
- [ ] 법적 방어 가능성 평가
- [ ] Go/No-Go 결정 결과
- [ ] 개선 제안 사항

**보고서 구조:**
```markdown
# 실사용자 E2E 검증 보고서

## 1. 페르소나별 평가 결과

### RA Lead (1-2명)
- **시나리오 점수:** 0.85/1.0
- **Go/No-Go:** GO
- **주요 피드백:**
  - PubMed 자동 수집 기능 우수 (40-80시간 → 10-15시간)
  - SIGN 50 자동 평가 정확도 95%
  - Predicate 비교 분석 시각화 개선 필요

### Clinical Lead (1명)
- **시나리오 점수:** 0.78/1.0
- **Go/No-Go:** GO
- **주요 피드백:**
  - 협업 기능 직관성 우수
  - 임상 문헌 평가 기능 개선 필요

## 2. 법적 방어 가능성 평가

- **임상/의학적 전문성:** GO (Clinical Lead, Medical Writer 역할 도입)
- **공학적/기술적 평가 전문성:** GO (R&D Lead, Engineering Specialist 역할 도입)
- **품질경영/검증 전문성:** GO (QA Lead, Documentation Specialist 역할 도입)
- **법무/리스크 관리 전문성:** GO (Legal Counsel, Risk Manager 역할 도입)

## 3. Go/No-Go 결정 결과

- **종합 점수:** 0.82/1.0
- **결정:** GO
- **다음 단계:** 페르소나별 채용 우선순위 제안

## 4. 개선 제안 사항

1. Predicate 비교 분석 시각화 개선
2. 임상 문헌 평가 기능 개선
3. 협업 기능 알림 시스템 강화
```

---

## 4. 구현 계획

### Phase 1: 페르소나별 시나리오 정의 (1일)
- 12-14명 페르소나별 실제 업무 시나리오 정의
- 각 시나리오별 Regula 활용 포인트 식별
- 각 시나리오별 Go/No-Go 기준 명시

### Phase 2: E2E 테스트 구현 (2일)
- Playwright E2E 테스트 구현 (시나리오별 최소 1개 이상)
- RA Lead 일일 타임라인 시나리오 구현
- Go/No-Go 기준 평가 스크립트 구현

### Phase 3: 실사용자 관점 평가 실행 (1일)
- 각 페르소나별 시나리오 테스트 실행
- 시나리오별 점수 산출
- 법적 방어 가능성 평가

### Phase 4: Go/No-Go 결정 및 보고 (1일)
- 종합 점수 계산
- Go/No-Go 결정
- 실사용자 관점 평가 보고서 생성

**총 예상 기간:** 5일

---

## 5. 성공 기준

### 5.1 기능적 완료 기준
- [ ] 12-14명 페르소나별 시나리오 정의 완료
- [ ] 각 시나리오별 E2E 테스트 구현 완료
- [ ] Go/No-Go 기준 평가 스크립트 구현 완료
- [ ] 실사용자 관점 평가 보고서 생성 완료

### 5.2 품질 기준
- [ ] 모든 E2E 테스트 통과 (100%)
- [ ] 법적 방어 가능성 평가 완료 (4가지 문제점 모두 GO)
- [ ] 종합 점수 >= 0.8 (Go/No-Go 기준 충족)

### 5.3 사용자 관점 기준
- [ ] RA Lead 실무 흐름 검증 완료
- [ ] 각 페르소나별 Go/No-Go 기준 충족
- [ ] 실사용자 관점에서의 개선점 식별

---

## 6. 참고 자료

- [페르소나 딥다이브 분석](../../../docs/persona-deep-dive-analysis.md)
- [제품 포지션 헌장](../../../.claude/projects/-home-abyz-lab-work-workspace-github-holee9-ra-med-bot/memory/product-charter.md)
- [프로젝트 상태](../../../.claude/projects/-home-abyz-lab-work-workspace-github-holee9-ra-med-bot/memory/project-state.md)
- [E2E 환경 설정](../../../.claude/projects/-home-abyz-lab-work-workspace-github-holee9-ra-med-bot/memory/e2e-env.md)

---

## 7. 이슈 참조

- Issue #182: 실사용자 E2E 검증 체계 수립
- Issue #161: dev DB migration drift 수정
- Issue #149: CI Quality Gate 복구
- Issue #150: `/api/ra/projects/[id]` RBAC 누락 수정
- Issue #151: 관리자 업로드 PII redaction 3-layer

---

## 8. 버전 관리

- **v1.0** (2026-06-18): 초기 SPEC 작성
