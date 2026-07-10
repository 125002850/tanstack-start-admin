import { expect, test, type Page } from '@playwright/test';
import { mockIamSession } from './support/mock-iam-session';

const CONTRACT_ROUTE = '/dashboard/forms/overlay-contract';

const popperWrapperSelector = '[data-radix-popper-content-wrapper]';
const openOverlaySelector = [
  '[data-slot="popover-content"][data-state="open"]',
  '[data-slot="dropdown-menu-content"][data-state="open"]',
  '[data-slot="select-content"][data-state="open"]',
  '[data-slot="combobox-content"][data-open]',
  '[data-slot="dialog-content"][data-state="open"]',
  '[data-slot="sheet-content"][data-state="open"]'
].join(',');

test.beforeEach(async ({ page }) => {
  await mockIamSession(page);
});

async function gotoContractPage(page: Page) {
  await page.goto(CONTRACT_ROUTE);
  await expect(page).toHaveURL(new RegExp(`${CONTRACT_ROUTE}$`));
  await expect(page.getByTestId('workspace-overlay-contract-page')).toBeVisible();
  await expect(page.getByRole('tab', { name: /^浮层契约/ })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  await expectNoOpenOverlays(page);
}

async function switchToOverviewTab(page: Page, options?: { dispatchHiddenTabClick?: boolean }) {
  if (options?.dispatchHiddenTabClick) {
    await page.locator('[role="tab"]').filter({ hasText: '仪表盘' }).dispatchEvent('click');
  } else {
    await page.getByRole('tab', { name: /^仪表盘/ }).click();
  }
  await expect(page).toHaveURL(/\/dashboard\/overview$/);
  await expect(page.getByRole('tab', { name: /^仪表盘/ })).toHaveAttribute('aria-selected', 'true');
}

async function expectNoOpenOverlays(page: Page) {
  await expect(page.locator(popperWrapperSelector)).toHaveCount(0);
  await expect(page.locator(openOverlaySelector)).toHaveCount(0);
}

async function expectRadixPopperOpen(page: Page, visibleText: string | RegExp) {
  await expect(page.locator(popperWrapperSelector)).toHaveCount(1);
  await expect(page.locator(popperWrapperSelector).getByText(visibleText)).toBeVisible();
}

test.describe('@workspace-v2 overlay portal cleanup', () => {
  test('closes DataTable faceted filter portal when switching workspace tabs', async ({ page }) => {
    await gotoContractPage(page);

    await page.getByRole('button', { name: /任务状态/ }).click();
    await expectRadixPopperOpen(page, '处理中');

    await switchToOverviewTab(page, { dispatchHiddenTabClick: true });
    await expectNoOpenOverlays(page);
  });

  test('closes Select portal when switching workspace tabs', async ({ page }) => {
    await gotoContractPage(page);

    await page.getByTestId('contract-select-trigger').click();
    await expectRadixPopperOpen(page, '待处理');

    await switchToOverviewTab(page, { dispatchHiddenTabClick: true });
    await expectNoOpenOverlays(page);
  });

  test('closes DropdownMenu portal when switching workspace tabs', async ({ page }) => {
    await gotoContractPage(page);

    await page.getByTestId('contract-dropdown-trigger').click();
    await expectRadixPopperOpen(page, '查看详情');

    await switchToOverviewTab(page, { dispatchHiddenTabClick: true });
    await expectNoOpenOverlays(page);
  });

  test('closes SearchCombobox portal when switching workspace tabs', async ({ page }) => {
    await gotoContractPage(page);

    await page.getByRole('combobox', { name: '契约账户' }).click();
    await expect(page.locator('[data-slot="combobox-content"][data-open]')).toBeVisible();
    await expect(page.getByRole('option', { name: 'Alpha Account' })).toBeVisible();

    await switchToOverviewTab(page, { dispatchHiddenTabClick: true });
    await expectNoOpenOverlays(page);
  });

  test('closes Dialog and Sheet portal content when switching workspace tabs', async ({ page }) => {
    await gotoContractPage(page);

    await page.getByTestId('contract-dialog-trigger').click();
    await expect(page.locator('[data-slot="dialog-content"][data-state="open"]')).toBeVisible();
    await expect(page.getByRole('dialog', { name: '契约弹窗' })).toBeVisible();

    await switchToOverviewTab(page, { dispatchHiddenTabClick: true });
    await expectNoOpenOverlays(page);

    await page.getByRole('tab', { name: /^浮层契约/ }).click();
    await expect(page).toHaveURL(new RegExp(`${CONTRACT_ROUTE}$`));
    await page.getByTestId('contract-sheet-trigger').click();
    await expect(page.locator('[data-slot="sheet-content"][data-state="open"]')).toBeVisible();
    await expect(page.getByRole('dialog', { name: '契约抽屉' })).toBeVisible();

    await switchToOverviewTab(page, { dispatchHiddenTabClick: true });
    await expectNoOpenOverlays(page);
  });

  test('closes nested SearchCombobox inside Sheet when switching workspace tabs', async ({
    page
  }) => {
    await gotoContractPage(page);

    await page.getByTestId('contract-nested-sheet-trigger').click();
    await expect(page.getByRole('dialog', { name: '嵌套选择抽屉' })).toBeVisible();
    await page.getByRole('combobox', { name: '抽屉内账户' }).click();
    await expect(page.locator('[data-slot="combobox-content"][data-open]')).toBeVisible();
    await expect(page.getByRole('option', { name: 'Beta Account' })).toBeVisible();

    await switchToOverviewTab(page, { dispatchHiddenTabClick: true });
    await expectNoOpenOverlays(page);
  });
});
