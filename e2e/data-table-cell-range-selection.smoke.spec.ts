import { expect, test, type Locator, type Page } from '@playwright/test';

import { mockIamSession } from './support/mock-iam-session';

const DICTIONARY_ROUTE = '/dashboard/system-management/dictionaries';
const EDITING_ROUTE = '/dashboard/examples/data-table-editing';

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

async function dispatchMatrixPaste(target: Locator, text: string) {
  return target.evaluate((element, clipboardText) => {
    const clipboardData = new DataTransfer();
    clipboardData.setData('text/plain', clipboardText);
    const event = new ClipboardEvent('paste', {
      bubbles: true,
      cancelable: true,
      clipboardData
    });
    element.dispatchEvent(event);
    return event.defaultPrevented;
  }, text);
}

async function readCellGeometry(card: Locator) {
  return card.locator('tbody td[data-cell-id]').evaluateAll((cells) =>
    cells.map((cell) => {
      const cellRect = cell.getBoundingClientRect();
      const contentRect = cell.firstElementChild?.getBoundingClientRect();
      const round = (value: number) => Math.round(value * 1000) / 1000;

      return {
        id: cell.getAttribute('data-cell-id'),
        cell: [cellRect.x, cellRect.y, cellRect.width, cellRect.height].map(round),
        content: contentRect
          ? [contentRect.x, contentRect.y, contentRect.width, contentRect.height].map(round)
          : null
      };
    })
  );
}

test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await mockIamSession(page);
  await mockDictionaryData(page);
});

test('@workspace-v2 filters the loaded page from a column header without requesting data', async ({
  page
}) => {
  const card = await gotoDictionaryTable(page);
  let itemRequestCount = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/mdm/dict/global/items/by-type')) {
      itemRequestCount += 1;
    }
  });

  const filterTrigger = card.getByRole('button', {
    name: '筛选当前页：字典项编码'
  });
  await filterTrigger.click();
  const filterSearch = page.getByRole('textbox', { name: '搜索字典项编码筛选值' });
  await filterSearch.fill('code-150');
  await filterSearch.press('Enter');

  await expect(card.getByText('code-150', { exact: true })).toBeVisible();
  await expect(card.getByText('code-001', { exact: true })).toHaveCount(0);
  await expect(filterTrigger).toHaveAttribute('aria-pressed', 'true');
  await page.waitForTimeout(350);
  expect(itemRequestCount).toBe(0);

  await card.getByRole('textbox', { name: '搜索字典项编码' }).fill('code');

  await expect(filterTrigger).toHaveAttribute('aria-pressed', 'false');
  await expect(card.getByText('code-001', { exact: true })).toBeVisible();
  await expect.poll(() => itemRequestCount).toBeGreaterThan(0);
});

