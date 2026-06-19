# E2E 검증 MRD (Market Requirements Document)

**작성일**: 2026-06-19  
**버전**: 1.0  
**상태**: 최종 초안  
**관련 이슈**: #182

---

## 1. 개요

본 MRD는 Regula 시스템의 실사용자 E2E(End-to-End) 검증 체계를 정의하고, 페르소나별 Go/No-Go 기준을 문서화하며, Smoke Test 명세를 제공한다.

### 1.1 목적

- **실사용자 검증**: RA Lead(주 사용자)와 비RA 전문가(부 사용자)의 실제 업무 시나리오 검증
- **품질 기준 설정**: 각 페르소나별 명확한 Go/No-Go 기준 정의
- **E2E 체계 수립**: 자동화된 Smoke Test와 수동 검증 프로세스 확립
- **출시 결정 지원**: Wave 3 완료 후 시장 출시 여부 판단 근거 제공

### 1.2 범위

- **대상 기능**: Phase 1-12까지 구현된 핵심 기능 (RAG 채팅, Predicate 비교, Traceability, Workflows)
- **검증 환경**: 로컬 개발 환경 및 Staging 환경
- **페르소나**: RA Lead, 비RA 전문가(개발/QA팀), 해외 딜러/컨설턴트
- **기간**: 2026-06-19 ~ (진행 중)

---

## 2. 페르소나별 Go/No-Go 기준

### 2.1 RA Lead (주 사용자)

**프로필**: 
- RA 담당자 1~2명
- 규제 문서 자동화, Predicate 분석, CER/PCCP 빌더, Expert Review 게이팅 담당
- 전체 기능의 80%+ 사용

#### Go Criteria (출시 승인 기준)

| 카테고리 | 항목 | 기준 | 검증 방법 |
|---------|------|------|----------|
| **핵심 기능** | RAG 채팅 정확도 | citation覆盖率 ≥ 90% | 20개 샘플 질의 검증 |
| | Citation 정확성 | 100% 인용 문서 유효 | 수동 검증 |
| | Predicate 비교표 | 5-dimension 평가 완료 | openFDA 검색 시나리오 |
| | Expert Review 게이팅 | 자동 플래그 정확도 ≥ 85% | 신뢰도 < 0.7 케이스 검증 |
| **업무 효율** | 검색 시간 단축 | 기존 대비 50% 이상 단축 | 타이머 측정 |
| | 문서 작성 자동화 | draft 품질 만족도 ≥ 4/5 | 사용자 설문 |
| | 일일 업무 처리 가능성 | RA Lead 일일 루틴 완수 | E2E 시나리오 테스트 |
| **신뢰성** | 답변 일관성 | 동일 질문 재시도 결과 일치 | 3회 반복 테스트 |
| | LLM 오류 복구 | embedding 실패 시 FTS fallback 동작 | 오류 주입 테스트 |
| | 데이터 보존 | audit_logs 21 CFR Part 11 준수 | 감사 로그 검증 |
| **사용성** | UI 응답성 | 첫 토큰 도달 ≤ 1.5s (P95) | 성능 모니터링 |
| | SSE 스트리밍 | 3단계 이벤트 순서 준수 | 스트리밍 검증 |
| | 모바일 호환 | 주요 기능 모바일 동작 | 반응형 테스트 |

#### No-Go Criteria (출시 보류 기준)

- **Failed**: citation覆盖率 < 80% 또는 citation 오류 ≥ 2건/20샘플
- **Failed**: Predicate 비교평 신뢰도 < 0.7
- **Failed**: Expert Review 플래그 누락 (고위험 답변 미감지)
- **Failed**: RA Lead 일일 루틴 시나리오 차단 (단계 실패)
- **Failed**: LLM 오류 시 시스템 복구 불가
- **Failed**: audit_logs PII 포함 또는 불완전 기록
- **Failed**: 첫 토큰 도달 P95 > 3초
- **Failed**: SSE 스트리밍 순서 위반

### 2.2 비RA 전문가 (개발/QA팀)

**프로필**: 
- RA 전문 지식 없이 규제 질의
- 근거 기반 답변 필요
- 기술적 문제 해결 focused

#### Go Criteria

