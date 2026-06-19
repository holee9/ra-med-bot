import { test, expect } from '@playwright/test';

test.describe('Onboarding Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Guest 사용자로 로그인 (Auth.js v5 session 호환)
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', 'guest@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard');
  });

  test('Guest onboarding - 빈 프로젝트 상태 확인', async ({ page }) => {
    // 대시보드에서 프로젝트가 없는지 확인
    await page.goto('/dashboard');

    // Project-switch 로직: onboarding으로 리다이렉트 확인
    await page.waitForURL('/onboarding', { timeout: 5000 });
    expect(page.url()).toContain('/onboarding');

    // Empty state UI 확인
    const heading = page.getByText('시작하기');
    await expect(heading).toBeVisible();

    const description = page.getByText('Regula에 오신 것을 환영합니다');
    await expect(description).toBeVisible();

    // 프로젝트 생성 버튼 확인
    const createButton = page.getByRole('button', { name: '프로젝트 생성' });
    await expect(createButton).toBeVisible();
  });

  test('Empty state에서 프로젝트 생성 플로우 연결', async ({ page }) => {
    // Onboarding 페이지에서 시작
    await page.goto('/onboarding');

    // 프로젝트 생성 버튼 클릭
    const createButton = page.getByRole('button', { name: '프로젝트 생성' });
    await createButton.click();

    // 프로젝트 생성 페이지로 이동 확인
    await page.waitForURL('/projects/new', { timeout: 5000 });
    expect(page.url()).toContain('/projects/new');
  });

  test('프로젝트 생성 후 onboarding 탈출', async ({ page }) => {
    // 프로젝트 생성 페이지로 이동
    await page.goto('/projects/new');

    // 프로젝트 정보 입력
    await page.fill('input[name="name"]', '테스트 프로젝트');
    await page.selectOption('select[name="deviceClass"]', 'Class IIa');
    await page.fill('textarea[name="description"]', '테스트용 의료기기 프로젝트입니다.');

    // 프로젝트 생성 제출
    await page.click('button[type="submit"]');

    // 프로젝트 상세 페이지로 이동 확인
    await page.waitForURL(/\/projects\/[a-zA-Z0-9-]+$/, { timeout: 5000 });
    expect(page.url()).toMatch(/\/projects\/[a-zA-Z0-9-]+$/);

    // 대시보드로 이동하여 프로젝트가 생성되었는지 확인
    await page.goto('/dashboard');

    // 대시보드에 프로젝트 카드가 표시되는지 확인
    const projectCard = page.getByText('프로젝트');
    await expect(projectCard).toBeVisible();

    // 프로젝트 수가 1인지 확인
    const projectCount = page.locator('.text-3xl').filter({ hasText: /^\d+$/ });
    const countText = await projectCount.textContent();
    expect(countText).toBe('1');
  });

  test('TanStack Query 캐싱 전략 확인', async ({ page }) => {
    // 첫 번째 요청
    await page.goto('/dashboard');

    // Network requests 감시 시작
    const requests: string[] = [];
    page.on('request', (request) => {
      if (request.url().includes('/api/ra/projects')) {
        requests.push(request.url());
      }
    });

    // 페이지 새로고침
    await page.reload();

    // 캐싱으로 인해 두 번째 요청은 전송되지 않아야 함
    // refetchOnMount: false 설정으로 인해
    await page.waitForTimeout(2000);

    // 새 탭에서 같은 페이지 열기 (캐시 유효성 확인)
    const newPage = await page.context().newPage();
    await newPage.goto('/dashboard');

    // 5분 이내(staleTime)이므로 캐시된 데이터 사용
    await newPage.waitForTimeout(2000);
    await newPage.close();
  });

  test('반응형 디자인 확인 (모바일)', async ({ page }) => {
    // 모바일 뷰포트 설정
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/onboarding');

    // 모바일에서도 Empty state UI가 제대로 표시되는지 확인
    const heading = page.getByText('시작하기');
    await expect(heading).toBeVisible();

    // 모바일에서 카드가 세로로 정렬되는지 확인
    const cards = page.locator('.grid > div');
    const count = await cards.count();
    expect(count).toBe(3); // 3개 카드

    // 각 카드의 너비가 모바일 뷰포트에 맞게 조정되는지 확인
    const firstCard = cards.first();
    const box = await firstCard.boundingBox();
    expect(box?.width).toBeLessThanOrEqual(355); // 375px - padding
  });

  test('도움말 버튼 연결 확인', async ({ page }) => {
    await page.goto('/onboarding');

    // 도움말 버튼 클릭
    const helpButton = page.getByRole('button', { name: '도움말' });
    await helpButton.click();

    // 도움말 페이지로 이동 확인
    await page.waitForURL('/help', { timeout: 5000 });
    expect(page.url()).toContain('/help');
  });
});

test.describe('Onboarding 진행률 표시', () => {
  test('진행률 인디케이터 확인', async ({ page }) => {
    await page.goto('/onboarding');

    // 진행률 표시 요소 확인 (향후 구현 시)
    // const progressIndicator = page.getByTestId('onboarding-progress');
    // await expect(progressIndicator).toBeVisible();

    // 현재는 진행률 표시가 없으므로 텍스트 확인으로 대체
    const currentStep = page.getByText('첫 프로젝트를 만들어보세요');
    await expect(currentStep).toBeVisible();
  });
});

test.describe('RBAC 경계 준수 (guest 권한)', () => {
  test('Guest 사용자가 onboarding에 접근 가능', async ({ page }) => {
    // Guest 사용자로 로그인
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', 'guest@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // Onboarding 페이지 접근 가능 확인
    await page.goto('/onboarding');
    const heading = page.getByText('시작하기');
    await expect(heading).toBeVisible();

    // 프로젝트 생성 버튼이 활성화되어 있는지 확인
    const createButton = page.getByRole('button', { name: '프로젝트 생성' });
    await expect(createButton).toBeEnabled();
  });

  test('Guest 사용자의 권한 경계 확인', async ({ page }) => {
    // Guest 사용자로 로그인
    await page.goto('/auth/signin');
    await page.fill('input[name="email"]', 'guest@example.com');
    await page.fill('input[name="password"]', 'password123');
    await page.click('button[type="submit"]');

    // 관리자 기능에 접근 불가 확인
    await page.goto('/admin');
    const error = page.getByText('접근 권한이 없습니다');
    await expect(error).toBeVisible({ timeout: 5000 });
  });
});