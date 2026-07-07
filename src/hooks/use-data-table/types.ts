import type { Row, TableOptions, TableState } from '@tanstack/react-table';
import type * as React from 'react';

import type {
  ColumnOrderStorageMode,
  ColumnResizeStorageMode,
  ExpandConfigEdge,
  ExtendedColumnSort,
  SortingStorageMode
} from '@/types/data-table';
import type { DataTableRowAction } from '@/components/ui/table/actions/data-table-row-action';
import type { RowNumberDisplayMode } from './columns/row-number-column';

/** 服务端查询参数，与 `apiFiltersBuilder` 的返回值类型一致。 */
export interface ApiFilters {
  page: number;
  limit: number;
  sort?: string;
  [k: string]: string | number | undefined;
}

export type DataTablePinnedSide = 'left' | 'right';

export type DataTableRowId<TData> =
  | keyof TData
  | ((row: TData, index: number, parent?: Row<TData>) => string | number);

export interface UseDataTableProps<TData> extends Omit<
  TableOptions<TData>,
  | 'state'
  | 'pageCount'
  | 'getCoreRowModel'
  | 'manualFiltering'
  | 'manualPagination'
  | 'manualSorting'
> {
  /** 手动指定总页数；未传时可改为传 `totalCount` 由内部按当前 pageSize 计算。 */
  pageCount?: number;
  /** 服务端总条数；适用于服务端分页表格，内部会基于当前 pageSize 自动推导 pageCount。 */
  totalCount?: number;
  /**
   * 表格初始状态。
   * `sorting` 支持 `ExtendedColumnSort<TData>[]` 以提供更精确的排序列类型推断。
   */
  initialState?: Omit<Partial<TableState>, 'sorting'> & {
    sorting?: ExtendedColumnSort<TData>[];
  };
  /** 路由历史模式：`push` 添加历史记录，`replace` 替换当前记录。 */
  history?: 'push' | 'replace';
  /** 列过滤搜索的去抖延迟（毫秒）。 */
  debounceMs?: number;
  /** 列过滤搜索的节流延迟（毫秒）。 */
  throttleMs?: number;
  /** 是否在查询参数为空时清除默认值。 */
  clearOnDefault?: boolean;
  /**
   * 是否启用高级筛选模式。
   *
   * @deprecated 高级筛选闭环已暂停使用；普通 `columnFilters` 会继续生效。
   */
  enableAdvancedFilter?: boolean;
  /** 受控的每页条数，覆盖默认值。 */
  pageSize?: number;
  /** 每页条数变化时的回调。 */
  onPageSizeChange?: (pageSize: number) => void;
  /** 是否启用滚动区域。 */
  scroll?: boolean;
  /** React 18+ 的 `startTransition` 函数，用于将状态更新标记为非紧急。 */
  startTransition?: React.TransitionStartFunction;
  /**
   * 表格唯一标识，用于列宽持久化存储的 key。
   * 传入后自动启用 localStorage / sessionStorage 列宽缓存。
   */
  tableId: string;
  /**
   * 行 ID 来源。未传时默认读取 `row.id`，字段值为空、非有限数字或不存在时回退为
   * `${tableId}-${index}`；子行回退为 `${parent.id}-${index}`。
   *
   * 启用选择列时，建议传入稳定的 `rowId` 或 `getRowId`。默认选择语义只覆盖当前已加载页，
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
}
