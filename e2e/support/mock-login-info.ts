import querySceneMetadata from '../../src/test/fixtures/query-scene-metadata.json' with { type: 'json' };
import { ssoTokenStorageKey } from './sso-storage';
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
    menuData: [
      { code: 'dict-management', hiddenFlag: 'N', children: [] },
      { code: 'export-center', hiddenFlag: 'N', children: [] },
      { code: 'operation-audit', hiddenFlag: 'N', children: [] },
      { code: 'schedule-center', hiddenFlag: 'N', children: [] }
    ],
    loginUrl: '',
    logoutUrl: ''
  }
};

export async function mockLoginInfo(page: Page) {
  await page.route('**/api/system/query-scene/metadata', (route) =>
    route.fulfill({ json: { code: 200, msg: 'ok', data: querySceneMetadata } })
  );
  await page.route('**/api/system/query-scheme/list', (route) =>
    route.fulfill({ json: { code: 200, msg: 'ok', data: [] } })
  );
  await page.addInitScript((key) => {
    localStorage.setItem(key, 'workspace-e2e-token');
  }, ssoTokenStorageKey);

  await page.route('**/api/getLoginInfo', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(loginInfoResponse)
    });
  });
}
