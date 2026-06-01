import { DataTable } from '@/components/ui/table/data-table'
import type { DataTableAction } from '@/components/ui/table/data-table-actions-bar'
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar'
import { useDataTable } from '@/hooks/use-data-table'
import { useDataTablePageSize } from '@/lib/data-table-page-size'
import { useSuspenseQuery } from '@tanstack/react-query'
import type { ColumnFiltersState, PaginationState, SortingState } from '@tanstack/react-table'
import { usersQueryOptions } from '../../api/queries'
import { columns } from './columns'
import * as React from 'react'
import { Icons } from '@/components/icons'
import type { User } from '../../api/types'
import { toast } from 'sonner'

const USERS_TABLE_ID = 'user-list'

export function UsersTable() {
  const { isReady, pageSize, setPageSize } = useDataTablePageSize({})

  if (!isReady) {
    return <UsersTableSkeleton />
  }

  return (
    <UsersTableContent
      seedPageSize={pageSize}
      onPageSizePrefChange={setPageSize}
    />
  )
}

type UsersTableContentProps = {
  seedPageSize: number
  onPageSizePrefChange: (pageSize: number) => void
}

function buildApiFilters(
  pagination: PaginationState,
  sorting: SortingState,
  columnFilters: ColumnFiltersState,
) {
  const nameFilter = columnFilters.find((f) => f.id === 'name')
  const roleFilter = columnFilters.find((f) => f.id === 'role')

  return {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    ...(nameFilter?.value ? { search: String(nameFilter.value) } : {}),
    ...(roleFilter && Array.isArray(roleFilter.value) && roleFilter.value.length > 0
      ? { roles: roleFilter.value.join(',') }
      : {}),
    ...(sorting.length > 0 ? { sort: JSON.stringify(sorting) } : {}),
  }
}

const EMPTY_SORTING: SortingState = []
const EMPTY_FILTERS: ColumnFiltersState = []

function UsersTableContent({
  seedPageSize,
  onPageSizePrefChange,
}: UsersTableContentProps) {
  const [apiFilters, setApiFilters] = React.useState(() =>
    buildApiFilters(
      { pageIndex: 0, pageSize: seedPageSize },
      EMPTY_SORTING,
      EMPTY_FILTERS,
    ),
  )

  const deferredApiFilters = React.useDeferredValue(apiFilters)
  const { data } = useSuspenseQuery(usersQueryOptions(deferredApiFilters))

  const pageCount = Math.ceil(data.total_users / deferredApiFilters.limit)

  const { table } = useDataTable({
    data: data.users,
    columns,
    pageCount,
    debounceMs: 500,
    pageSize: seedPageSize,
    onPageSizeChange: (newSize) => {
      onPageSizePrefChange(newSize)
    },
    initialState: {
      pagination: { pageIndex: apiFilters.page - 1, pageSize: apiFilters.limit },
      columnPinning: { right: ['actions'] },
    },
    tableId: USERS_TABLE_ID,
  })

  const { pagination, sorting, columnFilters } = table.getState()

  const prevRef = React.useRef({ pageIndex: 0, pageSize: seedPageSize, sorting: '', filters: '' })

  React.useEffect(() => {
    const sortingKey = JSON.stringify(sorting)
    const filtersKey = JSON.stringify(columnFilters)

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
        filters: filtersKey,
      }
      setApiFilters(buildApiFilters(pagination, sorting, columnFilters))
    }
  }, [pagination, sorting, columnFilters])

  const actions = React.useMemo<DataTableAction<User>[]>(
    () => [
      {
        label: '新增用户',
        icon: <Icons.add className='size-3.5' />,
        callback: () => {
          toast.info('打开新增用户表单')
        },
      },
      {
        label: '导出',
        icon: <Icons.share className='size-3.5' />,
        children: [
          {
            label: '导出全部',
            icon: <Icons.share className='size-3.5' />,
            callback: async () => {
              await new Promise((r) => setTimeout(r, 1500))
              toast.success('导出全部用户成功')
            },
          },
          {
            label: '导出选中',
            icon: <Icons.checks className='size-3.5' />,
            hidden: (ctx) => ctx.selectedRows.length === 0,
            callback: async (ctx) => {
              await new Promise((r) => setTimeout(r, 800))
              toast.success(`已导出 ${ctx.selectedRows.length} 个用户`)
            },
          },
        ],
      },
      {
        label: '批量删除',
        icon: <Icons.trash className='size-3.5' />,
        variant: 'destructive' as const,
        hidden: (ctx) => ctx.selectedRows.length === 0,
        callback: async (ctx) => {
          await new Promise((r) => setTimeout(r, 1200))
          toast.success(`已删除 ${ctx.selectedRows.length} 个用户`)
          ctx.table.toggleAllPageRowsSelected(false)
        },
      },
    ],
    [],
  )

  return (
    <DataTable
      table={table}
      tableActions={actions}
    >
      <DataTableToolbar table={table} />
    </DataTable>
  )
}

export function UsersTableSkeleton() {
  return (
    <div className='flex flex-1 animate-pulse flex-col gap-4'>
      <div className='bg-muted h-10 w-full rounded' />
      <div className='bg-muted h-96 w-full rounded-lg' />
      <div className='bg-muted h-10 w-full rounded' />
    </div>
  )
}
