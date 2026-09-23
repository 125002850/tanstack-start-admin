import { expect, test } from '@playwright/test';
import { mockLoginInfo } from './support/mock-login-info';
import { ssoTokenStorageKey } from './support/sso-storage';

const logoutPath = '/sso-test-logout';

test('@workspace-v2 SSO 初始化 401 必须确认后退出，Esc 和遮罩不可关闭', async ({
  page,
  baseURL
}) => {
  await mockLoginInfo(page);
  await page.route('**/api/getLoginInfo', (route) =>
    route.fulfill({
      status: 401,
      json: { data: { logoutUrl: `${baseURL}${logoutPath}` } }
    })
  );
  await page.route(`**${logoutPath}`, (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>已退出</h1>' })
  );
  await page.goto('/dashboard/overview');
  const dialog = page.getByRole('alertdialog');
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('heading', { name: '系统异常' })).toHaveCount(0);
  await expect(page).toHaveURL(/\/dashboard\/overview$/);
  await page.keyboard.press('Escape');
  await page.locator('[data-slot="alert-dialog-overlay"]').click({ position: { x: 5, y: 5 } });
  await expect(dialog).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), ssoTokenStorageKey)).toBeNull();
  await page.screenshot({ path: '/tmp/oig-sso-session-expired.png' });
  await dialog.getByRole('button', { name: '确认', exact: true }).click();
  await expect(page).toHaveURL(`${baseURL}${logoutPath}`);
});

test('@workspace-v2 旧公共 token 不影响本项目无 token 时自动换票', async ({ page, baseURL }) => {
  await mockLoginInfo(page);
  await page.addInitScript((key) => {
    localStorage.removeItem(key);
    localStorage.setItem('sso_token', 'legacy-other-app');
  }, ssoTokenStorageKey);
  let authHeader: string | undefined;
  await page.route('**/api/getLoginInfo', (route) => {
    authHeader = route.request().headers().authorization;
    return route.fulfill({
      status: 401,
      json: { data: { loginUrl: `${baseURL}/sso-test-login` } }
    });
  });
  await page.route('**/sso-test-login', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<h1>SSO 换票</h1>' })
  );
  await page.goto('/dashboard/overview?tab=orders');
  await expect(page).toHaveURL(`${baseURL}/sso-test-login`);
  expect(authHeader).toBeUndefined();
  await expect(page.getByRole('alertdialog')).toHaveCount(0);
});

test('@workspace-v2 业务接口 401 显示一个全局提示且不自动退出', async ({ page }) => {
  await mockLoginInfo(page);
  await page.route('**/api/system/dict/global/types/list-all', (route) =>
    route.fulfill({ status: 401, json: { message: 'Unauthorized' } })
  );
  await page.goto('/dashboard/system-management/dictionaries');
  await expect(page.getByRole('alertdialog')).toHaveCount(1);
  await expect(page.getByRole('alertdialog')).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/system-management\/dictionaries$/);
  await expect(page.locator('[data-sonner-toast]')).toHaveCount(0);
});
