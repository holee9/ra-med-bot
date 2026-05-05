// @MX:NOTE: [AUTO] E2E spec: project switch with conversation preservation
// @MX:SPEC: REQ-LAUNCH-018, SPEC-REGULA-E2EFIX-001 (REQ-E2EFIX-002)

import { expect, test } from '@playwright/test';
import { requiresAuthState, requiresLiveServer } from './fixtures/env-guard';

test.describe('Project switch (REQ-LAUNCH-018)', () => {
  test('project switcher is visible in the sidebar', async ({ page }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

    await page.goto('/chat');

    const switcher = page.locator('[data-testid="project-switcher"]');
    await expect(switcher).toBeVisible();
  });

  test('switching projects navigates to the new project chat', async ({ page }) => {
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

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
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

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
    const s = requiresLiveServer();
    test.skip(s.skip, s.reason);
    const a = requiresAuthState();
    test.skip(a.skip, a.reason);

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
