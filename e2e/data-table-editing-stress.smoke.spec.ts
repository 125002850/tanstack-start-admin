import { expect, test, type Locator, type Page } from '@playwright/test';

import { mockLoginInfo } from './support/mock-login-info';

const EDITING_ROUTE = '/dashboard/examples/data-table-editing';

interface RuntimeIssues {
  consoleErrors: string[];
  pageErrors: string[];
}

function installIssueCollector(page: Page): RuntimeIssues {
  const issues: RuntimeIssues = { consoleErrors: [], pageErrors: [] };
  page.on('console', (message) => {
    if (message.type() === 'error') issues.consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => issues.pageErrors.push(error.message));
  return issues;
}

async function expectNoRuntimeIssues(issues: RuntimeIssues) {
  expect(issues.pageErrors, `page errors: ${issues.pageErrors.join('; ')}`).toEqual([]);
  expect(issues.consoleErrors, `console errors: ${issues.consoleErrors.join('; ')}`).toEqual([]);
}

function cell(page: Page, columnId: string, rowId = 1): Locator {
  return page.locator(`td[data-cell-row-id="${rowId}"][data-cell-column-id="${columnId}"]`);
}

async function readClipboard(page: Page) {
  return page.evaluate(() => navigator.clipboard.readText());
}

async function scrollViewportTo(page: Page, top: number) {
  const viewport = page
    .getByTestId('data-table-editing-example')
    .locator('[data-slot="scroll-area-viewport"]');
  await viewport.evaluate((element, nextTop) => {
    element.scrollTop = nextTop;
    element.dispatchEvent(new Event('scroll'));
  }, top);
  return viewport;
}

test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await mockLoginInfo(page);
  await page.addInitScript(() => {
    localStorage.setItem('app-data-table-per-page:data-table-editing-example', '500');
  });
  await page.goto(EDITING_ROUTE);
  await expect(page).toHaveURL(new RegExp(`${EDITING_ROUTE}$`));
  await expect(page.getByTestId('data-table-editing-example')).toBeVisible();
  await expect(cell(page, 'name')).toContainText('记录 001');
});

test('@workspace-v2-stress endurance scroll keeps rows stable across repeated unmounts', async ({
  page
}) => {
  const issues = installIssueCollector(page);
  const example = page.getByTestId('data-table-editing-example');
  const virtualBody = example.locator('tbody[data-virtual-enabled="true"]');
  await expect(virtualBody).toBeVisible();

  for (let cycle = 0; cycle < 8; cycle++) {
    await scrollViewportTo(page, Number.MAX_SAFE_INTEGER);
    await expect(page.locator('td[data-cell-row-id="1"]')).toHaveCount(0);
    await expect(virtualBody).toHaveAttribute('data-virtual-first-index', /^[1-9]/);

    await scrollViewportTo(page, 0);
    await expect(virtualBody).toHaveAttribute('data-virtual-first-index', '0');
    await expect(cell(page, 'name')).toContainText('记录 001');
    await expect(cell(page, 'phone')).toContainText('13800000001');
  }

  await expectNoRuntimeIssues(issues);
});

test('@workspace-v2-stress large range copy produces complete row-major TSV', async ({ page }) => {
  const issues = installIssueCollector(page);
  await page.setViewportSize({ width: 1440, height: 1600 });
  const example = page.getByTestId('data-table-editing-example');
  await expect(example.locator('tbody[data-virtual-enabled="true"]')).toBeVisible();
  await page.waitForFunction(() => document.querySelectorAll('tbody tr[data-index]').length >= 16);

  const ROWS = 15;
  const anchorCell = example.locator('td[data-cell-row-id="1"][data-cell-column-id="name"]');
  await anchorCell.click();
  for (let i = 1; i < ROWS; i++) {
    await page.keyboard.press('Shift+ArrowDown');
  }
  await page.keyboard.press('Shift+ArrowRight');
  await expect(example.locator('td[data-cell-selected="true"]')).toHaveCount(ROWS * 2);

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+C' : 'Control+C');
  await expect(example.locator('td[data-cell-copy-flash="true"]')).toHaveCount(ROWS * 2);

  const tsv = await readClipboard(page);
  const lines = tsv.split('\n');
  expect(lines.length).toBe(ROWS);
  expect(lines[0]).toBe('记录 001\t13800000001');
  expect(lines[ROWS - 1]).toBe(
    `记录 ${String(ROWS).padStart(3, '0')}\t138${String(ROWS).padStart(8, '0')}`
  );
  await expectNoRuntimeIssues(issues);
});

