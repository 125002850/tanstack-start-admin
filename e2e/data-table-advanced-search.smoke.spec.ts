import { expect, test } from '@playwright/test';
import { mockIamSession } from './support/mock-iam-session';
import type { Page } from '@playwright/test';
import type { DataTableDslCondition } from '../src/hooks/use-data-table/dsl';

const sceneCode = 'mdm.global.dict.item.page';
const condition = { nodeType: 'text', field: 'dictItemName', op: 'CONTAINS', value: '海运' };

const mainPages = [
  {
    route: 'system-management/export-center',
    scene: 'mdm.export.record.page',
    api: '/api/mdm/export/my/page',
    field: 'fileName'
  },
  {
    route: 'system-management/operation-audit',
    scene: 'system.operation-audit.log.page',
    api: '/api/system/operation-audit/page',
    field: 'traceId'
  },
  {
    route: 'system-management/schedule-center',
    scene: 'system.schedule.job.page',
    api: '/api/system/schedule/job/page',
    field: 'jobName'
  }
] satisfies Array<{ route: string; scene: string; api: string; field: string }>;

async function installTemplateMocks(page: Page) {
  const pages = [
    ['dictionaries', 'mdm_dict', '字典管理'],
    ['export-center', 'export_center', '导出中心'],
    ['operation-audit', 'operation-audit', '操作审计'],
    ['schedule-center', 'schedule-center', '定时任务']
  ];
  await mockIamSession(page, {
    permissions: ['system:audit:query', 'system:schedule:manage'],
    menus: pages.map(([route, menuKey, menuName], index) => ({
      menuId: String(index + 1),
      menuCode: menuKey,
      menuKey,
      menuName,
      menuType: 'MENU',
      routePath: `/system-management/${route}`,
      sortOrder: index,
      hidden: false,
      cached: true,
      status: 'ENABLED'
    }))
  });
  await page.route('**/api/system/dict/global/items/options', (route) =>
    route.fulfill({ json: { code: 200, msg: 'ok', data: [] } })
  );
  await page.route('**/api/mdm/export/my/page', (route) =>
    route.fulfill({ json: { code: 200, msg: 'ok', data: { list: [], total: 0 } } })
  );
}

function leaves(condition?: DataTableDslCondition): DataTableDslCondition[] {
  if (!condition) return [];
  return condition.nodeType === 'compose' ? condition.children.flatMap(leaves) : [condition];
}

test('@workspace-v2 preloads query metadata on dashboard initialization and reuses it on navigation', async ({
  page
}) => {
  await installTemplateMocks(page);
  let metadataRequests = 0;
  page.on('request', (request) => {
    if (request.url().includes('/api/system/query-scene/metadata')) metadataRequests++;
  });
  await page.route('**/api/system/query-scheme/list', (route) =>
    route.fulfill({ json: { code: 200, msg: 'ok', data: [] } })
  );
  await page.goto('/overview');
  await expect.poll(() => metadataRequests).toBe(1);
  await page.getByRole('button', { name: '系统管理', exact: true }).click();
  await page.getByRole('link', { name: '导出中心', exact: true }).click();
  await expect(page).toHaveURL(/\/system-management\/export-center$/);
  await expect(page.getByRole('button', { name: /高级搜索/ })).toBeVisible();
  expect(metadataRequests).toBe(1);
});

for (const scenario of mainPages) {
  test(`@workspace-v2 main-page advanced search ${scenario.route}`, async ({ page }) => {
    await installTemplateMocks(page);
    const savedCondition = {
      nodeType: 'text',
      field: scenario.field,
      op: 'CONTAINS',
      value: '默认筛选'
    };
    const requests: Array<{ condition?: DataTableDslCondition }> = [];
    await page.route('**/api/system/query-scheme/list', (route) => {
      expect(route.request().postDataJSON()).toMatchObject({ sceneCode: scenario.scene });
      return route.fulfill({
        json: {
          code: 200,
          msg: 'ok',
          data: [
            {
              id: 1,
              sceneCode: scenario.scene,
              schemeName: '默认查询',
              contentJson: JSON.stringify({
                schemaVersion: 1,
                quickConditions: [],
                advancedCondition: savedCondition
              }),
              schemaVersion: 1,
              defaultScheme: true,
              version: 0
            }
          ]
        }
      });
    });
    await page.route(`**${scenario.api}`, (route) => {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ json: { code: 200, msg: 'ok', data: { list: [], total: 0 } } });
    });
    await page.goto(`/${scenario.route}`);
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    expect(leaves(requests[0]?.condition)).toContainEqual(savedCondition);

    await page.getByRole('button', { name: '高级搜索 1', exact: true }).click();
    const popover = page.getByTestId('data-table-advanced-search-popover');
    await expect(popover.getByRole('combobox').filter({ hasText: '默认查询' })).toBeVisible();
    await popover.getByRole('textbox').fill('更新筛选');
    await popover.getByRole('button', { name: '应用', exact: true }).click();
    await expect
      .poll(() => leaves(requests.at(-1)?.condition))
      .toContainEqual({ ...savedCondition, value: '更新筛选' });

    await page.getByRole('button', { name: '重置筛选条件', exact: true }).click();
    await expect.poll(() => leaves(requests.at(-1)?.condition)).toEqual([]);
  });
}

