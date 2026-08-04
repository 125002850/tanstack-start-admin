import * as React from 'react';
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DataTableDslCondition } from '@/hooks/use-data-table';

const serviceMocks = vi.hoisted(() => ({
  systemDictGlobalTypesListAll: vi.fn(),
  systemDictGlobalTypesListAllQueryOptions: vi.fn(),
  systemDictGlobalItemsByType: vi.fn(),
  systemDictGlobalTypeCreateMutationOptions: vi.fn(),
  systemDictGlobalTypeUpdateMutationOptions: vi.fn(),
  systemDictGlobalItemCreateMutationOptions: vi.fn(),
  systemDictGlobalItemUpdateMutationOptions: vi.fn(),
  systemDictGlobalItemDeleteMutationOptions: vi.fn(),
  systemDictGlobalTypeDeleteMutationOptions: vi.fn()
}));

vi.mock('@/lib/api/clients/service', () => ({
  systemDictGlobalTypesListAll: (...args: unknown[]) =>
    serviceMocks.systemDictGlobalTypesListAll(...args),
  systemDictGlobalTypesListAllQueryOptions: (...args: unknown[]) =>
    serviceMocks.systemDictGlobalTypesListAllQueryOptions(...args),
  systemDictGlobalItemsByType: (...args: unknown[]) =>
    serviceMocks.systemDictGlobalItemsByType(...args),
  systemDictGlobalTypeCreateMutationOptions: (...args: unknown[]) =>
    serviceMocks.systemDictGlobalTypeCreateMutationOptions(...args),
  systemDictGlobalTypeUpdateMutationOptions: (...args: unknown[]) =>
    serviceMocks.systemDictGlobalTypeUpdateMutationOptions(...args),
  systemDictGlobalItemCreateMutationOptions: (...args: unknown[]) =>
    serviceMocks.systemDictGlobalItemCreateMutationOptions(...args),
  systemDictGlobalItemUpdateMutationOptions: (...args: unknown[]) =>
    serviceMocks.systemDictGlobalItemUpdateMutationOptions(...args),
  systemDictGlobalItemDeleteMutationOptions: (...args: unknown[]) =>
    serviceMocks.systemDictGlobalItemDeleteMutationOptions(...args),
  systemDictGlobalTypeDeleteMutationOptions: (...args: unknown[]) =>
    serviceMocks.systemDictGlobalTypeDeleteMutationOptions(...args)
}));

import DictionaryManagementPage from './dictionary-management-page';

type DictionaryTypeResponse = {
  id: number;
  dictTypeCode: string;
  dictTypeName: string;
  status: string;
  createById: number;
  createByName: string;
  createTime: string;
  updateById: number;
  updateByName: string;
  updateTime: string;
};

type DictionaryItemResponse = {
  id: number;
  dictTypeCode: string;
  dictItemCode: string;
  dictItemName: string;
  status: string;
  sortOrder: number;
  remark: string;
  createById: number;
  createByName: string;
  createTime: string;
  updateById: number;
  updateByName: string;
  updateTime: string;
};

type DictionaryTypeRequest = {
  keyword?: string;
};

type DictionaryItemRequest = {
  pageNo: number;
  pageSize: number;
  condition?: DataTableDslCondition;
};

const PAGE_ONE_TYPES: DictionaryTypeResponse[] = [
  {
    id: 101,
    dictTypeCode: 'payment',
    dictTypeName: '付款状态',
    status: 'enable',
    createById: 1,
    createByName: 'admin',
    createTime: '2026-06-09 09:00:00',
    updateById: 1,
    updateByName: 'admin',
    updateTime: '2026-06-09 09:00:00'
  },
  {
    id: 102,
    dictTypeCode: 'color',
    dictTypeName: '颜色',
    status: 'enable',
    createById: 1,
    createByName: 'admin',
    createTime: '2026-06-09 09:01:00',
    updateById: 1,
    updateByName: 'admin',
    updateTime: '2026-06-09 09:01:00'
  }
];

const PAGE_TWO_TYPES: DictionaryTypeResponse[] = [
  {
    id: 103,
    dictTypeCode: 'invoice',
    dictTypeName: '发票状态',
    status: 'enable',
    createById: 1,
    createByName: 'admin',
    createTime: '2026-06-09 09:02:00',
    updateById: 1,
    updateByName: 'admin',
    updateTime: '2026-06-09 09:02:00'
  }
];

