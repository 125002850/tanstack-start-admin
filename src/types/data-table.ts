import type { DataTableConfig } from '@/config/data-table';
import type { FilterItemSchema } from '@/lib/parsers';
import type {
  CellContext,
  Column,
  ColumnSort,
  PaginationState,
  Row,
  RowData
} from '@tanstack/react-table';

/**
 * DataTable 共享类型定义。
 *
 * 这里扩展 TanStack Table 的 ColumnMeta/TableMeta，并定义 DSL、列类型、行操作、展开面板、
 * 虚拟化等跨组件共享的类型契约。
 */
declare module '@tanstack/react-table' {
  // biome-ignore lint/correctness/noUnusedVariables: Interface type parameters required by @tanstack/react-table
  interface ColumnMeta<TData extends RowData, TValue> {
    /** 列面板、拖拽 overlay 和兜底展示使用的人类可读列名。 */
    label?: string;
    /** 筛选输入占位文案。 */
    placeholder?: string;
    /** DataTableToolbar 用于选择筛选控件的类型。 */
    variant?: FilterVariant;
    /** useDslDataTable 读取的后端查询序列化配置。 */
    query?: {
      operator?: DataTableDslOperator;
      filterField?: string;
      sortField?: string;
      serializeFilter?: (value: unknown, column: Column<TData, TValue>) => unknown;
    };
    /** select/multiSelect/enum 列的可选项。 */
    options?: Option[];
    /** range 筛选的数值边界。 */
    range?: [number, number];
    /** 数值筛选或展示的单位。 */
    unit?: string;
    icon?: React.FC<React.SVGProps<SVGSVGElement>>;
    /** 固定列边界阴影，可按 left/right 覆盖默认阴影。 */
    pinningShadow?: Partial<Record<'left' | 'right', string>>;
    /** 单元格自己负责 Tooltip 时设置为 true，避免外层重复包裹。 */
    cellOwnsTooltip?: boolean;
    /** 单元格复制时使用的值，优先于 DOM innerText。 */
    copyValue?: (value: TValue, row: TData) => unknown;
    /** 预留：列头菜单是否可见。 */
    columnMenuVisible?: boolean;
    /** “显示列”面板是否展示该列。 */
    columnPanelVisible?: boolean;
    /** “显示列”面板中是否允许拖拽重排该列。 */
    columnPanelReorder?: boolean;
  }

  // biome-ignore lint/correctness/noUnusedVariables: Interface type parameters required by @tanstack/react-table
  interface TableMeta<TData extends RowData> {
    /** 序号列显示模式。 */
    rowNumberDisplayMode?: 'static' | 'original';
    /** 序号列使用的分页状态，渲染中用于保持编号稳定。 */
    rowNumberPagination?: PaginationState;
    /** 列面板重置顺序所需的状态和回调。 */
    dataTableColumnOrder?: DataTableColumnOrderMeta;
  }
}

/** 筛选选项和 enum 展示选项的通用结构。 */
export interface Option {
  label: string;
  value: string;
  /** 树形选项的层级；省略时按普通扁平选项渲染。 */
  depth?: number;
  count?: number;
  icon?: React.FC<React.SVGProps<SVGSVGElement>>;
}

export type FilterOperator = DataTableConfig['operators'][number];
export type FilterVariant = DataTableConfig['filterVariants'][number];
export type DataTableDslOperator =
  | 'EQ'
  | 'CONTAINS'
  | 'STARTS_WITH'
  | 'ENDS_WITH'
  | 'IN'
  | 'GT'
  | 'GTE'
  | 'LT'
  | 'LTE'
  | 'BETWEEN';

export type DataTableColumnFilterVariant =
  | 'text'
  | 'select'
  | 'multiSelect'
  | 'date'
  | 'dateRange'
  | 'number'
  | 'numberRange'
  | 'boolean';

export type DataTableFilterOption = Option;

