import { expect, type Page } from '@playwright/test';

const responses: Record<string, unknown> = {
  '/api/system/dict/global/types/list-all': [
    { id: 1, dictTypeCode: 'workspace_e2e', dictTypeName: 'Workspace E2E', status: 'enable' }
  ],
  '/api/system/dict/global/items/by-type': { total: 0, list: [] },
  '/api/system/dict/global/items/list-all': [],
  '/api/system/dict/global/items/options': [],
  '/api/mdm/export/my/page': { total: 0, list: [] }
};
const unexpected = new WeakMap<Page, Set<string>>();

export async function mockWorkspacePageData(page: Page) {
  const requests = new Set<string>();
  unexpected.set(page, requests);
  await page.route('**/api/**', async (route) => {
    if (!['fetch', 'xhr'].includes(route.request().resourceType())) return route.fallback();
    const pathname = new URL(route.request().url()).pathname;
    const path = pathname.slice(pathname.indexOf('/api/'));
    // 登录 fixture 已提供会话与查询契约，交给先注册的路由处理。
    if (
      [
        '/api/getLoginInfo',
        '/api/system/query-scene/metadata',
        '/api/system/query-scheme/list'
      ].includes(path)
    )
      return route.fallback();
    if (!(path in responses)) {
      requests.add(path);
      return route.abort();
    }
    await route.fulfill({ json: { code: 200, msg: 'ok', data: responses[path] } });
  });
}

export function expectNoUnexpectedWorkspaceApiRequests(page: Page) {
  expect([...(unexpected.get(page) ?? [])], 'Unmocked workspace API requests').toEqual([]);
}