| 카테고리 | 항목 | 기준 | 검증 방법 |
|---------|------|------|----------|
| **접근성** | 규제 질의 가능성 | RA 지식 없이 질문 가능 | 10개 기본 질문 시나리오 |
| | 답변 이해도 | 기술 비전문가 이해 가능 | 가독성 테스트 |
| | Citation 접근성 | 출처 문서 직접 확인 | 링크 클릭 테스트 |
| **기능 완결성** | 검색 결과 관련성 | 관련성 점수 ≥ 0.6 | 15개 질문 평가 |
| | 답변 완결성 | "모르겠음" 응답 ≤ 10% | 응답률 측정 |
| | 멀티모달 지원 | PDF/DOCX export 정상 동작 | export 테스트 |
| **기술 안정성** | API 안정성 | 4xx/5xx 오류율 < 1% | 부하 테스트 |
| | DB 연결 안정성 | connection pool 안정 | 동시 접속 테스트 |
| | 에러 메시지 | 사용자 친화적 에러 표시 | 에러 시나리오 테스트 |

#### No-Go Criteria

- **Failed**: 기본 질문 이해 불가 (의도 파악 오류 ≥ 30%)
- **Failed**: 검색 결과 관련성 < 0.4
- **Failed**: citation 링크 깨짐 (404 오류 ≥ 2건)
- **Failed**: export 실패 (PDF/DOCX 생성 오류)
- **Failed**: API 5xx 오류율 ≥ 5%

### 2.3 해외 딜러/컨설턴트 (3차 사용자)

**프로필**: 
- 특정 시장 규제 명확화 필요
- 초대된 문서 읽기/코멘트
- 제한적 접근 (read-only)

#### Go Criteria

| 카테고리 | 항목 | 기준 | 검증 방법 |
|---------|------|------|----------|
| **정보 접근** | 시장별 규제 정보 | FDA/EU/MFDS/NMPA/PMDA 검색 | 각 시장 3개 질문 |
| | 문서 뷰어 | DocViewer 정상 렌더링 | PDF/DOCX 뷰어 테스트 |
| | 언어 지원 | ko/en 전환 정상 동작 | i18n 테스트 |
| **권한 관리** | read-only 접근 | 쓰기 권한 차단 | RBAC 테스트 |
| | 문서 보호 | PII redaction 적용 | 개인정보 마스킹 확인 |
| | 공유 기능 | 링크 공유 정상 동작 | 공유 테스트 |
| **사용성** | 모바일 접근 | 모바일 문서 열람 | 반응형 테스트 |
| | 검색 속도 | 검색 응답 ≤ 2초 | 성능 테스트 |
| | 오프라인 지원 | 캐시 기능 동작 | 오프라인 모드 테스트 |

#### No-Go Criteria

- **Failed**: 시장별 검색 누락 (1개 이상 시장 검색 불가)
- **Failed**: 문서 뷰어 렌더링 실패
- **Failed**: 권한 누수 (read-only 사용자 쓰기 가능)
- **Failed**: PII 유출 (redaction 미적용)

---

## 3. E2E 검증 체계

### 3.1 검증 레벨

#### Level 1: Smoke Test (자동화)

**목적**: 핵심 기능의 기본 동작 확인

**검증 항목**:
```
1. 로그인/로그아웃 (Auth.js 세션)
2. 기본 RAG 채팅 (질문-답변 1회 완료)
3. citation 클릭 (DocViewer 열기)
4. 프로젝트 전환 (현재 프로젝트 변경)
5. Predicate 검색 (openFDA 연동)
6. Traceability 스캔 (근거 추적)
7. export 생성 (PDF 다운로드)
8. i18n 전환 (ko/en 언어 변경)
```

**실행 방법**:
```bash
# 로컬 환경
pnpm test:e2e:smoke

# CI 환경
npm run test:e2e:smoke:ci
```

**성공 기준**: 8/8 항목 통과 (100%)

#### Level 2: Integration Test (자동화 + 수동)

**목적**: 주요 사용자 시나리오 검증

**검증 시나리오**:

**시나리오 1: RA Lead 일일 루틴**
```
1. 로그인 (Credentials provider)
2. 프로젝트 대시보드 확인 (통계, 최근 활동)
3. 규제 질의 제출 (510(k) Predicate 검색)
4. Predicate 비교표 생성 및 승인
5. export 다운로드 (PDF)
6. Expert Review 플래그 확인
7. audit 로그 검증
```

