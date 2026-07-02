import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockLoginInfo } from './support/mock-login-info';

test.beforeEach(async ({ page }) => {
  await mockLoginInfo(page);
});

function workspaceTags(page: Page) {
  return page.locator('[data-slot="workspace-tags-bar"] [data-slot="workspace-tag"]');
}

async function tabTexts(page: Page) {
  return await workspaceTags(page).evaluateAll((nodes) =>
    nodes.map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '')
  );
}

async function expectWorkspaceTabs(page: Page) {
  await expect(page.getByRole('tablist', { name: 'Workspace tabs' })).toBeVisible();
}

async function openSidebarPage(page: Page, label: string, path: string) {
  await page.getByRole('link', { name: label, exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${path}$`));
  await expect(page.getByRole('tab', { name: new RegExp(`^${label}`) })).toHaveAttribute(
    'aria-selected',
    'true'
  );
}

async function longPressDragTab(page: Page, source: Locator, target: Locator) {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();

  if (!sourceBox || !targetBox) {
    throw new Error('tab bounding box unavailable');
  }

  const sourceX = sourceBox.x + sourceBox.width / 2;
  const sourceY = sourceBox.y + sourceBox.height / 2;
  const targetX = targetBox.x + targetBox.width / 2;
  const targetY = targetBox.y + targetBox.height / 2;

  await page.mouse.move(sourceX, sourceY);
  await page.mouse.down();
  await page.waitForTimeout(220);
  await page.mouse.move(targetX, targetY, { steps: 14 });
  await page.mouse.up();
}

test('@preflight @workspace-v2 tags bar drag preflight is reachable', async ({ page }) => {
  await page.goto('/dashboard/overview');
  await expectWorkspaceTabs(page);
  await expect(page.locator('[data-slot="workspace-tag"][data-pinned="home"]')).toBeVisible();
  await expect(page.getByRole('tab', { name: /^仪表盘/ })).toBeVisible();
});

test('@workspace-v2 drag sorting keeps home first and preserves navigation', async ({ page }) => {
  await page.goto('/dashboard/overview');
  await expectWorkspaceTabs(page);
  await openSidebarPage(page, '字典管理', '/dashboard/system-management/dictionaries');
  await openSidebarPage(page, '导出中心', '/dashboard/system-management/export-center');

  expect(await tabTexts(page)).toEqual(['仪表盘', '字典管理', '导出中心']);

  const exportTab = page.getByRole('tab', { name: /^导出中心/ });
  const dictionaryTab = page.getByRole('tab', { name: /^字典管理/ });
  await longPressDragTab(page, exportTab, dictionaryTab);

  await expect(page).toHaveURL(/\/dashboard\/system-management\/export-center$/);
  expect(await tabTexts(page)).toEqual(['仪表盘', '导出中心', '字典管理']);

  await dictionaryTab.click();
  await expect(page).toHaveURL(/\/dashboard\/system-management\/dictionaries$/);
});

test('@workspace-v2 drag sorting does not break close actions', async ({ page }) => {
  await page.goto('/dashboard/overview');
  await expectWorkspaceTabs(page);
  await openSidebarPage(page, '字典管理', '/dashboard/system-management/dictionaries');
  await openSidebarPage(page, '导出中心', '/dashboard/system-management/export-center');

  const exportTab = page.getByRole('tab', { name: /^导出中心/ });
  const dictionaryTab = page.getByRole('tab', { name: /^字典管理/ });
  await longPressDragTab(page, exportTab, dictionaryTab);

  expect(await tabTexts(page)).toEqual(['仪表盘', '导出中心', '字典管理']);

  await page
    .locator(
      '[data-slot="workspace-tag"][data-tab-id="/dashboard/system-management/dictionaries"] [aria-label="Close 字典管理"]'
    )
    .click();

  await expect(page.getByRole('tab', { name: /^字典管理/ })).toHaveCount(0);
  expect(await tabTexts(page)).toEqual(['仪表盘', '导出中心']);
});