for (const width of [768, 1440]) {
  test(`@workspace-v2 advanced query schemes keep dictionary scope at ${width}px`, async ({
    page
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await installTemplateMocks(page);
    const requests: unknown[] = [];
    let schemes = [
      {
        id: 9,
        sceneCode,
        schemeName: '海运方案',
        contentJson: JSON.stringify({
          schemaVersion: 1,
          quickConditions: [],
          advancedCondition: condition
        }),
        schemaVersion: 1,
        defaultScheme: true,
        version: 0
      }
    ];
    await page.route('**/api/system/query-scheme/list', (route) =>
      route.fulfill({ json: { code: 200, msg: 'ok', data: schemes } })
    );
    await page.route('**/api/system/query-scheme/create', (route) => {
      const body = route.request().postDataJSON();
      expect(body.sceneCode).toBe(sceneCode);
      expect(body.schemeName).toBe('常用查询');
      expect(body.contentJson).not.toContain('dictTypeCode');
      schemes.push({ id: 10, ...body, schemaVersion: 1, version: 0 });
      return route.fulfill({ json: { code: 200, msg: 'ok', data: 10 } });
    });
    await page.route('**/api/system/query-scheme/delete', (route) => {
      expect(route.request().postDataJSON()).toEqual({ id: 9, version: 0 });
      schemes = [];
      return route.fulfill({ json: { code: 200, msg: 'ok' } });
    });
    await page.route('**/api/system/dict/global/types/list-all', (route) =>
      route.fulfill({
        json: {
          code: 200,
          msg: 'ok',
          data: [
            { id: 1, dictTypeCode: 'shipping', dictTypeName: '运输方式', status: 'enable' },
            { id: 2, dictTypeCode: 'payment', dictTypeName: '付款方式', status: 'enable' }
          ]
        }
      })
    );
    await page.route('**/api/system/dict/global/items/options', (route) =>
      route.fulfill({ json: { code: 200, msg: 'ok', data: [] } })
    );
    await page.route('**/api/system/dict/global/items/by-type', (route) => {
      requests.push(route.request().postDataJSON());
      return route.fulfill({ json: { code: 200, msg: 'ok', data: { list: [], total: 0 } } });
    });
    await page.goto('/system-management/dictionaries');
    await expect.poll(() => requests.length).toBeGreaterThan(0);
    expect(requests[0]).toMatchObject({
      condition: {
        nodeType: 'compose',
        logic: 'AND',
        children: [
          { nodeType: 'text', field: 'dictTypeCode', op: 'EQ', value: 'shipping' },
          condition
        ]
      }
    });
    await page.getByRole('button', { name: /高级搜索/ }).click();
    await expect(page.getByRole('button', { name: '应用', exact: true })).toBeInViewport();
    await expect(page.getByRole('combobox').filter({ hasText: '海运方案' })).toBeVisible();
    await page.getByRole('button', { name: '取消', exact: true }).click();
    await page.getByRole('button', { name: /付款方式 payment/ }).click();
    await expect.poll(() => JSON.stringify(requests.at(-1))).toContain('payment');
    expect(JSON.stringify(requests.at(-1))).toContain('海运');
    await page.getByRole('button', { name: '重置筛选条件', exact: true }).click();
    await expect
      .poll(() => requests.at(-1))
      .toMatchObject({ condition: { nodeType: 'text', field: 'dictTypeCode', value: 'payment' } });
    await page.getByRole('button', { name: /高级搜索/ }).click();
    await page.getByRole('button', { name: '另存方案', exact: true }).click();
    await page.getByLabel('方案名称').fill('常用查询');
    await page.getByRole('button', { name: '保存', exact: true }).click();
    await expect.poll(() => schemes.length).toBe(2);
    await expect(page.getByRole('dialog', { name: '另存为查询方案' })).not.toBeVisible();
    await page.screenshot({ path: test.info().outputPath('advanced-query.png') });
  });
}
