import { describe, expect, it } from 'vitest';
import {
  collectCollapsibleMenuIds,
  filterVisibleMenuRows,
  flattenMenuTree,
  getMenuNodeStableId,
  menuSelectOptions
} from './tree';
import type { MenuRspDTO } from '@/lib/api/clients/service';

type MenuNode = MenuRspDTO & {
  children?: MenuNode[];
};

const menuTree: MenuNode[] = [
  {
    menuId: 1,
    menuName: '系统管理',
    menuCode: 'system',
    menuType: 'DIR',
    children: [
      {
        menuId: 2,
        menuName: '菜单管理',
        menuCode: 'menu',
        menuType: 'MENU',
        children: [
          {
            menuId: 3,
            menuName: '新增按钮',
            menuCode: 'menu_create',
            menuType: 'BUTTON'
          }
        ]
      },
      {
        menuId: 4,
        menuName: '角色管理',
        menuCode: 'role',
        menuType: 'MENU'
      }
    ]
  },
  {
    menuId: 5,
    menuName: '个人中心',
    menuCode: 'account',
    menuType: 'DIR'
  }
];

describe('menu tree helpers', () => {
  it('flattens menu tree with depth and collapsible metadata', () => {
    const rows = flattenMenuTree(menuTree);

    expect(rows.map((menu) => [menu.menuName, menu.depth])).toEqual([
      ['系统管理', 0],
      ['菜单管理', 1],
      ['新增按钮', 2],
      ['角色管理', 1],
      ['个人中心', 0]
    ]);
    expect(collectCollapsibleMenuIds(rows)).toEqual(new Set(['1']));
  });

  it('hides descendants of collapsed parent rows', () => {
    const rows = flattenMenuTree(menuTree);
    const visibleRows = filterVisibleMenuRows(rows, new Set(['1']));

    expect(visibleRows.map((menu) => menu.menuName)).toEqual(['系统管理', '个人中心']);
  });

  it('keeps siblings visible when collapsing a nested parent', () => {
    const rows = flattenMenuTree(menuTree);
    const visibleRows = filterVisibleMenuRows(rows, new Set(['2']));

    expect(visibleRows.map((menu) => menu.menuName)).toEqual([
      '系统管理',
      '菜单管理',
      '角色管理',
      '个人中心'
    ]);
  });

  it('falls back to menuCode when a menu id is unavailable', () => {
    expect(getMenuNodeStableId({ menuCode: 'menu_without_id' })).toBe('code:menu_without_id');
  });

  it('不允许将按钮权限节点选为上级菜单', () => {
    expect(menuSelectOptions(menuTree).map((option) => option.value)).toEqual(['1', '2', '4', '5']);
  });
});
