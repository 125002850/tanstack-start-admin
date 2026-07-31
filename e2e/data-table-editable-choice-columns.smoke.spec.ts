import { expect, test, type Locator, type Page } from '@playwright/test';

import { mockIamSession } from './support/mock-iam-session';

const CONTRACT_ROUTE = '/dashboard/elements/data-table-editable-choice';

function cell(page: Page, columnId: string, index = 0): Locator {
  return page.locator(`td[data-cell-column-id="${columnId}"]`).nth(index);
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
    localStorage.setItem('app-data-table-per-page:data-table-editable-choice-contract', '50');
  });
  await page.goto(CONTRACT_ROUTE);
  await expect(page).toHaveURL(new RegExp(`${CONTRACT_ROUTE}$`));
  await expect(page.getByTestId('data-table-editable-choice-contract')).toBeVisible();
  await expect(cell(page, 'name')).toContainText('记录 001');
});

test('@workspace-v2 edits an input cell and commits a switch cell directly', async ({ page }) => {
  const phoneCell = cell(page, 'phone');
  await phoneCell.dblclick();
  const phoneInput = page.getByRole('textbox', { name: '编辑手机号' });
  await expect(phoneInput).toHaveAttribute('type', 'tel');
  await phoneInput.fill('13900000000');
  await phoneInput.press('Enter');
  await expect(phoneCell).toContainText('13900000000');
  await expect(page.getByTestId('editable-choice-last-reason')).toHaveText('enter');

  const availabilityCell = cell(page, 'availability');
  const availabilitySwitch = page.getByRole('switch', { name: '启用状态：启用' }).first();
  await expect(availabilityCell).not.toHaveAttribute('data-cell-editing');
  await availabilitySwitch.click();
  await expect(page.getByRole('switch', { name: '启用状态：停用' }).first()).not.toBeChecked();
  await expect(availabilityCell).toContainText('停用');
  await expect(page.getByTestId('editable-choice-last-reason')).toHaveText('selection');
});