test('@workspace-v2 selects a range, extends by keyboard, and copies TSV', async ({ page }) => {
  const card = await gotoDictionaryTable(page);
  const firstCode = card.locator('td[data-cell-column-id="dictItemCode"]').first();
  const secondName = card.locator('td[data-cell-column-id="dictItemName"]').nth(1);
  const geometryBeforeSelection = await readCellGeometry(card);

  await dragBetweenCells(page, firstCode, secondName);
  await expect(card.locator('td[data-cell-selected="true"]')).toHaveCount(4);
  await expect(firstCode).toHaveAttribute('data-cell-range-anchor', 'true');
  await expect(secondName).toHaveAttribute('data-cell-range-focus', 'true');
  expect(await readCellGeometry(card)).toEqual(geometryBeforeSelection);

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

test('@workspace-v2 applies an Excel-compatible matrix atomically and rejects invalid plans', async ({
  page
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('app-data-table-per-page:data-table-editing-example', '500');
  });
  await page.goto(EDITING_ROUTE);
  await expect(page).toHaveURL(new RegExp(`${EDITING_ROUTE}$`));
  const example = page.getByTestId('data-table-editing-example');
  await expect(example).toBeVisible();

  const firstPhone = example.locator('td[data-cell-row-id="1"][data-cell-column-id="phone"]');
  const firstRemark = example.locator('td[data-cell-row-id="1"][data-cell-column-id="remark"]');
  const secondPhone = example.locator('td[data-cell-row-id="2"][data-cell-column-id="phone"]');
  const secondRemark = example.locator('td[data-cell-row-id="2"][data-cell-column-id="remark"]');
  await expect(firstPhone).toBeVisible();
  await expect(secondRemark).toBeVisible();

  await dragBetweenCells(page, firstPhone, secondRemark);
  await expect(example.locator('td[data-cell-selected="true"]')).toHaveCount(4);
  expect(
    await dispatchMatrixPaste(
      firstPhone,
      '13900000001\t"首行\r\n第二行，含 ""引号"""\r\n13900000002\t普通备注'
    )
  ).toBe(true);

  await expect(firstPhone).toContainText('13900000001');
  await expect(firstRemark).toContainText('首行');
  await expect(firstRemark).toContainText('第二行，含 "引号"');
  await expect(secondPhone).toContainText('13900000002');
  await expect(secondRemark).toContainText('普通备注');
  await expect(page.getByTestId('editable-choice-last-reason')).toHaveText('paste');

  const firstScore = example.locator('td[data-cell-row-id="1"][data-cell-column-id="score"]');
  const secondScore = example.locator('td[data-cell-row-id="2"][data-cell-column-id="score"]');
  const beforeInvalidPaste = await Promise.all([
    firstPhone.innerText(),
    firstRemark.innerText(),
    firstScore.innerText(),
    secondPhone.innerText(),
    secondRemark.innerText(),
    secondScore.innerText()
  ]);

  await dragBetweenCells(page, firstPhone, secondScore);
  await expect(example.locator('td[data-cell-selected="true"]')).toHaveCount(6);
  expect(
    await dispatchMatrixPaste(
      firstPhone,
      '13800000001\t会失败的备注\tbad-number\r\n13800000002\t也不能写入\t99.5'
    )
  ).toBe(true);

  const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
  await expect(errorToast).toBeVisible();
  await expect(errorToast).toContainText('不允许使用科学计数法。');
  await expect(errorToast).toContainText('来源：第 1 行第 3 列 → 目标：第 1 行第 4 列（score）');
  await expect
    .poll(() =>
      Promise.all([
        firstPhone.innerText(),
        firstRemark.innerText(),
        firstScore.innerText(),
        secondPhone.innerText(),
        secondRemark.innerText(),
        secondScore.innerText()
      ])
    )
    .toEqual(beforeInvalidPaste);
});

test('@workspace-v2 starts printable drafts and applies keyboard deletion atomically', async ({
  page
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('app-data-table-per-page:data-table-editing-example', '500');
  });
  await page.goto(EDITING_ROUTE);
  await expect(page).toHaveURL(new RegExp(`${EDITING_ROUTE}$`));
  const example = page.getByTestId('data-table-editing-example');
  await expect(example).toBeVisible();

  const firstPhone = example.locator('td[data-cell-row-id="1"][data-cell-column-id="phone"]');
  const firstRemark = example.locator('td[data-cell-row-id="1"][data-cell-column-id="remark"]');
  await expect(firstPhone).toContainText('13800000001');
  const beforeRejectedDelete = await Promise.all([firstPhone.innerText(), firstRemark.innerText()]);

  await dragBetweenCells(page, firstPhone, firstRemark);
  await expect(example.locator('td[data-cell-selected="true"]')).toHaveCount(2);
  await firstRemark.press('Delete');

  const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
  await expect(errorToast).toBeVisible();
  await expect(errorToast).toContainText('此项为必填项。');
  await expect(errorToast).toContainText('来源：第 1 行第 2 列 → 目标：第 1 行第 3 列（remark）');
  await expect
    .poll(() => Promise.all([firstPhone.innerText(), firstRemark.innerText()]))
    .toEqual(beforeRejectedDelete);
  await expect(page.getByTestId('editable-choice-last-reason')).toHaveText('-');

  await firstPhone.click();
  await firstPhone.press('Backspace');
  await expect(page.getByTestId('editable-choice-last-reason')).toHaveText('delete');
  await expect(firstPhone).not.toContainText('13800000001');
  await expect(firstPhone).toHaveAttribute('data-cell-range-focus', 'true');

  await firstPhone.press('7');
  await expect(page.getByRole('textbox', { name: '编辑手机号' })).toHaveValue('7');
  await expect(page.getByTestId('editable-choice-last-reason')).toHaveText('delete');
  await page.keyboard.press('Escape');
});

