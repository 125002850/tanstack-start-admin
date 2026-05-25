import { useSuspenseQuery } from '@tanstack/react-query';
import { useSearch } from '@tanstack/react-router';

import { DataTable } from '@/components/ui/table/data-table';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { useDataTable } from '@/hooks/use-data-table';
import { useDataTablePageSize } from '@/lib/data-table-page-size';
import { usePageCacheScroll } from '@/lib/page-cache';
import { parseSortingState } from '@/lib/parsers';
import { productsQueryOptions } from '../../api/queries';
import { columns } from './columns';

const columnIds = columns.map((c) => c.id).filter(Boolean) as string[];
const PRODUCT_TABLE_SCROLL_TARGET_ID = 'products-table';
const PRODUCT_TABLE_SCROLL_TARGET_SELECTOR = `[data-scroll-target-id="${PRODUCT_TABLE_SCROLL_TARGET_ID}"]`;

export function ProductTable() {
  const search = useSearch({ strict: false }) as Record<string, unknown>;
  const hasExplicitPerPage = Object.prototype.hasOwnProperty.call(search, 'perPage');

  const page = (search.page as number) ?? 1;
  const {
    isReady,
    pageSize: perPage,
    setPageSize
  } = useDataTablePageSize({
    searchPerPage: typeof search.perPage === 'number' ? search.perPage : undefined,
    hasExplicitSearchPerPage: hasExplicitPerPage
  });
  const name = search.name as string | undefined;
  const category = search.category as string | undefined;
  const sortStr = search.sort as string | undefined;

  if (!isReady) {
    return <ProductTableSkeleton />;
  }


  return (
    <ProductTableContent
      page={page}
      perPage={perPage}
      name={name}
      category={category}
      sortStr={sortStr}
      onPageSizeChange={setPageSize}
    />
  );
}

type ProductTableContentProps = {
  page: number;
  perPage: number;
  name?: string;
  category?: string;
  sortStr?: string;
  onPageSizeChange: (pageSize: number) => void;
};

function ProductTableContent({
  page,
  perPage,
  name,
  category,
  sortStr,
  onPageSizeChange
}: ProductTableContentProps) {
  const sort = parseSortingState(sortStr, columnIds);

  const filters = {
    page,
    limit: perPage,
    ...(name && { search: name }),
    ...(category && { categories: category }),
    ...(sort.length > 0 && { sort: JSON.stringify(sort) })
  };

  const { data } = useSuspenseQuery(productsQueryOptions(filters));
  const pageCount = Math.ceil(data.total_products / perPage);

  const { table } = useDataTable({
    data: data.products,
    columns,
    pageCount,
    shallow: true,
    debounceMs: 500,
    pageSize: perPage,
    onPageSizeChange,
    initialState: {
      columnPinning: { right: ['actions'] }
    }
  });

  // This subtree only mounts after the table query resolves.
  usePageCacheScroll({
    slot: 'table-scroll',
    selector: PRODUCT_TABLE_SCROLL_TARGET_SELECTOR,
    ready: true
  });

  return (
    <DataTable table={table} scrollTargetId={PRODUCT_TABLE_SCROLL_TARGET_ID}>
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
