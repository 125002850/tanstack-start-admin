import { expect, test } from '@playwright/test';
import { mockIamSession } from './support/mock-iam-session';

test.beforeEach(async ({ context, page }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await mockIamSession(page);
  await page.goto('/dashboard/examples/data-table-tree');
  await expect(page.getByTestId('data-table-tree-example')).toBeVisible();
});

test('@workspace-v2 expands aligned child rows with arrow-only controls and independent selection', async ({
  page
}) => {
  const card = page.getByTestId('data-table-tree-example');
  const root = card.locator('tr[data-tree-row-id="resource-01"]');
  await expect(root).toBeVisible();
  await root.getByText('客户数据', { exact: true }).click();
  await expect(card.locator('tr[data-tree-row-id="resource-01-extra"]')).toHaveCount(0);
  await root
    .locator('[data-cell-column-id="label"]')
    .press(process.platform === 'darwin' ? 'Meta+C' : 'Control+C');
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe('客户数据');

  const toggle = root.getByRole('button', { name: '展开 客户数据' });
  await toggle.focus();
  await toggle.press('ArrowRight');
  const grant = card.locator('tr[data-tree-row-id="resource-01-extra"]');
  await expect(grant).toBeVisible();
  await grant.getByRole('button', { name: '展开 追加授权' }).click();
  const employee = card.locator('tr[data-tree-row-id="resource-01-employee-1"]');
  await expect(employee).toBeVisible();
  await expect(employee).toHaveAttribute('data-tree-depth', '2');
  await expect(employee.getByRole('cell')).toHaveCount(await root.getByRole('cell').count());
  const rootCode = await root.locator('[data-cell-column-id="code"]').boundingBox();
  const employeeCode = await employee.locator('[data-cell-column-id="code"]').boundingBox();
  expect(rootCode).not.toBeNull();
  expect(employeeCode).not.toBeNull();
  expect(employeeCode!.x).toBeCloseTo(rootCode!.x, 0);
  expect(employeeCode!.width).toBeCloseTo(rootCode!.width, 0);

  await root.getByRole('checkbox', { name: '选择行' }).click();
  await expect(card.getByTestId('tree-selected-count')).toHaveText('已选 1 个节点');
  await expect(grant.getByRole('checkbox', { name: '选择行' })).toHaveAttribute(
    'aria-checked',
    'false'
  );
  await employee.getByRole('checkbox', { name: '选择行' }).click();
  await expect(card.getByTestId('tree-selected-count')).toHaveText('已选 2 个节点');
  await page.screenshot({ path: 'artifacts/data-table-tree/tree-expanded.png', fullPage: true });

  await root.getByRole('button', { name: '收起 客户数据' }).press('ArrowLeft');
  await expect(employee).toHaveCount(0);
  await expect(card.getByTestId('tree-selected-count')).toHaveText('已选 2 个节点');
  await expect(root.getByRole('button', { name: '展开 客户数据' })).toBeFocused();
});

test('@workspace-v2 keeps virtual scrolling stable when a visible branch expands', async ({
  page
}) => {
  const card = page.getByTestId('data-table-tree-example');
  const viewport = card.locator('[data-slot="scroll-area-viewport"]');
  await expect(card.locator('tbody[data-virtual-enabled="true"]')).toBeVisible();
  await viewport.evaluate((element) => {
    element.scrollTop = 480;
  });
  const root = card.locator('tr[data-tree-row-id="resource-12"]');
  await expect(root).toBeVisible();
  const offset = await viewport.evaluate((element) => element.scrollTop);
  expect(offset).toBeGreaterThan(0);

  await root.getByRole('button', { name: '展开 业务资源 12' }).click();
  await expect(card.locator('tr[data-tree-row-id="resource-12-base"]')).toBeVisible();
  await expect.poll(() => viewport.evaluate((element) => element.scrollTop)).toBe(offset);
  await expect(root).toHaveCSS('height', '48px');
  await expect(card.locator('tr[data-tree-row-id="resource-12-base"]')).toHaveCSS('height', '48px');
});
