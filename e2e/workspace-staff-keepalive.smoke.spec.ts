import { expect, test, type Page } from '@playwright/test';

import { mockIamSession } from './support/mock-iam-session';

const STAFF_ROUTE = '/dashboard/basic-settings/staff';
const DEPT_ROUTE = '/dashboard/basic-settings/dept';
const ROLE_ROUTE = '/dashboard/basic-settings/role';

function apiEnvelope<T>(data: T) {
  return { code: 200, msg: 'ok', data };
}

async function mockStaffPage(page: Page) {
  await mockIamSession(page, {
    menus: [
      {
        menuId: 'basic-settings',
        menuCode: 'basic_settings',
        menuKey: 'basic_settings',
        menuName: '基础设置',
        menuType: 'DIR',
        sortOrder: 10,
        hidden: false,
        cached: true,
        status: 'ENABLED',
        children: [
          {
            menuId: 'staff',
            parentId: 'basic-settings',
            menuCode: 'iam_staff',
            menuKey: 'iam_staff',
            menuName: '员工管理',
            menuType: 'MENU',
            routePath: STAFF_ROUTE,
            sortOrder: 10,
            hidden: false,
            cached: true,
            status: 'ENABLED'
          },
          {
            menuId: 'dept',
            parentId: 'basic-settings',
            menuCode: 'iam_dept',
            menuKey: 'iam_dept',
            menuName: '部门管理',
            menuType: 'MENU',
            routePath: DEPT_ROUTE,
            sortOrder: 20,
            hidden: false,
            cached: true,
            status: 'ENABLED'
          },
          {
            menuId: 'role',
            parentId: 'basic-settings',
            menuCode: 'iam_role',
            menuKey: 'iam_role',
            menuName: '角色管理',
            menuType: 'MENU',
            routePath: ROLE_ROUTE,
            sortOrder: 30,
            hidden: false,
            cached: true,
            status: 'ENABLED'
          }
        ]
      }
    ]
  });

  await page.route('**/api/iam/staff/page', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiEnvelope({ total: 0, list: [] }))
    });
  });
  await page.route('**/api/iam/dept/tree', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiEnvelope([]))
    });
  });
  await page.route('**/api/iam/role/page', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiEnvelope({ total: 0, list: [] }))
    });
  });
  await page.route('**/api/iam/menu/tree', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiEnvelope([]))
    });
  });
}

test.beforeEach(async ({ page }) => {
  await mockStaffPage(page);
});

test('@workspace-v2 preserves staff filters when switching through dashboard home', async ({
  page
}) => {
  await page.goto(STAFF_ROUTE);

  const filterInput = page.getByRole('textbox', { name: '搜索工号' });
  await expect(filterInput).toBeVisible();
  await filterInput.fill('1');
  await filterInput.press('Enter');
  await filterInput.evaluate((element) => {
    element.dataset.keepAliveProbe = 'staff-filter';
    Reflect.set(window, '__staffFilterProbe', element);
  });

  await page.getByRole('tab', { name: /^仪表盘/ }).click();
  await expect(page).toHaveURL(/\/dashboard\/overview$/);

  const preservedInput = page.locator('[data-keep-alive-probe="staff-filter"]');
  await expect(preservedInput).toHaveCount(1);
  await expect(preservedInput).toBeHidden();

  await page.getByRole('tab', { name: /^员工管理/ }).click();
  await expect(page).toHaveURL(new RegExp(`${STAFF_ROUTE}$`));
  const returnedInput = page.getByRole('textbox', { name: '搜索工号' });
  await expect(returnedInput).toBeVisible();
  await expect(returnedInput).toHaveValue('1');
  expect(
    await returnedInput.evaluate((element) => Reflect.get(window, '__staffFilterProbe') === element)
  ).toBe(true);
});

test('@workspace-v2 renders each page immediately during consecutive menu navigation', async ({
  page
}) => {
  await page.goto(STAFF_ROUTE);
  await expect(page.getByRole('textbox', { name: '搜索工号' })).toBeVisible();

  await page.getByRole('link', { name: '部门管理', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${DEPT_ROUTE}$`));
  await expect(page.getByRole('textbox', { name: '搜索部门编码或名称' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '搜索工号' })).toBeHidden();

  await page.getByRole('link', { name: '角色管理', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${ROLE_ROUTE}$`));
  await expect(page.getByRole('textbox', { name: '搜索名称' })).toBeVisible();
  await expect(page.getByRole('textbox', { name: '搜索部门编码或名称' })).toBeHidden();
});

test('@workspace-v2 sorts on a header click without sorting after a column drag', async ({
  page
}) => {
  await page.goto(STAFF_ROUTE);
  await expect(page.getByRole('textbox', { name: '搜索工号' })).toBeVisible();

  const table = page.locator('table[data-slot="table"]');
  const sourceHeader = table.locator('th[data-column-id="staffName"]');
  const targetHeader = table.locator('th[data-column-id="phone"]');
  const sortTrigger = sourceHeader.locator('[data-column-header-drag-surface]');

  await expect(sourceHeader).toHaveAttribute('aria-sort', 'none');
  await sortTrigger.click();
  await expect(sourceHeader).toHaveAttribute('aria-sort', 'ascending');

  const [sourceBox, targetBox] = await Promise.all([
    sortTrigger.boundingBox(),
    targetHeader.boundingBox()
  ]);
  if (!sourceBox || !targetBox) {
    throw new Error('Sortable DataTable header bounding box unavailable');
  }

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width * 0.8, targetBox.y + targetBox.height / 2, {
    steps: 12
  });

  await expect(table).toHaveAttribute('data-column-reordering', 'true');
  await page.mouse.up();
  await expect(table).not.toHaveAttribute('data-column-reordering');
  await expect(sourceHeader).toHaveAttribute('aria-sort', 'ascending');
});
