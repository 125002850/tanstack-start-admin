import type { InitialTableState, Row, TableOptions } from '@tanstack/react-table';

import type {
  ColumnOrderStorageMode,
  ColumnResizeStorageMode,
  ExpandConfigEdge,
  ExtendedColumnSort,
  DataTableEditingOptions,
  DataTableRowAction,
  SortingStorageMode
} from '@/types/data-table';
import type { RowNumberDisplayMode } from './columns/row-number-column';

export type DataTablePinnedSide = 'left' | 'right';

export type DataTableRowId<TData> =
  | keyof TData
  | ((row: TData, index: number, parent?: Row<TData>) => string | number);

/** useDataTable 在传给 TanStack Table 前统一生成或覆盖的 option。 */
export type DataTableRuntimeConfiguredTableOption =
  | 'columns'
  | 'columnResizeMode'
  | 'data'
  | 'defaultColumn'
  | 'enableColumnResizing'
  | 'enableRowSelection'
  | 'getCoreRowModel'
  | 'getFacetedMinMaxValues'
  | 'getFacetedRowModel'
  | 'getFacetedUniqueValues'
  | 'getFilteredRowModel'
  | 'getExpandedRowModel'
  | 'getPaginationRowModel'
  | 'getRowId'
  | 'getSortedRowModel'
  | 'initialState'
  | 'manualFiltering'
  | 'manualPagination'
  | 'manualSorting'
  | 'meta'
  | 'onColumnFiltersChange'
  | 'onColumnOrderChange'
  | 'onColumnPinningChange'
  | 'onColumnSizingChange'
  | 'onColumnVisibilityChange'
  | 'onPaginationChange'
  | 'onRowSelectionChange'
  | 'onSortingChange'
  | 'pageCount'
  | 'rowCount'
  | 'state';

/** 被 runtime 覆盖但仍以稳定语义重新开放给 useDataTable 调用方的 option。 */
export type DataTableRuntimeRemappedPublicTableOption =
  | 'columns'
  | 'data'
  | 'initialState'
  | 'onColumnOrderChange'
  | 'pageCount';

/** TanStack Table 的底层扩展入口；共享 hook 不允许业务调用方介入。 */
export type DataTableReservedTableOption = '_features' | 'mergeOptions' | 'onStateChange';

/** 当前必须从 useDataTable 公共类型隐藏的 TanStack option。 */
export type DataTableRuntimeHiddenTableOption =
  | Exclude<DataTableRuntimeConfiguredTableOption, DataTableRuntimeRemappedPublicTableOption>
  | DataTableReservedTableOption;

/** 允许业务调用方直接透传给 TanStack Table 的受支持 option。 */
export type DataTablePublicPassthroughTableOption = 'enableSorting' | 'getSubRows';

/** TanStack Table 已提供、但共享 hook 尚未形成稳定公共语义的 option。 */
export type DataTableUnsupportedTableOption = Exclude<
  keyof TableOptions<unknown>,
  | DataTableRuntimeConfiguredTableOption
  | DataTableReservedTableOption
  | DataTablePublicPassthroughTableOption
>;

export type DataTableSupportedInitialStateKey =
  | 'columnFilters'
  | 'columnOrder'
  | 'columnPinning'
  | 'columnSizing'
  | 'columnVisibility'
  | 'expanded'
  | 'pagination'
  | 'rowSelection'
  | 'sorting';

/** TanStack initialState 中共享 hook 尚未支持的状态切片。 */
export type DataTableUnsupportedInitialStateKey = Exclude<
  keyof InitialTableState,
  DataTableSupportedInitialStateKey
>;

type DataTableInitialState<TData> = Pick<
  InitialTableState,
  Exclude<DataTableSupportedInitialStateKey, 'sorting'>
> & {
  sorting?: ExtendedColumnSort<TData>[];
};

export interface UseDataTableProps<TData> extends Pick<
  TableOptions<TData>,
  DataTablePublicPassthroughTableOption
