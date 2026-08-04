import { expect, test, type Locator, type Page } from '@playwright/test';
import { mockIamSession } from './support/mock-iam-session';
import { mockMdmWorkspaceApis } from './support/mock-mdm-workspace-apis';

test.beforeEach(async ({ page }) => {
  await mockIamSession(page);
  await mockMdmWorkspaceApis(page);
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

async function dragTab(page: Page, source: Locator, target: Locator) {
  await expect(source).toBeVisible();
  await expect(target).toBeVisible();

  const readRect = (locator: Locator) =>
    locator.evaluate((element) => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    });
  const sourceBox = await readRect(source);
  const targetBox = await readRect(target);

  const sourceX = sourceBox.x + sourceBox.width / 2;
  const sourceY = sourceBox.y + sourceBox.height / 2;
  const targetX = targetBox.x + targetBox.width / 4;
  const targetY = targetBox.y + targetBox.height / 2;

  await page.mouse.move(sourceX, sourceY);
  await page.mouse.down();
  await page.mouse.move(targetX, targetY, { steps: 14 });
  await page.mouse.up();

  // dnd-kit 会在拖拽结束后的 50ms 内拦截 click，防止 pointerup 合成的点击误触。
  // 等待该保护窗口结束，再验证一次独立的用户操作。
  await page.waitForTimeout(75);
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
  await dragTab(page, exportTab, dictionaryTab);

  await expect(page).toHaveURL(/\/dashboard\/system-management\/export-center$/);
  await expect.poll(() => tabTexts(page)).toEqual(['仪表盘', '导出中心', '字典管理']);

  const dictionaryTabAfterDrag = page.getByRole('tab', { name: /^字典管理/ });
  await dictionaryTabAfterDrag.focus();
  await dictionaryTabAfterDrag.press('Enter');
  await expect(page).toHaveURL(/\/dashboard\/system-management\/dictionaries$/);
});

test('@workspace-v2 drag sorting does not break close actions', async ({ page }) => {
  await page.goto('/dashboard/overview');
  await expectWorkspaceTabs(page);
  await openSidebarPage(page, '字典管理', '/dashboard/system-management/dictionaries');
  await openSidebarPage(page, '导出中心', '/dashboard/system-management/export-center');

  const exportTab = page.getByRole('tab', { name: /^导出中心/ });
  const dictionaryTab = page.getByRole('tab', { name: /^字典管理/ });
  await dragTab(page, exportTab, dictionaryTab);

  await expect.poll(() => tabTexts(page)).toEqual(['仪表盘', '导出中心', '字典管理']);

  const dictionaryShell = page.locator(
    '[data-slot="workspace-tag-shell"][data-tab-id="/dashboard/system-management/dictionaries"]'
  );
  await dictionaryShell.hover();
  await dictionaryShell.getByRole('button', { name: '关闭：字典管理' }).click();

  await expect(page.getByRole('tab', { name: /^字典管理/ })).toHaveCount(0);
  expect(await tabTexts(page)).toEqual(['仪表盘', '导出中心']);
});