export interface DataTableColumnFilterOptions {
  /** false 表示关闭筛选；字符串值表示筛选控件类型。 */
  filter?: false | DataTableColumnFilterVariant;
  filterPlaceholder?: string;
  filterOptions?: readonly DataTableFilterOption[];
  filterMin?: number | Date;
  filterMax?: number | Date;
  filterUnit?: string;
}

export interface DataTableColumnDslQueryOptions<TData, TValue> {
  /** 后端 DSL 查询字段、排序字段、操作符和自定义序列化函数。 */
  dsl?: {
    filterField?: string;
    sortField?: string;
    filterOperator?: DataTableDslOperator;
    serializeFilter?: (value: unknown, column: Column<TData, TValue>) => unknown;
  };
}

export interface DataTableColumnPanelOptions {
  columnMenuVisible?: boolean;
  columnPanelVisible?: boolean;
  columnPanelReorder?: boolean;
}

export type BuiltInColumnValueType =
  | 'text'
  | 'longText'
  | 'number'
  | 'int'
  | 'decimal'
  | 'money'
  | 'percent'
  | 'date'
  | 'dateTime'
  | 'boolean'
  | 'enum'
  | 'fileSize';

export type DataTableColumnValueType = BuiltInColumnValueType | (string & {});

export interface DataTableColumnTypeDefinition<TData, TValue> {
  /** 将原始字段值转换为展示内容。 */
  formatValue?: (value: TValue, row: TData) => React.ReactNode;
  /** 将原始字段值转换为复制内容。 */
  copyValue?: (value: TValue, row: TData) => unknown;
  /** 完整接管 cell 渲染。 */
  renderCell?: (context: CellContext<TData, TValue>) => React.ReactNode;
  size?: number;
  minSize?: number;
  maxSize?: number;
  align?: 'left' | 'center' | 'right';
  cellClassName?: string;
  headerClassName?: string;
}

export interface DataTableRowActionSelectContext<TData> {
  row: TData;
  tableRow: Row<TData>;
}

export interface DataTableRowActionOption<TData> {
  id: string;
  label: string;
  icon?: React.ReactNode | React.ComponentType<React.SVGProps<SVGSVGElement>>;
  disabled?: boolean | ((row: TData) => boolean);
  hidden?: boolean | ((row: TData) => boolean);
  onSelect?: (context: DataTableRowActionSelectContext<TData>) => void | Promise<void>;
}

export interface ExtendedColumnSort<TData> extends Omit<ColumnSort, 'id'> {
  id: Extract<keyof TData, string>;
}

export interface ExtendedColumnFilter<TData> extends FilterItemSchema {
  id: Extract<keyof TData, string>;
}

export type DataTableStateStorageMode = 'localStorage' | 'sessionStorage' | false;
export type ColumnResizeStorageMode = DataTableStateStorageMode;
export type ColumnOrderStorageMode = DataTableStateStorageMode;
export type SortingStorageMode = DataTableStateStorageMode;

export interface DataTableColumnOrderMeta {
  hasCustomOrder: boolean;
  reset: () => void;
}

/** 只允许 string/number 字段作为展开行 key，保证可稳定序列化。 */
export type ExpandRowKeyField<TData> = Extract<
  {
    [K in keyof TData]-?: TData[K] extends string | number ? K : never;
  }[keyof TData],
  string
>;

export interface ExpandTab<TData, TId extends string = string> {
  id: TId;
  label: string;
  icon?: React.ReactNode;
  disabled?: boolean | ((row: TData) => boolean);
  render: (row: TData) => React.ReactNode;
}

export interface ExpandTableSizing {
  /** 展开后主表区域的初始高度。 */
  initialHeight: number;
  /** 主表区域最小高度。 */
  minHeight?: number;
  /** 主表区域最大高度。 */
  maxHeight?: number;
}

export interface ExpandConfig<
  TData,
  TKey extends ExpandRowKeyField<TData>,
  TTabs extends readonly ExpandTab<TData, string>[]
