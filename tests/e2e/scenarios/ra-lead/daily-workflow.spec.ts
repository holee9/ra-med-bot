import { expect, test } from '@playwright/test';

/**
 * RA Lead Daily Workflow E2E Test
 *
 * Purpose: Validate RA Lead's daily workflow (09:00-18:00)
 *
 * Scenarios:
 * 1. 09:00-09:30: CER 문헌 검색 시작
 * 2. 09:30-10:00: SIGN 50 평가 기준 1차 필터링
 * 3. 10:00-11:00: 임상 Lead와 협의
 * 4. 11:00-13:00: Predicate device 비교 분석
 * 5. 14:00-16:00: PCCP 초안 작성
 * 6. 16:00-18:00: 팀 전체 리뷰 및 Expert Review Gate 승인
 */

test.describe('RA Lead Daily Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as RA Lead
    await page.goto('/login');
    await page.fill('[name="email"]', 'ra.lead@example.test');
    await page.fill('[name="password"]', 'test-password');
    await page.click('[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('09:00-09:30: CER 문헌 검색 시작', async ({ page }) => {
    // Navigate to CER workflow
    await page.goto('/workflows/cer');

    // Click PubMed search
    await page.click('[data-testid="pubmed-search"]');

    // Fill search query
    await page.fill('[data-testid="search-query"]', 'cardiovascular stent clinical outcomes');

    // Submit search
    await page.click('[data-testid="search-submit"]');

    // Wait for search results
    await page.waitForSelector('[data-testid="search-results"]');

    // Verify search results count (should be 50+)
    const results = await page.locator('[data-testid="search-results"] > div').count();
    expect(results).toBeGreaterThan(50);

    // Verify search completion message
    await expect(page.locator('[data-testid="search-complete"]')).toBeVisible();
  });

  test('09:30-10:00: SIGN 50 평가 기준 1차 필터링', async ({ page }) => {
    // Navigate to CER workflow
    await page.goto('/workflows/cer');

    // Run SIGN 50 evaluation
    await page.click('[data-testid="sign50-evaluation"]');

    // Wait for evaluation to complete
    await page.waitForSelector('[data-testid="evaluation-complete"]');

    // Check filtered results count (should be 15+)
    const filtered = await page.locator('[data-testid="filtered-results"] > div').count();
    expect(filtered).toBeGreaterThan(15);

    // Verify evaluation accuracy (should be 95%+)
    const accuracy = await page.textContent('[data-testid="evaluation-accuracy"]');
    if (accuracy === null) {
      throw new Error('Missing text content for evaluation accuracy');
    }
    const accuracyPercent = Number.parseFloat(accuracy.replace('%', ''));
    expect(accuracyPercent).toBeGreaterThanOrEqual(95);
  });

  test('10:00-11:00: 임상 Lead와 협의', async ({ page }) => {
    // Navigate to collaboration tab
    await page.goto('/workflows/cer/collaboration');

    // Select first result
    await page.click('[data-testid="result-1"]');

    // Click collaborate tab
    await page.click('[data-testid="collaborate-tab"]');

    // Fill collaboration comment
    await page.fill(
      '[data-testid="collaboration-comment"]',
      '임상적 타당성 평가 요청: Cardiovascular stent 임상 데이터 검토 부탁드립니다.',
    );

    // Send to Clinical Lead
    await page.click('[data-testid="send-to-clinical-lead"]');

    // Verify sent confirmation
    await expect(page.locator('[data-testid="sent-confirmation"]')).toBeVisible();

    // Check collaboration history
    await page.click('[data-testid="collaboration-history"]');
    await expect(page.locator('[data-testid="latest-collaboration"]')).toContainText(
      '임상적 타당성 평가 요청',
    );
  });

  test('11:00-13:00: Predicate device 비교 분석', async ({ page }) => {
    // Navigate to Predicate comparison
    await page.goto('/workflows/predicate-comparison');

    // Select 3 Predicate devices
    await page.click('[data-testid="select-predicate-1"]');
    await page.click('[data-testid="select-predicate-2"]');
    await page.click('[data-testid="select-predicate-3"]');

    // Run comparison
    await page.click('[data-testid="run-comparison"]');

    // Wait for comparison to complete
    await page.waitForSelector('[data-testid="comparison-complete"]');

    // Verify comparison results
    await expect(page.locator('[data-testid="comparison-table"]')).toBeVisible();

    // Check comparison metrics
    const metrics = await page.locator('[data-testid="comparison-metrics"] > div').count();
    expect(metrics).toBeGreaterThan(10); // Should have 10+ comparison metrics

    // Verify visualization
    await expect(page.locator('[data-testid="comparison-chart"]')).toBeVisible();
  });

  test('14:00-16:00: PCCP 초안 작성', async ({ page }) => {
    // Navigate to PCCP wizard
    await page.goto('/workflows/pccp');

    // Start 4-step wizard
    await page.click('[data-testid="start-pccp-wizard"]');

    // Step 1: Device Description
    await page.fill(
      '[data-testid="device-description"]',
      'Cardiovascular stent for coronary artery disease',
    );
    await page.click('[data-testid="step-next"]');

    // Step 2: Intended Use
    await page.fill('[data-testid="intended-use"]', 'Treatment of coronary artery stenosis');
    await page.click('[data-testid="step-next"]');

    // Step 3: Principle Components
    await page.fill(
      '[data-testid="principle-components"]',
      'Stent material, coating system, delivery system',
    );
    await page.click('[data-testid="step-next"]');

    // Step 4: Characteristics
    await page.fill(
      '[data-testid="characteristics"]',
      'Size, material composition, biocompatibility',
    );
    await page.click('[data-testid="step-complete"]');

    // Verify PCCP draft created
    await expect(page.locator('[data-testid="pccp-draft"]')).toBeVisible();

    // Verify structured formatting
    await expect(page.locator('[data-testid="pccp-formatted"]')).toBeVisible();
  });

  test('16:00-18:00: 팀 전체 리뷰 및 Expert Review Gate 승인', async ({ page }) => {
    // Navigate to team review
    await page.goto('/workflows/team-review');

    // Start team review meeting
    await page.click('[data-testid="start-team-review"]');

    // Add team members
    await page.click('[data-testid="add-clinical-lead"]');
    await page.click('[data-testid="add-rd-lead"]');
    await page.click('[data-testid="add-qa-lead"]');

    // Verify team members added
    const teamMembers = await page.locator('[data-testid="team-member"] > div').count();
    expect(teamMembers).toBe(3);

    // Run review
    await page.click('[data-testid="run-review"]');

    // Wait for review to complete
    await page.waitForSelector('[data-testid="review-complete"]');

    // Expert Review Gate approval
    await page.click('[data-testid="expert-review-gate"]');

    // Provide approval comment
    await page.fill(
      '[data-testid="approval-comment"]',
      'All sections reviewed and approved. Ready for submission.',
    );

    // Approve
    await page.click('[data-testid="approve-gate"]');

    // Verify approval confirmation
    await expect(page.locator('[data-testid="approval-confirmed"]')).toBeVisible();

    // Verify audit_logs entry
    await page.goto('/audit-logs');
    await expect(page.locator('[data-testid="audit-entry"]')).toContainText(
      'Expert Review Gate approved by RA Lead',
    );
  });

  test('전체 일일 타임라인 통합 테스트', async ({ page }) => {
    // 09:00-09:30: CER 문헌 검색
    await page.goto('/workflows/cer');
    await page.click('[data-testid="pubmed-search"]');
    await page.fill('[data-testid="search-query"]', 'cardiovascular stent clinical outcomes');
    await page.click('[data-testid="search-submit"]');
    await page.waitForSelector('[data-testid="search-results"]');
    const results = await page.locator('[data-testid="search-results"] > div').count();
    expect(results).toBeGreaterThan(50);

    // 09:30-10:00: SIGN 50 평가
    await page.click('[data-testid="sign50-evaluation"]');
    await page.waitForSelector('[data-testid="evaluation-complete"]');
    const filtered = await page.locator('[data-testid="filtered-results"] > div').count();
    expect(filtered).toBeGreaterThan(15);

    // 10:00-11:00: 임상 Lead 협의
    await page.click('[data-testid="result-1"]');
    await page.click('[data-testid="collaborate-tab"]');
    await page.fill('[data-testid="collaboration-comment"]', '임상적 타당성 평가 요청');
    await page.click('[data-testid="send-to-clinical-lead"]');
    await expect(page.locator('[data-testid="sent-confirmation"]')).toBeVisible();

    // 11:00-13:00: Predicate 비교 분석
    await page.goto('/workflows/predicate-comparison');
    await page.click('[data-testid="select-predicate-1"]');
    await page.click('[data-testid="select-predicate-2"]');
    await page.click('[data-testid="select-predicate-3"]');
    await page.click('[data-testid="run-comparison"]');
    await page.waitForSelector('[data-testid="comparison-complete"]');
    await expect(page.locator('[data-testid="comparison-table"]')).toBeVisible();

    // 14:00-16:00: PCCP 작성
    await page.goto('/workflows/pccp');
    await page.click('[data-testid="start-pccp-wizard"]');
    await page.fill(
      '[data-testid="device-description"]',
      'Cardiovascular stent for coronary artery disease',
    );
    await page.click('[data-testid="step-next"]');
    await page.fill('[data-testid="intended-use"]', 'Treatment of coronary artery stenosis');
    await page.click('[data-testid="step-next"]');
    await page.fill(
      '[data-testid="principle-components"]',
      'Stent material, coating system, delivery system',
    );
    await page.click('[data-testid="step-next"]');
    await page.fill(
      '[data-testid="characteristics"]',
      'Size, material composition, biocompatibility',
    );
    await page.click('[data-testid="step-complete"]');
    await expect(page.locator('[data-testid="pccp-draft"]')).toBeVisible();

    // 16:00-18:00: 팀 리뷰 및 Expert Review Gate
    await page.goto('/workflows/team-review');
    await page.click('[data-testid="start-team-review"]');
    await page.click('[data-testid="add-clinical-lead"]');
    await page.click('[data-testid="add-rd-lead"]');
    await page.click('[data-testid="add-qa-lead"]');
    await page.click('[data-testid="run-review"]');
    await page.waitForSelector('[data-testid="review-complete"]');
    await page.click('[data-testid="expert-review-gate"]');
    await page.fill(
      '[data-testid="approval-comment"]',
      'All sections reviewed and approved. Ready for submission.',
    );
    await page.click('[data-testid="approve-gate"]');
    await expect(page.locator('[data-testid="approval-confirmed"]')).toBeVisible();

    // Verify audit_logs
    await page.goto('/audit-logs');
    await expect(page.locator('[data-testid="audit-entry"]')).toContainText(
      'Expert Review Gate approved by RA Lead',
    );
  });
});
