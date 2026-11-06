import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/src/test/fixtures/shared-ui-preview.html');
  await expect(page.getByRole('button', { name: '打开附件详情' })).toBeVisible();
  await expect(
    page
      .getByRole('region', { name: '条件画布编辑示例' })
      .locator('.react-flow__node[data-id="example-amount"]')
  ).toBeVisible();
});

test('共享选择器保留头部操作、搜索空态和 Escape 焦点恢复', async ({ page }) => {
  const trigger = page.getByRole('button', { name: '分类选择' });
  await trigger.click();
  await page.getByRole('button', { name: '选择全部候选' }).click();
  await expect(trigger).toContainText('候选 B');
  await page.getByRole('combobox').last().fill('没有对应候选');
  await expect(page.getByRole('status').filter({ hasText: '未找到匹配项' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(trigger).toBeFocused();
});

for (const mobile of [false, true]) {
  test(`图片预览支持缩放切图、嵌套 Escape 与焦点恢复 ${mobile ? 'mobile' : 'desktop'}`, async ({
    page
  }) => {
    await page.setViewportSize(mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 });
    await page.getByRole('button', { name: '打开附件详情' }).click();
    const opener = page.getByRole('button', { name: '查看分组图片' });
    await opener.click();
    const preview = page.getByRole('dialog', { name: '图片预览' });
    await expect(preview.locator('[data-slot="image-preview-viewer"] img').first()).toBeVisible();
    await expect(preview.getByText('1 / 2', { exact: true })).toBeVisible();
    const image = preview.locator('[data-slot="image-preview-viewer"] img').first();
    const initialWidth = (await image.boundingBox())!.width;
    await preview.getByRole('button', { name: '缩放图片' }).click();
    await expect
      .poll(async () => (await image.boundingBox())?.width ?? 0)
      .toBeGreaterThan(initialWidth * 1.05);
    await page.keyboard.press('ArrowRight');
    await expect(preview.getByText('2 / 2', { exact: true })).toBeVisible();
    await page.screenshot({
      path: `/tmp/oig-backport-preview-${mobile ? 'mobile' : 'desktop'}.png`
    });
    await page.keyboard.press('Escape');
    await expect(preview).not.toBeVisible();
    await expect(page.getByRole('dialog', { name: '附件详情' })).toBeVisible();
    await expect(opener).toBeFocused();
  });
}

test('错误导航激活分区再聚焦，未保存导航可取消或确认', async ({ page }) => {
  await page.getByRole('button', { name: '定位首个错误' }).click();
  await expect(page.getByRole('textbox', { name: '邮箱' })).toBeFocused();
  await page.getByRole('textbox', { name: '未保存内容' }).fill('尚未保存');
  await page.getByRole('button', { name: '离开示例页' }).click();
  await expect(page.getByRole('alertdialog')).toContainText('未保存更改');
  await page.getByRole('button', { name: '留在页面' }).click();
  await expect(page.getByRole('textbox', { name: '未保存内容' })).toHaveValue('尚未保存');
  await page.getByRole('button', { name: '离开示例页' }).click();
  await page.getByRole('button', { name: '放弃更改并离开' }).click();
  await expect(page.getByText('已离开示例页', { exact: true })).toBeVisible();
});

test('明细表复用行列虚拟化，滚动可达末行并保留固定列', async ({ page }) => {
  const viewport = page.getByTestId('virtual-detail');
  await expect(viewport.getByText('R-0000', { exact: true })).toBeVisible();
  expect(await viewport.locator('tbody tr[data-row-index]').count()).toBeGreaterThan(0);
  expect(await viewport.locator('tbody tr[data-row-index]').count()).toBeLessThan(100);
  const firstPinned = viewport.getByText('R-0000', { exact: true });
  const pinnedLeft = (await firstPinned.boundingBox())!.x;
  await viewport.evaluate((element) => {
    element.scrollLeft = element.scrollWidth;
  });
  await expect
    .poll(async () => Math.abs(((await firstPinned.boundingBox())?.x ?? 0) - pinnedLeft))
    .toBeLessThan(2);
  await viewport.evaluate((element) => {
    element.scrollTop = element.scrollHeight;
    element.scrollLeft = element.scrollWidth;
  });
  await expect(viewport.getByText('R-0399', { exact: true })).toBeVisible();
  await expect(viewport.getByText('399:27', { exact: true })).toBeVisible();
  await expect(page.locator('[data-component="text-diff"] [data-diff-kind="added"]')).toContainText(
    'new'
  );
  await expect(
    page.locator('[data-component="text-diff"] [data-diff-kind="removed"]')
  ).toContainText('old');
});

test('时长输入保留原文，条件树编辑支持撤销与只读', async ({ page }) => {
  await page.getByRole('textbox', { name: '超时时长', exact: true }).fill('001.25');
  await page.getByRole('combobox', { name: '超时时长单位' }).click();
  await page.getByRole('option', { name: '小时', exact: true }).click();
  await expect(page.getByLabel('时长结果')).toContainText('"value":"001.25","unit":"hour"');

  const tree = page.getByRole('region', { name: '条件树编辑示例' });
  await tree.getByRole('textbox', { name: '条件右值' }).fill('250.000001');
  await expect(tree.getByLabel('条件结果')).toContainText('"rightValue":"250.000001"');
  await tree.getByRole('button', { name: '撤销条件修改' }).click();
  await expect(tree.getByRole('textbox', { name: '条件右值' })).toHaveValue('100');
  await tree.getByRole('button', { name: '重做条件修改' }).click();
  await expect(tree.getByRole('textbox', { name: '条件右值' })).toHaveValue('250.000001');
  await tree.getByRole('button', { name: '切换只读' }).click();
  await expect(tree.getByRole('textbox', { name: '条件左值' })).toBeDisabled();
  await expect(tree.getByRole('button', { name: '添加条件', exact: true })).toBeDisabled();
});

test('条件画布全屏保留节点与缩放，下拉 Escape 先关闭内层', async ({ page }) => {
  const canvas = page.getByRole('region', { name: '条件画布编辑示例' });
  const node = canvas.locator('.react-flow__node[data-id="example-amount"]');
  await expect(node).toBeVisible();
  await node.getByRole('textbox', { name: '条件值', exact: true }).fill('123.4500');
  await node.evaluate((element) => element.setAttribute('data-instance-proof', 'persistent'));
  const initialZoom = await canvas
    .locator('.react-flow__viewport')
    .evaluate((element) => new DOMMatrix(getComputedStyle(element).transform).a);
  await canvas.getByRole('button', { name: '放大画布', exact: true }).click();
  await expect(canvas.getByLabel('当前缩放比例')).toHaveText(
    `${Math.round(Math.min(1.6, initialZoom * 1.2) * 100)}%`
  );
  const zoom = await canvas.getByLabel('当前缩放比例').textContent();
  await canvas.getByRole('button', { name: '放大编辑画布' }).click();
  const fullscreen = page.getByRole('dialog', { name: '放大编辑：示例条件' });
  await expect(fullscreen).toBeVisible();
  await expect(fullscreen.locator('[data-id="example-amount"]')).toHaveAttribute(
    'data-instance-proof',
    'persistent'
  );
  await expect(fullscreen.getByRole('textbox', { name: '条件值', exact: true })).toHaveValue(
    '123.4500'
  );
  await expect(fullscreen.getByLabel('当前缩放比例')).toHaveText(zoom!);
  await fullscreen.getByRole('combobox', { name: '条件字段', exact: true }).click();
  await expect(page.getByRole('option', { name: '地区', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(fullscreen).toBeVisible();
  await expect(page.getByRole('option', { name: '地区', exact: true })).not.toBeVisible();
  await page.screenshot({ path: '/tmp/oig-shared-foundation-canvas.png' });
  await page.keyboard.press('Escape');
  await expect(fullscreen).not.toBeVisible();
  await expect(canvas.getByRole('button', { name: '放大编辑画布' })).toBeFocused();
  await expect(canvas.locator('[data-id="example-amount"]')).toHaveAttribute(
    'data-instance-proof',
    'persistent'
  );
  await expect(canvas.getByRole('textbox', { name: '条件值', exact: true })).toHaveValue(
    '123.4500'
  );
});

for (const orientation of ['horizontal', 'vertical'] as const) {
  test(`滚动条 ${orientation} 透明热区可拖拽且不触发单元格选择`, async ({ page }) => {
    const example = page.getByTestId('foundation-scrollbars');
    const area = example.locator('[data-slot="scroll-area"]');
    const viewport = example.locator('[data-slot="scroll-area-viewport"]');
    const bar = area.locator(
      `[data-slot="scroll-area-scrollbar"][data-orientation="${orientation}"]`
    );
    const thumb = bar.locator('[data-slot="scroll-area-thumb"]');
    const vertical = orientation === 'vertical';
    await area.hover();
    await thumb.scrollIntoViewIfNeeded();
    const box = (await thumb.boundingBox())!;
    expect(vertical ? box.width : box.height).toBe(16);
    const x = box.x + (vertical ? 1 : box.width / 2);
    const y = box.y + (vertical ? box.height / 2 : 1);
    const thickness = () =>
      thumb.evaluate(
        (element, isVertical) =>
          parseFloat(getComputedStyle(element, '::before')[isVertical ? 'width' : 'height']),
        vertical
      );
    await page.mouse.move(vertical ? x - 32 : x, vertical ? y : y - 32);
    await expect.poll(thickness).toBe(7);
    await page.mouse.move(x, y);
    await expect.poll(thickness).toBe(9);
    const before = await viewport.evaluate(
      (element, isVertical) => (isVertical ? element.scrollTop : element.scrollLeft),
      vertical
    );
    await page.mouse.down();
    await page.mouse.move(vertical ? x - 32 : x + 50, vertical ? y + 50 : y - 32, { steps: 8 });
    await expect
      .poll(() =>
        viewport.evaluate(
          (element, isVertical) => (isVertical ? element.scrollTop : element.scrollLeft),
          vertical
        )
      )
      .toBeGreaterThan(before);
    await page.mouse.up();
    await expect.poll(thickness).toBe(7);
    await expect(example.locator('td[data-cell-selected="true"]')).toHaveCount(0);
    await page.emulateMedia({ reducedMotion: 'reduce' });
    expect(
      await thumb.evaluate((element) => getComputedStyle(element, '::before').transitionDuration)
    ).toBe('0s');
  });
}

test('滚动条旁操作按钮右边缘可点击，工作区错误页不额外撑高', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1000 });
  const table = page.getByTestId('foundation-scrollbars');
  const action = table.getByRole('button', { name: '查看记录', exact: true }).first();
  await action.scrollIntoViewIfNeeded();
  const box = (await action.boundingBox())!;
  await action.click({ position: { x: box.width - 1, y: box.height / 2 } });
  await expect(table.getByLabel('记录操作结果')).toContainText('F-0');
  const frame = page.getByTestId('workspace-error-frame');
  await frame.scrollIntoViewIfNeeded();
  const bounds = await frame.evaluate((element) => {
    const available = element.clientHeight - element.querySelector('header')!.clientHeight;
    return {
      available,
      errorHeight: element.querySelector('main')!.getBoundingClientRect().height
    };
  });
  expect(bounds.errorHeight).toBeLessThanOrEqual(bounds.available + 1);
});
