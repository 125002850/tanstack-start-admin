import { expect, test } from '@playwright/test';
import { mockLoginInfo } from './support/mock-login-info';
import { expectHorizontallyVisible } from './support/assert-horizontal-visibility';

for (const width of [390, 768, 1280, 1440]) {
  test(`@workspace-v2 dictionary controls remain reachable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await mockLoginInfo(page);
    await page.route('**/api/system/dict/global/items/options', (route) =>
      route.fulfill({ json: { code: 200, msg: 'ok', data: [] } })
    );
    await page.route('**/api/system/dict/global/items/by-type', (route) =>
      route.fulfill({ json: { code: 200, msg: 'ok', data: { total: 0, list: [] } } })
    );
    await page.route('**/api/system/dict/global/types/list-all', (route) =>
      route.fulfill({
        json: {
          code: 200,
          msg: 'ok',
          data: Array.from({ length: 30 }, (_, index) => ({
            id: index + 1,
            dictTypeCode: `dictionary_type_with_a_long_code_for_responsive_layout_${index}`,
            dictTypeName: `窄屏回归字典 ${index + 1}`,
            status: 'enable'
          }))
        }
      })
    );
    await page.goto('/dashboard/system-management/dictionaries');
    await expectHorizontallyVisible(page.getByRole('button', { name: '新增字典类型' }));
    if (width === 390) {
      await page.screenshot({ path: test.info().outputPath('responsive-layout.png') });
    }

    await expectHorizontallyVisible(page.getByPlaceholder('搜索 编码 / 名称'));
    await expectHorizontallyVisible(page.getByRole('button', { name: '编辑', exact: true }));
    await expectHorizontallyVisible(page.getByText('字典项列表', { exact: true }));
    await page.getByRole('button', { name: '新增字典类型' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });
}
