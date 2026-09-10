import { expect, test, type Page } from '@playwright/test';
import { mockLoginInfo } from './support/mock-login-info';

test.beforeEach(async ({ page }) => {
  await mockLoginInfo(page);
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

for (const background of [false, true]) {
  test(`@workspace-v2 refreshes ${background ? 'background' : 'active'} tab tree and resets local filters`, async ({
    page
  }) => {
    let version = '刷新前';
    let requests = 0;
    await page.route('**/api/system/dict/global/types/list-all', async (route) => {
      await route.fulfill({
        json: {
          code: 200,
          msg: 'ok',
          data: [
            {
              id: 1,
              dictTypeCode: 'workspace_e2e',
              dictTypeName: '刷新测试',
              status: 'enable'
            }
          ]
        }
      });
    });
    await page.route('**/api/system/dict/global/items/by-type', async (route) => {
      requests++;
      await route.fulfill({
        json: {
          code: 200,
          msg: 'ok',
          data: {
            total: 1,
            list: [
              {
                id: 1,
                dictTypeCode: 'workspace_e2e',
                dictItemCode: 'refresh-test',
                dictItemName: version,
                status: 'enable',
                sortOrder: 1
              }
            ]
          }
        }
      });
    });
    await page.goto('/dashboard/system-management/dictionaries');
    const card = page
      .getByText('字典项列表', { exact: true })
      .locator('xpath=ancestor::*[@data-slot="card"][1]');
    await expect(card.getByText('刷新前', { exact: true })).toBeVisible();
    const filter = card.getByPlaceholder('搜索字典项名称');
    await filter.fill('刷新');
    await expect(card.getByText('刷新前', { exact: true })).toBeVisible();
    if (background) {
      await page.getByRole('tab', { name: /^仪表盘/ }).click();
      await expect(card).toBeHidden();
    }
    const before = requests;
    version = '刷新后';
    await page.getByRole('tab', { name: /^字典管理/ }).click({ button: 'right' });
    const refresh = page.getByRole('menuitem', { name: '刷新页面', exact: true });
    // 覆盖菜单的键盘选择路径，避免刷新仅绑定鼠标 click。
    if (background) await refresh.press('Enter');
    else await refresh.click();
    await expect(page).toHaveURL(/\/dashboard\/system-management\/dictionaries$/);
    await expect.poll(() => requests).toBeGreaterThan(before);
    await expect(card.getByText('刷新后', { exact: true })).toBeVisible();
    await expect(filter).toHaveValue('');
  });
}
