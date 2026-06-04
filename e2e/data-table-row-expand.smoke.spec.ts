import { expect, test, type Locator, type Page } from '@playwright/test';

function visibleRows(page: Page) {
  return page.locator('table tbody tr:visible');
}

function firstNameCell(page: Page) {
  return visibleRows(page).first().locator('td').nth(4);
}

function expandPanel(page: Page) {
  return page.locator('[data-slot="data-table-expand-panel"]');
}

function expandTrigger(page: Page) {
  return page.locator('[data-slot="data-table-expand-trigger"]');
}

function expandCloseButton(page: Page) {
  return page.locator('[data-slot="data-table-expand-panel-close"]');
}

function expandSplitHandle(page: Page) {
  return page.locator('[data-slot="data-table-expand-split-handle"]');
}

async function gotoUsers(page: Page) {
  await page.goto('/dashboard/users');
  await expect(page).toHaveURL(/\/dashboard\/users$/);
  await expect(visibleRows(page).first()).toBeVisible();
}

async function dragHandle(handle: Locator, page: Page, deltaY: number) {
  const box = await handle.boundingBox();
  if (!box) {
    throw new Error('split handle bounding box unavailable');
  }

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + deltaY);
  await page.mouse.up();
}

test('@preflight @workspace-v2 users row expand preflight is reachable', async ({ page }) => {
  await gotoUsers(page);
  await expect(expandTrigger(page).first()).toBeVisible();
  await expect(expandPanel(page)).toHaveCount(0);
});

test('@workspace-v2 row click and disclosure button open and close the detail panel', async ({
  page
}) => {
  await gotoUsers(page);

  await firstNameCell(page).click();
  await expect(expandPanel(page)).toBeVisible();
  await expect(expandTrigger(page).first()).toHaveAttribute('aria-expanded', 'true');

  await expandCloseButton(page).click();
  await expect(expandPanel(page)).toHaveCount(0);

  await expandTrigger(page).first().click();
  await expect(expandPanel(page)).toBeVisible();
  await expect(expandTrigger(page).first()).toHaveAttribute('aria-expanded', 'true');
});

test('@workspace-v2 checkbox and row actions do not open the detail panel', async ({ page }) => {
  await gotoUsers(page);

  await page.getByRole('checkbox', { name: '选择行' }).first().click();
  await expect(expandPanel(page)).toHaveCount(0);

  await page.getByRole('button', { name: '编辑' }).first().click();
  await expect(expandPanel(page)).toHaveCount(0);
});

test('@workspace-v2 split drag persists across close and reopen in the same mount', async ({
  page
}) => {
  await gotoUsers(page);

  await firstNameCell(page).click();
  await expect(expandPanel(page)).toBeVisible();

  const handle = expandSplitHandle(page);
  await expect(handle).toBeVisible();

  const before = Number(await handle.getAttribute('aria-valuenow'));
  await dragHandle(handle, page, 120);

  await expect
    .poll(async () => Number(await handle.getAttribute('aria-valuenow')))
    .toBeGreaterThan(before);

  const after = Number(await handle.getAttribute('aria-valuenow'));

  await expandCloseButton(page).click();
  await expect(expandPanel(page)).toHaveCount(0);

  await firstNameCell(page).click();
  await expect(expandPanel(page)).toBeVisible();
  await expect(expandSplitHandle(page)).toHaveAttribute('aria-valuenow', String(after));
});
