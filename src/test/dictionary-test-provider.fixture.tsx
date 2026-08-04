import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { buildDictBatch, DictionaryContext, type DictionaryContextValue } from '@/hooks/use-dict';
import type { DictOptionGroupRspDTO } from '@/lib/api/clients/service';

const DEFAULT_DICTIONARIES: readonly DictOptionGroupRspDTO[] = [
  {
    dictTypeCode: 'IAM_STATUS',
    items: [
      { code: 'ENABLED', name: '启用', status: 'enable', sortOrder: 1 },
      { code: 'DISABLED', name: '停用', status: 'enable', sortOrder: 2 }
    ]
  },
  {
    dictTypeCode: 'IAM_MENU_TYPE',
    items: [
      { code: 'DIR', name: '目录', status: 'enable', sortOrder: 1 },
      { code: 'MENU', name: '菜单', status: 'enable', sortOrder: 2 },
      { code: 'BUTTON', name: '按钮', status: 'enable', sortOrder: 3 }
    ]
  },
  {
    dictTypeCode: 'IAM_DATA_SCOPE_TYPE',
    items: [
      { code: 'ALL', name: '全部数据', status: 'enable', sortOrder: 1 },
      { code: 'DEPT_AND_CHILD', name: '本部门及下级', status: 'enable', sortOrder: 2 },
      { code: 'DEPT_ONLY', name: '仅本部门', status: 'enable', sortOrder: 3 },
      { code: 'SELF', name: '仅本人', status: 'enable', sortOrder: 4 },
      { code: 'CUSTOM_DEPT', name: '自定义部门', status: 'enable', sortOrder: 5 }
    ]
  },
  {
    dictTypeCode: 'IAM_LOGIN_RESULT',
    items: [
      { code: 'SUCCESS', name: '成功', status: 'enable', sortOrder: 1 },
      { code: 'FAIL', name: '失败', status: 'enable', sortOrder: 2 }
    ]
  }
];

export function createDictionaryTestWrapper(
  groups: readonly DictOptionGroupRspDTO[] = DEFAULT_DICTIONARIES
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false }
    }
  });
  const batch = buildDictBatch(groups);
  const value: DictionaryContextValue = {
    batch,
    declaredTypes: new Set(groups.flatMap((group) => group.dictTypeCode ?? [])),
    error: null,
    isError: false,
    isFetching: false,
    isPending: false,
    refetch: () => undefined
  };

  return function DictionaryTestWrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <DictionaryContext.Provider value={value}>{children}</DictionaryContext.Provider>
      </QueryClientProvider>
    );
  };
}
