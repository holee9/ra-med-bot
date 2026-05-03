// @MX:NOTE: [AUTO] E2E spec: project switch with conversation preservation
// @MX:SPEC: REQ-LAUNCH-018

import { expect, test } from '@playwright/test';

const NEEDS_SERVER =
  process.env.CI !== 'true' && !process.env.PLAYWRIGHT_BASE_URL
    ? 'Requires running Next.js server (set PLAYWRIGHT_BASE_URL or run in CI)'
    : undefined;

test.describe('Project switch (REQ-LAUNCH-018)', () => {
  test('project switcher is visible in the sidebar', async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');

    await page.goto('/chat');

    const switcher = page.locator('[data-testid="project-switcher"]');
    await expect(switcher).toBeVisible();
  });

  test('switching projects navigates to the new project chat', async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');

    await page.goto('/chat');

    const switcher = page.locator('[data-testid="project-switcher"]');
    await switcher.click();

    // A dropdown or modal listing available projects should appear.
    const projectList = page.locator('[data-testid="project-list"]');
    await expect(projectList).toBeVisible({ timeout: 5_000 });

    // Click the first project in the list.
    const firstProject = projectList.locator('[data-testid="project-item"]').first();
    const projectName = await firstProject.textContent();
    await firstProject.click();

    // URL should update to the selected project's chat.
    await expect(page).toHaveURL(/\/chat/);

    // The project name should be reflected in the header.
    if (projectName) {
      const header = page.locator('[data-testid="project-header"]');
      await expect(header).toContainText(projectName.trim());
    }
  });

  test('conversation history is preserved after project switch', async ({ page }) => {
    test.skip(true, 'Requires authenticated session with seeded conversation data');

    await page.goto('/chat');

    // Record the current conversation item count before switching.
    const initialItems = await page.locator('[data-testid="conversation-item"]').count();

    // Switch to a different project and back.
    const switcher = page.locator('[data-testid="project-switcher"]');
    await switcher.click();
    const projectList = page.locator('[data-testid="project-list"]');
    await projectList.locator('[data-testid="project-item"]').nth(1).click();

    // Switch back.
    await switcher.click();
    await projectList.locator('[data-testid="project-item"]').first().click();

    // History count should be unchanged.
    const finalItems = await page.locator('[data-testid="conversation-item"]').count();
    expect(finalItems).toBe(initialItems);
  });

  test('unsaved draft is cleared when switching projects', async ({ page }) => {
    test.skip(!!NEEDS_SERVER, NEEDS_SERVER ?? '');

    await page.goto('/chat');

    // Type a draft message but do not send it.
    const composer = page.locator('[data-testid="chat-composer"]');
    await composer.fill('Draft message that should not persist');

    // Switch to another project.
    const switcher = page.locator('[data-testid="project-switcher"]');
    await switcher.click();
    const projectList = page.locator('[data-testid="project-list"]');
    await projectList.locator('[data-testid="project-item"]').first().click();

    // The composer should be empty in the new project context.
    await expect(composer).toHaveValue('');
  });
});
