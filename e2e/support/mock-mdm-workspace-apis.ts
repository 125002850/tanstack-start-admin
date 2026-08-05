import type { Page } from '@playwright/test';

function envelope<T>(data: T) {
  return { code: 200, msg: 'ok', data };
}

/** 为 workspace 标签测试提供字典与导出页面所需的最小只读业务响应。 */
export async function mockMdmWorkspaceApis(page: Page) {
  await page.route('**/api/mdm/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    const data = pathname.endsWith('/dict/global/types/list-all')
      ? []
      : pathname.endsWith('/dict/global/types/list') ||
          pathname.endsWith('/dict/global/items/by-type') ||
          pathname.endsWith('/export/my/page')
        ? { total: 0, list: [] }
        : null;

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(envelope(data))
    });
  });
}