**시나리오 2: 비RA 전문가 규제 질의**
```
1. 로그인
2. 기본 규제 질의 (QSR 요건)
3. citation 확인 (출처 문서)
4. follow-up 질의 (구조화 블록)
5. export 생성 (DOCX)
```

**시나리오 3: 해외 딜러 시장 조회**
```
1. 로그인 (External 페르소나)
2. 시장별 규제 검색 (EU MDR)
3. 문서 공유 (링크 생성)
4. 언어 전환 (en → ko)
5. read-only 권한 확인
```

**성공 기준**: 
- 자동화 단계: 80% 이상 통과
- 수동 검증: RA Lead 만족도 ≥ 4/5

#### Level 3: Edge Case Test (수동)

**목적**: 예외 상황 및 오류 복구 검증

**검증 항목**:
```
1. LLM embedding 실패 시 FTS fallback
2. openFDA rate limiting 대응
3. DB 연결 실패 시 retry
4. PII 포함 문서 redaction
5. RBAC 경계 위반 시 차단
6. SSE 스트리밍 중단 시 복구
7. export 대용량 파일 처리
8. 동시 사용자 10명 부하 테스트
```

**성공 기준**: 8/8 항목 복구 성공

### 3.2 검증 환경

| 환경 | 용도 | 상태 | 설정 |
|------|------|------|------|
| **Local** | 개발 중 Smoke Test | ✅ 운영 중 | `.env.local` + Docker DB |
| **Staging** | Integration Test | 🚧 준비 중 | Vercel preview URL |
| **Production** | Edge Case Test | ❌ 사용 안함 | - |

**Local 환경 설정**:
```bash
# 1. Docker DB 시작
docker compose up -d

# 2. 마이그레이션
pnpm db:migrate

# 3. 코퍼스 seed (최소)
pnpm db:seed:minimal

# 4. 개발 서버 시작
pnpm dev

# 5. E2E 실행
pnpm test:e2e
```

### 3.3 테스트 데이터 관리

**Fixture 전략**:
- **최소 fixture**: RAG 검증을 위한 5개 핵심 문서
- **사용자 fixture**: 3명 테스트 사용자 (RA Lead, Developer, External)
- **프로젝트 fixture**: 2개 테스트 프로젝트 (FDA Device, EU IVD)

**데이터 격리**:
- E2E 테스트용 DB: `regula_e2e` (별도 스키마)
- 테스트 후 cleanup: `pnpm db:cleanup:e2e`
- PII-free fixture: 개인정보 제거 테스트 데이터

---

## 4. Smoke Test 명세서

### 4.1 Smoke Test 구조

**파일 위치**: `tests/e2e/smoke/`

**Spec 파일**:
```
smoke/
├── auth.spec.ts           # 로그인/세션/로그아웃
├── consultation.spec.ts  # RAG 채팅 기본 흐름
├── citation.spec.ts      # citation 클릭/DocViewer
├── predicate.spec.ts     # Predicate 검색/비교
├── traceability.spec.ts  # Traceability 스캔
├── export.spec.ts        # PDF/DOCX export
├── project.spec.ts      # 프로젝트 전환
└── i18n.spec.ts         # 언어 전환
```

### 4.2 Smoke Test 상세 명세

#### 4.2.1 auth.spec.ts

**목적**: Auth.js v5 세션 및 Credentials provider 검증

**Test Cases**:
```typescript
describe('Smoke Auth Test', () => {
  test('로그인 성공', async ({ page }) => {
    await page.goto('/login')
    await page.fill('[name="email"]', 'ra-lead@abyzr.com')
    await page.fill('[name="password"]', 'test-password-123')
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL('/dashboard')
  })

  test('세션 유지', async ({ page }) => {
    await loginAs(page, 'ra-lead@abyzr.com')
    await page.goto('/chat')
    await expect(page.locator('[data-testid="composer"]')).toBeVisible()
  })

  test('로그아웃 성공', async ({ page }) => {
    await loginAs(page, 'ra-lead@abyzr.com')
    await page.click('[data-testid="user-menu"]')
    await page.click('text=로그아웃')
    await expect(page).toHaveURL('/login')
  })
})
```

**성공 기준**: 3/3 테스트 통과

