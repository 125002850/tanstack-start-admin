import { expect, test, type Page } from '@playwright/test';
import { mockIamSession } from './support/mock-iam-session';

test.beforeEach(async ({ page }) => {
  await mockIamSession(page);
});

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

test.describe('@workspace-v2 infrastructure pages', () => {
  test('opens system-management pages as workspace tabs and switches back', async ({ page }) => {
    await page.goto('/dashboard/overview');
    await expectWorkspaceTabs(page);
    await expect(page.getByRole('tab', { name: /^仪表盘/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );

    await openSidebarPage(page, '字典管理', '/dashboard/system-management/dictionaries');
    await openSidebarPage(page, '导出中心', '/dashboard/system-management/export-center');

    await expect(page.getByRole('tab', { name: /^仪表盘/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^字典管理/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^导出中心/ })).toBeVisible();

    await page.getByRole('tab', { name: /^字典管理/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/system-management\/dictionaries$/);
    await expect(page.getByRole('tab', { name: /^字典管理/ })).toHaveAttribute(
      'aria-selected',
      'true'
    );
  });

  test('context menu close removes a system-management tab', async ({ page }) => {
    await page.goto('/dashboard/overview');
    await expectWorkspaceTabs(page);

    await openSidebarPage(page, '字典管理', '/dashboard/system-management/dictionaries');
    await openSidebarPage(page, '导出中心', '/dashboard/system-management/export-center');

    const tabsBefore = await page.getByRole('tab').count();
    expect(tabsBefore).toBeGreaterThanOrEqual(3);

    await page.getByRole('tab', { name: /^字典管理/ }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: /关闭标签/ }).click();

    await expect(page.getByRole('tab')).toHaveCount(tabsBefore - 1);
    await expect(page.getByRole('tab', { name: /^字典管理/ })).toHaveCount(0);
  });

  test('refresh action is available for infrastructure tabs', async ({ page }) => {
    await page.goto('/dashboard/overview');
    await expectWorkspaceTabs(page);

    await openSidebarPage(page, '导出中心', '/dashboard/system-management/export-center');
    await page.getByRole('tab', { name: /^导出中心/ }).click({ button: 'right' });

    await expect(page.getByRole('menuitem', { name: /刷新页面/ })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /关闭标签/ })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /关闭其他标签/ })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /关闭所有标签/ })).toBeVisible();
  });
});
