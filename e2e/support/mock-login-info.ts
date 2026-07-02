import type { Page } from '@playwright/test';

const loginInfoResponse = {
  rspCode: '200',
  msg: 'ok',
  success: true,
  data: {
    userId: 'workspace-e2e',
    phone: '00000000000',
    userName: 'workspace-e2e',
    realName: 'Workspace E2E',
    menuData: [],
    loginUrl: '',
    logoutUrl: ''
  }
};

export async function mockLoginInfo(page: Page) {
  await page.route('**/api/getLoginInfo', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(loginInfoResponse)
    });
  });
}
