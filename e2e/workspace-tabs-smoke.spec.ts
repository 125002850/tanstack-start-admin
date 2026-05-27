import { expect, test, type Page } from '@playwright/test';

async function expectWorkspaceTabs(page: Page) {
  await expect(page.getByRole('tablist', { name: 'Workspace tabs' })).toBeVisible();
}

async function expectActiveTab(page: Page, name: RegExp | string) {
  await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
}

async function expectProductList(page: Page) {
  await expectWorkspaceTabs(page);
  await expect(page.locator('table tbody tr:visible').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('link', { name: /新增产品/ })).toBeVisible();
}

async function expectUsersList(page: Page) {
  await expectWorkspaceTabs(page);
  await expect(page.locator('table tbody tr:visible').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.getByRole('button', { name: /Add User/ })).toBeVisible();
}

async function navigateFromSidebar(page: Page, label: '产品' | '用户' | '聊天') {
  await page.getByRole('link', { name: label, exact: true }).click();
}

function productForm(page: Page, submitLabel: '新增产品' | '更新产品') {
  return page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: submitLabel, exact: true }) });
}

function productNameField(page: Page, submitLabel: '新增产品' | '更新产品') {
  return productForm(page, submitLabel).getByPlaceholder('请输入产品名称');
}

async function expectProductDetail(page: Page, tabName: RegExp, submitLabel: '新增产品' | '更新产品') {
  await expectWorkspaceTabs(page);
  await expectActiveTab(page, tabName);
  await expect(page.getByRole('heading', { name: '产品详情' })).toBeVisible({ timeout: 10_000 });
  await expect(productNameField(page, submitLabel)).toBeVisible();
  await expect(page.getByRole('button', { name: submitLabel, exact: true })).toBeVisible();
}

async function openFirstProductEdit(page: Page) {
  await page.getByRole('button', { name: '打开操作菜单' }).first().click();
  await page.getByRole('menuitem', { name: '编辑' }).click();
  await page.waitForURL(/\/dashboard\/product\/\d+$/);
  await expectProductDetail(page, /^编辑产品/, '更新产品');
}

async function openNewProduct(page: Page) {
  await page.getByRole('link', { name: /新增产品/ }).click();
  await page.waitForURL(/\/dashboard\/product\/new$/);
  await expectProductDetail(page, /^新增产品/, '新增产品');
}

async function makeNewProductDirty(page: Page) {
  const nameField = productNameField(page, '新增产品');
  await nameField.fill('Workspace Draft');
  await expect(nameField).toHaveValue('Workspace Draft');
}

async function expectUnsavedChangesWarning(page: Page) {
  await expect(
    page.getByText('当前产品表单有未保存更改，请先保存后再关闭标签页。'),
  ).toBeVisible();
}

