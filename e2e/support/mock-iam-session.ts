import type { Page } from '@playwright/test';

const IAM_REFRESH_TOKEN_KEY = 'iam_refresh_token';
const IAM_ACCESS_TOKEN_EXPIRES_AT_KEY = 'iam_access_token_expires_at';

const tokenPair = {
  accessToken: 'workspace-e2e-access-token',
  refreshToken: 'workspace-e2e-refresh-token',
  accessTokenExpiresAt: '2099-01-01T00:00:00.000Z',
  tokenType: 'Bearer'
};

const iamMe = {
  staff: {
    staffId: 'workspace-e2e',
    username: 'workspace-e2e',
    staffName: 'Workspace E2E',
    status: 'ENABLED'
  },
  dept: null,
  roles: [],
  permissions: [],
  menus: [
    {
      menuId: 'system-management',
      menuCode: 'system_management',
      menuKey: 'system_management',
      menuName: '系统管理',
      menuType: 'DIR',
      sortOrder: 10,
      hidden: false,
      cached: true,
      status: 'ENABLED',
      children: [
        {
          menuId: 'system-dict',
          parentId: 'system-management',
          menuCode: 'system_dict',
          menuKey: 'system_dict',
          menuName: '字典管理',
          menuType: 'MENU',
          routePath: '/dashboard/system-management/dictionaries',
          sortOrder: 10,
          hidden: false,
          cached: true,
          status: 'ENABLED'
        },
        {
          menuId: 'export-center',
          parentId: 'system-management',
          menuCode: 'export_center',
          menuKey: 'export_center',
          menuName: '导出中心',
          menuType: 'MENU',
          routePath: '/dashboard/system-management/export-center',
          sortOrder: 20,
          hidden: false,
          cached: true,
          status: 'ENABLED'
        }
      ]
    }
  ],
  dataScopeSummary: {
    effectiveType: 'ALL',
    includeSelf: true,
    description: '全部数据'
  },
  mustChangePassword: false
};

function envelope<T>(data: T) {
  return { code: 200, msg: 'ok', data };
}

/** 为 main 分支的 Playwright 新浏览器上下文建立最小本地 IAM 会话。 */
export async function mockIamSession(page: Page) {
  await page.addInitScript(
    ({ refreshTokenKey, expiresAtKey, refreshToken }) => {
      localStorage.setItem(refreshTokenKey, refreshToken);
      localStorage.setItem(expiresAtKey, '2000-01-01T00:00:00.000Z');
    },
    {
      refreshTokenKey: IAM_REFRESH_TOKEN_KEY,
      expiresAtKey: IAM_ACCESS_TOKEN_EXPIRES_AT_KEY,
      refreshToken: tokenPair.refreshToken
    }
  );

  await page.route('**/api/iam/auth/refresh', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(envelope(tokenPair))
    });
  });

  await page.route('**/api/iam/auth/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(envelope(iamMe))
    });
  });
}