> {
  /** 当前页已经加载到浏览器的数据。 */
  data: TableOptions<TData>['data'];
  /** 表格列定义；业务页面应优先通过列 DSL 生成。 */
  columns: TableOptions<TData>['columns'];
  /** 手动指定总页数；未传时可改为传 `totalCount` 由内部按当前 pageSize 计算。 */
  pageCount?: number;
  /** 服务端总条数；内部写入 TanStack rowCount，并基于当前 pageSize 推导 pageCount。 */
  totalCount?: number;
  /**
   * 表格初始状态。
   * `sorting` 支持 `ExtendedColumnSort<TData>[]` 以提供更精确的排序列类型推断。
   */
  initialState?: DataTableInitialState<TData>;
  /** 列顺序变化通知；内部持久化和状态更新完成后调用。 */
  onColumnOrderChange?: TableOptions<TData>['onColumnOrderChange'];
  /** 受控的每页条数，覆盖默认值。 */
  pageSize?: number;
  /** 每页条数变化时的回调。 */
  onPageSizeChange?: (pageSize: number) => void;
  /**
   * 表格唯一标识，用于列宽持久化存储的 key。
   * 传入后自动启用 localStorage / sessionStorage 列宽缓存。
   */
  tableId: string;
  /**
   * 行 ID 来源。未传时默认读取 `row.id`，字段值为空、非有限数字或不存在时回退为
   * `${tableId}-${index}`；子行回退为 `${parent.id}-${index}`。
   *
   * 启用选择列时，建议传入稳定的 `rowId`。默认选择语义只覆盖当前已加载页，
   * `selectedRows`、`selectedRowIds` 和 `getSelectedRows()` 都不会表达跨页全量选择。
   */
  rowId?: DataTableRowId<TData>;
  /**
   * 列宽持久化存储模式。
   * - `'localStorage'` — 持久存储（默认）
   * - `'sessionStorage'` — 会话存储
   * - `false` — 禁用持久化
   */
  columnResizeStorage?: ColumnResizeStorageMode;
  /**
   * 列顺序持久化存储模式。
   * - `'localStorage'` — 持久存储（默认）
   * - `'sessionStorage'` — 会话存储
   * - `false` — 禁用持久化
   */
  columnOrderStorage?: ColumnOrderStorageMode;
  /**
   * 排序持久化存储模式。
   * - `'localStorage'` — 持久存储（默认）
   * - `'sessionStorage'` — 会话存储
   * - `false` — 禁用持久化
   */
  sortingStorage?: SortingStorageMode;
  /** 列宽拖拽结束时的回调，仅在列宽实际变化时触发。 */
  onColumnResizeEnd?: (columnKey: string, width: number) => void;
  /** 是否在表格首列显示行号列。默认 `true`。 */
  showRowNumberColumn?: boolean;
  /**
   * 行号显示模式。
   * - `'static'`：按当前可见行位置连续编号，服务端分页时叠加页偏移（默认）
   * - `'original'`：跟随原始数据数组索引，不叠加分页偏移
   */
  rowNumberDisplayMode?: RowNumberDisplayMode;
  /** 是否自动注入多选列。默认 `false`。选中统计默认是当前页范围。 */
  showSelectColumn?: boolean;
  /** 行选中态所属的数据上下文 key；变化时会自动清空当前选中。 */
  rowSelectionScopeKey?: string | number | null;
  /** 操作列的固定方向。默认 `'right'`。 */
  actionColumnPin?: DataTablePinnedSide;
  /** 行操作配置列表。传入后自动在表格末尾生成操作列。 */
  rowActions?: DataTableRowAction<TData>[];
  /** 行展开配置。传入后启用行点击展开和详情面板，不再额外注入展开图标列。 */
  expandConfig?: ExpandConfigEdge<TData>;
  /** editableField 的行级权限与编辑完成通知。 */
  editing?: DataTableEditingOptions<TData>;
}