test('@workspace-v2 fills from the accessible handle and rejects readonly targets atomically', async ({
  page
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('app-data-table-per-page:data-table-editing-example', '500');
  });
  await page.goto(EDITING_ROUTE);
  await expect(page).toHaveURL(new RegExp(`${EDITING_ROUTE}$`));
  const example = page.getByTestId('data-table-editing-example');
  await expect(example).toBeVisible();
  await expect(example.locator('tbody[data-virtual-enabled="true"]')).toBeVisible();

  const firstName = example.locator('td[data-cell-row-id="1"][data-cell-column-id="name"]');
  const firstPhone = example.locator('td[data-cell-row-id="1"][data-cell-column-id="phone"]');
  const secondPhone = example.locator('td[data-cell-row-id="2"][data-cell-column-id="phone"]');
  await firstPhone.click();
  const handle = example.getByRole('button', { name: '填充所选单元格' });
  await expect(handle).toBeVisible();

  const handleBox = await handle.boundingBox();
  const firstNameBox = await firstName.boundingBox();
  if (!handleBox || !firstNameBox) throw new Error('Fill handle geometry unavailable');
  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    firstNameBox.x + firstNameBox.width / 2,
    firstNameBox.y + firstNameBox.height / 2,
    { steps: 8 }
  );
  await expect(firstName).toHaveAttribute('data-cell-fill-preview', 'true');
  await page.mouse.up();

  const errorToast = page.locator('[data-sonner-toast][data-type="error"]');
  await expect(errorToast).toBeVisible();
  await expect(errorToast).toContainText('矩阵粘贴的目标列不可编辑。');
  await expect(errorToast).toContainText('来源：第 1 行第 2 列 → 目标：第 1 行第 1 列（name）');
  await expect(firstName).toContainText('记录 001');
  await expect(page.getByTestId('editable-choice-last-reason')).toHaveText('-');

  const nextHandle = example.getByRole('button', { name: '填充所选单元格' });
  const nextHandleBox = await nextHandle.boundingBox();
  const secondPhoneBox = await secondPhone.boundingBox();
  if (!nextHandleBox || !secondPhoneBox) throw new Error('Fill target geometry unavailable');
  await page.mouse.move(
    nextHandleBox.x + nextHandleBox.width / 2,
    nextHandleBox.y + nextHandleBox.height / 2
  );
  await page.mouse.down();
  await page.mouse.move(
    secondPhoneBox.x + secondPhoneBox.width / 2,
    secondPhoneBox.y + secondPhoneBox.height / 2,
    { steps: 8 }
  );
  await expect(secondPhone).toHaveAttribute('data-cell-fill-preview', 'true');
  await page.mouse.up();

  await expect(secondPhone).toContainText('13800000001');
  await expect(page.getByTestId('editable-choice-last-reason')).toHaveText('fill');
  await expect(example.locator('td[data-cell-selected="true"]')).toHaveCount(2);
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

