import { describe, expect, it } from 'vitest';

import { buildNavGroupsFromRoutes } from './route-nav';
import { buildMenuTreeLookup } from './menu-tree-resolver';

describe('route nav', () => {
  it('uses the backend-aligned management groups as the static fallback', () => {
    const groups = buildNavGroupsFromRoutes({
      logs: {
        id: '/dashboard/log-management/login',
        fullPath: '/dashboard/log-management/login',
        options: {
          staticData: {
            label: '登录日志',
            nav: { group: 'logManagement', menuKey: 'iam_login_log' }
          }
        }
      },
      system: {
        id: '/dashboard/system-management/dictionaries',
        fullPath: '/dashboard/system-management/dictionaries',
        options: {
          staticData: {
            label: '字典管理',
            nav: { group: 'systemManagement', menuKey: 'mdm_dict' }
          }
        }
      },
      basic: {
        id: '/dashboard/basic-settings/staff',
        fullPath: '/dashboard/basic-settings/staff',
        options: {
          staticData: {
            label: '员工管理',
            nav: { group: 'basicSettings', menuKey: 'iam_staff' }
          }
        }
      }
    });

    expect(groups.map((group) => group.label)).toEqual(['基础设置', '系统管理', '日志管理']);
  });

  it('prefers an explicit route group over a stale backend ancestor group', () => {
    const routes = {
      staff: {
        id: '/dashboard/basic-settings/staff',
        fullPath: '/dashboard/basic-settings/staff',
        options: {
          staticData: {
            label: '员工管理',
            nav: { group: 'basicSettings', menuKey: 'iam_staff' }
          }
        }
      }
    };
    const staleMenuTree = buildMenuTreeLookup([
      {
        menuId: 1,
        menuCode: 'system',
        menuKey: 'system',
        menuName: '系统管理',
        menuType: 'DIR',
        sortOrder: 10,
        hidden: false,
        cached: true,
        status: 'ENABLED',
        children: [
          {
            menuId: 2,
            parentId: 1,
            menuCode: 'iam_staff',
            menuKey: 'iam_staff',
            menuName: '员工管理',
            menuType: 'MENU',
            sortOrder: 10,
            hidden: false,
            cached: true,
            status: 'ENABLED'
          }
        ]
      }
    ]);

    expect(buildNavGroupsFromRoutes(routes, staleMenuTree)[0]?.label).toBe('基础设置');
  });

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
        id: '/dashboard/basic-settings/staff',
        fullPath: '/dashboard/basic-settings/staff',
        options: { staticData: { nav: { menuKey: 'iam_staff', icon: 'settings' } } }
      }
    };
    const menuTree = (icon: string) =>
      buildMenuTreeLookup([
        {
          menuId: 1,
          menuCode: 'basic_settings',
          menuKey: 'basic_settings',
          menuName: '基础设置',
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
