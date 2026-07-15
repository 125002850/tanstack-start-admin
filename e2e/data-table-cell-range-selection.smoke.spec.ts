import { expect, test, type Locator, type Page } from '@playwright/test';

import { mockLoginInfo } from './support/mock-login-info';

const DICTIONARY_ROUTE = '/dashboard/system-management/dictionaries';

function apiEnvelope<T>(data: T) {
  return { code: 200, msg: 'ok', data };
}

async function mockDictionaryData(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('app-data-table-per-page:dictionary-items', '200');
  });

  await page.route('**/api/mdm/dict/global/types/list-all', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(
        apiEnvelope([
          {
            id: 1,
            dictTypeCode: 'cell_range',
            dictTypeName: '区域选择测试',
            status: 'enable',
            remark: 'Playwright fixture'
          }
        ])
      )
    });
  });

  await page.route('**/api/mdm/dict/global/items/by-type', async (route) => {
    const list = Array.from({ length: 150 }, (_, index) => ({
      id: index + 1,
      dictTypeCode: 'cell_range',
      dictItemCode: `code-${String(index + 1).padStart(3, '0')}`,
      dictItemName: `Name ${index + 1}`,
      status: 'enable',
      sortOrder: index + 1,
      remark: `Row ${index + 1}`,
      createBy: 1,
      createTime: '2026-07-10T00:00:00Z',
      updateBy: 1,
      updateTime: '2026-07-10T00:00:00Z'
    }));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(apiEnvelope({ total: list.length, list }))
    });
  });
}

async function gotoDictionaryTable(page: Page) {
  await page.goto(DICTIONARY_ROUTE);
  await expect(page).toHaveURL(new RegExp(`${DICTIONARY_ROUTE}$`));
  const card = page
    .getByText('字典项列表', { exact: true })
    .locator('xpath=ancestor::*[@data-slot="card"][1]');
  await expect(card.getByText('code-001', { exact: true })).toBeVisible();
  return card;
}

async function dragBetweenCells(page: Page, source: Locator, target: Locator) {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error('DataTable cell bounding box unavailable');

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, {
    steps: 8
  });
  await page.mouse.up();
}

test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await mockLoginInfo(page);
  await mockDictionaryData(page);
});

test('@workspace-v2 selects a range, extends by keyboard, and copies TSV', async ({ page }) => {
  const card = await gotoDictionaryTable(page);
  const firstCode = card.locator('td[data-cell-column-id="dictItemCode"]').first();
  const secondName = card.locator('td[data-cell-column-id="dictItemName"]').nth(1);

  await dragBetweenCells(page, firstCode, secondName);
  await expect(card.locator('td[data-cell-selected="true"]')).toHaveCount(4);
  await expect(firstCode).toHaveAttribute('data-cell-range-anchor', 'true');
  await expect(secondName).toHaveAttribute('data-cell-range-focus', 'true');

  await secondName.focus();
  await page.keyboard.down('Shift');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.up('Shift');
  await expect(card.locator('td[data-cell-selected="true"]')).toHaveCount(6);

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+C' : 'Control+C');
  await expect(card.locator('td[data-cell-copy-flash="true"]')).toHaveCount(6);
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe('code-001\tName 1\ncode-002\tName 2\ncode-003\tName 3');
});

test('@workspace-v2 auto-scrolls virtual rows and maps RTL horizontal arrows', async ({ page }) => {
  const card = await gotoDictionaryTable(page);
  const viewport = card.locator('[data-slot="scroll-area-viewport"]');
  await expect(card.locator('tbody[data-virtual-enabled="true"]')).toBeVisible();
  const scrollMetrics = await viewport.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight
  }));
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);
  const firstCode = card.locator('td[data-cell-column-id="dictItemCode"]').first();
  const sourceBox = await firstCode.boundingBox();
  const viewportBox = await viewport.boundingBox();
  if (!sourceBox || !viewportBox) throw new Error('DataTable viewport bounding box unavailable');

  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await expect(viewport).toHaveAttribute('data-cell-range-dragging', 'true');
  const browserViewportBottom = page.viewportSize()?.height ?? viewportBox.y + viewportBox.height;
  await page.mouse.move(
    viewportBox.x + viewportBox.width / 2,
    Math.min(viewportBox.y + viewportBox.height, browserViewportBottom) - 2
  );
  await expect(card.locator('td[data-cell-range-focus="true"]')).not.toHaveAttribute(
    'data-cell-column-id',
    'dictItemCode'
  );
  await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await page.mouse.up();
  const stoppedAt = await viewport.evaluate((element) => element.scrollTop);
  await page.waitForTimeout(100);
  expect(await viewport.evaluate((element) => element.scrollTop)).toBe(stoppedAt);

  await viewport.evaluate((element) => element.setAttribute('dir', 'rtl'));
  const visibleName = card.locator('td[data-cell-column-id="dictItemName"]').first();
  await visibleName.click();
  await visibleName.press('ArrowLeft');
  await expect(card.locator('td[data-cell-range-focus="true"]')).toHaveAttribute(
    'data-cell-column-id',
    'status'
  );
});

