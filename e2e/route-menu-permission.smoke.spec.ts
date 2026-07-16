import { expect, test } from '@playwright/test';

const DICTIONARIES_ROUTE = '/dashboard/system-management/dictionaries';

test.describe('@workspace-v2 route menu permissions', () => {
  test('shows 403 when a direct route is absent from SSO menuData', async ({ page }) => {
    await page.route('**/api/getLoginInfo', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          rspCode: '200',
          msg: 'ok',
          success: true,
          data: {
            userId: 'route-permission-e2e',
            phone: '00000000000',
            userName: 'route-permission-e2e',
            realName: 'Route Permission E2E',
            menuData: [
              {
                code: 'track-bench:track-owner-rel',
                hiddenFlag: 'N',
                children: []
              }
            ],
            loginUrl: '',
            logoutUrl: ''
          }
        })
      });
    });

    await page.goto(DICTIONARIES_ROUTE);

    await expect(page).toHaveURL(new RegExp(`${DICTIONARIES_ROUTE}$`));
    await expect(page.getByRole('heading', { name: '无权限访问' })).toBeVisible();
    await expect(page.getByText('HTTP 错误代码：403')).toBeAttached();
    await expect(page.getByRole('link', { name: '返回工作台' })).toHaveAttribute(
      'href',
      '/dashboard/overview'
    );
    await expect(page.getByRole('heading', { name: '字典类型' })).toHaveCount(0);
  });
});
