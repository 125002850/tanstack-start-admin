import { expect, test, type Locator, type Page } from '@playwright/test';

import { mockIamSession } from './support/mock-iam-session';

const DICTIONARY_ROUTE = '/dashboard/system-management/dictionaries';

function apiEnvelope<T>(data: T) {
  return { code: 200, msg: 'ok', data };
}

function createDictionaryItems() {
  return Array.from({ length: 180 }, (_, index) => ({
    id: index + 1,
    dictTypeCode: 'regression',
    dictItemCode: `reg-${String(index + 1).padStart(3, '0')}`,
    dictItemName: `回归项 ${index + 1}`,
    status: 'enable',
    sortOrder: index + 1,
    remark: `DataTable regression row ${index + 1}`,
    createById: 1,
    createByName: 'creator',
    createTime: '2026-08-03T00:00:00Z',
    updateById: 2,
    updateByName: 'updater',
    updateTime: '2026-08-03T01:00:00Z'
  }));
}

async function mockDictionaryData(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('app-data-table-per-page:dictionary-items', '200');
  });
  await page.route('**/api/system/dict/global/types/list-all', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        apiEnvelope([
          {
            id: 1,
            dictTypeCode: 'regression',
            dictTypeName: 'DataTable 回归',
            status: 'enable',
            remark: 'Playwright fixture'
          }
        ])
      )
    });
  });

  let releaseItems!: () => void;
  const itemsGate = new Promise<void>((resolve) => {
    releaseItems = resolve;
  });
  const items = createDictionaryItems();

  await page.route('**/api/system/dict/global/items/by-type', async (route) => {
    await itemsGate;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiEnvelope({ total: items.length, list: items }))
    });
  });

  return releaseItems;
}

function dictionaryItemsCard(page: Page) {
  return page
    .getByText('字典项列表', { exact: true })
    .locator('xpath=ancestor::*[@data-slot="card"][1]');
}

async function expectHeaderAndBodyAligned(card: Locator, columnId: string) {
  const header = card.locator(`th[data-column-id="${columnId}"]`);
  const cell = card.locator(`td[data-cell-column-id="${columnId}"]`).first();
  const [headerBox, cellBox] = await Promise.all([header.boundingBox(), cell.boundingBox()]);

  expect(headerBox).not.toBeNull();
  expect(cellBox).not.toBeNull();
  expect(Math.abs(headerBox!.width - cellBox!.width)).toBeLessThanOrEqual(1);
  expect(Math.abs(headerBox!.x - cellBox!.x)).toBeLessThanOrEqual(1);
}

test.beforeEach(async ({ page }) => {
  await mockIamSession(page);
});

test('@workspace-v2 renders loading, toolbar, top actions, and row actions', async ({ page }) => {
  const releaseItems = await mockDictionaryData(page);

  await page.goto(DICTIONARY_ROUTE);
  await expect(page).toHaveURL(new RegExp(`${DICTIONARY_ROUTE}$`));
  const card = dictionaryItemsCard(page);
  await expect(card.locator('[data-slot="data-table-skeleton"]')).toBeVisible();

  releaseItems();
  await expect(card.getByText('reg-001', { exact: true })).toBeVisible();
  await expect(card.locator('[data-slot="data-table-skeleton"]')).toHaveCount(0);

  await expect(card.getByRole('toolbar')).toBeVisible();
  await expect(card.getByRole('textbox', { name: '搜索字典项编码' })).toBeVisible();
  await expect(card.getByRole('button', { name: '刷新列表' })).toBeVisible();
  await expect(card.getByRole('button', { name: '新增字典项' })).toBeVisible();
  await expect(card.getByRole('button', { name: '编辑' }).first()).toBeVisible();
  await expect(card.getByRole('button', { name: '删除' }).first()).toBeVisible();
});

test('@workspace-v2 commits a pending toolbar filter when it loses focus', async ({ page }) => {
  const releaseItems = await mockDictionaryData(page);
  releaseItems();

  await page.goto(DICTIONARY_ROUTE);
  const card = dictionaryItemsCard(page);
  await expect(card.getByText('reg-001', { exact: true })).toBeVisible();

  const filterInput = card.getByRole('textbox', { name: '搜索字典项编码' });
  await filterInput.fill('reg-150');

  const committedOnBlur = await filterInput.evaluate(async (element) => {
    element.blur();
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    return document.querySelector('[aria-label="重置筛选条件"]') !== null;
  });
  expect(committedOnBlur).toBe(true);
  await expect(filterInput).toHaveValue('reg-150');
});

test('@workspace-v2 keeps virtual scrolling, pinned columns, and cell alignment stable', async ({
  page
}) => {
  const releaseItems = await mockDictionaryData(page);
  releaseItems();

  await page.goto(DICTIONARY_ROUTE);
  const card = dictionaryItemsCard(page);
  await expect(card.getByText('reg-001', { exact: true })).toBeVisible();

  const virtualBody = card.locator('tbody[data-virtual-enabled="true"]');
  const viewport = card.locator('[data-slot="scroll-area-viewport"]').last();
  await expect(virtualBody).toBeVisible();
  await expectHeaderAndBodyAligned(card, 'dictItemCode');

  const scrollMetrics = await viewport.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight
  }));
  expect(scrollMetrics.scrollWidth).toBeGreaterThan(scrollMetrics.clientWidth);
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);

  await viewport.evaluate((element) => {
    element.scrollTop = Math.floor(element.scrollHeight * 0.6);
    element.dispatchEvent(new Event('scroll'));
  });
  await expect
    .poll(async () => Number(await virtualBody.getAttribute('data-virtual-first-index')))
    .toBeGreaterThan(0);

  await viewport.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
    element.dispatchEvent(new Event('scroll'));
  });
  await expectHeaderAndBodyAligned(card, 'dictItemCode');

  const viewportBox = await viewport.boundingBox();
  const selectHeaderBox = await card.locator('th[data-column-id="select"]').boundingBox();
  const actionsHeaderBox = await card.locator('th[data-column-id="actions"]').boundingBox();
  expect(viewportBox).not.toBeNull();
  expect(selectHeaderBox).not.toBeNull();
  expect(actionsHeaderBox).not.toBeNull();
  expect(selectHeaderBox!.x).toBeGreaterThanOrEqual(viewportBox!.x - 1);
  expect(actionsHeaderBox!.x + actionsHeaderBox!.width).toBeLessThanOrEqual(
    viewportBox!.x + viewportBox!.width + 1
  );
  await expect(card.locator('td[data-cell-column-id="select"]').first()).toBeVisible();
  await expect(card.locator('td[data-cell-column-id="actions"]').first()).toBeVisible();
});