test('@workspace-v2 edits static and remote choices with keyboard-safe lifecycle', async ({
  page
}) => {
  const statusCell = cell(page, 'status');
  const editableIndicator = await statusCell.evaluate((element) => {
    const style = window.getComputedStyle(element, '::before');
    return {
      content: style.content,
      width: style.width,
      height: style.height,
      clipPath: style.clipPath,
      zIndex: style.zIndex,
      pointerEvents: style.pointerEvents
    };
  });
  expect(editableIndicator).toMatchObject({
    content: '""',
    width: '7px',
    height: '7px',
    zIndex: '1',
    pointerEvents: 'none'
  });
  expect(editableIndicator.clipPath).not.toBe('none');

  await statusCell.click();
  await expect(statusCell).toHaveAttribute('data-cell-selected', 'true');
  await expect(statusCell).toHaveAttribute('data-cell-interaction-state', 'selected');
  await expect(statusCell).not.toHaveAttribute('data-cell-edit-ready');
  await expect(statusCell).not.toHaveAttribute('data-cell-editing');
  const selectedCellBox = await statusCell.boundingBox();
  if (!selectedCellBox) throw new Error('selected status cell is not visible');
  const selectedColors = await statusCell.evaluate((element) => {
    const primaryProbe = document.createElement('span');
    primaryProbe.style.color = 'var(--primary)';
    document.body.append(primaryProbe);
    const colors = {
      indicator: window.getComputedStyle(element, '::before').backgroundColor,
      selection: window.getComputedStyle(element, '::after').borderBlockEndColor,
      primary: window.getComputedStyle(primaryProbe).color
    };
    primaryProbe.remove();
    return colors;
  });
  expect(selectedColors.indicator).toBe(selectedColors.selection);
  expect(selectedColors.indicator).toBe(selectedColors.primary);
  const readyTrigger = statusCell.locator('[data-slot="data-table-choice-editor-ready-trigger"]');
  await expect(readyTrigger).not.toBeVisible();
  await expect(readyTrigger).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByRole('option', { name: '就绪' })).toHaveCount(0);

  await statusCell.dblclick();
  await expect(page.getByRole('option', { name: '就绪' })).toBeVisible();
  await expect(statusCell).not.toHaveAttribute('data-cell-edit-ready');
  await expect(statusCell).toHaveAttribute('data-cell-editing', 'true');
  await expect(statusCell.locator('[data-slot="choice-combobox-trigger"]')).toBeVisible();
  const editorMetrics = await statusCell.evaluate((element) => {
    const trigger = element.querySelector<HTMLElement>('[data-slot="choice-combobox-trigger"]');
    if (!trigger) throw new Error('status choice combobox trigger is missing');
    const cellStyle = window.getComputedStyle(element);
    const triggerStyle = window.getComputedStyle(trigger);
    const cellRect = element.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    return {
      cellBackground: cellStyle.backgroundColor,
      cellBoxShadow: cellStyle.boxShadow,
      cellHeight: cellRect.height,
      cellPadding: [
        cellStyle.paddingTop,
        cellStyle.paddingRight,
        cellStyle.paddingBottom,
        cellStyle.paddingLeft
      ],
      editorIndicator: window.getComputedStyle(element, '::before').content,
      triggerBackground: triggerStyle.backgroundColor,
      triggerBoxShadow: triggerStyle.boxShadow,
      triggerBorderRadius: triggerStyle.borderRadius,
      triggerBorderWidths: [
        triggerStyle.borderTopWidth,
        triggerStyle.borderRightWidth,
        triggerStyle.borderBottomWidth,
        triggerStyle.borderLeftWidth
      ],
      triggerHeight: triggerRect.height,
      triggerWidth: triggerRect.width,
      cellWidth: cellRect.width,
      chevronCount: trigger.querySelectorAll('svg').length
    };
  });
  expect(editorMetrics.cellPadding).toEqual(['0px', '0px', '0px', '0px']);
  expect(editorMetrics.cellBackground).toBe(editorMetrics.triggerBackground);
  expect(editorMetrics.editorIndicator).toBe('none');
  expect(editorMetrics.triggerBorderRadius).toBe('2px');
  expect(editorMetrics.chevronCount).toBeGreaterThan(0);
  expect(Math.abs(editorMetrics.cellHeight - selectedCellBox.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(editorMetrics.triggerHeight - editorMetrics.cellHeight)).toBeLessThanOrEqual(2);
  expect(Math.abs(editorMetrics.triggerWidth - editorMetrics.cellWidth)).toBeLessThanOrEqual(2);
  await page.keyboard.press('Escape');
  await expect(statusCell).toHaveAttribute('data-cell-edit-ready', 'true');
  await expect(statusCell).not.toHaveAttribute('data-cell-editing');
  await expect(page.getByRole('combobox', { name: '编辑状态' })).toHaveCount(0);
  await expect(page.getByTestId('editable-choice-last-reason')).toHaveText('-');
  await expect(readyTrigger).toBeVisible();
  const readyMetrics = await statusCell.evaluate((element) => {
    const trigger = element.querySelector<HTMLElement>(
      '[data-slot="data-table-choice-editor-ready-trigger"]'
    );
    if (!trigger) throw new Error('status edit-ready trigger is missing');
    const cellStyle = window.getComputedStyle(element);
    const triggerStyle = window.getComputedStyle(trigger);
    return {
      cellBackground: cellStyle.backgroundColor,
      cellBoxShadow: cellStyle.boxShadow,
      cellPadding: [
        cellStyle.paddingTop,
        cellStyle.paddingRight,
        cellStyle.paddingBottom,
        cellStyle.paddingLeft
      ],
      triggerBackground: triggerStyle.backgroundColor,
      triggerBoxShadow: triggerStyle.boxShadow,
      triggerBorderRadius: triggerStyle.borderRadius,
      triggerBorderWidths: [
        triggerStyle.borderTopWidth,
        triggerStyle.borderRightWidth,
        triggerStyle.borderBottomWidth,
        triggerStyle.borderLeftWidth
      ]
    };
  });
  expect(readyMetrics.cellPadding).toEqual(['0px', '0px', '0px', '0px']);
  expect(readyMetrics.cellBackground).toBe(readyMetrics.triggerBackground);
  expect(readyMetrics.triggerBoxShadow).not.toBe('none');
  expect(readyMetrics.triggerBorderRadius).toBe('2px');
  expect(readyMetrics.triggerBorderWidths).toEqual(['2px', '2px', '2px', '2px']);
  expect(editorMetrics.cellBackground).toBe(readyMetrics.cellBackground);
  expect(editorMetrics.cellBoxShadow).not.toBe('none');
  expect(readyMetrics.cellBoxShadow).not.toBe('none');
  expect(editorMetrics.cellBoxShadow).not.toBe(readyMetrics.cellBoxShadow);
  expect(editorMetrics.cellPadding).toEqual(readyMetrics.cellPadding);
  expect(editorMetrics.triggerBoxShadow).toBe(readyMetrics.triggerBoxShadow);
  expect(editorMetrics.triggerBorderRadius).toBe(readyMetrics.triggerBorderRadius);
  expect(editorMetrics.triggerBorderWidths).toEqual(readyMetrics.triggerBorderWidths);

  await statusCell.press('F2');
  await page.getByRole('option', { name: '就绪' }).click();
  await expect(statusCell).toContainText('就绪');
  await expect(page.getByTestId('editable-choice-last-reason')).toHaveText('selection');

  const roleCell = cell(page, 'roleIds');
  await roleCell.dblclick();
  await page.getByText('审计员', { exact: true }).click();
  await page.getByRole('button', { name: '读取草稿' }).click();
  await expect(roleCell).toContainText('管理员、审计员');
  await expect(roleCell).toHaveAttribute('data-cell-interaction-state', 'edit-ready');
  const roleReadyTrigger = page.getByRole('button', { name: '准备编辑角色' });
  await expect(roleReadyTrigger).toBeVisible();
  await expect(page.getByTestId('editable-choice-last-reason')).toHaveText('blur');
  await expect(page.getByTestId('editable-choice-snapshot')).toContainText('"roleIds":[1,2]');

  const ownerCell = cell(page, 'ownerId');
  await roleReadyTrigger.click();
  await page.getByText('审计员', { exact: true }).click();
  await page.getByRole('button', { name: '编辑角色' }).press('Tab');
  await expect(ownerCell).toBeFocused();
  await expect(ownerCell).toHaveAttribute('data-cell-interaction-state', 'selected');
  await expect(ownerCell).not.toHaveAttribute('data-cell-edit-ready');
  await expect(page.getByTestId('editable-choice-last-reason')).toHaveText('tab');

  await ownerCell.dblclick();
  await expect(page.getByPlaceholder('搜索负责人')).toBeVisible();
  await loadNextRemoteOptionPage(page, '远程人员 021');
  await page.getByRole('option', { name: '远程人员 021' }).click();
  await expect(ownerCell).toContainText('远程人员 021');

  await ownerCell.dblclick();
  await page.getByPlaceholder('搜索负责人').fill('李');
  await expect(page.getByRole('option', { name: '李四' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(ownerCell).toContainText('远程人员 021');
});

test('@workspace-v2 filters remote multiple choice options by keyword', async ({ page }) => {
  const reviewersCell = cell(page, 'reviewerIds');
  await reviewersCell.dblclick();

  const searchInput = page.getByPlaceholder('搜索协作人');
  await expect(searchInput).toBeVisible();
  await expect(page.getByRole('option', { name: '张三' })).toBeVisible();

  await searchInput.fill('远程人员 100');

  await expect(page.getByRole('option', { name: '远程人员 100' })).toBeVisible();
  await expect(page.getByRole('option', { name: '李四' })).toBeVisible();
  await expect(page.getByRole('option', { name: '张三' })).toHaveCount(0);
});

test('@workspace-v2 preserves cross-page drafts through refetch and virtual unmount', async ({
  page
}) => {
  const firstStatus = cell(page, 'status');
  await firstStatus.dblclick();
  await page.getByRole('option', { name: '就绪' }).click();

  await page.getByRole('button', { name: '前往下一页' }).click();
  await expect(cell(page, 'name')).toContainText('记录 051');
  await page.getByRole('button', { name: '读取草稿' }).click();
  await expect(page.getByTestId('editable-choice-snapshot')).toContainText('"loadedPages":[1,2]');

  await page.getByRole('button', { name: '前往上一页' }).click();
  await expect(cell(page, 'status')).toContainText('就绪');
  await page.getByRole('button', { name: '模拟服务端刷新' }).click();
  await expect(cell(page, 'name')).toContainText('记录 001（服务端刷新）');
  await expect(cell(page, 'status')).toContainText('就绪');

  const secondRoleCell = cell(page, 'roleIds', 1);
  await secondRoleCell.dblclick();
  await page.getByText('审计员', { exact: true }).click();
  const viewport = page.locator('[data-slot="scroll-area-viewport"]').last();
  await viewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(page.locator('td[data-cell-row-id="2"]')).toHaveCount(0);

  await page.getByRole('button', { name: '读取草稿' }).click();
  await expect(page.getByTestId('editable-choice-snapshot')).toContainText('"roleIds":[999,2]');

  await viewport.evaluate((element) => {
    element.scrollTop = 0;
    element.dispatchEvent(new Event('scroll'));
  });
  await expect(page.locator('td[data-cell-row-id="2"]').first()).toBeVisible();
  const restoredRoleCell = cell(page, 'roleIds', 1);
  await expect(restoredRoleCell).toContainText('999、审计员');
  await expect(restoredRoleCell).toHaveAttribute('data-cell-interaction-state', 'selected');
  await expect(restoredRoleCell).not.toHaveAttribute('data-cell-edit-ready');
  await expect(page.getByRole('button', { name: '准备编辑角色' })).toHaveCount(0);

  await page.getByRole('button', { name: '确认草稿' }).click();
  await expect(page.getByTestId('editable-choice-snapshot')).toContainText('"changedRows":[]');
});
