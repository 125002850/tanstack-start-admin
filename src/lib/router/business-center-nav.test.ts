import { expect, it } from 'vitest';
import { buildBusinessCenterNav } from './business-center-nav';
import { filterNavGroupsByMenuKeys } from './nav-permissions';

it('projects permitted legacy containers to exactly two levels', () => {
  const groups = [
    {
      label: '系统管理',
      items: [
        {
          id: 'legacy',
          title: '旧容器',
          url: '/legacy',
          linkable: false,
          items: [
            { id: 'dict', title: '字典', url: '/dictionary', menuKey: 'dict' },
            { id: 'private', title: '私有', url: '/private', menuKey: 'private' }
          ]
        }
      ]
    }
  ];
  const [center] = buildBusinessCenterNav(filterNavGroupsByMenuKeys(groups, new Set(['dict'])));
  expect(center.title).toBe('系统管理');
  expect(center.linkable).toBe(false);
  expect(center.items?.map((item) => item.title)).toEqual(['字典']);
  expect(center.items?.[0].items).toBeUndefined();
});
