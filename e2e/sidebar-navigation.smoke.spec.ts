import { expect, test } from '@playwright/test';
import { mockLoginInfo } from './support/mock-login-info';

test.describe('@workspace-v2 sidebar navigation', () => {
  test.use({ viewport: { width: 1440, height: 1000 } });

  test.beforeEach(async ({ page }) => {
    await mockLoginInfo(page);
    await page.route('**/api/system/dict/global/types/list-all', (route) =>
      route.fulfill({ json: { code: 200, data: [] } })
    );
    await page.route('**/api/system/dict/global/items/options', (route) =>
      route.fulfill({ json: { code: 200, data: [] } })
    );
    await page.goto('/overview');
  });

  test('hover only hints; click opens; leaving does not close; selecting navigates', async ({
    page
  }) => {
    await page.locator('[data-sidebar="trigger"]').click();
    const trigger = page.getByRole('button', { name: '系统管理', exact: true });
    await trigger.hover();
    await expect(page.getByRole('tooltip')).toHaveText('系统管理');
    // 超过旧悬停开启延迟，验证不会出现自动展开。
    await page.waitForTimeout(180);
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('menuitem', { name: '字典管理' })).not.toBeVisible();

    await trigger.click();
    const item = page.getByRole('menuitem', { name: '字典管理' });
    await expect(item).toBeVisible();
    await item.hover();
    await page.mouse.move(1000, 500);
    // 超过旧移出关闭延迟，浮层仍应可用。
    await page.waitForTimeout(260);
    await expect(item).toBeVisible();
    await item.click();
    await expect(page).toHaveURL(/\/system-management\/dictionaries$/);
    await expect(page.getByRole('tab', { name: '字典管理', exact: true })).toHaveAttribute(
      'aria-selected',
      'true'
    );
    await expect(page.getByRole('menu')).not.toBeVisible();
  });

  test('keyboard opens children and Escape restores trigger focus', async ({ page }) => {
    await page.locator('[data-sidebar="trigger"]').click();
    const trigger = page.getByRole('button', { name: '系统管理', exact: true });
    await trigger.focus();
    await page.keyboard.press('ArrowDown');
    await expect(page.getByRole('menuitem', { name: '字典管理' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('menu')).not.toBeVisible();
    await expect(trigger).toBeFocused();
  });

  test('SSO user menu preserves notifications and logout', async ({ page }) => {
    await page.getByRole('button', { name: '用户菜单', exact: true }).click();
    await expect(page.getByRole('menuitem', { name: '退出登录', exact: true })).toBeVisible();
    await expect(page.getByRole('menuitem', { name: '个人资料', exact: true })).toHaveCount(0);
    await expect(page.getByRole('menuitem', { name: '修改密码', exact: true })).toHaveCount(0);
    await page.getByRole('menuitem', { name: '通知', exact: true }).click();
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(page.getByRole('menu')).not.toBeVisible();
  });

  test('active groups can collapse; children animate by height and labels fade separately', async ({
    page
  }, testInfo) => {
    const toggle = page.locator('[data-sidebar="trigger"]');
    await toggle.click();
    await toggle.click();
    const trigger = page.getByRole('button', { name: '系统管理', exact: true });
    const motion = await trigger.getByText('系统管理', { exact: true }).evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        delay: style.animationDelay,
        duration: style.animationDuration,
        fill: style.animationFillMode
      };
    });
    expect(motion).toEqual({ delay: '0.15s', duration: '0.075s', fill: 'backwards' });
    expect(
      await trigger.evaluate((element) => getComputedStyle(element).transitionProperty)
    ).not.toContain('width');
    await expect(page.locator('[data-sidebar="group-label"]')).toHaveCount(0);

    await trigger.click();
    const submenu = page
      .locator('[data-slot="collapsible-content"]')
      .filter({ has: page.getByRole('link', { name: '字典管理', exact: true }) });
    const animation = await submenu.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        name: style.animationName,
        duration: style.animationDuration,
        height: style.getPropertyValue('--radix-collapsible-content-height')
      };
    });
    expect(animation.name).toContain('collapsible-down');
    expect(animation.duration).toBe('0.2s');
    expect(animation.height).toMatch(/^\d+(?:\.\d+)?px$/);
    await expect(page.getByRole('link', { name: '字典管理', exact: true })).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('sidebar-desktop.png'),
      animations: 'disabled'
    });

    await page.getByRole('link', { name: '字典管理', exact: true }).click();
    await expect(trigger).toHaveAttribute('data-active', 'true');
    await trigger.click();
    await expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('link', { name: '字典管理', exact: true })).not.toBeVisible();
    await expect(page).toHaveURL(/\/system-management\/dictionaries$/);
  });

  test('respects reduced motion for labels and submenu expansion', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    const trigger = page.getByRole('button', { name: '系统管理', exact: true });
    await trigger.click();
    const label = trigger.getByText('系统管理', { exact: true });
    expect(await label.evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
    const submenu = page
      .locator('[data-slot="collapsible-content"]')
      .filter({ has: page.getByRole('link', { name: '字典管理', exact: true }) });
    expect(await submenu.evaluate((element) => getComputedStyle(element).animationName)).toBe(
      'none'
    );
  });

  test('mobile uses an inline submenu inside the drawer', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator('[data-sidebar="trigger"]').click();
    const drawer = page.locator('[data-sidebar="sidebar"][data-mobile="true"]');
    await expect(drawer).toBeVisible();
    await drawer.getByRole('button', { name: '系统管理', exact: true }).click();
    await expect(drawer.getByRole('link', { name: '字典管理', exact: true })).toBeVisible();
    await expect(page.getByRole('menu')).not.toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath('sidebar-mobile.png'),
      animations: 'disabled'
    });
  });
});
