import * as React from 'react';
import { QueryClient, QueryClientProvider, queryOptions } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { DataTableDslCondition } from '@/hooks/use-data-table-query.dsl';

const serviceMocks = vi.hoisted(() => ({
  listGlobalTypesQueryOptions: vi.fn(),
  listGlobalItemsByTypeQueryOptions: vi.fn(),
  createGlobalTypeMutationOptions: vi.fn(),
  updateGlobalTypeMutationOptions: vi.fn(),
  createGlobalItemMutationOptions: vi.fn(),
  updateGlobalItemMutationOptions: vi.fn(),
  deleteGlobalItemMutationOptions: vi.fn(),
  deleteGlobalTypeMutationOptions: vi.fn()
}));

vi.mock('@/lib/api/clients/service', () => ({
  listGlobalTypesQueryOptions: (...args: unknown[]) => serviceMocks.listGlobalTypesQueryOptions(...args),
  listGlobalItemsByTypeQueryOptions: (...args: unknown[]) =>
    serviceMocks.listGlobalItemsByTypeQueryOptions(...args),
  createGlobalTypeMutationOptions: (...args: unknown[]) =>
    serviceMocks.createGlobalTypeMutationOptions(...args),
  updateGlobalTypeMutationOptions: (...args: unknown[]) =>
    serviceMocks.updateGlobalTypeMutationOptions(...args),
  createGlobalItemMutationOptions: (...args: unknown[]) =>
    serviceMocks.createGlobalItemMutationOptions(...args),
  updateGlobalItemMutationOptions: (...args: unknown[]) =>
    serviceMocks.updateGlobalItemMutationOptions(...args),
  deleteGlobalItemMutationOptions: (...args: unknown[]) =>
    serviceMocks.deleteGlobalItemMutationOptions(...args),
  deleteGlobalTypeMutationOptions: (...args: unknown[]) =>
    serviceMocks.deleteGlobalTypeMutationOptions(...args)
}));

import DictionaryManagementPage from './dictionary-management-page';

type DictionaryTypeResponse = {
  id: number;
  dictTypeCode: string;
  dictTypeName: string;
  status: string;
  createBy: number;
  createTime: string;
  updateBy: number;
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
  createBy: number;
  createTime: string;
  updateBy: number;
  updateTime: string;
};

type DictionaryTypeRequest = {
  pageNo: number;
  pageSize: number;
  dslVersion: number;
  condition?: DataTableDslCondition;
};

type DictionaryItemRequest = {
  pageNo: number;
  pageSize: number;
  dslVersion: number;
  condition?: DataTableDslCondition;
};

const PAGE_ONE_TYPES: DictionaryTypeResponse[] = [
  {
    id: 101,
    dictTypeCode: 'payment',
    dictTypeName: '付款状态',
    status: 'ENABLE',
    createBy: 1,
    createTime: '2026-06-09 09:00:00',
    updateBy: 1,
    updateTime: '2026-06-09 09:00:00'
  },
  {
    id: 102,
    dictTypeCode: 'color',
    dictTypeName: '颜色',
    status: 'ENABLE',
    createBy: 1,
    createTime: '2026-06-09 09:01:00',
    updateBy: 1,
    updateTime: '2026-06-09 09:01:00'
  }
];

