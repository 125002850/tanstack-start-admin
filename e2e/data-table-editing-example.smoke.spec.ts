import { expect, test, type Locator, type Page } from '@playwright/test';

import { mockIamSession } from './support/mock-iam-session';

const EXAMPLE_ROUTE = '/dashboard/examples/data-table-editing';
const EDITOR_LABELS = [
  'text · input',
  'longText · textarea',
  'number · numeric',
  'int · numeric',
  'decimal · numeric',
  'money · numeric',
  'percent · numeric',
  'date · calendar',
  'dateTime · instant',
  'dateTime · local',
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

test('@workspace-v2 shows current-page filters without compressing header labels', async ({
  page
}) => {
  const example = page.getByTestId('data-table-editing-example');
  const filterButtons = example.getByRole('button', { name: /^筛选当前页：/ });

  await expect(filterButtons).not.toHaveCount(0);
  await expect(example.getByRole('button', { name: '筛选当前页：名称' })).toBeVisible();
  await expect(example.getByRole('button', { name: '筛选当前页：手机号' })).toBeVisible();

  for (const title of ['名称', '手机号', '备注', '评分']) {
    const titleElement = example
      .locator(`th:has(button[aria-label="筛选当前页：${title}"])`)
      .locator('[data-slot="data-table-overflow-text"]');
    await expect(titleElement).toBeVisible();
    expect(
      await titleElement.evaluate((element) => element.scrollWidth <= element.clientWidth)
    ).toBe(true);
  }

  const nameFilter = example.getByRole('button', { name: '筛选当前页：名称' });
  await nameFilter.click();
  const filterSearch = page.getByRole('textbox', { name: '搜索名称筛选值' });
  const filterList = page.getByRole('list', { name: '筛选值' });
  const filterPopover = page.locator(
    '[data-slot="popover-content"][aria-label="筛选当前页：名称"]'
  );
  await expect(filterSearch).toBeVisible();
  await expect(filterPopover).toBeVisible();

  const popoverBox = await filterPopover.boundingBox();
  expect(popoverBox).not.toBeNull();
  expect(popoverBox!.width).toBeLessThanOrEqual(250);

  const listMetrics = await filterList.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    rendered: element.querySelectorAll('[role="listitem"]').length
  }));
  expect(listMetrics.scrollHeight).toBeGreaterThan(listMetrics.clientHeight);
  expect(listMetrics.rendered).toBeLessThan(500);

  await filterSearch.fill('记录 001');
  await expect(page.getByRole('checkbox', { name: '记录 001' })).toBeVisible();
  await expect(page.getByRole('checkbox', { name: '记录 002' })).toHaveCount(0);
  await expect(nameFilter).toHaveAttribute('aria-pressed', 'false');
  await expect(cell(page, 'name')).toContainText('记录 001');

  await filterSearch.fill('');
  await page.getByRole('checkbox', { name: '全选名称筛选值' }).click();
  await expect(example.locator('tbody tr[data-index]')).toHaveCount(0);

  await filterSearch.fill('记录 001');
  await page.getByRole('checkbox', { name: '记录 001' }).click();

  await expect(nameFilter).toHaveAttribute('aria-pressed', 'true');
  await expect(example.locator('tbody tr[data-index]')).toHaveCount(1);
  await expect(cell(page, 'name')).toContainText('记录 001');

  await filterSearch.fill('');
  await page.getByRole('checkbox', { name: '全选名称筛选值' }).click();
  await expect(nameFilter).toHaveAttribute('aria-pressed', 'false');
  await expect(example.locator('tbody tr[data-index]')).not.toHaveCount(1);
});