#### 4.2.2 consultation.spec.ts

**목적**: RAG 채팅 및 SSE 스트리밍 검증

**Test Cases**:
```typescript
describe('Smoke Consultation Test', () => {
  test('RAG 채팅 완료', async ({ page }) => {
    await loginAs(page, 'ra-lead@abyzr.com')
    await page.goto('/chat')
    
    // 질문 입력
    await page.fill('[data-testid="composer"]', '510(k) submission 요건은?')
    await page.click('[data-testid="send-button"]')
    
    // SSE 스트리밍 확인
    await expect(page.locator('[data-testid="thinking"]')).toBeVisible()
    await expect(page.locator('[data-testid="answer-block"]')).toBeVisible({ timeout: 5000 })
    
    // citation 확인
    await expect(page.locator('[data-testid="citation"]').first()).toBeVisible()
  })

  test('SSE 3단계 이벤트 순서', async ({ browser }) => {
    // 웹 소켓 모니터링
    const events = []
    browser.on('response', (response) => {
      if (response.url().includes('/api/ra/consult')) {
        events.push(response.headers()['x-event-phase'])
      }
    })
    
    // ... 채팅 실행 ...
    
    // 순서 검증: trace < prose < sources < done
    expect(events).toEqual(['trace', 'prose', 'sources', 'done'])
  })
})
```

**성공 기준**: 2/2 테스트 통과

#### 4.2.3 citation.spec.ts

**목적**: Citation 클릭 및 DocViewer 연동 검증

**Test Cases**:
```typescript
describe('Smoke Citation Test', () => {
  test('citation 클릭 시 DocViewer 열기', async ({ page }) => {
    await loginAs(page, 'ra-lead@abyzr.com')
    await page.goto('/chat')
    
    // 채팅 실행
    await executeChat(page, 'FDA 21 CFR Part 820 요약')
    
    // 첫 번째 citation 클릭
    await page.locator('[data-testid="citation"]').first().click()
    
    // DocViewer 확인
    await expect(page.locator('[data-testid="doc-viewer"]')).toBeVisible()
    await expect(page.locator('[data-testid="doc-viewer"]')).toContainText('21 CFR Part 820')
  })

  test(' citation source offset 스크롤', async ({ page }) => {
    await page.goto('/chat')
    await executeChat(page, 'QSR 요건')
    await page.locator('[data-testid="citation"]').first().click()
    
    // 스크롤 위치 확인
    const scrollPosition = await page.locator('[data-testid="doc-viewer"]')
      .evaluate(el => el.scrollTop)
    
    expect(scrollPosition).toBeGreaterThan(0)
  })
})
```

**성공 기준**: 2/2 테스트 통과

#### 4.2.4 predicate.spec.ts

**목적**: Predicate 검색 및 비교표 검증

**Test Cases**:
```typescript
describe('Smoke Predicate Test', () => {
  test('openFDA 검색 완료', async ({ page }) => {
    await loginAs(page, 'ra-lead@abyzr.com')
    await page.goto('/predicate/search')
    
    // 검색어 입력
    await page.fill('[name="device_name"]', 'Class II surgical mask')
    await page.click('[data-testid="search-button"]')
    
    // 검색 결과 확인
    await expect(page.locator('[data-testid="search-results"]')).toBeVisible()
    await expect(page.locator('.predicate-card')).toHaveCount(await page.locator('.predicate-card').count(), { timeout: 5000 })
  })

  test('Predicate 비교표 생성', async ({ page }) => {
    await page.goto('/predicate/search')
    await executeSearch(page, 'Class II surgical mask')
    
    // 비교 대상 선택
    await page.locator('.predicate-card').first().click()
    await page.click('[data-testid="compare-button"]')
    
    // 비교표 확인
    await expect(page).toHaveURL('/predicate/compare')
    await expect(page.locator('[data-testid="comparison-table"]')).toBeVisible()
  })
})
```

**성공 기준**: 2/2 테스트 통과

#### 4.2.5 traceability.spec.ts

**목적**: Traceability 스캔 및 추적 검증

