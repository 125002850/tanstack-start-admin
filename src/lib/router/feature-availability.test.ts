import { expect, it } from 'vitest';
import { defineRouteMeta } from './app-route-meta';
import { buildNavGroupsFromRoutes } from './route-nav';

it('hides disabled features from navigation and preserves enabled routes', () => {
  const makeRoute = (enabled: boolean) => ({
    id: '/_app/example',
    fullPath: '/example',
    ...defineRouteMeta({
      label: '示例',
      feature: { key: 'example', enabled },
      nav: { visible: true, group: 'examples', order: 1 }
    })
  });
  expect(makeRoute(false).staticData.nav.visible).toBe(false);
  expect(buildNavGroupsFromRoutes({ example: makeRoute(false) })).toEqual([]);
  expect(buildNavGroupsFromRoutes({ example: makeRoute(true) })[0]?.items[0]?.url).toBe('/example');
});
