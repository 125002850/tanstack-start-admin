import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('/src/test/fixtures/shared-ui-preview.html');
  await expect(page.getByRole('button', { name: '打开附件详情' })).toBeVisible();
});

test('共享选择器保留头部操作、搜索空态和 Escape 焦点恢复', async ({ page }) => {
  const trigger = page.getByRole('button', { name: '分类选择' });
  await trigger.click();
  await page.getByRole('button', { name: '选择全部候选' }).click();
  await expect(trigger).toContainText('候选 B');
  await page.getByRole('combobox').last().fill('没有对应候选');
  await expect(page.getByRole('status')).toContainText('未找到匹配项');
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
