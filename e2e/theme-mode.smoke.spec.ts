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

for (const systemMode of ['light', 'dark'] as const) {
  test(`@workspace-v2 系统${systemMode}下按钮与 D D 一致，并可恢复跟随系统`, async ({ page }) => {
    const opposite = systemMode === 'light' ? 'dark' : 'light';
    await page.emulateMedia({ colorScheme: systemMode, reducedMotion: 'reduce' });
    await page.addInitScript(() => localStorage.setItem('theme', 'system'));
    await mockLoginInfo(page);
    await page.goto('/dashboard/overview');
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
