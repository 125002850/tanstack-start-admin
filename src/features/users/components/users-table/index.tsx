import { DataTable } from '@/components/ui/table/data-table';
import type {
  DataTableAction,
  DataTableActionContext
} from '@/components/ui/table/data-table-actions-bar';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { useDataTable } from '@/hooks/use-data-table';
import { useDataTablePageSize } from '@/lib/data-table-page-size';
import { useSuspenseQuery, useMutation } from '@tanstack/react-query';
import type { ColumnFiltersState, PaginationState, SortingState } from '@tanstack/react-table';
import { usersQueryOptions } from '../../api/queries';
import { deleteUserMutation } from '../../api/mutations';
import { columns } from './columns';
import * as React from 'react';
import { Icons } from '@/components/icons';
import type { User } from '../../api/types';
import { toast } from 'sonner';
import { type DataTableRowAction } from '@/components/ui/table/data-table-row-action';
import { UserFormSheet } from '../user-form-sheet';
import { useConfirmAction } from '@/hooks/use-confirm-action';
import { userTableExpandConfig } from './expand-config';

const USERS_TABLE_ID = 'user-list';

export function UsersTable() {
  const { isReady, pageSize, setPageSize } = useDataTablePageSize({});

  if (!isReady) {
    return <UsersTableSkeleton />;
  }

  return <UsersTableContent seedPageSize={pageSize} onPageSizePrefChange={setPageSize} />;
}

type UsersTableContentProps = {
  seedPageSize: number;
  onPageSizePrefChange: (pageSize: number) => void;
};

function buildApiFilters(
  pagination: PaginationState,
  sorting: SortingState,
  columnFilters: ColumnFiltersState
) {
  const nameFilter = columnFilters.find((f) => f.id === 'name');
  const roleFilter = columnFilters.find((f) => f.id === 'role');

  return {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    ...(nameFilter?.value ? { search: String(nameFilter.value) } : {}),
    ...(roleFilter && Array.isArray(roleFilter.value) && roleFilter.value.length > 0
      ? { roles: roleFilter.value.join(',') }
      : {}),
    ...(sorting.length > 0 ? { sort: JSON.stringify(sorting) } : {})
  };
}

const EMPTY_SORTING: SortingState = [];
const EMPTY_FILTERS: ColumnFiltersState = [];

