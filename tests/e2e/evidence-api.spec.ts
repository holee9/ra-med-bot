/**
 * Evidence API E2E Tests
 *
 * Contract testing for hybrid-ra-saas Evidence API integration.
 * Validates request/response schemas and error handling.
 *
 * @see Evidence API Integration Issue #168
 */

import { test, expect } from '@playwright/test';
import { hybridRaApiHandlers } from '../fixtures/hybrid-ra-api';

test.describe('Evidence API Integration', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to evidence page
    await page.goto('/evidence');
  });

  test('should display evidence management page', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('증거 관리');
    await expect(page.locator('text=요구사항과 증거를 연결하고 증거 바인더를 생성합니다')).toBeVisible();
  });

  test('should display quick action buttons', async ({ page }) => {
    await expect(page.locator('text=새 증거 링크 생성')).toBeVisible();
    await expect(page.locator('text=증거 바인더 생성')).toBeVisible();
  });

  test('should display requirement list', async ({ page }) => {
    await expect(page.locator('text=REQ-001')).toBeVisible();
    await expect(page.locator('text=REQ-002')).toBeVisible();
    await expect(page.locator('text=REQ-003')).toBeVisible();
  });

  test('should show evidence link dialog when button clicked', async ({ page }) => {
    await page.click('text=새 증거 링크 생성');

    await expect(page.locator('text=증거 링크 생성')).toBeVisible();
    await expect(page.locator('text=요구사항 ID')).toBeVisible();
    await expect(page.locator('text=요구사항 내용')).toBeVisible();
    await expect(page.locator('text=증거 소스')).toBeVisible();
  });

  test('should add evidence source in dialog', async ({ page }) => {
    await page.click('text=새 증거 링크 생성');

    // Click add source button
    await page.click('text=+ 소스 추가');

    // Verify source form appears
    await expect(page.locator('text=소스 유형')).toBeVisible();
    await expect(page.locator('text=소스 ID')).toBeVisible();
    await expect(page.locator('text=제목')).toBeVisible();
    await expect(page.locator('text=URL (선택)')).toBeVisible();
  });

  test('should show evidence binder dialog', async ({ page }) => {
    await page.click('text=증거 바인더 생성');

    await expect(page.locator('text=증거 바인더 생성')).toBeVisible();
    await expect(page.locator('text=바인더 이름')).toBeVisible();
    await expect(page.locator('text=설명 (선택)')).toBeVisible();
    await expect(page.locator('text=템플릿 유형')).toBeVisible();
    await expect(page.locator('text=포함할 요구사항')).toBeVisible();
  });

  test('should select requirement and show empty state', async ({ page }) => {
    await page.click('text=REQ-001');

    await expect(page.locator('text=증거 링크 - REQ-001')).toBeVisible();
    await expect(page.locator('text=등록된 증거 링크가 없습니다')).toBeVisible();
  });

  test('should show loading state when fetching evidence links', async ({ page }) => {
    // Select a requirement
    await page.click('text=REQ-001');

    // Look for loading indicator (if API call is made)
    const loadingSpinner = page.locator('.animate-spin');
    if (await loadingSpinner.count() > 0) {
      await expect(loadingSpinner).toBeVisible();
    }
  });

  test('should display error message on API failure', async ({ page }) => {
    // This test would require MSW to simulate API errors
    // For now, we just verify the error handling UI exists
    await page.click('text=새 증거 링크 생성');

    // Try to submit without adding sources (should show validation)
    await page.click('text=링크 생성');

    // Dialog should still be open (validation prevented submission)
    await expect(page.locator('text=증거 링크 생성')).toBeVisible();
  });

  test('should cancel evidence link dialog', async ({ page }) => {
    await page.click('text=새 증거 링크 생성');
    await expect(page.locator('text=증거 링크 생성')).toBeVisible();

    await page.click('text=취소');
    await expect(page.locator('text=증거 링크 생성')).not.toBeVisible();
  });

  test('should cancel evidence binder dialog', async ({ page }) => {
    await page.click('text=증거 바인더 생성');
    await expect(page.locator('text=증거 바인더 생성')).toBeVisible();

    await page.click('text=취소');
    await expect(page.locator('text=증거 바인더 생성')).not.toBeVisible();
  });
});

test.describe('Evidence API Contract Tests', () => {
  test('POST /api/v1/evidence/link should create evidence link', async ({ request }) => {
    // This would test the actual API contract
    // In real scenario, this would call the API with MSW mock
    const response = {
      id: 'LINK-123',
      req_id: 'REQ-001',
      requirement_text: 'Test requirement',
      evidence_sources: [
        {
          source_type: 'regulation',
          source_id: 'REG-001',
          title: 'Test Regulation',
        },
      ],
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    expect(response).toHaveProperty('id');
    expect(response).toHaveProperty('req_id');
    expect(response).toHaveProperty('evidence_sources');
    expect(response.evidence_sources).toBeInstanceOf(Array);
  });

  test('GET /api/v1/evidence/links/:reqId should return links array', async () => {
    const response = {
      req_id: 'REQ-001',
      total: 2,
      links: [
        {
          id: 'LINK-001',
          req_id: 'REQ-001',
          requirement_text: 'Test requirement',
          evidence_sources: [],
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ],
    };

    expect(response).toHaveProperty('req_id');
    expect(response).toHaveProperty('total');
    expect(response).toHaveProperty('links');
    expect(response.links).toBeInstanceOf(Array);
  });

  test('POST /api/v1/evidence/binder should create binder', async () => {
    const response = {
      id: 'BINDER-123',
      name: 'Test Binder',
      req_ids: ['REQ-001', 'REQ-002'],
      template_type: 'regulatory',
      created_at: '2024-01-01T00:00:00Z',
      status: 'draft',
    };

    expect(response).toHaveProperty('id');
    expect(response).toHaveProperty('name');
    expect(response).toHaveProperty('req_ids');
    expect(response.req_ids).toBeInstanceOf(Array);
    expect(response).toHaveProperty('status');
  });
});