test('@workspace-v2-stress large matrix paste applies atomically across rows', async ({ page }) => {
  const issues = installIssueCollector(page);
  const example = page.getByTestId('data-table-editing-example');

  const firstPhone = example.locator('td[data-cell-row-id="1"][data-cell-column-id="phone"]');
  await expect(firstPhone).toBeVisible();
  await firstPhone.click();
  for (let i = 1; i < 10; i++) {
    await page.keyboard.press('Shift+ArrowDown');
  }
  await page.keyboard.press('Shift+ArrowRight');
  await page.keyboard.press('Shift+ArrowRight');
  await expect(example.locator('td[data-cell-selected="true"]')).toHaveCount(30);

  const matrix = Array.from({ length: 10 }, (_, index) => {
    const row = index + 1;
    return `139${String(row).padStart(8, '0')}\t压测备注 ${row}\t${10 + row}.5`;
  }).join('\n');
  expect(
    await firstPhone.evaluate((element, clipboardText) => {
      const clipboardData = new DataTransfer();
      clipboardData.setData('text/plain', clipboardText);
      const event = new ClipboardEvent('paste', {
        bubbles: true,
        cancelable: true,
        clipboardData
      });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    }, matrix)
  ).toBe(true);

  await expect(firstPhone).toContainText('13900000001');
  await expect(example.locator('td[data-cell-row-id="1"][data-cell-column-id="remark"]')).toContainText(
    '压测备注 1'
  );
  await expect(example.locator('td[data-cell-row-id="1"][data-cell-column-id="score"]')).toContainText(
    '11.5'
  );
  await expect(example.locator('td[data-cell-row-id="10"][data-cell-column-id="phone"]')).toContainText(
    '13900000010'
  );
  await expect(example.locator('td[data-cell-row-id="10"][data-cell-column-id="remark"]')).toContainText(
    '压测备注 10'
  );
  await expect(example.locator('td[data-cell-row-id="10"][data-cell-column-id="score"]')).toContainText(
    '20.5'
  );
  await expect(page.getByTestId('editable-choice-last-reason')).toHaveText('paste');
  await expectNoRuntimeIssues(issues);
});

test('@workspace-v2-stress continuous edits accumulate in the draft snapshot', async ({ page }) => {
  const issues = installIssueCollector(page);

  for (let row = 1; row <= 4; row++) {
    const phone = cell(page, 'phone', row);
    const score = cell(page, 'score', row);
    const budget = cell(page, 'budget', row);

    await phone.dblclick();
    await page.getByRole('textbox', { name: '编辑手机号' }).fill(`136${String(row).padStart(8, '0')}`);
    await page.keyboard.press('Enter');

    await score.dblclick();
    await page.getByRole('textbox', { name: '编辑评分' }).fill(`${90 + row}.5`);
    await page.keyboard.press('Tab');

    await budget.dblclick();
    await page.getByRole('textbox', { name: '编辑预算' }).fill(`CNY 2,10${row}.00`);
    await page.keyboard.press('Tab');
  }

  await page.getByRole('button', { name: '读取草稿' }).click();
  const snapshot = page.getByTestId('editable-choice-snapshot');
  for (let row = 1; row <= 4; row++) {
    await expect(snapshot).toContainText(`"phone":"136${String(row).padStart(8, '0')}"`);
    await expect(snapshot).toContainText(`"score":${90 + row}.5`);
    await expect(snapshot).toContainText(`"budget":${2100 + row}`);
  }
  await expectNoRuntimeIssues(issues);
});

test('@workspace-v2-stress edit+scroll loop keeps DOM and heap bounded', async ({ page }) => {
  const issues = installIssueCollector(page);

  const measure = () =>
    page.evaluate(() => ({
      domNodes: document.querySelectorAll('*').length,
      tds: document.querySelectorAll('tbody td').length,
      heap: (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory
        ?.usedJSHeapSize ?? null
    }));

  const baseline = await measure();

  for (let cycle = 0; cycle < 6; cycle++) {
    await scrollViewportTo(page, Number.MAX_SAFE_INTEGER);
    await expect(page.locator('td[data-cell-row-id="1"]')).toHaveCount(0);

    await scrollViewportTo(page, 0);
    await expect(cell(page, 'name')).toContainText('记录 001');

    if (cycle % 2 === 0) {
      await cell(page, 'phone').dblclick();
      await page
        .getByRole('textbox', { name: '编辑手机号' })
        .fill(`137000000${String(cycle + 1).padStart(2, '0')}`);
      await page.keyboard.press('Enter');
    }
  }

  await page.getByRole('button', { name: '读取草稿' }).click();
  await expect(page.getByTestId('editable-choice-snapshot')).toContainText('"phone":"13700000005"');

  const after = await measure();
  expect(after.domNodes).toBeLessThan(baseline.domNodes * 1.6);
  expect(after.tds).toBeLessThan(600);
  if (baseline.heap !== null && after.heap !== null) {
    expect(after.heap - baseline.heap).toBeLessThan(120 * 1024 * 1024);
  }
  await expectNoRuntimeIssues(issues);
});