test('@workspace-v2 moves virtualized body cells with their headers during column drag', async ({
  page
}) => {
  const card = await gotoDictionaryTable(page);
  const table = card.locator('table[data-slot="table"]');
  const sourceHeader = card.locator('th[data-column-id="dictItemCode"]');
  const targetHeader = card.locator('th[data-column-id="dictItemName"]');
  const sourceActivator = sourceHeader.locator('[data-slot="data-table-column-order-activator"]');
  const sourceCell = card.locator('td[data-cell-column-id="dictItemCode"]').first();
  const targetCell = card.locator('td[data-cell-column-id="dictItemName"]').first();

  await expect(card.locator('tbody[data-virtual-enabled="true"]')).toBeVisible();

  const sourceHeaderBefore = await sourceHeader.boundingBox();
  const targetHeaderBefore = await targetHeader.boundingBox();
  const sourceCellBefore = await sourceCell.boundingBox();
  const targetCellBefore = await targetCell.boundingBox();
  const sourceActivatorBox = await sourceActivator.boundingBox();
  if (
    !sourceHeaderBefore ||
    !targetHeaderBefore ||
    !sourceCellBefore ||
    !targetCellBefore ||
    !sourceActivatorBox
  ) {
    throw new Error('DataTable column drag bounding box unavailable');
  }

  await sourceActivator.dispatchEvent('mousedown', {
    button: 0,
    buttons: 1,
    clientX: sourceActivatorBox.x + sourceActivatorBox.width / 2,
    clientY: sourceActivatorBox.y + sourceActivatorBox.height / 2
  });
  await page.waitForTimeout(220);
  await page.mouse.move(
    targetHeaderBefore.x + targetHeaderBefore.width * 0.8,
    targetHeaderBefore.y + targetHeaderBefore.height / 2,
    { steps: 12 }
  );

  await expect(table).toHaveAttribute('data-column-reordering', 'true');
  await expect(sourceCell).toHaveAttribute('data-column-drag-motion', 'true');
  await expect(targetCell).toHaveAttribute('data-column-drag-motion', 'true');

  await expect
    .poll(async () => {
      const [sourceHeaderDuring, sourceCellDuring, targetHeaderDuring, targetCellDuring] =
        await Promise.all([
          sourceHeader.boundingBox(),
          sourceCell.boundingBox(),
          targetHeader.boundingBox(),
          targetCell.boundingBox()
        ]);
      if (!sourceHeaderDuring || !sourceCellDuring || !targetHeaderDuring || !targetCellDuring) {
        return { columnsMoved: false, columnsSynchronized: false };
      }

      const sourceDeltaDifference = Math.abs(
        sourceHeaderDuring.x - sourceHeaderBefore.x - (sourceCellDuring.x - sourceCellBefore.x)
      );
      const targetDeltaDifference = Math.abs(
        targetHeaderDuring.x - targetHeaderBefore.x - (targetCellDuring.x - targetCellBefore.x)
      );

      return {
        columnsMoved: Math.abs(sourceCellDuring.x - sourceCellBefore.x) > 10,
        columnsSynchronized: sourceDeltaDifference <= 2 && targetDeltaDifference <= 2
      };
    })
    .toEqual({ columnsMoved: true, columnsSynchronized: true });

  await page.mouse.up();
  await expect(table).not.toHaveAttribute('data-column-reordering');
  await expect
    .poll(async () => {
      const [sourceHeaderAfter, sourceCellAfter, targetHeaderAfter, targetCellAfter] =
        await Promise.all([
          sourceHeader.boundingBox(),
          sourceCell.boundingBox(),
          targetHeader.boundingBox(),
          targetCell.boundingBox()
        ]);
      if (!sourceHeaderAfter || !sourceCellAfter || !targetHeaderAfter || !targetCellAfter) {
        return false;
      }

      return (
        Math.abs(sourceHeaderAfter.width - sourceCellAfter.width) <= 1 &&
        Math.abs(targetHeaderAfter.width - targetCellAfter.width) <= 1
      );
    })
    .toBe(true);
});

test('@workspace-v2 constrains column view option dragging to the scrollable list', async ({
  page
}) => {
  const card = await gotoDictionaryTable(page);
  await card.getByRole('button', { name: '切换表格列显示' }).click();

  const columnGroup = page.locator('[data-slot="command-group"]').first();
  const dragHandle = page.getByRole('button', { name: /拖拽调整 .* 列顺序/ }).first();
  const sortableItem = dragHandle.locator(
    'xpath=ancestor::*[@data-slot="data-table-view-option-sortable"]'
  );
  const [groupBox, handleBox] = await Promise.all([
    columnGroup.boundingBox(),
    dragHandle.boundingBox()
  ]);
  if (!groupBox || !handleBox) {
    throw new Error('DataTable view option drag bounding box unavailable');
  }

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox.x + handleBox.width / 2, groupBox.y + groupBox.height + 400, {
    steps: 12
  });

  await expect
    .poll(async () => {
      const [currentGroupBox, currentItemBox] = await Promise.all([
        columnGroup.boundingBox(),
        sortableItem.boundingBox()
      ]);
      if (!currentGroupBox || !currentItemBox) return false;

      return (
        currentItemBox.y + currentItemBox.height <= currentGroupBox.y + currentGroupBox.height + 1
      );
    })
    .toBe(true);

  await page.mouse.up();
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