const PAGE_TWO_TYPES: DictionaryTypeResponse[] = [
  {
    id: 103,
    dictTypeCode: 'invoice',
    dictTypeName: '发票状态',
    status: 'ENABLE',
    createBy: 1,
    createTime: '2026-06-09 09:02:00',
    updateBy: 1,
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
      status: 'ENABLE',
      sortOrder: 10,
      remark: '真实接口返回',
      createBy: 1,
      createTime: '2026-06-09 09:05:00',
      updateBy: 1,
      updateTime: '2026-06-09 09:05:00'
    }
  ],
  color: [
    {
      id: 202,
      dictTypeCode: 'color',
      dictItemCode: 'red',
      dictItemName: '红色',
      status: 'ENABLE',
      sortOrder: 20,
      remark: '颜色字典项',
      createBy: 1,
      createTime: '2026-06-09 09:06:00',
      updateBy: 1,
      updateTime: '2026-06-09 09:06:00'
    }
  ],
  invoice: [
    {
      id: 203,
      dictTypeCode: 'invoice',
      dictItemCode: 'pending',
      dictItemName: '待开票',
      status: 'ENABLE',
      sortOrder: 30,
      remark: '分页回退后的字典项',
      createBy: 1,
      createTime: '2026-06-09 09:07:00',
      updateBy: 1,
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

  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
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

describe('DictionaryManagementPage', () => {
  const originalResizeObserver = globalThis.ResizeObserver;

  beforeEach(() => {
    serviceMocks.listGlobalTypesQueryOptions.mockReset();
    serviceMocks.listGlobalItemsByTypeQueryOptions.mockReset();
    serviceMocks.createGlobalTypeMutationOptions.mockReset();
    serviceMocks.updateGlobalTypeMutationOptions.mockReset();
    serviceMocks.createGlobalItemMutationOptions.mockReset();
    serviceMocks.updateGlobalItemMutationOptions.mockReset();
    serviceMocks.deleteGlobalItemMutationOptions.mockReset();
    serviceMocks.deleteGlobalTypeMutationOptions.mockReset();

    localStorage.clear();
    window.localStorage.setItem('app-data-table-per-page:dictionary-types', '10');
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    globalThis.ResizeObserver = class ResizeObserver {
      disconnect() {}
      observe() {}
      unobserve() {}
    } as typeof ResizeObserver;

    serviceMocks.createGlobalTypeMutationOptions.mockReturnValue(createMutationStub());
    serviceMocks.updateGlobalTypeMutationOptions.mockReturnValue(createMutationStub());
    serviceMocks.createGlobalItemMutationOptions.mockReturnValue(createMutationStub());
    serviceMocks.updateGlobalItemMutationOptions.mockReturnValue(createMutationStub());
    serviceMocks.deleteGlobalItemMutationOptions.mockReturnValue(createMutationStub());
    serviceMocks.deleteGlobalTypeMutationOptions.mockReturnValue(createMutationStub());
  });

  afterEach(() => {
    globalThis.ResizeObserver = originalResizeObserver;
  });

  it('drives dictionary type requests from table state and falls back selection on page changes', async () => {
    const typeRequests: DictionaryTypeRequest[] = [];
    const itemRequests: DictionaryItemRequest[] = [];
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    serviceMocks.listGlobalTypesQueryOptions.mockImplementation((request: DictionaryTypeRequest) => {
      typeRequests.push(request);

      const keyword = getTextConditionValue(request.condition)?.toLowerCase();
      const source = request.pageNo === 2 ? PAGE_TWO_TYPES : PAGE_ONE_TYPES;
      const filtered = keyword
        ? source.filter(
            (record) =>
              record.dictTypeCode.toLowerCase().includes(keyword) ||
              record.dictTypeName.toLowerCase().includes(keyword)
          )
        : source;

      return queryOptions({
        queryKey: ['dictionary-types', request],
        queryFn: async () => ({
          total: keyword ? filtered.length : 11,
          list: filtered
        })
      });
    });

    serviceMocks.listGlobalItemsByTypeQueryOptions.mockImplementation((request: DictionaryItemRequest) => {
      itemRequests.push(request);
      const dictTypeCode = getTextConditionValue(request.condition);

      return queryOptions({
        queryKey: ['dictionary-items', request],
        queryFn: async () => ({
          total: dictTypeCode ? ITEMS_BY_TYPE[dictTypeCode]?.length ?? 0 : 0,
          list: dictTypeCode ? ITEMS_BY_TYPE[dictTypeCode] ?? [] : []
        })
      });
    });

    const user = userEvent.setup();
    render(<DictionaryManagementPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /付款状态 payment/i })).toBeInTheDocument();
    });

    expect(typeRequests[0]).toMatchObject({
      pageNo: 1,
      pageSize: 10,
      dslVersion: 1
    });
    expect(itemRequests.at(-1)).toMatchObject({
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

    expect(screen.getByRole('button', { name: /颜色 color/i })).toHaveAttribute('data-state', 'active');
    await waitFor(() => {
      expect(screen.getByText('红色')).toBeInTheDocument();
    });

    const nextPageButton = screen
      .getAllByRole('button', { name: '前往下一页' })
      .find((button) => !button.hasAttribute('disabled'));

    expect(nextPageButton).toBeDefined();

    await user.click(nextPageButton!);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /发票状态 invoice/i })).toBeInTheDocument();
    });

    await waitFor(() => {
      expect(typeRequests.at(-1)).toMatchObject({
        pageNo: 2,
        pageSize: 10,
        dslVersion: 1
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

  it('serializes toolbar filters into paginated dsl requests', async () => {
    const typeRequests: DictionaryTypeRequest[] = [];

    serviceMocks.listGlobalTypesQueryOptions.mockImplementation((request: DictionaryTypeRequest) => {
      typeRequests.push(request);
      const keyword = getTextConditionValue(request.condition)?.toLowerCase();
      const filtered = keyword
        ? PAGE_ONE_TYPES.filter((record) => record.dictTypeCode.toLowerCase().includes(keyword))
        : PAGE_ONE_TYPES;

      return queryOptions({
        queryKey: ['dictionary-types', request],
        queryFn: async () => ({
          total: filtered.length,
          list: filtered
        })
      });
    });

    serviceMocks.listGlobalItemsByTypeQueryOptions.mockImplementation((request: DictionaryItemRequest) =>
      queryOptions({
        queryKey: ['dictionary-items', request],
        queryFn: async () => ({
          total: 1,
          list: ITEMS_BY_TYPE.payment
        })
      })
    );

    const user = userEvent.setup();
    render(<DictionaryManagementPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByPlaceholderText('筛选编码')).toBeInTheDocument();
    });

    await user.type(screen.getByPlaceholderText('筛选编码'), ' payment ');

    await waitFor(() => {
      expect(typeRequests.at(-1)).toMatchObject({
        pageSize: 10,
        dslVersion: 1,
        condition: {
          nodeType: 'compose',
          logic: 'AND',
          children: [
            {
              nodeType: 'text',
              field: 'dictTypeCode',
              op: 'CONTAINS',
              value: 'payment'
            }
          ]
        }
      });
    });
  });

  it('binds the page write actions to the current mutation option factories', async () => {
    serviceMocks.listGlobalTypesQueryOptions.mockImplementation((request: DictionaryTypeRequest) =>
      queryOptions({
        queryKey: ['dictionary-types', request],
        queryFn: async () => ({
          total: 1,
          list: PAGE_ONE_TYPES.slice(0, 1)
        })
      })
    );

    serviceMocks.listGlobalItemsByTypeQueryOptions.mockImplementation((request: DictionaryItemRequest) =>
      queryOptions({
        queryKey: ['dictionary-items', request],
        queryFn: async () => ({
          total: 1,
          list: ITEMS_BY_TYPE.payment
        })
      })
    );

    render(<DictionaryManagementPage />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(serviceMocks.createGlobalTypeMutationOptions).toHaveBeenCalled();
    });

    expect(serviceMocks.updateGlobalTypeMutationOptions).toHaveBeenCalled();
    expect(serviceMocks.createGlobalItemMutationOptions).toHaveBeenCalled();
    expect(serviceMocks.updateGlobalItemMutationOptions).toHaveBeenCalled();
    expect(serviceMocks.deleteGlobalItemMutationOptions).toHaveBeenCalled();
    expect(serviceMocks.deleteGlobalTypeMutationOptions).toHaveBeenCalled();
  });
});
