import { test, expect, type Page } from '@playwright/test';

const USERS_URL = '/dashboard/users';
const EXPAND_PANEL = '[data-slot="data-table-expand-panel"]';
const EXPAND_PANEL_CLOSE = '[data-slot="data-table-expand-panel-close"]';
const EXPAND_SPLIT_HANDLE = '[data-slot="data-table-expand-split-handle"]';

async function expectUsersTableLoaded(page: Page) {
  await expect(page.locator('table tbody tr:visible').first()).toBeVisible({ timeout: 15_000 });
}

async function expectExpandPanelOpen(page: Page) {
  await expect(page.locator(EXPAND_PANEL)).toBeVisible({ timeout: 5_000 });
}

async function expectExpandPanelClosed(page: Page) {
  await expect(page.locator(EXPAND_PANEL)).toHaveCount(0);
}

async function openFirstRowViaClick(page: Page) {
  // Click on a data cell in the first row (skip row number + select columns)
  await page.locator('table tbody tr:first-child td').nth(2).click();
  await expectExpandPanelOpen(page);
}

// ── Task 0: Browser Preflight ──────────────────────────────────────────────

test.describe('@preflight @workspace-v2', () => {
  test('preflight: /dashboard/users loads and renders user table', async ({ page }) => {
    await page.goto(USERS_URL);
    await expect(page.locator('table')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('table tbody tr:visible').first()).toBeVisible({ timeout: 10_000 });
  });

  test('preflight: row click on data cell opens expand panel', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);

    await openFirstRowViaClick(page);
  });

  test('preflight: expand panel renders tabs and close button', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);
    await openFirstRowViaClick(page);

    await expect(page.locator(EXPAND_PANEL).locator('[role="tablist"]')).toBeVisible();
    await expect(page.locator(EXPAND_PANEL_CLOSE)).toBeVisible();
  });

  test('preflight: close button dismisses expand panel', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);
    await openFirstRowViaClick(page);

    await page.locator(EXPAND_PANEL_CLOSE).click();
    await expectExpandPanelClosed(page);
  });

  test('preflight: split handle is present when panel is open', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);
    await openFirstRowViaClick(page);

    await expect(page.locator(EXPAND_SPLIT_HANDLE)).toBeVisible();
  });

  test('preflight: expanded row is visually highlighted', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);
    await openFirstRowViaClick(page);

    await expect(page.locator('table tbody tr.bg-accent').first()).toBeVisible();
  });
});

// ── Task 6: Business Smoke (final regression) ──────────────────────────────

test.describe('@workspace-v2 row expand business smoke', () => {
  test('switching rows updates expand panel content', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);

    await openFirstRowViaClick(page);
    const firstPanelText = await page.locator(EXPAND_PANEL).textContent();

    await page.locator(EXPAND_PANEL_CLOSE).click();
    await expectExpandPanelClosed(page);

    // Click second row
    await page.locator('table tbody tr:nth-child(2) td').nth(2).click();
    await expectExpandPanelOpen(page);
    const secondPanelText = await page.locator(EXPAND_PANEL).textContent();

    expect(firstPanelText).not.toBe(secondPanelText);
  });

  test('checkbox click does not trigger row expand', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);

    const checkbox = page.locator('table tbody tr:first-child [role="checkbox"]').first();
    await checkbox.click();

    await expectExpandPanelClosed(page);
  });

  test('row action button click does not trigger row expand', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);

    const actionButton = page
      .locator('table tbody tr:first-child')
      .locator('[data-row-expand-ignore] button')
      .first();
    await actionButton.click();

    await expectExpandPanelClosed(page);
  });

  test('expand panel reopens at same height after close', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);
    await openFirstRowViaClick(page);

    const panelBefore = page.locator(EXPAND_PANEL);
    const heightBefore = await panelBefore.evaluate((el) => el.getBoundingClientRect().height);

    await page.locator(EXPAND_PANEL_CLOSE).click();
    await expectExpandPanelClosed(page);
    await openFirstRowViaClick(page);

    const heightAfter = await panelBefore.evaluate((el) => el.getBoundingClientRect().height);

    expect(Math.abs(heightBefore - heightAfter)).toBeLessThanOrEqual(2);
  });

  test('split handle has correct accessibility attributes', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);
    await openFirstRowViaClick(page);

    const handle = page.locator(EXPAND_SPLIT_HANDLE);
    await expect(handle).toHaveAttribute('role', 'separator');
    await expect(handle).toHaveAttribute('aria-orientation', 'horizontal');
  });

  test('split handle is keyboard focusable', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);
    await openFirstRowViaClick(page);

    const handle = page.locator(EXPAND_SPLIT_HANDLE);
    await expect(handle).toHaveAttribute('tabindex', '0');
  });

  test('expanded row is visually highlighted with accent background', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);
    await openFirstRowViaClick(page);

    const expandedRow = page.locator('table tbody tr.bg-accent').first();
    await expect(expandedRow).toBeVisible();
  });

  test('page reload resets expand state', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);
    await openFirstRowViaClick(page);
    await expectExpandPanelOpen(page);

    await page.reload();
    await expectUsersTableLoaded(page);
    await expectExpandPanelClosed(page);
  });

  test('panel is rendered below pagination', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);
    await openFirstRowViaClick(page);

    // Pagination should be visible above the expand panel
    const pagination = page.getByRole('button', { name: '前往下一页' });
    await expect(pagination).toBeVisible();

    // Panel should be visible below
    await expectExpandPanelOpen(page);
  });
});
