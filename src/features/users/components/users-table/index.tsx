import { DataTable } from '@/components/ui/table/data-table'
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar'
import { useDataTable } from '@/hooks/use-data-table'
import { useDataTablePageSize } from '@/lib/data-table-page-size'
import { useSuspenseQuery } from '@tanstack/react-query'
import type { ColumnFiltersState, PaginationState, SortingState } from '@tanstack/react-table'
import { usersQueryOptions } from '../../api/queries'
import { columns } from './columns'
import * as React from 'react'

const columnIds = columns.map((c) => c.id).filter(Boolean) as string[]

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
    ...(nameFilter && nameFilter.value && { search: String(nameFilter.value) }),
    ...(roleFilter && Array.isArray(roleFilter.value) && roleFilter.value.length > 0 && {
      roles: roleFilter.value.join(','),
    }),
    ...(sorting.length > 0 && { sort: JSON.stringify(sorting) }),
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

  const { data } = useSuspenseQuery(usersQueryOptions(apiFilters))

  const pageCount = Math.ceil(data.total_users / apiFilters.limit)

  const { table } = useDataTable({
    data: data.users,
    columns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    pageSize: seedPageSize,
    onPageSizeChange: (newSize) => {
      onPageSizePrefChange(newSize)
    },
    initialState: {
      pagination: { pageIndex: apiFilters.page - 1, pageSize: apiFilters.limit },
      columnPinning: { right: ['actions'] },
    },
  })

  const prevRef = React.useRef({ pageIndex: 0, pageSize: seedPageSize, sorting: '', filters: '' })

  React.useEffect(() => {
    const { pagination, sorting, columnFilters } = table.getState()
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
  })

  return (
    <DataTable table={table}>
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
