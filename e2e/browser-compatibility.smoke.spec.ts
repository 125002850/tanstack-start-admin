import { expect, test } from '@playwright/test';
import { THEMES } from '../src/components/themes/theme.config';
import { mockIamSession } from './support/mock-iam-session';

test('@workspace-v2 浏览器基线：导航与请求', async ({ page, browser }) => {
  test.info().annotations.push({ type: 'browser', description: browser.version() });
  if (process.env.PLAYWRIGHT_EXPECT_CHROMIUM_MAJOR) {
    expect(browser.version().split('.')[0]).toBe(process.env.PLAYWRIGHT_EXPECT_CHROMIUM_MAJOR);
  }
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await mockIamSession(page);
  await page.route('**/api/system/dict/**', (route) =>
    route.fulfill({
      json: {
        code: 200,
        msg: 'ok',
        data: route.request().url().includes('/types/list-all')
          ? [{ id: 1, dictTypeCode: 'compat', dictTypeName: '兼容性验证', status: 'enable' }]
          : { total: 0, list: [] }
      }
    })
  );
  const response = page.waitForResponse(
    (response) =>
      response.url().includes('/dict/global/types/list-all') && response.status() === 200
  );
  await page.goto('/system-management/dictionaries');
  await response;
  await expect(page.getByText('字典项列表', { exact: true })).toBeVisible();
  await expect(page.getByRole('tab', { name: /^字典管理/ })).toHaveAttribute(
    'aria-selected',
    'true'
  );
  expect(
    await page.evaluate(() => ({
      sorted: [3, 1, 2].toSorted(),
      reversed: [1, 2, 3].toReversed(),
      any: typeof AbortSignal.any,
      colorMix: CSS.supports('color', 'color-mix(in oklab, red, blue)'),
      oklch: CSS.supports('color', 'oklch(0.5 0.1 180)')
    }))
  ).toEqual({
    sorted: [1, 2, 3],
    reversed: [3, 2, 1],
    any: 'function',
    colorMix: true,
    oklch: true
  });
  expect(errors).toEqual([]);
});

for (const theme of THEMES) {
  test(`@workspace-v2 ${theme.name} 亮暗主题透明度、表格混色与固定列颜色`, async ({ page }) => {
    await page.goto('/about');
    await expect
      .poll(() =>
        page.evaluate(() =>
          getComputedStyle(document.documentElement).getPropertyValue('--primary')
        )
      )
      .not.toBe('');
    const results = await page.evaluate((theme) => {
      const root = document.documentElement;
      const probe = document.createElement('div');
      probe.style.cssText = 'position:fixed;pointer-events:none';
      document.body.append(probe);
      const table = document.createElement('div');
      table.dataset.component = 'data-table-body';
      const selectedRow = document.createElement('div');
      selectedRow.dataset.slot = 'table-row';
      selectedRow.dataset.state = 'selected';
      table.append(selectedRow);
      document.body.append(table);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d')!;
      const pixel = (color: string) => {
        context.clearRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.fillRect(0, 0, 1, 1);
        return [...context.getImageData(0, 0, 1, 1).data];
      };
      const overWhite = (color: string, alpha = 1) => {
        context.fillStyle = '#fff';
        context.fillRect(0, 0, 1, 1);
        context.fillStyle = color;
        context.globalAlpha = alpha;
        context.fillRect(0, 0, 1, 1);
        context.globalAlpha = 1;
        return [...context.getImageData(0, 0, 1, 1).data];
      };
      const values = [];
      for (const dark of [false, true]) {
        root.dataset.theme = theme;
        root.classList.toggle('dark', dark);
        probe.className = 'bg-primary/10';
        probe.style.removeProperty('background');
        const tintColor = getComputedStyle(probe).backgroundColor;
        const tint = pixel(tintColor);
        const tintOverWhite = overWhite(tintColor);
        probe.className = '';
        probe.style.background = 'var(--primary)';
        const primaryColor = getComputedStyle(probe).backgroundColor;
        const primary = pixel(primaryColor);
        const expectedTintOverWhite = overWhite(primaryColor, 0.1);
        probe.style.background = 'var(--pinned-shadow-gradient)';
        const shadow = pixel(getComputedStyle(probe).backgroundColor);
        const row = pixel(getComputedStyle(selectedRow).backgroundColor);
        values.push({
          theme,
          dark,
          tint,
          primary,
          shadow,
          row,
          tintOverWhite,
          expectedTintOverWhite
        });
      }
      probe.remove();
      table.remove();
      return values;
    }, theme.value);
    for (const {
      theme,
      dark,
      tint,
      primary,
      shadow,
      row,
      tintOverWhite,
      expectedTintOverWhite
    } of results) {
      expect(tint[3], `${theme} ${dark} 10% 透明度`).toBeCloseTo(26, 0);
      expect(shadow[3], `${theme} ${dark} 固定列阴影`).toBeCloseTo(9, 0);
      expect(primary[3]).toBe(255);
      expect(row[3], `${theme} ${dark} 表格选中背景`).toBe(255);
      // 比较不透明合成像素，避免低 alpha 像素反预乘时放大 8 位通道的舍入误差。
      for (let channel = 0; channel < 3; channel++) {
        expect(
          Math.abs(tintOverWhite[channel]! - expectedTintOverWhite[channel]!),
          `${theme} ${dark} 混色通道 ${channel}`
        ).toBeLessThanOrEqual(2);
      }
    }
    expect(results[0]!.row).not.toEqual(results[1]!.row);
  });
}
