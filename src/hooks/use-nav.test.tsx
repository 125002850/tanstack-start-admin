import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderHook } from '@testing-library/react';
import * as React from 'react';
import { describe, expect, it } from 'vitest';

import type { NavGroup } from '@/types';

import { useFilteredNavGroups } from './use-nav';

const navGroups: NavGroup[] = [
  {
    label: '工作台',
    items: [
      {
        id: 'overview',
        title: '概览',
        url: '/dashboard/overview'
      },
      {
        id: 'dict',
        title: '字典管理',
        url: '/dashboard/system-management/dictionaries',
        menuKey: 'dict-management'
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

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false }
    }
  });

  queryClient.setQueryData(['iam', 'me'], {
    staff: {
      staffId: '1',
      username: 'admin',
      staffName: '管理员',
      phone: '13800138000',
      status: 'ENABLED'
    },
    roles: [],
    permissions: [],
    menus: [
      {
        menuId: 'dict',
        menuCode: 'dict-management',
        menuKey: 'dict-management',
        menuName: '字典管理',
        menuType: 'MENU',
        sortOrder: 10,
        hidden: false,
        cached: false,
        status: 'ENABLED',
        children: []
      }
    ],
    dataScopeSummary: {
      effectiveType: 'ALL',
      includeSelf: true,
      description: '全部数据'
    },
    dataScope: {
      effectiveType: 'ALL',
      includeSelf: true,
      description: '全部数据'
    },
    mustChangePassword: false
  });

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

describe('useFilteredNavGroups', () => {
  it('filters menuKey constrained items by cached login menu permissions', () => {
    const { result } = renderHook(() => useFilteredNavGroups(navGroups), {
      wrapper: createWrapper()
    });

    expect(result.current[0]?.items.map((item) => item.id)).toEqual(['overview', 'dict']);
  });
});