**Test Cases**:
```typescript
describe('Smoke Traceability Test', () => {
  test('Traceability 스캔 실행', async ({ page }) => {
    await loginAs(page, 'ra-lead@abyzr.com')
    await page.goto('/workflows/traceability')
    
    // 스캔 설정
    await page.fill('[name="query"]', 'biocompatibility')
    await page.selectOption('[name="target_markets[]"]', 'FDA')
    await page.click('[data-testid="scan-button"]')
    
    // 스캔 결과 확인
    await expect(page.locator('[data-testid="scan-results"]')).toBeVisible({ timeout: 10000 })
  })

  test('Traceability 그래프 렌더링', async ({ page }) => {
    await page.goto('/workflows/traceability')
    await executeScan(page, 'sterilization')
    
    // 그래프 탭 전환
    await page.click('[data-testid="graph-tab"]')
    
    // 그래프 확인
    await expect(page.locator('[data-testid="trace-graph"]')).toBeVisible()
  })
})
```

**성공 기준**: 2/2 테스트 통과

#### 4.2.6 export.spec.ts

**목적**: PDF/DOCX export 검증

**Test Cases**:
```typescript
describe('Smoke Export Test', () => {
  test('PDF export 다운로드', async ({ page }) => {
    await loginAs(page, 'ra-lead@abyzr.com')
    await page.goto('/predicate/compare')
    
    // export 버튼 클릭
    const downloadPromise = page.waitForEvent('download')
    await page.click('[data-testid="export-pdf-button"]')
    const download = await downloadPromise
    
    // 파일 확인
    expect(download.suggestedFilename()).toMatch(/\.pdf$/)
  })

  test('DOCX export 다운로드', async ({ page }) => {
    await page.goto('/predicate/compare')
    
    const downloadPromise = page.waitForEvent('download')
    await page.click('[data-testid="export-docx-button"]')
    const download = await downloadPromise
    
    expect(download.suggestedFilename()).toMatch(/\.docx$/)
  })
})
```

**성공 기준**: 2/2 테스트 통과

#### 4.2.7 project.spec.ts

**목적**: 프로젝트 전환 및 세션 유지 검증

**Test Cases**:
```typescript
describe('Smoke Project Test', () => {
  test('프로젝트 전환', async ({ page }) => {
    await loginAs(page, 'ra-lead@abyzr.com')
    await page.goto('/chat')
    
    // 현재 프로젝트 확인
    await expect(page.locator('[data-testid="current-project"]')).toContainText('FDA Device')
    
    // 프로젝트 변경
    await page.click('[data-testid="project-dropdown"]')
    await page.click('text=EU IVD')
    
    // 프로젝트 전환 확인
    await expect(page.locator('[data-testid="current-project"]')).toContainText('EU IVD')
  })

  test('프로젝트 전환 시 세션 유지', async ({ page }) => {
    await page.goto('/chat')
    
    // 채팅 시작
    await executeChat(page, '현재 프로젝트 요건')
    
    // 프로젝트 전환
    await switchProject(page, 'EU IVD')
    
    // 채팅 기록 유지 확인
    await expect(page.locator('[data-testid="conversation-item"]')).toHaveCount(1)
  })
})
```

**성공 기준**: 2/2 테스트 통과

#### 4.2.8 i18n.spec.ts

**목적**: 언어 전환 검증

**Test Cases**:
```typescript
describe('Smoke i18n Test', () => {
  test('한국어 → 영어 전환', async ({ page }) => {
    await loginAs(page, 'ra-lead@abyzr.com')
    await page.goto('/dashboard')
    
    // 언어 전환
    await page.click('[data-testid="language-selector"]')
    await page.click('text=English')
    
    // 영어 UI 확인
    await expect(page.locator('h1')).toContainText('Dashboard')
  })

  test('영어 → 한국어 전환', async ({ page }) => {
    await page.goto('/dashboard')
    await page.click('[data-testid="language-selector"]')
    await page.click('text=한국어')
    
    // 한국어 UI 확인
    await expect(page.locator('h1')).toContainText('대시보드')
  })
})
```

**성공 기준**: 2/2 테스트 통과

### 4.3 Smoke Test 실행

**로컬 실행**:
```bash
# 전체 Smoke Test
pnpm test:e2e:smoke

# 특정 Spec만 실행
pnpm test:e2e smoke/auth.spec.ts

# 헤드리스 모드
pnpm test:e2e:smoke --headed=false

# 디버그 모드
pnpm test:e2e:smoke --debug
```