test('@workspace-v2 keeps themed row surfaces opaque and aligned with pinned cells', async ({
  page
}) => {
  const card = await gotoDictionaryTable(page);
  const rows = card.locator('tbody[data-component="data-table-body"] tr[data-row-index]');
  const firstRow = rows.first();
  const stripedRow = rows.nth(1);
  const firstPinnedSurface = firstRow.locator('[data-slot="data-table-pinned-cell-base"]').first();
  const pinnedSurface = stripedRow.locator('[data-slot="data-table-pinned-cell-base"]').first();
  const headerCell = card.locator('thead[data-component="data-table-header"] th').first();

  for (const theme of ['claude', 'supabase', 'zen', 'vercel', 'mono', 'astro-vista']) {
    for (const dark of [false, true]) {
      await page.evaluate(
        ({ nextTheme, nextDark }) => {
          document.documentElement.setAttribute('data-theme', nextTheme);
          document.documentElement.classList.toggle('dark', nextDark);
        },
        { nextTheme: theme, nextDark: dark }
      );
      await page.waitForTimeout(200);

      const surfaces = await Promise.all([
        firstRow.evaluate((element) => getComputedStyle(element).backgroundColor),
        stripedRow.evaluate((element) => getComputedStyle(element).backgroundColor),
        pinnedSurface.evaluate((element) => getComputedStyle(element).backgroundColor),
        headerCell.evaluate((element) => getComputedStyle(element).backgroundColor)
      ]);
      const mode = dark ? 'dark' : 'light';

      expect(surfaces[0], `${theme} ${mode} base row must be opaque`).not.toBe('rgba(0, 0, 0, 0)');
      expect(surfaces[1], `${theme} ${mode} striped row must differ from base`).not.toBe(
        surfaces[0]
      );
      expect(surfaces[2], `${theme} ${mode} pinned surface must match its row`).toBe(surfaces[1]);
      expect(surfaces[3], `${theme} ${mode} header must be opaque`).not.toBe('rgba(0, 0, 0, 0)');
    }
  }

  await page.evaluate(() => {
    document.documentElement.setAttribute('data-theme', 'claude');
    document.documentElement.classList.remove('dark');
  });
  await page.waitForTimeout(200);
  const baseSurface = await firstRow.evaluate(
    (element) => getComputedStyle(element).backgroundColor
  );

  await firstRow.hover();
  await page.waitForTimeout(200);
  const hoverSurface = await firstRow.evaluate(
    (element) => getComputedStyle(element).backgroundColor
  );

  await firstRow.evaluate((element) => element.setAttribute('data-state', 'selected'));
  await page.waitForTimeout(200);
  const selectedSurface = await firstRow.evaluate(
    (element) => getComputedStyle(element).backgroundColor
  );

  await firstRow.evaluate((element) => element.setAttribute('data-expanded', 'true'));
  await page.waitForTimeout(200);
  const expandedSurface = await firstRow.evaluate(
    (element) => getComputedStyle(element).backgroundColor
  );
  const expandedPinnedSurface = await firstPinnedSurface.evaluate(
    (element) => getComputedStyle(element).backgroundColor
  );

  expect(hoverSurface).not.toBe(baseSurface);
  expect(selectedSurface).not.toBe(hoverSurface);
  expect(expandedSurface).not.toBe(selectedSurface);
  expect(expandedPinnedSurface).toBe(expandedSurface);
});
