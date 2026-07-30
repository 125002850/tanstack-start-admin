import { expect, test, type Locator, type Page } from '@playwright/test';

import { mockIamSession } from './support/mock-iam-session';

const EXAMPLE_ROUTE = '/dashboard/examples/data-table-editing';
const EDITOR_LABELS = [
  'text · input',
  'enum · single',
  'enum · multiple',
  'select · single',
  'select · multiple',
  'remoteSelect · single',
  'remoteSelect · multiple',
  'enum · switch'
] as const;

function cell(page: Page, columnId: string): Locator {
  return page.locator(`td[data-cell-column-id="${columnId}"]`).first();
}

async function loadNextRemoteOptionPage(page: Page, nextOptionLabel: string) {
  const optionList = page.locator('[data-slot="command-list"]').last();
  await expect(optionList).toBeVisible();
  await expect(page.getByRole('button', { name: /加载更多/ })).toHaveCount(0);
  await expect(page.getByRole('option', { name: '远程人员 020' })).toBeVisible();
  await expect(page.getByRole('option', { name: nextOptionLabel })).toHaveCount(0);

  const metrics = await optionList.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight
  }));
  expect(metrics.scrollHeight).toBeGreaterThan(metrics.clientHeight);

  await optionList.hover();
  await page.mouse.wheel(0, metrics.scrollHeight);
  await expect(
    optionList.locator('[data-slot="choice-combobox-load-more-sentinel"][role="status"]')
  ).toContainText('正在加载更多');
  await expect(page.getByRole('option', { name: nextOptionLabel })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await mockIamSession(page);
  await page.addInitScript(() => {
    localStorage.setItem('app-data-table-per-page:data-table-editing-example', '500');
  });
  await page.goto(EXAMPLE_ROUTE);
  await expect(page).toHaveURL(new RegExp(`${EXAMPLE_ROUTE}$`));
  await expect(page.getByTestId('data-table-editing-example')).toBeVisible();
  await expect(cell(page, 'name')).toContainText('记录 001');
});

test('@workspace-v2 exposes every editor in a visible examples menu', async ({ page }) => {
  await expect(page.getByText('示例', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: '表格编辑' }).first()).toBeVisible();

  const coverage = page.getByTestId('data-table-editor-coverage');
  for (const label of EDITOR_LABELS) {
    await expect(coverage.getByText(label, { exact: true })).toBeVisible();
  }

  const virtualBody = page.locator('tbody[data-virtual-enabled="true"]');
  await expect(virtualBody).toBeVisible();
  await expect(page.getByText('共 10000 条数据', { exact: true })).toBeVisible();
  await expect(page.getByText('远程选项 120 条 / 每页 20 条', { exact: true })).toBeVisible();
  await expect(page.getByText('加载延迟约 1 秒', { exact: true })).toBeVisible();

  const metrics = await virtualBody.evaluate((element) => ({
    rendered: Number(element.getAttribute('data-virtual-count')),
    totalSize: Number(element.getAttribute('data-virtual-total-size')),
    firstIndex: Number(element.getAttribute('data-virtual-first-index')),
    lastIndex: Number(element.getAttribute('data-virtual-last-index'))
  }));
  expect(metrics.rendered).toBeGreaterThan(0);
  expect(metrics.rendered).toBeLessThan(500);
  expect(metrics.totalSize).toBeGreaterThan(500 * 40);
  expect(metrics.firstIndex).toBe(0);
  expect(metrics.lastIndex).toBeLessThan(500);
});

test('@workspace-v2 edits all supported editor variants through virtual row unmounts', async ({
  page
}) => {
  const phoneCell = cell(page, 'phone');
  await phoneCell.dblclick();
  const phoneInput = page.getByRole('textbox', { name: '编辑手机号' });
  await phoneInput.fill('13900000000');
  await phoneInput.press('Enter');
  await expect(phoneCell).toContainText('13900000000');

  const availabilityCell = cell(page, 'availability');
  await page.getByRole('switch', { name: '启用状态：启用' }).first().click();
  await expect(availabilityCell).toContainText('停用');

  const statusCell = cell(page, 'status');
  await statusCell.dblclick();
  await page.getByRole('option', { name: '就绪' }).click();
  await expect(statusCell).toContainText('就绪');

  const labelsCell = cell(page, 'labels');
  await labelsCell.dblclick();
  await page.getByRole('option', { name: '紧急' }).click();
  await page.getByRole('button', { name: '编辑标签' }).press('Tab');
  await expect(labelsCell).toContainText('核心、紧急');

  const departmentCell = cell(page, 'departmentId');
  await departmentCell.dblclick();
  await page.getByRole('option', { name: '产品部' }).click();
  await expect(departmentCell).toContainText('产品部');

  const rolesCell = cell(page, 'roleIds');
  await rolesCell.dblclick();
  await page.getByRole('option', { name: '审计员' }).click();
  await page.getByRole('button', { name: '编辑角色' }).press('Tab');
  await expect(rolesCell).toContainText('管理员、审计员');

  const ownerCell = cell(page, 'ownerId');
  await ownerCell.dblclick();
  await loadNextRemoteOptionPage(page, '远程人员 021');
  await page.getByRole('option', { name: '远程人员 021' }).click();
  await expect(ownerCell).toContainText('远程人员 021');

  const reviewersCell = cell(page, 'reviewerIds');
  await reviewersCell.dblclick();
  await page.getByRole('option', { name: '张三' }).click();
  await page.getByRole('button', { name: '读取草稿' }).click();
  await expect(reviewersCell).toContainText('李四、张三');

  const snapshot = page.getByTestId('editable-choice-snapshot');
  await expect(snapshot).toContainText('"phone":"13900000000"');
  await expect(snapshot).toContainText('"labels":["CORE","URGENT"]');
  await expect(snapshot).toContainText('"departmentId":202');
  await expect(snapshot).toContainText('"reviewerIds":[102,101]');

  const viewport = page
    .getByTestId('data-table-editing-example')
    .locator('[data-slot="scroll-area-viewport"]');
  await viewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(page.locator('td[data-cell-row-id="1"]')).toHaveCount(0);

  await viewport.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(cell(page, 'name')).toContainText('记录 001');
  await expect(cell(page, 'phone')).toContainText('13900000000');
  await expect(cell(page, 'labels')).toContainText('核心、紧急');
  await expect(cell(page, 'reviewerIds')).toContainText('李四、张三');
});