test.describe('@workspace-v2 tag switch state preservation', () => {
  test('switching away from a paginated list page and back preserves page state', async ({
    page,
  }) => {
    await page.goto('/dashboard/product');
    await expectProductList(page);

    const nextPageButton = page.getByRole('button', { name: '前往下一页' });
    const previousPageButton = page.getByRole('button', { name: '前往上一页' });

    await expect(nextPageButton).toBeEnabled();
    await expect(previousPageButton).toBeDisabled();

    await nextPageButton.click();
    await expect(previousPageButton).toBeEnabled();
    await expect(page.getByText(/第 2 \/ \d+ 页/)).toBeVisible({ timeout: 10_000 });

    await navigateFromSidebar(page, '用户');
    await page.waitForURL(/\/dashboard\/users$/);
    await expectUsersList(page);
    await expect(page.getByRole('tab', { name: /^产品/ })).toBeVisible();

    await page.getByRole('tab', { name: /^产品/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/product$/);
    await expect(page.getByText(/第 2 \/ \d+ 页/)).toBeVisible({ timeout: 10_000 });
    await expect(previousPageButton).toBeEnabled();
  });

  test('reload resets table pagination to default state', async ({ page }) => {
    await page.goto('/dashboard/product');
    await expectProductList(page);

    const nextPageButton = page.getByRole('button', { name: '前往下一页' });
    const previousPageButton = page.getByRole('button', { name: '前往上一页' });

    await expect(nextPageButton).toBeEnabled();
    await expect(previousPageButton).toBeDisabled();

    await nextPageButton.click();
    await expect(previousPageButton).toBeEnabled();
    await expect(page.getByText(/第 2 \/ \d+ 页/)).toBeVisible({ timeout: 10_000 });

    await page.reload();
    await expectProductList(page);
    await expect(page.getByText(/第 1 \/ \d+ 页/)).toBeVisible({ timeout: 10_000 });
    await expect(previousPageButton).toBeDisabled();
  });

  test('dirty product form survives tab switches', async ({ page }) => {
    await page.goto('/dashboard/product');
    await expectProductList(page);

    await openNewProduct(page);
    await makeNewProductDirty(page);

    await navigateFromSidebar(page, '用户');
    await page.waitForURL(/\/dashboard\/users$/);
    await expectUsersList(page);

    await page.getByRole('tab', { name: /^新增产品/ }).click();
    await page.waitForURL(/\/dashboard\/product\/new$/);
    await expectProductDetail(page, /^新增产品/, '新增产品');
    await expect(productNameField(page, '新增产品')).toHaveValue('Workspace Draft');
  });
});

test.describe('@workspace-v2 detail/form multi-instance', () => {
  test('new and edit product routes open as separate tabs', async ({ page }) => {
    await page.goto('/dashboard/product');
    await expectProductList(page);

    await openNewProduct(page);

    await page.getByRole('tab', { name: /^产品/ }).click();
    await expect(page).toHaveURL(/\/dashboard\/product$/);
    await expectProductList(page);

    await openFirstProductEdit(page);
    await expect(page.getByRole('tab', { name: /^新增产品/ })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^编辑产品/ })).toBeVisible();

    await page.getByRole('tab', { name: /^新增产品/ }).click();
    await page.waitForURL(/\/dashboard\/product\/new$/);
    await expectProductDetail(page, /^新增产品/, '新增产品');
  });

  test('first open of a new detail tag renders non-blank viewport', async ({ page }) => {
    await page.goto('/dashboard/product');
    await expectProductList(page);

    await openNewProduct(page);
    await expect(page.getByText('Something went wrong')).toHaveCount(0);
  });
});

