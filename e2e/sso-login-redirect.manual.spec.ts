import { expect, test } from '@playwright/test';

import {
  installSsoLoginRedirectPatch,
  SSO_LOGIN_VIEW_ORIGIN
} from './support/sso-login-redirect-patch';

const BASE_URL = process.env.PLAYWRIGHT_SSO_BASE_URL ?? 'http://127.0.0.1:3000';
const RUN_SSO_SMOKE = process.env.PLAYWRIGHT_SSO_LOGIN_SMOKE === '1';

function appUrl(path: string) {
  return new URL(path, BASE_URL).toString();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

test.describe('@workspace-v2 @manual-sso SSO login redirect', () => {
  test.skip(!RUN_SSO_SMOKE, 'Set PLAYWRIGHT_SSO_LOGIN_SMOKE=1 to run the real SSO smoke test.');

  test('unauthenticated dashboard navigation reaches the real SSO login page', async ({
    context,
    page
  }) => {
    await context.clearCookies();
    await installSsoLoginRedirectPatch(context);

    await page.goto(appUrl('/auth/sign-in'), { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => {
      localStorage.removeItem('sso_token');
      localStorage.removeItem('sso_user_id');
      localStorage.removeItem('sso_logout_url');
      sessionStorage.clear();
    });

    await page.goto(appUrl('/dashboard/overview'), { waitUntil: 'domcontentloaded' });

    await expect(page).toHaveURL(
      new RegExp(`^${escapeRegExp(SSO_LOGIN_VIEW_ORIGIN)}/login/loginView\\?clientId=`),
      { timeout: 15_000 }
    );
    await expect(page.getByText('OIG统一登录认证平台')).toBeVisible({ timeout: 15_000 });
    expect(page.url()).not.toContain('%2A');
  });
});
