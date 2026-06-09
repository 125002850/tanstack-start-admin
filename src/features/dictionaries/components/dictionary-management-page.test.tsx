import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockUseSuspenseQuery = vi.fn();
const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const mockUseDataTable = vi.fn();

const mockDictionaryTypesQueryOptions = vi.fn(() => ({ queryKey: ['dictionary-types', 'list'] }));
const mockDictionaryItemsQueryOptions = vi.fn((dictTypeCode: string) => ({
  queryKey: ['dictionary-items', dictTypeCode]
}));

vi.mock('@tanstack/react-query', () => ({
  useSuspenseQuery: (...args: unknown[]) => mockUseSuspenseQuery(...args),
  useQuery: (...args: unknown[]) => mockUseQuery(...args),
  useMutation: (...args: unknown[]) => mockUseMutation(...args)
}));

vi.mock('@/hooks/use-data-table', () => ({
  useDataTable: (args: { data: Array<{ id: number; dictItemName: string }> }) =>
    mockUseDataTable(args)
}));

vi.mock('@/components/ui/table/data-table', () => ({
  DataTable: ({
    table,
    tableActions,
    emptyMessage
  }: {
    table: { rows: Array<{ id: number; dictItemName: string }> };
    tableActions: Array<{
      label: string;
      callback?: (ctx: { table: unknown; selectedRows: unknown[] }) => void | Promise<void>;
    }>;
    emptyMessage: string;
  }) => (
    <div>
      {tableActions.map((action) => (
        <button
          key={action.label}
          type='button'
          onClick={() => void action.callback?.({ table, selectedRows: [] })}
        >
          {action.label}
        </button>
      ))}
      {table.rows.length > 0 ? (
        table.rows.map((row) => <div key={row.id}>{row.dictItemName}</div>)
      ) : (
        <div>{emptyMessage}</div>
      )}
    </div>
  )
}));

vi.mock('../api/queries', () => ({
  dictionaryTypesQueryOptions: (
    ...args: Parameters<typeof mockDictionaryTypesQueryOptions>
  ) => mockDictionaryTypesQueryOptions(...args),
  dictionaryItemsQueryOptions: (
    ...args: Parameters<typeof mockDictionaryItemsQueryOptions>
  ) => mockDictionaryItemsQueryOptions(...args)
}));

vi.mock('../api/mutations', () => ({
  updateDictionaryTypeMutation: { mutationFn: vi.fn() },
  createDictionaryItemMutation: { mutationFn: vi.fn() },
  updateDictionaryItemMutation: { mutationFn: vi.fn() },
  deleteDictionaryItemMutation: { mutationFn: vi.fn() },
  bulkDeleteDictionaryItemsMutation: { mutationFn: vi.fn() }
}));

vi.mock('./dictionary-item-sheet', () => ({
  DictionaryItemSheet: ({
    open,
    dictTypeCode,
    onSubmit
  }: {
    open: boolean;
    dictTypeCode: string;
    onSubmit: (payload: {
      id?: number;
      dictTypeCode: string;
      dictItemCode: string;
      dictItemName: string;
      status?: string;
      sort?: number;
      remark?: string;
    }) => Promise<void>;
  }) =>
    open ? (
      <button
        type='button'
        onClick={() =>
          void onSubmit({
            id: undefined,
            dictTypeCode,
            dictItemCode: 'pending-review',
            dictItemName: '待审核',
            status: 'ENABLED',
            sort: undefined,
            remark: undefined
          })
        }
      >
        提交字典项
      </button>
    ) : null
}));

import DictionaryManagementPage from './dictionary-management-page';

function createMutationStub() {
  return {
    mutateAsync: vi.fn().mockResolvedValue(undefined),
    isPending: false
  };
}

describe('DictionaryManagementPage', () => {
  beforeEach(() => {
    mockUseSuspenseQuery.mockReset();
    mockUseQuery.mockReset();
    mockUseMutation.mockReset();
    mockUseDataTable.mockReset();
    mockDictionaryTypesQueryOptions.mockClear();
    mockDictionaryItemsQueryOptions.mockClear();

    mockUseDataTable.mockImplementation(({ data }) => ({
      table: {
        rows: data,
        toggleAllPageRowsSelected: vi.fn()
      }
    }));

    mockUseSuspenseQuery.mockReturnValue({});

    mockUseQuery.mockImplementation((options: { queryKey?: string[] }) => {
      const key = Array.isArray(options?.queryKey) ? options.queryKey[0] : '';

      if (key === 'dictionary-types') {
        return {
          data: {
            total: 1,
            list: [
              {
                id: 101,
                dictTypeCode: 'payment',
                dictTypeName: '付款状态',
                status: 'ENABLED',
                createdBy: 'System',
                createdAt: '2026-06-09 09:00:00',
                updatedBy: 'System',
                updatedAt: '2026-06-09 09:00:00'
              }
            ]
          },
          isLoading: false
        };
      }

      return {
        data: [
          {
            id: 201,
            dictTypeCode: 'payment',
            dictItemCode: 'paid',
            dictItemName: '已支付',
            status: 'ENABLED',
            sort: 10,
            remark: '真实接口返回',
            createdBy: 'System',
            createdAt: '2026-06-09 09:05:00',
            updatedBy: 'System',
            updatedAt: '2026-06-09 09:05:00'
          }
        ],
        isFetching: false,
        refetch: vi.fn().mockResolvedValue(undefined)
      };
    });

    mockUseMutation.mockImplementation(() => createMutationStub());
  });

  it('renders dictionary types and items from query data instead of local mock data', () => {
    render(<DictionaryManagementPage />);

    expect(mockDictionaryTypesQueryOptions).toHaveBeenCalledTimes(1);
    expect(mockDictionaryItemsQueryOptions).toHaveBeenCalledWith('payment');
    expect(screen.getByRole('button', { name: /付款状态 payment/i })).toHaveAttribute(
      'data-state',
      'active'
    );
    expect(screen.getByText('编码：payment')).toBeInTheDocument();
    expect(screen.getByText('已支付')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /颜色 color/i })).not.toBeInTheDocument();
  });

  it('binds dictionary write operations to mutation hooks instead of local mock state', async () => {
    render(<DictionaryManagementPage />);

    await waitFor(() => {
      expect(mockUseMutation).toHaveBeenCalledTimes(5);
    });
  });

  it('does not override DataTable pageSize for the non-paginated dictionary item list', () => {
    render(<DictionaryManagementPage />);

    expect(mockUseDataTable).toHaveBeenCalledWith(
      expect.not.objectContaining({
        pageSize: expect.any(Number)
      })
    );
  });
});
