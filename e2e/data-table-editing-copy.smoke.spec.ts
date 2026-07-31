import { expect, test, type Locator, type Page } from '@playwright/test';

import { mockIamSession } from './support/mock-iam-session';

const EDITING_ROUTE = '/dashboard/examples/data-table-editing';

function cell(page: Page, columnId: string): Locator {
  return page.locator(`td[data-cell-column-id="${columnId}"]`).first();
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

async function readClipboard(page: Page) {
  return page.evaluate(() => navigator.clipboard.readText());
}

test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await mockIamSession(page);
  await page.addInitScript(() => {
    localStorage.setItem('app-data-table-per-page:data-table-editing-example', '500');
  });
  await page.goto(EDITING_ROUTE);
  await expect(page).toHaveURL(new RegExp(`${EDITING_ROUTE}$`));
  await expect(page.getByTestId('data-table-editing-example')).toBeVisible();
  await expect(cell(page, 'name')).toContainText('记录 001');
});

test('@workspace-v2 copies a single selected cell to the clipboard as TSV', async ({ page }) => {
  const example = page.getByTestId('data-table-editing-example');
  const phoneCell = example.locator('td[data-cell-row-id="1"][data-cell-column-id="phone"]');
  await expect(phoneCell).toContainText('13800000001');

  await phoneCell.click();
  await expect(phoneCell).toHaveAttribute('data-cell-range-focus', 'true');

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+C' : 'Control+C');
  await expect(example.locator('td[data-cell-copy-flash="true"]')).toHaveCount(1);
  await expect.poll(() => readClipboard(page)).toBe('13800000001');
});

test('@workspace-v2 copies a dragged range to the clipboard as row-major TSV', async ({ page }) => {
  const example = page.getByTestId('data-table-editing-example');
  const firstPhone = example.locator('td[data-cell-row-id="1"][data-cell-column-id="phone"]');
  const secondName = example.locator('td[data-cell-row-id="2"][data-cell-column-id="name"]');
  await expect(firstPhone).toBeVisible();
  await expect(secondName).toBeVisible();

  await dragBetweenCells(page, firstPhone, secondName);
  await expect(example.locator('td[data-cell-selected="true"]')).toHaveCount(4);

  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+C' : 'Control+C');
  await expect(example.locator('td[data-cell-copy-flash="true"]')).toHaveCount(4);
  await expect.poll(() => readClipboard(page)).toBe(
    '记录 001\t13800000001\n记录 002\t13800000002'
  );
});

test('@workspace-v2 copies a filtered single-row selection to the clipboard', async ({ page }) => {
  const example = page.getByTestId('data-table-editing-example');

  const nameFilter = example.getByRole('button', { name: '筛选当前页：名称' });
  await nameFilter.click();
  const filterSearch = page.getByRole('textbox', { name: '搜索名称筛选值' });
  await filterSearch.fill('记录 001');
  await filterSearch.press('Enter');
  await expect(example.locator('tbody tr[data-index]')).toHaveCount(1);
  await expect(nameFilter).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.press('Escape');

  const phoneCell = example.locator('td[data-cell-row-id="1"][data-cell-column-id="phone"]');
  await expect(phoneCell).toContainText('13800000001');
  await phoneCell.click();
  await page.keyboard.press(process.platform === 'darwin' ? 'Meta+C' : 'Control+C');
  await expect(example.locator('td[data-cell-copy-flash="true"]')).toHaveCount(1);
  await expect.poll(() => readClipboard(page)).toBe('13800000001');
});