function UsersTableContent({ seedPageSize, onPageSizePrefChange }: UsersTableContentProps) {
  const [apiFilters, setApiFilters] = React.useState(() =>
    buildApiFilters({ pageIndex: 0, pageSize: seedPageSize }, EMPTY_SORTING, EMPTY_FILTERS)
  );

  const deferredApiFilters = React.useDeferredValue(apiFilters);
  const { data } = useSuspenseQuery(usersQueryOptions(deferredApiFilters));

  const pageCount = Math.ceil(data.total_users / deferredApiFilters.limit);
  const { withConfirm, confirmDialog } = useConfirmAction<[DataTableActionContext<User>]>();

  const deleteMutation = useMutation({
    ...deleteUserMutation,
    onSuccess: () => {
      toast.success('用户已删除');
    },
    onError: () => {
      toast.error('删除用户失败');
    }
  });

  const rowActions = React.useMemo<DataTableRowAction<User>[]>(
    () => [
      {
        label: '编辑',
        icon: <Icons.edit className='size-4' />,
        Sheet: ({
          data: user,
          open,
          onOpenChange
        }: {
          data: User;
          open: boolean;
          onOpenChange: (open: boolean) => void;
        }) => <UserFormSheet user={user} open={open} onOpenChange={onOpenChange} />
      },
      {
        label: '删除',
        icon: <Icons.trash className='size-4' />,
        confirmDelete: {
          title: '确认删除',
          description: (row) =>
            `确定要删除用户 ${row.first_name} ${row.last_name} 吗？此操作不可撤销。`
        },
        onClick: (row) => {
          deleteMutation.mutate(row.id);
        }
      }
    ],
    [deleteMutation]
  );

  const { table, expandConfig, expandedRow, expandedRowKey, setExpandedRowKey, expandPanelId } =
    useDataTable({
    data: data.users,
    columns,
    pageCount,
    debounceMs: 500,
    pageSize: seedPageSize,
    onPageSizeChange: (newSize) => {
      onPageSizePrefChange(newSize);
    },
    initialState: {
      pagination: { pageIndex: apiFilters.page - 1, pageSize: apiFilters.limit }
    },
    rowActions,
    actionColumnPin: 'left',
    tableId: USERS_TABLE_ID,
    expandConfig: userTableExpandConfig
  });

  const { pagination, sorting, columnFilters } = table.getState();

  const prevRef = React.useRef({ pageIndex: 0, pageSize: seedPageSize, sorting: '', filters: '' });

  React.useEffect(() => {
    const sortingKey = JSON.stringify(sorting);
    const filtersKey = JSON.stringify(columnFilters);

    if (
      pagination.pageIndex !== prevRef.current.pageIndex ||
      pagination.pageSize !== prevRef.current.pageSize ||
      sortingKey !== prevRef.current.sorting ||
      filtersKey !== prevRef.current.filters
    ) {
      prevRef.current = {
        pageIndex: pagination.pageIndex,
        pageSize: pagination.pageSize,
        sorting: sortingKey,
        filters: filtersKey
      };
      setApiFilters(buildApiFilters(pagination, sorting, columnFilters));
    }
  }, [pagination, sorting, columnFilters]);

  const actions = React.useMemo<DataTableAction<User>[]>(
    () => [
      {
        label: '新增用户',
        icon: <Icons.add className='size-3.5' />,
        callback: () => {
          toast.info('打开新增用户表单');
        }
      },
      {
        label: '导出',
        icon: <Icons.share className='size-3.5' />,
        children: [
          {
            label: '导出全部',
            icon: <Icons.share className='size-3.5' />,
            callback: async () => {
              await new Promise((r) => setTimeout(r, 1500));
              toast.success('导出全部用户成功');
            }
          },
          {
            label: '导出选中',
            icon: <Icons.checks className='size-3.5' />,
            hidden: (ctx) => ctx.selectedRows.length === 0,
            callback: async (ctx) => {
              await new Promise((r) => setTimeout(r, 800));
              toast.success(`已导出 ${ctx.selectedRows.length} 个用户`);
            }
          }
        ]
      },
      {
        label: '批量删除',
        icon: <Icons.trash className='size-3.5' />,
        type: 'danger',
        hidden: (ctx) => ctx.selectedRows.length === 0,
        callback: withConfirm({
          title: (ctx) => `确认删除 ${ctx.selectedRows.length} 个用户？`,
          description: '此操作不可撤销。',
          confirmText: '删除',
          cancelText: '取消',
          run: async (ctx) => {
            await new Promise((r) => setTimeout(r, 1200));
            toast.success(`已删除 ${ctx.selectedRows.length} 个用户`);
            ctx.table.toggleAllPageRowsSelected(false);
          }
        })
      }
    ],
    [withConfirm]
  );

  return (
    <>
      {confirmDialog}
      <DataTable
        table={table}
        tableActions={actions}
        expandConfig={expandConfig}
        expandedRow={expandedRow}
        expandedRowKey={expandedRowKey}
        onExpandedRowKeyChange={setExpandedRowKey}
        expandPanelId={expandPanelId}
      >
        <DataTableToolbar table={table} />
      </DataTable>
    </>
  );
}

export function UsersTableSkeleton() {
  return (
    <div className='flex flex-1 animate-pulse flex-col gap-4'>
      <div className='bg-muted h-10 w-full rounded' />
      <div className='bg-muted h-96 w-full rounded-lg' />
      <div className='bg-muted h-10 w-full rounded' />
    </div>
  );
}
