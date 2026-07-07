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

  queryClient.setQueryData(['sso', 'login-info'], {
    userId: '1',
    userName: 'admin',
    realName: '管理员',
    phone: '13800138000',
    loginUrl: 'https://sso/login',
    logoutUrl: 'https://sso/logout',
    menuData: [
      {
        code: 'admin:dict-management',
        hiddenFlag: 'N',
        children: []
      }
    ]
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
