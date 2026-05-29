import { useSuspenseQuery } from '@tanstack/react-query';
import type { ColumnFiltersState, PaginationState, SortingState } from '@tanstack/react-table';

import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { useDataTable } from '@/hooks/use-data-table';
import { useDataTablePageSize } from '@/lib/data-table-page-size';
import { isProductTableVirtualizationEnabled } from '@/config/data-table';
import { emitDataTableVirtualEvent } from '@/components/ui/table/data-table-virtual-events';
import { productsQueryOptions } from '../../api/queries';
import { columns } from './columns';
import * as React from 'react';
import { resolveProductTableVirtualizationOptions } from './virtualization';

const PRODUCT_TABLE_ID = 'product-list'
const PRODUCT_TABLE_SCROLL_TARGET_ID = 'products-table';

export function ProductTable() {
  const { isReady, pageSize, setPageSize } = useDataTablePageSize({});

  if (!isReady) {
    return <ProductTableSkeleton />;
  }

  return <ProductTableContent seedPageSize={pageSize} onPageSizePrefChange={setPageSize} />;
}

type ProductTableContentProps = {
  seedPageSize: number;
  onPageSizePrefChange: (pageSize: number) => void;
};

function buildApiFilters(
  pagination: PaginationState,
  sorting: SortingState,
  columnFilters: ColumnFiltersState
) {
  const nameFilter = columnFilters.find((f) => f.id === 'name');
  const categoryFilter = columnFilters.find((f) => f.id === 'category');

  return {
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    ...(nameFilter?.value ? { search: String(nameFilter.value) } : {}),
    ...(categoryFilter && Array.isArray(categoryFilter.value) && categoryFilter.value.length > 0
      ? { categories: categoryFilter.value.join(',') }
      : {}),
    ...(sorting.length > 0 ? { sort: JSON.stringify(sorting) } : {})
  };
}

const EMPTY_SORTING: SortingState = [];
const EMPTY_FILTERS: ColumnFiltersState = [];

function ProductTableContent({ seedPageSize, onPageSizePrefChange }: ProductTableContentProps) {
  const [apiFilters, setApiFilters] = React.useState(() =>
    buildApiFilters({ pageIndex: 0, pageSize: seedPageSize }, EMPTY_SORTING, EMPTY_FILTERS)
  );

  const deferredApiFilters = React.useDeferredValue(apiFilters);
  const { data } = useSuspenseQuery(productsQueryOptions(deferredApiFilters));
  const pageCount = Math.ceil(data.total_products / deferredApiFilters.limit);

  const { table } = useDataTable({
    data: data.products,
    columns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    pageSize: seedPageSize,
    onPageSizeChange: (newSize) => {
      onPageSizePrefChange(newSize);
    },
    initialState: {
      pagination: { pageIndex: apiFilters.page - 1, pageSize: apiFilters.limit },
      columnPinning: { right: ['actions'] }
    },
    tableId: PRODUCT_TABLE_ID,
  });

  const { pagination, sorting, columnFilters } = table.getState();

  // Sync table state → apiFilters on user interaction.
  // useRef guards against re-syncing the same values, preventing infinite loops
  // when useSuspenseQuery re-renders with new data.
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

  const virtConfig = React.useMemo(() => {
    const enabled = isProductTableVirtualizationEnabled();
    return resolveProductTableVirtualizationOptions(enabled, (reason) => {
      emitDataTableVirtualEvent({ event: 'fallback', reason });
    });
  }, []);

  return (
    <DataTable
      table={table}
      scrollTargetId={PRODUCT_TABLE_SCROLL_TARGET_ID}
      virtualization={virtConfig}
    >
      <DataTableToolbar table={table} />
    </DataTable>
  );
}

export function ProductTableSkeleton() {
  return (
    <div className='flex flex-1 animate-pulse flex-col gap-4'>
      <div className='bg-muted h-10 w-full rounded' />
      <div className='bg-muted h-96 w-full rounded-lg' />
      <div className='bg-muted h-10 w-full rounded' />
    </div>
  );
}