const ITEMS_BY_TYPE: Record<string, DictionaryItemResponse[]> = {
  payment: [
    {
      id: 201,
      dictTypeCode: 'payment',
      dictItemCode: 'paid',
      dictItemName: '已支付',
      status: 'enable',
      sortOrder: 10,
      remark: '真实接口返回',
      createById: 1,
      createByName: 'admin',
      createTime: '2026-06-09 09:05:00',
      updateById: 1,
      updateByName: 'admin',
      updateTime: '2026-06-09 09:05:00'
    }
  ],
  color: [
    {
      id: 202,
      dictTypeCode: 'color',
      dictItemCode: 'red',
      dictItemName: '红色',
      status: 'enable',
      sortOrder: 20,
      remark: '颜色字典项',
      createById: 1,
      createByName: 'admin',
      createTime: '2026-06-09 09:06:00',
      updateById: 1,
      updateByName: 'admin',
      updateTime: '2026-06-09 09:06:00'
    }
  ],
  invoice: [
    {
      id: 203,
      dictTypeCode: 'invoice',
      dictItemCode: 'pending',
      dictItemName: '待开票',
      status: 'enable',
      sortOrder: 30,
      remark: '分页回退后的字典项',
      createById: 1,
      createByName: 'admin',
      createTime: '2026-06-09 09:07:00',
      updateById: 1,
      updateByName: 'admin',
      updateTime: '2026-06-09 09:07:00'
    }
  ]
};

function createMutationStub() {
  return {
    mutationFn: vi.fn().mockResolvedValue(undefined)
  };
}

function createWrapper() {
  return createWrapperWithClient().Wrapper;
}

function createWrapperWithClient() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0
      },
      mutations: {
        retry: false
      }
    }
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  }

  return { queryClient, Wrapper };
}

function getRowSelectHitbox(container: HTMLElement, rowIndex: number) {
  const hitboxes = container.querySelectorAll('[data-slot="data-table-select-hitbox"]');
  const rowHitbox = hitboxes.item(rowIndex + 1);

  if (!(rowHitbox instanceof HTMLElement)) {
    throw new Error(`row ${rowIndex + 1} select hitbox missing`);
  }

  return rowHitbox;
}

function getTextConditionValue(condition: DataTableDslCondition | undefined): string | undefined {
  if (!condition) {
    return undefined;
  }

  if (condition.nodeType === 'text') {
    return condition.value;
  }

  if (condition.nodeType === 'compose') {
    return condition.children
      .map((child) => getTextConditionValue(child))
      .find((value): value is string => Boolean(value));
  }

  return undefined;
}

function findTextCondition(
  condition: DataTableDslCondition | undefined,
  field: string
): Extract<DataTableDslCondition, { nodeType: 'text' }> | undefined {
  if (!condition) {
    return undefined;
  }

  if (condition.nodeType === 'text' && condition.field === field) {
    return condition;
  }

  if (condition.nodeType === 'compose') {
    for (const child of condition.children) {
      const found = findTextCondition(child, field);
      if (found) return found;
    }
  }

  return undefined;
}