test.describe('@workspace-v2 close actions and close guard', () => {
  test('context menu shows all close actions for tags', async ({ page }) => {
    await page.goto('/dashboard/product');
    await expectProductList(page);

    await page.getByRole('tab', { name: /^产品/ }).click({ button: 'right' });

    await expect(page.getByRole('menuitem', { name: /刷新页面/ })).toBeVisible({ timeout: 3_000 });
    await expect(page.getByRole('menuitem', { name: /关闭标签/ })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /关闭其他标签/ })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: /关闭所有标签/ })).toBeVisible();
  });

  test('"关闭标签" removes the targeted tab via context menu', async ({ page }) => {
    await page.goto('/dashboard/product');
    await expectProductList(page);

    await navigateFromSidebar(page, '用户');
    await page.waitForURL(/\/dashboard\/users$/);
    await expectUsersList(page);

    const tabsBefore = await page.getByRole('tab').count();
    expect(tabsBefore).toBeGreaterThanOrEqual(2);

    await page.locator('[role="tab"][aria-selected="true"]').click({ button: 'right' });
    await page.getByRole('menuitem', { name: /关闭标签/ }).click();

    await expect(page.getByRole('tab')).toHaveCount(tabsBefore - 1);
    await expect(page.getByRole('tab', { name: /^用户/ })).toHaveCount(0);
    await expect(page.locator('[role="tab"][aria-selected="true"]')).not.toHaveText(/用户/);
    await expect(page).not.toHaveURL(/\/dashboard\/users$/);
  });

  test('"关闭其他标签" removes all tags except the targeted one', async ({ page }) => {
    await page.goto('/dashboard/product');
    await expectProductList(page);

    await navigateFromSidebar(page, '用户');
    await page.waitForURL(/\/dashboard\/users$/);
    await expectUsersList(page);

    await navigateFromSidebar(page, '聊天');
    await page.waitForURL(/\/dashboard\/chat$/);
    await expectWorkspaceTabs(page);
    await expect(page.getByRole('tab', { name: '聊天' })).toBeVisible();

    const tabsBefore = await page.getByRole('tab').count();
    expect(tabsBefore).toBeGreaterThanOrEqual(3);

  await page.getByRole('tab', { name: /^用户/ }).click({ button: 'right' });
  await page.getByRole('menuitem', { name: /关闭其他标签/ }).click();

  await expect(page.getByRole('tab')).toHaveCount(1);
  await expectActiveTab(page, /^用户/);
  await expect(page).toHaveURL(/\/dashboard\/users$/);
  });

  test('dirty new-product page rejects close current and preserves the active tab', async ({
    page,
  }) => {
    await page.goto('/dashboard/product');
    await expectProductList(page);

    await openNewProduct(page);
    await makeNewProductDirty(page);

    const tabsBefore = await page.getByRole('tab').count();

    await page.getByRole('tab', { name: /^新增产品/ }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: /关闭标签/ }).click();

    await expect(page.getByRole('tab')).toHaveCount(tabsBefore);
    await expectActiveTab(page, /^新增产品/);
    await expect(page).toHaveURL(/\/dashboard\/product\/new$/);
    await expectUnsavedChangesWarning(page);
    await expect(productNameField(page, '新增产品')).toHaveValue('Workspace Draft');
  });

  test('dirty hidden product form rejects close other and returns focus to the dirty tab', async ({
    page,
  }) => {
    await page.goto('/dashboard/product');
    await expectProductList(page);

    await openNewProduct(page);
    await makeNewProductDirty(page);

    await navigateFromSidebar(page, '用户');
    await page.waitForURL(/\/dashboard\/users$/);
    await expectUsersList(page);

    const tabsBefore = await page.getByRole('tab').count();

    await page.getByRole('tab', { name: /^用户/ }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: /关闭其他标签/ }).click();

    await expect(page.getByRole('tab')).toHaveCount(tabsBefore);
    await expectActiveTab(page, /^新增产品/);
    await expect(page).toHaveURL(/\/dashboard\/product\/new$/);
    await expectUnsavedChangesWarning(page);
    await expect(productNameField(page, '新增产品')).toHaveValue('Workspace Draft');
  });

  test('dirty hidden product form rejects close all and keeps all tabs open', async ({
    page,
  }) => {
    await page.goto('/dashboard/product');
    await expectProductList(page);

    await openNewProduct(page);
    await makeNewProductDirty(page);

    await navigateFromSidebar(page, '用户');
    await page.waitForURL(/\/dashboard\/users$/);
    await expectUsersList(page);

    const tabsBefore = await page.getByRole('tab').count();

    await page.getByRole('tab', { name: /^用户/ }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: /关闭所有标签/ }).click();

    await expect(page.getByRole('tab')).toHaveCount(tabsBefore);
    await expectActiveTab(page, /^新增产品/);
    await expect(page).toHaveURL(/\/dashboard\/product\/new$/);
    await expectUnsavedChangesWarning(page);
    await expect(productNameField(page, '新增产品')).toHaveValue('Workspace Draft');
  });
});

test.describe('@workspace-v2-rollback no workspace shell', () => {
  test('dashboard overview renders without tags shell when flag is off', async ({ page }) => {
    await page.goto('/dashboard/overview');
    await expect(page.getByRole('heading', { name: '你好，欢迎回来 👋' })).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole('tablist', { name: 'Workspace tabs' })).toHaveCount(0);
  });

  test('product listing works via v2 internal-state without workspace shell', async ({ page }) => {
    await page.goto('/dashboard/product');
    await expect(page.locator('table tbody tr:visible').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('link', { name: /新增产品/ })).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Workspace tabs' })).toHaveCount(0);
  });

  test('user listing works via v2 internal-state without workspace shell', async ({ page }) => {
    await page.goto('/dashboard/users');
    await expect(page.locator('table tbody tr:visible').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /Add User/ })).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Workspace tabs' })).toHaveCount(0);
  });
});