test('@workspace-v2 applies header sorting to the mock server data', async ({ page }) => {
  const example = page.getByTestId('data-table-editing-example');
  const nameHeader = example.locator(
    'th[data-column-id="name"] button[data-column-header-drag-surface]'
  );

  await expect(nameHeader).toHaveAttribute('aria-label', '名称：升序');
  await nameHeader.click();
  await expect(nameHeader).toHaveAttribute('aria-label', '名称：降序');
  await expect(cell(page, 'name')).toContainText('记录 001');

  await nameHeader.click();
  await expect(nameHeader).toHaveAttribute('aria-label', '名称：重置排序');
  await expect(cell(page, 'name')).toContainText('记录 10000');
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

test('@workspace-v2 renders and clears server cell errors across virtual unmounts', async ({
  page
}) => {
  const example = page.getByTestId('data-table-editing-example');
  await page.getByRole('button', { name: '模拟服务端校验失败' }).click();
  await expect(page.getByTestId('editable-choice-server-error-count')).toHaveText('1');

  const phoneCell = example.locator('td[data-cell-row-id="1"][data-cell-column-id="phone"]');
  await expect(phoneCell).toHaveAttribute('aria-invalid', 'true');
  await expect(phoneCell).toHaveAttribute('data-cell-server-invalid', 'true');
  const descriptionId = await phoneCell.getAttribute('aria-describedby');
  expect(descriptionId).toBeTruthy();
  await expect(page.locator(`[id="${descriptionId}"]`)).toHaveText('手机号已被服务端占用');
  await expect(phoneCell.locator('[data-slot="data-table-cell-server-error-marker"]')).toHaveText(
    '!'
  );

  const viewport = example.locator('[data-slot="scroll-area-viewport"]');
  await viewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(page.locator('td[data-cell-row-id="1"]')).toHaveCount(0);
  await viewport.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(phoneCell).toHaveAttribute('data-cell-server-invalid', 'true');

  await phoneCell.dblclick();
  const input = page.getByRole('textbox', { name: '编辑手机号' });
  await input.fill('13700000000');
  await input.press('Enter');
  await expect(phoneCell).not.toHaveAttribute('data-cell-server-invalid');
  await expect(page.getByTestId('editable-choice-server-error-count')).toHaveText('0');
  await expect(page.getByTestId('editable-choice-last-reason')).toHaveText('enter');
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

  const remarkCell = cell(page, 'remark');
  await remarkCell.dblclick();
  const remarkInput = page.getByRole('textbox', { name: '编辑备注' });
  await expect(remarkInput).toBeFocused();
  await remarkInput.fill('首行\r\n第二行');
  await expect(page.getByRole('dialog', { name: '备注多行文本编辑器' })).toContainText('7 / 120');
  await page.getByRole('button', { name: '确认', exact: true }).click();
  await expect(remarkCell).toContainText('首行');
  await expect(remarkCell).toContainText('第二行');

  const scoreCell = cell(page, 'score');
  const quantityCell = cell(page, 'quantity');
  const weightCell = cell(page, 'weight');
  const budgetCell = cell(page, 'budget');
  const completionRateCell = cell(page, 'completionRate');
  const effectiveDateCell = cell(page, 'effectiveDate');

  await scoreCell.dblclick();
  const scoreInput = page.getByRole('textbox', { name: '编辑评分' });
  await scoreInput.fill('88.25');
  await scoreInput.press('Tab');
  await expect(scoreCell).toContainText('88.25');
  await expect(quantityCell).toBeFocused();

  await quantityCell.press('Enter');
  const quantityInput = page.getByRole('textbox', { name: '编辑数量' });
  const quantityStepper = page.getByRole('group', { name: '数量步进控件' });
  const increaseQuantity = page.getByRole('button', { name: '增加数量' });
  const decreaseQuantity = page.getByRole('button', { name: '减少数量' });
  await expect(quantityStepper).toHaveAttribute('data-orientation', 'vertical');
  const increaseBox = await increaseQuantity.boundingBox();
  const decreaseBox = await decreaseQuantity.boundingBox();
  expect(increaseBox).not.toBeNull();
  expect(decreaseBox).not.toBeNull();
  expect(increaseBox!.y).toBeLessThan(decreaseBox!.y);
  await quantityInput.fill('7.2');
  await expect(quantityInput).toHaveAttribute('aria-invalid', 'true');
  await quantityInput.fill('7');
  await quantityInput.press('Tab');
  await expect(quantityCell).toContainText('7');
  await expect(weightCell).toBeFocused();

  await weightCell.press('Enter');
  const weightInput = page.getByRole('textbox', { name: '编辑重量' });
  await weightInput.fill('12.345');
  await weightInput.press('Tab');
  await expect(weightCell).toContainText('12.345');
  await expect(budgetCell).toBeFocused();

  await budgetCell.press('Enter');
  const budgetInput = page.getByRole('textbox', { name: '编辑预算' });
  await budgetInput.fill('CNY 2,345.67');
  await budgetInput.press('Tab');
  await expect(budgetCell).toContainText('2,345.67');
  await expect(completionRateCell).toBeFocused();

  await completionRateCell.press('Enter');
  const completionRateInput = page.getByRole('textbox', { name: '编辑完成率' });
  await completionRateInput.fill('12.34%');
  await completionRateInput.press('Enter');
  await expect(completionRateCell).toContainText('12.34%');

  await effectiveDateCell.dblclick();
  const dateDialog = page.getByRole('dialog', { name: '生效日期日历' });
  await expect(dateDialog).toBeVisible();
  await expect(page.getByRole('textbox', { name: '编辑生效日期' })).toHaveCount(0);
  await expect(dateDialog.locator('input')).toHaveCount(0);
  const dialogBox = await dateDialog.boundingBox();
  const calendarBox = await dateDialog.locator('[role="grid"]').boundingBox();
  expect(dialogBox).not.toBeNull();
  expect(calendarBox).not.toBeNull();
  expect(calendarBox!.width).toBeGreaterThan(dialogBox!.width * 0.85);
  const selectedDate = dateDialog.locator('[data-day="2026-07-01"]');
  await expect(selectedDate).toHaveAttribute('aria-selected', 'true');
  const selectedDateButton = selectedDate.locator('button');
  await expect
    .poll(() => selectedDate.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe('rgba(0, 0, 0, 0)');
  const selectedBackground = await selectedDateButton.evaluate(
    (element) => getComputedStyle(element).backgroundColor
  );
  expect(selectedBackground).not.toBe('rgba(0, 0, 0, 0)');
  await expect
    .poll(() =>
      selectedDateButton.evaluate((element) =>
        getComputedStyle(element).getPropertyValue('--tw-ring-shadow').includes('calc(0px +')
      )
    )
    .toBe(true);
  await selectedDateButton.hover();
  await expect
    .poll(() => selectedDateButton.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe(selectedBackground);
  await expect(dateDialog.locator('[data-day="2026-07-31"] button')).toBeDisabled();
  await dateDialog.locator('[data-day="2026-08-01"] button').click();
  await expect(dateDialog).toHaveCount(0);
  await expect(effectiveDateCell).toContainText('2026-08-01');

  const executeAtCell = cell(page, 'executeAt');
  await executeAtCell.dblclick();
  const executeAtDialog = page.getByRole('dialog', { name: '执行时间日期时间编辑器' });
  await expect(executeAtDialog).toBeVisible();
  await expect(page.getByRole('textbox', { name: '编辑执行时间' })).toHaveCount(0);
  await expect(executeAtDialog.locator('input[type="text"]')).toHaveCount(0);
  await expect(executeAtDialog.locator('input[type="time"]')).toHaveCount(1);
  const executeAtTimeInput = page.getByLabel('执行时间：时间');
  await expect(executeAtTimeInput).toHaveValue('12:05');
  await executeAtTimeInput.fill('12:10');
  await executeAtDialog.locator('[data-day="2026-08-01"] button').click();
  await executeAtDialog.getByRole('button', { name: '确定' }).click();
  await expect(executeAtCell).toContainText('2026-08-01 12:10:00');

  const localStartsAtCell = cell(page, 'localStartsAt');
  await localStartsAtCell.dblclick();
  const localStartsAtDialog = page.getByRole('dialog', {
    name: '本地开始时间日期时间编辑器'
  });
  await expect(page.getByRole('textbox', { name: '编辑本地开始时间' })).toHaveCount(0);
  const localStartsAtTimeInput = page.getByLabel('本地开始时间：时间');
  await localStartsAtDialog.locator('[data-day="2026-08-01"] button').click();
  await localStartsAtTimeInput.fill('12:00:01');
  await expect(localStartsAtTimeInput).toHaveAttribute('aria-invalid', 'true');
  await localStartsAtTimeInput.fill('12:00:30');
  await localStartsAtTimeInput.press('Enter');
  await expect(localStartsAtCell).toContainText('2026-08-01 12:00:30');

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
  await expect(snapshot).toContainText('"remark":"首行\\n第二行"');
  await expect(snapshot).toContainText('"score":88.25');
  await expect(snapshot).toContainText('"quantity":7');
  await expect(snapshot).toContainText('"weight":12.345');
  await expect(snapshot).toContainText('"budget":2345.67');
  await expect(snapshot).toContainText('"completionRate":0.1234');
  await expect(snapshot).toContainText('"effectiveDate":"2026-08-01"');
  await expect(snapshot).toContainText('"executeAt":"2026-08-01T04:10:00.000Z"');
  await expect(snapshot).toContainText('"localStartsAt":"2026-08-01T12:00:30"');
  await expect(snapshot).toContainText('"labels":["CORE","URGENT"]');
  await expect(snapshot).toContainText('"departmentId":202');
  await expect(snapshot).toContainText('"reviewerIds":[102,101]');

  await phoneCell.dblclick();
  await page.getByRole('textbox', { name: '编辑手机号' }).fill('13700000000');

  const viewport = page
    .getByTestId('data-table-editing-example')
    .locator('[data-slot="scroll-area-viewport"]');
  await viewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(page.locator('td[data-cell-row-id="1"]')).toHaveCount(0);
  await expect(page.getByRole('textbox', { name: '编辑手机号' })).toHaveCount(0);

  await viewport.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(cell(page, 'name')).toContainText('记录 001');
  await expect(cell(page, 'phone')).toContainText('13700000000');
  await expect(cell(page, 'remark')).toContainText('首行');
  await expect(cell(page, 'score')).toContainText('88.25');
  await expect(cell(page, 'budget')).toContainText('2,345.67');
  await expect(cell(page, 'completionRate')).toContainText('12.34%');
  await expect(cell(page, 'effectiveDate')).toContainText('2026-08-01');
  await expect(cell(page, 'executeAt')).toContainText('2026-08-01 12:10:00');
  await expect(cell(page, 'localStartsAt')).toContainText('2026-08-01 12:00:30');
  await expect(cell(page, 'labels')).toContainText('核心、紧急');
  await expect(cell(page, 'reviewerIds')).toContainText('李四、张三');
  await page.getByRole('button', { name: '读取草稿' }).click();
  await expect(snapshot).toContainText('"phone":"13700000000"');

  await cell(page, 'score').dblclick();
  await page.getByRole('textbox', { name: '编辑评分' }).fill('99.5');
  await viewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(page.getByRole('textbox', { name: '编辑评分' })).toHaveCount(0);
  await viewport.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(cell(page, 'score')).toContainText('99.5');

  await cell(page, 'remark').dblclick();
  await page.getByRole('textbox', { name: '编辑备注' }).fill('虚拟卸载不得提交');
  await viewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(page.getByRole('dialog', { name: '备注多行文本编辑器' })).toHaveCount(0);
  await viewport.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(cell(page, 'remark')).toContainText('首行');
  await expect(cell(page, 'remark')).not.toContainText('虚拟卸载不得提交');

  await cell(page, 'executeAt').dblclick();
  await page.getByLabel('执行时间：时间').fill('13:10');
  await viewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(page.getByRole('dialog', { name: '执行时间日期时间编辑器' })).toHaveCount(0);
  await viewport.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(cell(page, 'executeAt')).toContainText('2026-08-01 12:10:00');
});
