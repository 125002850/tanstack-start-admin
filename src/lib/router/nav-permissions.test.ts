import { describe, expect, it } from 'vitest';

import type { NavGroup } from '@/types';

import {
  collectVisibleMenuKeys,
  filterNavGroupsByMenuKeys,
  normalizeMenuKey
} from './nav-permissions';

describe('nav permissions', () => {
  it('normalizes backend menu codes without app-specific constants', () => {
    expect(normalizeMenuKey('admin:dict-management')).toBe('dict-management');
    expect(normalizeMenuKey('dict-management')).toBe('dict-management');
    expect(normalizeMenuKey(' platform:admin:export-center ')).toBe('export-center');
  });

  it('collects visible menu keys recursively', () => {
    const keys = collectVisibleMenuKeys([
      {
        menuCode: 'dict-management',
        menuKey: 'dict-management',
        hidden: false,
        status: 'ENABLED',
        children: []
      },
      {
        menuCode: 'hidden-parent',
        hidden: true,
        status: 'ENABLED',
        children: [
          {
            menuCode: 'user-role-rel',
            menuKey: 'user-role-rel',
            hidden: false,
            status: 'ENABLED',
            children: []
          }
        ]
      },
      {
        menuCode: 'report-summary',
        hidden: true,
        children: []
      },
      {
        menuCode: 'disabled-menu',
        hidden: false,
        status: 'DISABLED',
        children: []
      }
    ]);

    expect([...keys].toSorted()).toEqual(['dict-management', 'user-role-rel']);
  });

  it('filters constrained nav items while preserving unconstrained entries', () => {
    const groups: NavGroup[] = [
      {
        label: '工作台',
        items: [
          {
            id: 'overview',
            title: '概览',
            url: '/dashboard/overview'
          },
          {
            id: 'system',
            title: '系统管理',
            url: '/dashboard/system-management',
            linkable: false,
            items: [
              {
                id: 'dict',
                title: '字典管理',
                url: '/dashboard/system-management/dictionaries',
                menuKey: 'dict-management'
              },
              {
                id: 'users',
                title: '用户管理',
                url: '/dashboard/system-management/users',
                menuKey: 'user-management'
              }
            ]
          },
          {
            id: 'report-summary',
            title: '报表汇总',
            url: '/dashboard/reports/overview',
            menuKey: 'report-summary'
          }
        ]
      }
    ];

    const result = filterNavGroupsByMenuKeys(groups, new Set(['dict-management']));
    const groupItems = result[0]?.items ?? [];
    const systemItem = groupItems.find((item) => item.id === 'system');

    expect(groupItems.map((item) => item.id)).toEqual(['overview', 'system']);
    expect(systemItem?.items?.map((item) => item.id)).toEqual(['dict']);
  });

  it('removes non-linkable containers after all children are filtered out', () => {
    const result = filterNavGroupsByMenuKeys(
      [
        {
          label: '系统管理',
          items: [
            {
              id: 'system',
              title: '系统管理',
              url: '/dashboard/system-management',
              linkable: false,
              items: [
                {
                  id: 'dict',
                  title: '字典管理',
                  url: '/dashboard/system-management/dictionaries',
                  menuKey: 'dict-management'
                }
              ]
            }
          ]
        }
      ],
      new Set(['user-management'])
    );

    expect(result).toEqual([]);
  });
});
