import { test, expect, type Page } from '@playwright/test';

const USERS_URL = '/dashboard/users';
const EXPAND_TRIGGER = '[data-slot="data-table-expand-trigger"]';
const EXPAND_PANEL = '[data-slot="data-table-expand-panel"]';
const EXPAND_PANEL_CLOSE = '[data-slot="data-table-expand-panel-close"]';
const EXPAND_SPLIT_HANDLE = '[data-slot="data-table-expand-split-handle"]';

async function expectUsersTableLoaded(page: Page) {
  await expect(page.locator('table tbody tr:visible').first()).toBeVisible({ timeout: 15_000 });
  await expect(page.locator(EXPAND_TRIGGER).first()).toBeVisible({ timeout: 5_000 });
}

async function expectExpandPanelOpen(page: Page) {
  await expect(page.locator(EXPAND_PANEL)).toBeVisible({ timeout: 5_000 });
}

async function expectExpandPanelClosed(page: Page) {
  await expect(page.locator(EXPAND_PANEL)).toHaveCount(0);
}

async function openFirstRowViaTrigger(page: Page) {
  await page.locator(EXPAND_TRIGGER).first().click();
  await expectExpandPanelOpen(page);
}

// ── Task 0: Browser Preflight ──────────────────────────────────────────────

test.describe('@preflight @workspace-v2', () => {
  test('preflight: /dashboard/users loads and renders user table', async ({ page }) => {
    await page.goto(USERS_URL);
    await expect(page.locator('table')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator('table tbody tr:visible').first()).toBeVisible({ timeout: 10_000 });
  });

  test('preflight: expand trigger column is present on users page', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);

    const triggers = page.locator(EXPAND_TRIGGER);
    const count = await triggers.count();
    expect(count).toBeGreaterThan(0);
  });

  test('preflight: expand trigger button has correct aria attributes when collapsed', async ({
    page
  }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);

    const trigger = page.locator(EXPAND_TRIGGER).first();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('preflight: disclosure button opens expand panel', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);

    await openFirstRowViaTrigger(page);

    const trigger = page.locator(EXPAND_TRIGGER).first();
    await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  test('preflight: expand panel renders tabs and close button', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);
    await openFirstRowViaTrigger(page);

    await expect(page.locator('[role="tablist"]')).toBeVisible();
    await expect(page.locator(EXPAND_PANEL_CLOSE)).toBeVisible();
  });

  test('preflight: close button dismisses expand panel', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);
    await openFirstRowViaTrigger(page);

    await page.locator(EXPAND_PANEL_CLOSE).click();
    await expectExpandPanelClosed(page);

    const trigger = page.locator(EXPAND_TRIGGER).first();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  test('preflight: row click on data cell opens expand panel', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);

    const firstDataCell = page.locator('table tbody tr:first-child td').nth(2);
    await firstDataCell.click();

    await expectExpandPanelOpen(page);
  });

  test('preflight: split handle is present when panel is open', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);
    await openFirstRowViaTrigger(page);

    await expect(page.locator(EXPAND_SPLIT_HANDLE)).toBeVisible();
  });
});

// ── Task 6: Business Smoke (final regression) ──────────────────────────────

test.describe('@workspace-v2 row expand business smoke', () => {
  test('switching rows updates expand panel content', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);

    await openFirstRowViaTrigger(page);
    const firstPanelText = await page.locator(EXPAND_PANEL).textContent();

    await page.locator(EXPAND_PANEL_CLOSE).click();
    await expectExpandPanelClosed(page);

    await page.locator(EXPAND_TRIGGER).nth(1).click();
    await expectExpandPanelOpen(page);
    const secondPanelText = await page.locator(EXPAND_PANEL).textContent();

    expect(firstPanelText).not.toBe(secondPanelText);
  });

  test('clicking same row trigger twice does not close panel', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);
    await openFirstRowViaTrigger(page);

    await page.locator(EXPAND_TRIGGER).first().click();
    await expectExpandPanelOpen(page);
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
    await openFirstRowViaTrigger(page);

    const panelBefore = page.locator(EXPAND_PANEL);
    const heightBefore = await panelBefore.evaluate((el) => el.getBoundingClientRect().height);

    await page.locator(EXPAND_PANEL_CLOSE).click();
    await expectExpandPanelClosed(page);
    await openFirstRowViaTrigger(page);

    const heightAfter = await panelBefore.evaluate((el) => el.getBoundingClientRect().height);

    expect(Math.abs(heightBefore - heightAfter)).toBeLessThanOrEqual(2);
  });

  test('split handle has correct accessibility attributes', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);
    await openFirstRowViaTrigger(page);

    const handle = page.locator(EXPAND_SPLIT_HANDLE);
    await expect(handle).toHaveAttribute('role', 'separator');
    await expect(handle).toHaveAttribute('aria-orientation', 'horizontal');
  });

  test('split handle is keyboard focusable', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);
    await openFirstRowViaTrigger(page);

    const handle = page.locator(EXPAND_SPLIT_HANDLE);
    await expect(handle).toHaveAttribute('tabindex', '0');
  });

  test('disclosure button has aria-controls pointing to panel', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);

    const trigger = page.locator(EXPAND_TRIGGER).first();
    const controlsId = await trigger.getAttribute('aria-controls');
    expect(controlsId).toBeTruthy();

    await trigger.click();
    await expectExpandPanelOpen(page);
    const panel = page.locator(EXPAND_PANEL);
    await expect(panel).toHaveAttribute('id', controlsId!);
  });

  test('expanded row is visually highlighted', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);
    await openFirstRowViaTrigger(page);

    const expandedRow = page.locator('table tbody tr.bg-accent').first();
    await expect(expandedRow).toBeVisible();
  });

  test('page reload resets expand state', async ({ page }) => {
    await page.goto(USERS_URL);
    await expectUsersTableLoaded(page);
    await openFirstRowViaTrigger(page);
    await expectExpandPanelOpen(page);

    await page.reload();
    await expectUsersTableLoaded(page);
    await expectExpandPanelClosed(page);
  });
});