> {
  rowKey: TKey;
  tabs: TTabs;
  defaultTab?: TTabs[number]['id'];
  tableSizing?: ExpandTableSizing;
}

export interface ExpandTabEdge<TData> extends Omit<ExpandTab<TData, string>, 'id'> {
  id: string;
}

export interface ExpandConfigEdge<TData> {
  rowKey: keyof TData & string;
  tabs: readonly ExpandTabEdge<TData>[];
  defaultTab?: string;
  tableSizing?: ExpandTableSizing;
}

export function defineExpandConfig<
  TData,
  TKey extends ExpandRowKeyField<TData>,
  const TTabs extends readonly ExpandTab<TData, string>[]
>(config: ExpandConfig<TData, TKey, TTabs>) {
  // 纯类型 helper：保留 tabs id 字面量类型，运行时直接返回原配置。
  return config;
}

export type DataTableVirtualizationMode = 'auto' | 'on' | 'off';

export type DataTableVirtualizationFallbackReason =
  | 'runtime-error'
  | 'unsupported-browser'
  | 'disabled-by-config'
  | 'grouped-header'
  | 'header-colspan';

export interface DataTableVirtualizationOptions {
  /**
   * 控制行虚拟化启用方式：
   * - `auto`（默认）：遵守环境 gate 和 `rowCountThreshold`
   * - `on`：环境允许时强制启用，忽略小数据量阈值
   * - `off`：显式关闭
   */
  mode?: DataTableVirtualizationMode;
  /**
   * 旧 API 的兼容别名。
   * `enabled: false` 映射为 `mode: 'off'`；
   * `enabled: true` 映射为 auto，仍遵守行数阈值。
   */
  enabled?: boolean;
  /**
   * 控制中间列虚拟化启用方式：
   * - 省略 / `off`（默认）：保持完整列渲染路径
   * - `auto`：达到列数阈值时启用
   * - `on`：表头结构允许时强制启用
   */
  columnVirtualizationMode?: DataTableVirtualizationMode;
  estimateRowHeight?: number;
  overscan?: number;
  rowCountThreshold?: number;
  columnCountThreshold?: number;
  columnOverscan?: number;
  /**
   * 只有“调用方意图启用虚拟化，但被 gate 或运行时错误阻止”时触发。
   * 显式 `mode: 'off'` 不触发该回调。
   */
  onVirtualizationFallback?: (reason: DataTableVirtualizationFallbackReason) => void;
}

export interface DataTableResolvedColumnVirtualizationOptions {
  enabled: boolean;
  columnCountThreshold: number;
  overscan: number;
}

export interface DataTableResolvedVirtualizationOptions {
  enabled: boolean;
  estimateRowHeight?: number;
  overscan?: number;
  rowCountThreshold?: number;
  column: DataTableResolvedColumnVirtualizationOptions;
  onVirtualizationFallback?: (reason: DataTableVirtualizationFallbackReason) => void;
}

export type DataTableVirtualizationProp = boolean | DataTableVirtualizationOptions;

export interface DataTableColumnRenderItem<TData> {
  /** 列 ID。 */
  columnId: string;
  /** 在完整可见叶子列数组中的索引，用于从 row.getVisibleCells() 取 cell。 */
  leafIndex: number;
  /** 在中间区域列数组中的索引；固定列使用 -1。 */
  centerIndex: number;
  /** 当前渲染宽度。 */
  size: number;
  column: Column<TData>;
}

/** 列虚拟化窗口：固定列始终在 left/right，items 只包含中间可见窗口。 */
export interface DataTableColumnVirtualWindow<TData> {
  enabled: boolean;
  items: DataTableColumnRenderItem<TData>[];
  leftItems: DataTableColumnRenderItem<TData>[];
  rightItems: DataTableColumnRenderItem<TData>[];
  virtualPaddingLeft: number;
  virtualPaddingRight: number;
  virtualTotalSize: number;
}
