import { expect, test, type Page } from '@playwright/test';

async function expectWorkspaceTabs(page: Page) {
  await expect(page.getByRole('tablist', { name: 'Workspace tabs' })).toBeVisible();
}

async function expectActiveTab(page: Page, name: RegExp | string) {
  await expect(page.getByRole('tab', { name })).toHaveAttribute('aria-selected', 'true');
}

async function expectProductList(page: Page) {
  await expectWorkspaceTabs(page);
  await expect(page).toHaveURL(/\/dashboard\/product$/);
  await expect(page.locator('table tbody tr:visible').first()).toBeVisible({ timeout: 10_000 });
}

async function expectUsersList(page: Page) {
  await expectWorkspaceTabs(page);
  await expect(page).toHaveURL(/\/dashboard\/users$/);
  await expect(page.locator('table tbody tr:visible').first()).toBeVisible({ timeout: 10_000 });
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

async function expectProductDetail(
  page: Page,
  tabName: RegExp,
  submitLabel: '新增产品' | '更新产品'
) {
  await expectWorkspaceTabs(page);
  await expectActiveTab(page, tabName);
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
  await page.goto('/dashboard/product/new');
  await page.waitForURL(/\/dashboard\/product\/new$/);
  await expectProductDetail(page, /^新增产品/, '新增产品');
}

async function makeNewProductDirty(page: Page) {
  const nameField = productNameField(page, '新增产品');
  await nameField.fill('Workspace Draft');
  await expect(nameField).toHaveValue('Workspace Draft');
}

async function expectUnsavedChangesWarning(page: Page) {
  await expect(page.getByText('当前产品表单有未保存更改，请先保存后再关闭标签页。')).toBeVisible();
}

test.describe('@workspace-v2 tag switch state preservation', () => {
  test('switching away from a paginated list page and back preserves page state', async ({
    page
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
    await page.goto('/dashboard/product/new');
    await expectProductDetail(page, /^新增产品/, '新增产品');
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
    await page.goto('/dashboard/product/new');
    await expectProductDetail(page, /^新增产品/, '新增产品');

    await navigateFromSidebar(page, '产品');
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
    await page.goto('/dashboard/product/new');
    await expectProductDetail(page, /^新增产品/, '新增产品');
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

    await page.getByRole('tab', { name: /^用户/ }).click({ button: 'right' });
    await page.getByRole('menuitem', { name: /关闭标签/ }).click();

    await expect(page.getByRole('tab')).toHaveCount(tabsBefore - 1);
    await expect(page.getByRole('tab', { name: /^用户/ })).toHaveCount(0);
    await expect(page.locator('[role="tab"][aria-selected="true"]')).not.toHaveText(/用户/);
    await expect(page).not.toHaveURL(/\/dashboard\/users$/);
  });

  test('"关闭其他标签" keeps home first and preserves the targeted tab', async ({ page }) => {
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

    const tabs = page.getByRole('tab');
    await expect(tabs).toHaveCount(2);
    await expect(tabs.first()).toContainText('仪表盘');
    await expectActiveTab(page, /^用户/);
    await expect(page.getByRole('tab', { name: /^用户/ })).toHaveCount(1);
    await expect(page.getByRole('tab', { name: /^聊天/ })).toHaveCount(0);
    await expect(page).toHaveURL(/\/dashboard\/users$/);
  });

  test('dirty new-product page rejects close current and preserves the active tab', async ({
    page
  }) => {
    await page.goto('/dashboard/product/new');
    await expectProductDetail(page, /^新增产品/, '新增产品');
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
    page
  }) => {
    await page.goto('/dashboard/product/new');
    await expectProductDetail(page, /^新增产品/, '新增产品');
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

  test('dirty hidden product form rejects close all and keeps all tabs open', async ({ page }) => {
    await page.goto('/dashboard/product/new');
    await expectProductDetail(page, /^新增产品/, '新增产品');
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

test.describe('@workspace-v2 virtual scroll regression', () => {
  test('virtualized product list survives tab switches', async ({ page }) => {
    await page.goto('/dashboard/product');
    await expectWorkspaceTabs(page);
    await expect(page.locator('table tbody tr:visible').first()).toBeVisible({ timeout: 10_000 });

    // Switch to large page size via localStorage
    await page.evaluate(() => localStorage.setItem('app-data-table-per-page', '500'));
    await page.reload();
    await page.waitForSelector('[data-scroll-target-id="products-table"]', { timeout: 15_000 });
    await page.waitForTimeout(2000);

    const viewport = page.locator('[data-scroll-target-id="products-table"]');
    await expect(viewport).toBeVisible();

    // Hard: virtual scroll is active
    const virtualEnabled = await viewport.locator('tbody').getAttribute('data-virtual-enabled');
    expect(virtualEnabled).toBe('true');

    // Hard: header at viewport top
    const headerTop = await viewport
      .locator('thead')
      .evaluate((el) => Math.round(el.getBoundingClientRect().top));
    const vpTop = await viewport.evaluate((el) => Math.round(el.getBoundingClientRect().top));
    expect(Math.abs(headerTop - vpTop)).toBeLessThanOrEqual(1);

    // Switch to users tab and back
    await navigateFromSidebar(page, '用户');
    await expectUsersList(page);

    await navigateFromSidebar(page, '产品');
    await page.waitForSelector('[data-scroll-target-id="products-table"]', { timeout: 15_000 });
    await page.waitForTimeout(1000);

    // Hard: virtual scroll still active after tab switch
    const viewportAfter = page.locator('[data-scroll-target-id="products-table"]');
    await expect(viewportAfter).toBeVisible();

    const vEnabledAfter = await viewportAfter.locator('tbody').getAttribute('data-virtual-enabled');
    expect(vEnabledAfter).toBe('true');

    // Hard: tbody rows <= 64 after tab switch
    const tbodyRows = await viewportAfter.locator('tbody tr').count();
    console.log(`[Task4] default tbody rows after tab switch: ${tbodyRows}`);
    expect(tbodyRows).toBeLessThanOrEqual(64);
    expect(tbodyRows).toBeGreaterThan(0);

    // Hard: header still sticky after tab switch
    const hTopAfter = await viewportAfter
      .locator('thead')
      .evaluate((el) => Math.round(el.getBoundingClientRect().top));
    const vpTopAfter = await viewportAfter.evaluate((el) =>
      Math.round(el.getBoundingClientRect().top)
    );
    expect(Math.abs(hTopAfter - vpTopAfter)).toBeLessThanOrEqual(1);

    // Hard: no blank viewport — visible rows exist
    await expect(viewportAfter.locator('table tbody tr:visible').first()).toBeVisible({
      timeout: 5000
    });

    console.log('[Task4] Tab switch hard assertions all PASS');
  });
});

test.describe('@workspace-v2-rollback no workspace shell', () => {
  test('dashboard overview renders without tags shell when flag is off', async ({ page }) => {
    await page.goto('/dashboard/overview');
    await expect(page.getByRole('heading', { name: '你好，欢迎回来 👋' })).toBeVisible({
      timeout: 10_000
    });
    await expect(page.getByRole('tablist', { name: 'Workspace tabs' })).toHaveCount(0);
  });

  test('product listing works via v2 internal-state without workspace shell', async ({ page }) => {
    await page.goto('/dashboard/product');
    await expect(page.locator('table tbody tr:visible').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('tablist', { name: 'Workspace tabs' })).toHaveCount(0);
  });

  test('user listing works via v2 internal-state without workspace shell', async ({ page }) => {
    await page.goto('/dashboard/users');
    await expect(page.locator('table tbody tr:visible').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole('button', { name: /新增用户|Add User/ })).toBeVisible();
    await expect(page.getByRole('tablist', { name: 'Workspace tabs' })).toHaveCount(0);
  });

  test('product listing exposes stable scroll viewport selector', async ({ page }) => {
    await page.goto('/dashboard/product');
    const viewport = page.locator('[data-scroll-target-id="products-table"]');
    await expect(viewport).toBeVisible({ timeout: 10_000 });
    await expect(viewport.locator('table tbody tr:visible').first()).toBeVisible({
      timeout: 10_000
    });
    await expect(page.getByRole('tablist', { name: 'Workspace tabs' })).toHaveCount(0);
  });

  test('product listing baseline renders full DOM at page size 2000', async ({ page }) => {
    await page.goto('/dashboard/product');
    await page.evaluate(() => localStorage.setItem('app-data-table-per-page', '2000'));
    await page.reload();
    await page.waitForSelector('[data-scroll-target-id="products-table"]', { timeout: 15_000 });
    await page.waitForTimeout(2000);

    const viewport = page.locator('[data-scroll-target-id="products-table"]');
    await expect(viewport).toBeVisible();

    const tbodyRows = await viewport.locator('tbody tr').count();
    console.log(`[Task1] baseline tbody row count at perPage=2000: ${tbodyRows}`);
    expect(tbodyRows).toBeGreaterThan(0);

    await expect(viewport).toHaveAttribute('data-scroll-target-id', 'products-table');
    await expect(page.getByRole('tablist', { name: 'Workspace tabs' })).toHaveCount(0);
  });

  test('rollback product list virtualizes large page within DOM budget', async ({ page }) => {
    await page.goto('/dashboard/product');
    await page.evaluate(() => localStorage.setItem('app-data-table-per-page', '2000'));
    await page.reload();
    await page.waitForSelector('[data-scroll-target-id="products-table"]', { timeout: 15_000 });
    await page.waitForTimeout(2000);

    const viewport = page.locator('[data-scroll-target-id="products-table"]');
    await expect(viewport).toBeVisible();

    // DOM budget: tbody tr count must be <= 64
    const tbodyRows = await viewport.locator('tbody tr').count();
    console.log(`[Task4] rollback virtual tbody rows: ${tbodyRows}`);
    expect(tbodyRows).toBeLessThanOrEqual(64);
    expect(tbodyRows).toBeGreaterThan(0);

    // Hard assertion: data-virtual-enabled must be "true"
    const virtualEnabled = await viewport.locator('tbody').getAttribute('data-virtual-enabled');
    expect(virtualEnabled).toBe('true');

    // Hard assertion: data-virtual-first-index must be numeric
    const firstIndex = Number(
      await viewport.locator('tbody').getAttribute('data-virtual-first-index')
    );
    expect(Number.isFinite(firstIndex)).toBe(true);
    expect(firstIndex).toBe(0); // at top of scroll, first index is 0

    // Hard assertion: data-virtual-total-size exists and is positive
    const totalSize = Number(
      await viewport.locator('tbody').getAttribute('data-virtual-total-size')
    );
    expect(totalSize).toBeGreaterThan(100000); // 2000 * ~56px

    // Hard assertion: aria-rowcount is correct
    const ariaRowcount = Number(await viewport.locator('tbody').getAttribute('aria-rowcount'));
    expect(ariaRowcount).toBeGreaterThan(1);

    // Hard assertion: sticky header top matches viewport top
    const headerRect = await viewport.locator('thead').evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), left: Math.round(r.left) };
    });
    const viewportRect = await viewport.evaluate((el) => {
      const r = el.getBoundingClientRect();
      return { top: Math.round(r.top), left: Math.round(r.left) };
    });
    expect(Math.abs(headerRect.top - viewportRect.top)).toBeLessThanOrEqual(1);

    // Hard assertion: pinned actions column exists with sticky positioning
    const actionsCells = viewport.locator('tbody tr:first-child td').last();
    const actionsComputed = await actionsCells.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return { position: style.position, right: style.right };
    });
    // Pinned right column has position: sticky
    expect(actionsComputed.position).toBe('sticky');

    // Hard assertion: no error fallback on page
    await expect(page.getByText('Something went wrong')).toHaveCount(0);

    // Scroll to middle and verify telemetry updates
    await viewport.evaluate((el) => {
      el.scrollTop = 20000;
    });
    await page.waitForTimeout(500);

    const firstIndexAfterScroll = Number(
      await viewport.locator('tbody').getAttribute('data-virtual-first-index')
    );
    const scrollOffsetAfter = Number(
      await viewport.locator('tbody').getAttribute('data-virtual-scroll-offset')
    );
    expect(firstIndexAfterScroll).toBeGreaterThan(0); // scrolled down → index > 0
    expect(scrollOffsetAfter).toBeGreaterThan(0); // scroll offset > 0

    // Verify telemetry event queue exists
    const events = await page.evaluate(() => {
      const w = window as unknown as Record<string, unknown>;
      return w.__DATA_TABLE_VIRTUAL_EVENTS__ ?? null;
    });
    expect(events).not.toBeNull();

    // Header still sticky after scroll
    const headerTopAfter = await viewport
      .locator('thead')
      .evaluate((el) => Math.round(el.getBoundingClientRect().top));
    const viewportTopAfter = await viewport.evaluate((el) =>
      Math.round(el.getBoundingClientRect().top)
    );
    expect(Math.abs(headerTopAfter - viewportTopAfter)).toBeLessThanOrEqual(1);
    console.log(`[Task4] Hard assertions all PASS`);
  });
});
