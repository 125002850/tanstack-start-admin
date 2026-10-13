import { expect, test, type Page } from '@playwright/test';
import { mockLoginInfo } from './support/mock-login-info';

async function expectMode(page: Page, preference: string, resolved: string) {
  await expect(page.locator('html')).toHaveClass(new RegExp(`\\b${resolved}\\b`));
  await expect.poll(() => page.evaluate(() => localStorage.getItem('theme'))).toBe(preference);
}

async function selectMode(page: Page, name: string) {
  await page.keyboard.press('ControlOrMeta+k');
  const search = page.getByRole('combobox', { name: 'Type a command or search…' });
  await search.fill(name);
  await page.getByText(name, { exact: true }).click();
  await expect(search).not.toBeVisible();
}

test.describe('主题切换动画原点', () => {
  test.use({ deviceScaleFactor: 2 });

  for (const input of ['鼠标', '键盘'] as const) {
    test(`@workspace-v2 高 DPR 下${input}触发的动画原点使用 CSS 像素`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'no-preference' });
      await page.addInitScript(() => {
        localStorage.setItem('theme', 'light');
        const animate = Element.prototype.animate;
        Element.prototype.animate = function (keyframes, options) {
          const animation = animate.call(this, keyframes, options);
          if (
            typeof options === 'object' &&
            options.pseudoElement === '::view-transition-new(root)'
          ) {
            // 保留原生动画，在起始帧检查浏览器实际计算的裁剪原点。
            animation.pause();
            animation.currentTime = 0;
          }
          return animation;
        };
      });
      await mockLoginInfo(page);
      await page.goto('/overview');
      expect(await page.evaluate(() => window.devicePixelRatio)).toBe(2);
      const toggle = page.getByRole('button', { name: '切换主题模式' });
      await expect(toggle).toBeVisible();
      await expectMode(page, 'light', 'light');
      const origin = await toggle.evaluate((button, input) => {
        const bounds = button.getBoundingClientRect();
        return input === '鼠标'
          ? { x: Math.floor(bounds.left + 8), y: Math.floor(bounds.top + 8) }
          : { x: bounds.left + bounds.width / 2, y: bounds.top + bounds.height / 2 };
      }, input);

      if (input === '鼠标') {
        await page.mouse.click(origin.x, origin.y);
      } else {
        await toggle.press('Enter');
      }

      await expect
        .poll(() =>
          page.evaluate(() => {
            const clipPath = getComputedStyle(
              document.documentElement,
              '::view-transition-new(root)'
            ).clipPath;
            return clipPath
              .match(/^circle\((.+)px at (.+)px (.+)px\)$/)
              ?.slice(1)
              .map(Number);
          })
        )
        .toEqual([0, expect.closeTo(origin.x, 2), expect.closeTo(origin.y, 2)]);
      await page.evaluate(() => {
        for (const animation of document.getAnimations()) {
          if (
            animation.effect instanceof KeyframeEffect &&
            animation.effect.pseudoElement === '::view-transition-new(root)'
          ) {
            animation.finish();
          }
        }
      });
      await expect(page.locator('html')).not.toHaveAttribute('data-theme-mode-transition');
      await expectMode(page, 'dark', 'dark');
    });
  }
});

for (const systemMode of ['light', 'dark'] as const) {
  test(`@workspace-v2 系统${systemMode}下按钮与 D D 一致，并可恢复跟随系统`, async ({ page }) => {
    const opposite = systemMode === 'light' ? 'dark' : 'light';
    await page.emulateMedia({ colorScheme: systemMode, reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('theme', 'system'));
    await mockLoginInfo(page);
    await page.goto('/overview');
    const toggle = page.getByRole('button', { name: '切换主题模式' });
    await expect(toggle).toBeVisible();
    await expectMode(page, 'system', systemMode);

    await page.keyboard.press('d');
    await page.keyboard.press('d');
    await expectMode(page, opposite, opposite);
    await toggle.click();
    await expectMode(page, systemMode, systemMode);

    await selectMode(page, '跟随系统明暗模式');
    await expectMode(page, 'system', systemMode);
    await toggle.click();
    await expectMode(page, opposite, opposite);
    await page.keyboard.press('d');
    await page.keyboard.press('d');
    await expectMode(page, systemMode, systemMode);

    await selectMode(page, '切换为浅色模式');
    await expectMode(page, 'light', 'light');
    await selectMode(page, '切换为深色模式');
    await expectMode(page, 'dark', 'dark');
    await selectMode(page, '跟随系统明暗模式');
    await expectMode(page, 'system', systemMode);
    await page.emulateMedia({ colorScheme: opposite });
    await expectMode(page, 'system', opposite);
    await page.keyboard.press('d');
    await page.keyboard.press('d');
    await expectMode(page, systemMode, systemMode);
  });
}