describe('DictionaryManagementPage', () => {
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    serviceMocks.systemDictGlobalTypesListAll.mockReset();
    serviceMocks.systemDictGlobalTypesListAllQueryOptions.mockReset();
    serviceMocks.systemDictGlobalItemsByType.mockReset();
    serviceMocks.systemDictGlobalTypeCreateMutationOptions.mockReset();
    serviceMocks.systemDictGlobalTypeUpdateMutationOptions.mockReset();
    serviceMocks.systemDictGlobalItemCreateMutationOptions.mockReset();
    serviceMocks.systemDictGlobalItemUpdateMutationOptions.mockReset();
    serviceMocks.systemDictGlobalItemDeleteMutationOptions.mockReset();
    serviceMocks.systemDictGlobalTypeDeleteMutationOptions.mockReset();

    localStorage.clear();
    window.localStorage.setItem('app-data-table-per-page:dictionary-types', '10');
    window.localStorage.setItem('app-data-table-per-page:dictionary-items', '50');
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    globalThis.ResizeObserver = class ResizeObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
    } as typeof ResizeObserver;

    serviceMocks.systemDictGlobalTypesListAllQueryOptions.mockImplementation(
      (request: DictionaryTypeRequest) =>
        queryOptions({
          queryKey: ['service', 'global-types', 'list-all', request] as const,
          queryFn: ({ signal }) => serviceMocks.systemDictGlobalTypesListAll(request, { signal })
        })
    );
    serviceMocks.systemDictGlobalTypeCreateMutationOptions.mockReturnValue(createMutationStub());
    serviceMocks.systemDictGlobalTypeUpdateMutationOptions.mockReturnValue(createMutationStub());
    serviceMocks.systemDictGlobalItemCreateMutationOptions.mockReturnValue(createMutationStub());
    serviceMocks.systemDictGlobalItemUpdateMutationOptions.mockReturnValue(createMutationStub());
    serviceMocks.systemDictGlobalItemDeleteMutationOptions.mockReturnValue(createMutationStub());
    serviceMocks.systemDictGlobalTypeDeleteMutationOptions.mockReturnValue(createMutationStub());
  });

  afterEach(() => {
    cleanup();
    globalThis.ResizeObserver = originalResizeObserver;
  });

  it('drives dictionary type requests from table state and falls back selection on page changes', async () => {
    const typeRequests: DictionaryTypeRequest[] = [];
    const itemRequests: DictionaryItemRequest[] = [];
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    serviceMocks.systemDictGlobalTypesListAll.mockImplementation(
      async (request: DictionaryTypeRequest) => {
        typeRequests.push(request);

        const keyword = request.keyword?.toLowerCase();
        const source = [...PAGE_ONE_TYPES, ...PAGE_TWO_TYPES];
        const filtered = keyword
          ? source.filter(
              (record) =>
                record.dictTypeCode.toLowerCase().includes(keyword) ||
                record.dictTypeName.toLowerCase().includes(keyword)
            )
          : source;

        return filtered;
      }
    );

    serviceMocks.systemDictGlobalItemsByType.mockImplementation(
      async (request: DictionaryItemRequest) => {
        itemRequests.push(request);
        const dictTypeCode = getTextConditionValue(request.condition);

        return {
          total: dictTypeCode ? (ITEMS_BY_TYPE[dictTypeCode]?.length ?? 0) : 0,
          list: dictTypeCode ? (ITEMS_BY_TYPE[dictTypeCode] ?? []) : []
        };
      }
    );

    const user = userEvent.setup();
    render(<DictionaryManagementPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /付款状态 payment/i })).toBeInTheDocument();
    });

    expect(typeRequests[0]).toEqual({});
    expect(itemRequests.at(-1)).toMatchObject({
      pageNo: 1,
      pageSize: 50,
      condition: {
        nodeType: 'text',
        field: 'dictTypeCode',
        op: 'EQ',
        value: 'payment'
      }
    });
    await waitFor(() => {
      expect(screen.getByText('已支付')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /颜色 color/i }));

    await waitFor(() => {
      expect(itemRequests.at(-1)).toMatchObject({
        condition: expect.objectContaining({ value: 'color' })
      });
    });

    expect(screen.getByRole('button', { name: /颜色 color/i })).toHaveAttribute(
      'data-state',
      'active'
    );
    await waitFor(() => {
      expect(screen.getByText('红色')).toBeInTheDocument();
    });

    await user.clear(screen.getByPlaceholderText('搜索 编码 / 名称'));
    await user.type(screen.getByPlaceholderText('搜索 编码 / 名称'), 'invoice');

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /发票状态 invoice/i })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(typeRequests.at(-1)).toEqual({
        keyword: 'invoice'
      });
    });
    await waitFor(() => {
      expect(itemRequests.at(-1)).toMatchObject({
        condition: expect.objectContaining({ value: 'invoice' })
      });
    });

    expect(screen.getByRole('button', { name: /发票状态 invoice/i })).toHaveAttribute(
      'data-state',
      'active'
    );
    await waitFor(() => {
      expect(screen.getByText('待开票')).toBeInTheDocument();
    });
    expect(consoleWarnSpy).not.toHaveBeenCalledWith(
      expect.stringContaining('[useDataTable] tableId changed from')
    );
    consoleWarnSpy.mockRestore();
  });

  it('serializes keyword search into list-all requests', async () => {
    const typeRequests: DictionaryTypeRequest[] = [];

    serviceMocks.systemDictGlobalTypesListAll.mockImplementation(
      async (request: DictionaryTypeRequest) => {
        typeRequests.push(request);
        const keyword = request.keyword?.toLowerCase();
        const filtered = keyword
          ? PAGE_ONE_TYPES.filter(
              (record) =>
                record.dictTypeCode.toLowerCase().includes(keyword) ||
                record.dictTypeName.toLowerCase().includes(keyword)
            )
          : PAGE_ONE_TYPES;

        return filtered;
      }
    );

    serviceMocks.systemDictGlobalItemsByType.mockImplementation(
      async (_request: DictionaryItemRequest) => ({
        total: 1,
        list: ITEMS_BY_TYPE.payment
      })
    );

    const user = userEvent.setup();
    render(<DictionaryManagementPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('搜索 编码 / 名称')).toBeInTheDocument();
    });
    expect(screen.queryByPlaceholderText('筛选编码')).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText('筛选名称')).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('搜索 编码 / 名称'), ' payment ');

    await waitFor(() => {
      expect(typeRequests.at(-1)).toMatchObject({
        keyword: 'payment'
      });
    });
  });

  it('serializes dictionary item filters with the selected type scope', async () => {
    const itemRequests: DictionaryItemRequest[] = [];

    serviceMocks.systemDictGlobalTypesListAll.mockImplementation(
      async (_request: DictionaryTypeRequest) => PAGE_ONE_TYPES.slice(0, 1)
    );
    serviceMocks.systemDictGlobalItemsByType.mockImplementation(
      async (request: DictionaryItemRequest) => {
        itemRequests.push(request);

        return {
          total: 1,
          list: ITEMS_BY_TYPE.payment
        };
      }
    );

    const user = userEvent.setup();
    render(<DictionaryManagementPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('已支付')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('搜索字典项编码'), 'paid');

    await waitFor(() => {
      const condition = itemRequests.at(-1)?.condition;
      expect(findTextCondition(condition, 'dictTypeCode')).toMatchObject({
        field: 'dictTypeCode',
        op: 'EQ',
        value: 'payment'
      });
      expect(findTextCondition(condition, 'dictItemCode')).toMatchObject({
        field: 'dictItemCode',
        op: 'CONTAINS',
        value: 'paid'
      });
    });
  });

  it('shows the batch delete action only after selecting a dictionary item', async () => {
    serviceMocks.systemDictGlobalTypesListAll.mockImplementation(
      async (_request: DictionaryTypeRequest) => PAGE_ONE_TYPES.slice(0, 1)
    );
    serviceMocks.systemDictGlobalItemsByType.mockImplementation(
      async (_request: DictionaryItemRequest) => ({
        total: 1,
        list: ITEMS_BY_TYPE.payment
      })
    );

    const user = userEvent.setup();
    const { container } = render(<DictionaryManagementPage />, { wrapper: createWrapper() });

    await screen.findByText('已支付');
    expect(screen.queryByRole('button', { name: /批量删除/ })).not.toBeInTheDocument();

    await user.click(getRowSelectHitbox(container, 0));

    expect(screen.getByRole('button', { name: /批量删除/ })).toBeInTheDocument();
  });

  it('keeps previous dictionary type content visible while keyword refetch is pending', async () => {
    const typeRequests: DictionaryTypeRequest[] = [];
    let resolveKeywordQuery: ((value: DictionaryTypeResponse[]) => void) | undefined;

    serviceMocks.systemDictGlobalTypesListAll.mockImplementation(
      (request: DictionaryTypeRequest) => {
        typeRequests.push(request);

        if (request.keyword === 'invoice') {
          return new Promise<DictionaryTypeResponse[]>((resolve) => {
            resolveKeywordQuery = resolve;
          });
        }

        return Promise.resolve(PAGE_ONE_TYPES);
      }
    );

    serviceMocks.systemDictGlobalItemsByType.mockImplementation(
      async (_request: DictionaryItemRequest) => ({
        total: 1,
        list: ITEMS_BY_TYPE.payment
      })
    );

    const user = userEvent.setup();
    render(<DictionaryManagementPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /付款状态 payment/i })).toBeInTheDocument();
    });

    await user.clear(screen.getByPlaceholderText('搜索 编码 / 名称'));
    await user.type(screen.getByPlaceholderText('搜索 编码 / 名称'), 'invoice');

    await waitFor(() => {
      expect(typeRequests.at(-1)).toEqual({
        keyword: 'invoice'
      });
    });

    expect(screen.queryByText('加载字典数据中...')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /付款状态 payment/i })).toBeInTheDocument();

    resolveKeywordQuery?.(PAGE_TWO_TYPES);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /发票状态 invoice/i })).toBeInTheDocument();
    });
  });

  it('refreshes dictionary items after status toggle succeeds', async () => {
    const itemRequests: DictionaryItemRequest[] = [];
    const updateItemMutationFn = vi.fn().mockResolvedValue(undefined);
    serviceMocks.systemDictGlobalItemUpdateMutationOptions.mockReturnValue({
      mutationFn: updateItemMutationFn
    });
    serviceMocks.systemDictGlobalTypesListAll.mockImplementation(
      async (_request: DictionaryTypeRequest) => PAGE_ONE_TYPES.slice(0, 1)
    );
    serviceMocks.systemDictGlobalItemsByType.mockImplementation(
      async (request: DictionaryItemRequest) => {
        itemRequests.push(request);

        return {
          total: 1,
          list: ITEMS_BY_TYPE.payment
        };
      }
    );

    const user = userEvent.setup();
    render(<DictionaryManagementPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('已支付')).toBeInTheDocument();
    });
    const requestCountBeforeToggle = itemRequests.length;

    const paidItemRow = screen.getByText('已支付').closest('tr');
    expect(paidItemRow).not.toBeNull();
    fireEvent.click(within(paidItemRow!).getByText('启用'));
    expect(await screen.findByText('确认停用字典项「已支付」？')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '确认切换' }));

    await waitFor(() => {
      expect(updateItemMutationFn.mock.calls[0]?.[0]).toMatchObject({
        id: 201,
        dictTypeCode: 'payment',
        dictItemCode: 'paid',
        dictItemName: '已支付',
        status: 'disable',
        sortOrder: 10
      });
    });
    await waitFor(() => {
      expect(itemRequests.length).toBeGreaterThan(requestCountBeforeToggle);
    });
  });

  it('invalidates dictionary item queries after item edit succeeds', async () => {
    const updateItemMutationFn = vi.fn().mockResolvedValue(undefined);
    serviceMocks.systemDictGlobalItemUpdateMutationOptions.mockReturnValue({
      mutationFn: updateItemMutationFn
    });
    serviceMocks.systemDictGlobalTypesListAll.mockImplementation(
      async (_request: DictionaryTypeRequest) => PAGE_ONE_TYPES.slice(0, 1)
    );
    serviceMocks.systemDictGlobalItemsByType.mockImplementation(
      async (_request: DictionaryItemRequest) => ({
        total: 1,
        list: ITEMS_BY_TYPE.payment
      })
    );

    const { Wrapper, queryClient } = createWrapperWithClient();
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries');
    const user = userEvent.setup();
    render(<DictionaryManagementPage />, { wrapper: Wrapper });

    await waitFor(() => {
      expect(screen.getByText('已支付')).toBeInTheDocument();
    });

    const itemEditButton = screen.getAllByRole('button', { name: '编辑' }).at(-1);
    if (!itemEditButton) {
      throw new Error('Expected dictionary item edit button to be rendered');
    }

    await user.click(itemEditButton);
    expect(await screen.findByText('编辑字典项')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => {
      expect(updateItemMutationFn).toHaveBeenCalled();
    });
    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ['service', 'mdm-dict-global-items-by-type'],
      exact: false
    });
  });

  it('binds the page write actions to the current mutation option factories', async () => {
    serviceMocks.systemDictGlobalTypesListAll.mockImplementation(
      async (_request: DictionaryTypeRequest) => PAGE_ONE_TYPES.slice(0, 1)
    );

    serviceMocks.systemDictGlobalItemsByType.mockImplementation(
      async (_request: DictionaryItemRequest) => ({
        total: 1,
        list: ITEMS_BY_TYPE.payment
      })
    );

    render(<DictionaryManagementPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(serviceMocks.systemDictGlobalTypesListAllQueryOptions).toHaveBeenCalled();
      expect(serviceMocks.systemDictGlobalTypeCreateMutationOptions).toHaveBeenCalled();
    });

    expect(serviceMocks.systemDictGlobalTypeUpdateMutationOptions).toHaveBeenCalled();
    expect(serviceMocks.systemDictGlobalItemCreateMutationOptions).toHaveBeenCalled();
    expect(serviceMocks.systemDictGlobalItemUpdateMutationOptions).toHaveBeenCalled();
    expect(serviceMocks.systemDictGlobalItemDeleteMutationOptions).toHaveBeenCalled();
    expect(serviceMocks.systemDictGlobalTypeDeleteMutationOptions).toHaveBeenCalled();
  });
});
