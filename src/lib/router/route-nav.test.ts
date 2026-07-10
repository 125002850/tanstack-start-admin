import { describe, expect, it } from 'vitest';

import { buildNavGroupsFromRoutes } from './route-nav';
import { buildMenuTreeLookup } from './menu-tree-resolver';

describe('route nav', () => {
  it('carries route menuKey into nav items', () => {
    const groups = buildNavGroupsFromRoutes({
      dictionaries: {
        id: '/dashboard/system-management/dictionaries',
        fullPath: '/dashboard/system-management/dictionaries',
        options: {
          staticData: {
            label: '字典管理',
            nav: {
              visible: true,
              group: 'systemManagement',
              order: 10,
              menuKey: 'dict-management'
            }
          }
        }
      }
    });

    expect(groups[0]?.items[0]?.menuKey).toBe('dict-management');
  });

  it('uses the local route icon and ignores backend icon values', () => {
    const routes = {
      staff: {
        id: '/dashboard/iam/staff',
        fullPath: '/dashboard/iam/staff',
        options: { staticData: { nav: { menuKey: 'iam_staff', icon: 'settings' } } }
      }
    };
    const menuTree = (icon: string) =>
      buildMenuTreeLookup([
        {
          menuId: 1,
          menuCode: 'iam',
          menuKey: 'iam',
          menuName: '权限管理',
          menuType: 'DIR',
          sortOrder: 10,
          hidden: false,
          cached: true,
          status: 'ENABLED',
          children: [
            {
              menuId: 2,
              menuCode: 'iam_staff',
              menuKey: 'iam_staff',
              menuName: '员工管理',
              menuType: 'MENU',
              icon,
              sortOrder: 10,
              hidden: false,
              cached: true,
              status: 'ENABLED'
            }
          ]
        }
      ]);

    expect(buildNavGroupsFromRoutes(routes, menuTree('teams'))[0]?.items[0]?.icon).toBe('settings');
    expect(
      buildNavGroupsFromRoutes(routes, menuTree('not-a-registered-icon'))[0]?.items[0]?.icon
    ).toBe('settings');
  });
});