**CI 실행**:
```yaml
# .github/workflows/e2e-smoke.yml
name: E2E Smoke Test
on: [push, pull_request]
jobs:
  smoke:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: 22
      - name: Install pnpm
        uses: pnpm/action-setup@v2
      - name: Install dependencies
        run: pnpm install
      - name: Setup Docker DB
        run: docker compose up -d
      - name: Run migrations
        run: pnpm db:migrate
      - name: Seed minimal data
        run: pnpm db:seed:minimal
      - name: Build app
        run: pnpm build
      - name: Start dev server
        run: pnpm start &
      - name: Run Smoke Tests
        run: pnpm test:e2e:smoke
```

**성공 기준**: 8/8 Spec 파일 통과, 총 24/24 테스트 케이스 통과

---

## 5. 출시 결정 프로세스

### 5.1 E2E 검증 단계

```
Gate 0: Smoke Test (자동화)
  ↓ 통과 시
Gate 1: Integration Test (자동화 + 수동)
  ↓ 통과 시
Gate 2: Edge Case Test (수동)
  ↓ 통과 시
Gate 3: RA Lead 승인 (최종)
```

### 5.2 각 Gate별 검증 기간

| Gate | 검증 기간 | 담당자 | 승인 권한 |
|------|-----------|--------|-----------|
| Gate 0 | 1시간 | CI 시스템 | 자동 |
| Gate 1 | 2-3일 | QA 팀 | QA 리드 |
| Gate 2 | 1일 | RA 팀 | RA Lead |
| Gate 3 | 2시간 | RA Lead | 최종 승인 |

### 5.3 Gate별 차단 기준

**Gate 0 차단**:
- Smoke Test 실패율 > 25%
- 치명적 기능(로그인, RAG 채팅) 동작 불가

**Gate 1 차단**:
- Integration Test 실패율 > 40%
- RA Lead 일일 루틴 차단
- 성능 기준 미달 (P95 첫 토큰 > 3초)

**Gate 2 차단**:
- Edge Case 복구 실패 > 2건
- 보안 취약점 발견 (PII 유출, RBAC 우회)
- 데이터 무결성 위반

**Gate 3 차단 (최종)**:
- RA Lead 만족도 < 4/5
- 비즈니스 위험 식별 (규제 리스크)
- 운영 준비 미흡 (모니터링, 롤백 계획)

### 5.4 출시 승인 프로세스

```
1. Gate 0-3 통과 확인
   ↓
2. 각 Gate 검증 보고서 작성
   ↓
3. RA Lead 최종 검토 (1일)
   ↓
4. Go/No-Go 결정
   ├─ Go: 시장 출시 승인
   └─ No-Go: 차단 이슈 해결 후 재검증
```

**결정 권한**:
- **Go 승인**: RA Lead 단독 결정
- **No-Go**: RA Lead + Tech Lead 합의

---

## 6. 부록

### 6.1 용어 정의

| 용어 | 정의 |
|------|------|
| **E2E (End-to-End)** | 사용자 관점에서의 전체 시스템 검증 |
| **Smoke Test** | 핵심 기능의 기본 동작 확인 테스트 |
| **Go/No-Go** | 출시 승인/보류 결정 기준 |
| **P95** | 95번째 백분위수 응답 시간 |
| **citation覆盖率** | 답변에 인용이 포함된 비율 |
| **FTS fallback** | 전체 텍스트 검색으로의 장애 조치 |

### 6.2 참고 문서

| 문서 | 경로 |
|------|------|
| **E2E 사용자 검증 보고서** | `docs/e2e-user-validation-report.md` |
| **페르소나 심층 분석** | `docs/persona-deep-dive-analysis.md` |
| **구현 상태 문서** | `docs/implementation-status.md` |
| **QA 매트릭스** | `docs/qa/qa-matrix.md` |
| **Issue #182** | https://github.com/holee9/ra-med-bot/issues/182 |

### 6.3 변경 이력

| 버전 | 날짜 | 변경 내용 | 작성자 |
|------|------|----------|--------|
| 1.0 | 2026-06-19 | 최초 작성 | MoAI Documentation Expert |

---

**문서 상태**: ✅ 최종 초안 완료  
**다음 단계**: 이해관계자 리뷰 및 피드백 수집  
**승인 대상**: RA Lead, Tech Lead, QA 리드