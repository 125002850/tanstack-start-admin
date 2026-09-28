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

test('@workspace-v2 dictionary failed save keeps input and allows retry', async ({ page }) => {
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
        data: [{ id: 1, dictTypeCode: 'audit', dictTypeName: '审查回归字典', status: 'enable' }]
      }
    })
  );
  let calls = 0;
  await page.route('**/api/system/dict/global/item/create', async (route) => {
    calls++;
    await route.fulfill({
      json:
        calls === 1
          ? { code: 500, msg: '字典保存回归失败', data: null }
          : { code: 200, msg: 'ok', data: null }
    });
  });
  await page.goto('/dashboard/system-management/dictionaries');
  await page.getByRole('button', { name: '新增字典项', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '新增字典项' });
  await dialog.getByRole('textbox', { name: /字典项编码/ }).fill('regression');
  await dialog.getByRole('textbox', { name: /字典项名称/ }).fill('回归项');
  await dialog.getByRole('button', { name: '创建', exact: true }).click();
  await expect.poll(() => calls).toBe(1);
  await expect(dialog.getByRole('button', { name: '创建', exact: true })).toBeEnabled();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: /字典项名称/ })).toHaveValue('回归项');
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(1);
  await dialog.getByRole('button', { name: '创建', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(calls).toBe(2);
});

test('@workspace-v2 dictionary type failed save keeps input and allows retry', async ({ page }) => {
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
        data: [{ id: 1, dictTypeCode: 'audit', dictTypeName: '审查回归字典', status: 'enable' }]
      }
    })
  );
  let calls = 0;
  await page.route('**/api/system/dict/global/type/create', async (route) => {
    calls++;
    await route.fulfill({
      json:
        calls === 1
          ? { code: 500, msg: '字典保存回归失败', data: null }
          : { code: 200, msg: 'ok', data: null }
    });
  });
  await page.goto('/dashboard/system-management/dictionaries');
  await page.getByRole('button', { name: '新增字典类型', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: '新增字典类型' });
  await dialog.getByRole('textbox', { name: /字典类型编码/ }).fill('regression');
  await dialog.getByRole('textbox', { name: /字典类型名称/ }).fill('回归项');
  await dialog.getByRole('button', { name: '创建', exact: true }).click();
  await expect.poll(() => calls).toBe(1);
  await expect(dialog.getByRole('button', { name: '创建', exact: true })).toBeEnabled();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: /字典类型名称/ })).toHaveValue('回归项');
  await expect(page.locator('[data-sonner-toast][data-type="error"]')).toHaveCount(1);
  await dialog.getByRole('button', { name: '创建', exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(calls).toBe(2);
});
