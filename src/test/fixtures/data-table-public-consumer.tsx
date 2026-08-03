import { queryOptions } from '@tanstack/react-query';

import { createDataTableColumnDsl } from '@/components/data-table/columns/data-table-column-factory';
import { DataTable } from '@/components/data-table/core/data-table';
import { DataTableToolbar } from '@/components/data-table/toolbar/data-table-toolbar';
import {
  useDataTable,
  useDslDataTable,
  type DataTableDslPageRequestBase,
  type PaginatedResponse,
  type QueryOptionsFactory
} from '@/hooks/use-data-table';
import type {
  DataTableAction,
  DataTableEditingOptions,
  DataTableRowAction
} from '@/types/data-table';

interface PublicConsumerRow {
  id: number;
  name: string;
  createBy?: number | null;
  createTime?: string | null;
  updateBy?: number | null;
  updateTime?: string | null;
  children?: PublicConsumerRow[];
}

const columnDsl = createDataTableColumnDsl<PublicConsumerRow>();
const columns = [columnDsl.field('name', '名称', { filter: 'text' }), ...columnDsl.audit()];
const localRows: PublicConsumerRow[] = [
  {
    id: 1,
    name: '根节点',
    children: [{ id: 2, name: '子节点' }]
  }
];
const editing: DataTableEditingOptions<PublicConsumerRow> = {
  isCellEditable: () => false
};
const tableActions: DataTableAction<PublicConsumerRow>[] = [
  { label: '新增', callback: () => undefined }
];
const rowActions: DataTableRowAction<PublicConsumerRow>[] = [
  { label: '查看', icon: null, onClick: () => undefined }
];

export function LocalTreeDataTableConsumer() {
  const { table } = useDataTable({
    tableId: 'public-fixture-local-tree',
    data: localRows,
    columns,
    getSubRows: (row) => row.children,
    rowActions,
    editing
  });

  return (
    <DataTable table={table} tableActions={tableActions} isLoading loadingSkeleton={{}}>
      <DataTableToolbar table={table} />
    </DataTable>
  );
}

type PublicFixtureQueryKey = readonly ['public-fixture-dsl', DataTableDslPageRequestBase];

const queryOptionsFactory: QueryOptionsFactory<
  PublicConsumerRow,
  DataTableDslPageRequestBase,
  PaginatedResponse<PublicConsumerRow>,
  unknown,
  PublicFixtureQueryKey
> = (request) =>
  queryOptions({
    queryKey: ['public-fixture-dsl', request] as const,
    queryFn: async (): Promise<PaginatedResponse<PublicConsumerRow>> => ({
      list: localRows,
      total: localRows.length
    })
  });

export function DslDataTableConsumer() {
  const { table, total, queryState, refreshProps } = useDslDataTable<
    PublicConsumerRow,
    DataTableDslPageRequestBase,
    PaginatedResponse<PublicConsumerRow>,
    unknown,
    PublicFixtureQueryKey
  >({
    tableId: 'public-fixture-dsl',
    columns,
    queryOptions: queryOptionsFactory,
    rowId: 'id'
  });

  return (
    <DataTable
      table={table}
      statusTotalCount={total}
      isLoading={queryState.isFetching}
      loadingSkeleton={{}}
      {...refreshProps}
    >
      <DataTableToolbar table={table} isQuerying={queryState.isFetching} />
    </DataTable>
  );
}

type Assert<T extends true> = T;
type PublicHooks = typeof import('@/hooks/use-data-table');
type PublicCore = typeof import('@/components/data-table/core/data-table');
type PublicColumns = typeof import('@/components/data-table/columns/data-table-column-factory');

export type PublicHooksHideDslBuilder = Assert<
  'buildDataTableDslRequest' extends keyof PublicHooks ? false : true
>;
export type PublicHooksHideApiFilterBuilder = Assert<
  'makeApiFilters' extends keyof PublicHooks ? false : true
>;
export type PublicCoreHidesActionRenderer = Assert<
  'DataTableActionsBar' extends keyof PublicCore ? false : true
>;
export type PublicCoreHidesSkeleton = Assert<
  'DataTableSkeleton' extends keyof PublicCore ? false : true
>;
export type PublicColumnsHideLegacyAuditHelper = Assert<
  'auditColumns' extends keyof PublicColumns ? false : true
>;
