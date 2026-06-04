import { expect, test, type Locator, type Page } from '@playwright/test';

function workspaceTabs(page: Page) {
  return page.locator('[data-slot="workspace-tags-bar"] [data-slot="workspace-tag"]');
}

async function tabTexts(page: Page) {
  return await workspaceTabs(page).evaluateAll((nodes) =>
    nodes.map((node) => node.textContent?.replace(/\s+/g, ' ').trim() ?? '')
  );
}

async function expectWorkspaceTabs(page: Page) {
  await expect(page.getByRole('tablist', { name: 'Workspace tabs' })).toBeVisible();
}

async function expectProductList(page: Page) {
  await expect(page).toHaveURL(/\/dashboard\/product$/);
  await expect(page.getByRole('tab', { name: /^产品/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
}

async function expectUsersList(page: Page) {
  await expect(page).toHaveURL(/\/dashboard\/users$/);
  await expect(page.getByRole('tab', { name: /^用户/ })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText('Something went wrong')).toHaveCount(0);
}

async function gotoProduct(page: Page) {
  await page.goto('/dashboard/product');
  await expectWorkspaceTabs(page);
  await expectProductList(page);
}

async function openSidebarPage(page: Page, label: '用户' | '聊天' | '通知') {
  await page.getByRole('link', { name: label, exact: true }).click();

  if (label === '用户') {
    await expectUsersList(page);
    return;
  }

  if (label === '聊天') {
    await expect(page).toHaveURL(/\/dashboard\/chat$/);
    await expect(page.getByRole('tab', { name: /^聊天/ })).toHaveAttribute('aria-selected', 'true');
    return;
  }

  await expect(page).toHaveURL(/\/dashboard\/notifications$/);
  await expect(page.getByRole('tab', { name: /^通知/ })).toHaveAttribute('aria-selected', 'true');
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
  await gotoProduct(page);
  await expect(page.locator('[data-slot="workspace-tag"][data-pinned="home"]')).toBeVisible();
  await expect(page.getByRole('tab', { name: /^产品/ })).toBeVisible();
});

test('@workspace-v2 drag sorting keeps home first and preserves next real click navigation', async ({
  page
}) => {
  await gotoProduct(page);
  await openSidebarPage(page, '用户');
  await openSidebarPage(page, '聊天');

  expect(await tabTexts(page)).toEqual(['仪表盘', '产品', '用户', '聊天']);

  const chatTab = page.getByRole('tab', { name: /^聊天/ });
  const usersTab = page.getByRole('tab', { name: /^用户/ });
  await longPressDragTab(page, chatTab, usersTab);

  await expect(page).toHaveURL(/\/dashboard\/chat$/);
  expect(await tabTexts(page)).toEqual(['仪表盘', '产品', '聊天', '用户']);

  await page.getByRole('tab', { name: /^产品/ }).click();
  await expectProductList(page);

  await openSidebarPage(page, '通知');
  expect(await tabTexts(page)).toEqual(['仪表盘', '产品', '聊天', '用户', '通知']);
});

test('@workspace-v2 drag sorting does not break close actions', async ({ page }) => {
  await gotoProduct(page);
  await openSidebarPage(page, '用户');
  await openSidebarPage(page, '聊天');

  const chatTab = page.getByRole('tab', { name: /^聊天/ });
  const usersTab = page.getByRole('tab', { name: /^用户/ });
  await longPressDragTab(page, chatTab, usersTab);

  expect(await tabTexts(page)).toEqual(['仪表盘', '产品', '聊天', '用户']);

  await page
    .locator('[data-slot="workspace-tag"][data-tab-id="/dashboard/users"] [aria-label="Close 用户"]')
    .click();

  await expect(page.getByRole('tab', { name: /^用户/ })).toHaveCount(0);
  expect(await tabTexts(page)).toEqual(['仪表盘', '产品', '聊天']);
});
