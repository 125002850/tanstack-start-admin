import type { DataTableConfig } from '@/config/data-table';
import type { FilterItemSchema } from '@/lib/parsers';
import type { Column, ColumnSort, PaginationState, RowData } from '@tanstack/react-table';

declare module '@tanstack/react-table' {
  // biome-ignore lint/correctness/noUnusedVariables: Interface type parameters required by @tanstack/react-table
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string;
    placeholder?: string;
    variant?: FilterVariant;
    query?: {
      operator?: DataTableDslOperator;
    };
    options?: Option[];
    range?: [number, number];
    unit?: string;
    icon?: React.FC<React.SVGProps<SVGSVGElement>>;
    pinningShadow?: Partial<Record<'left' | 'right', string>>;
    cellOwnsTooltip?: boolean;
  }

  // biome-ignore lint/correctness/noUnusedVariables: Interface type parameters required by @tanstack/react-table
  interface TableMeta<TData extends RowData> {
    rowNumberDisplayMode?: 'static' | 'original';
    rowNumberPagination?: PaginationState;
    dataTableColumnOrder?: DataTableColumnOrderMeta;
  }
}

export interface Option {
  label: string;
  value: string;
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

export interface ExtendedColumnSort<TData> extends Omit<ColumnSort, 'id'> {
  id: Extract<keyof TData, string>;
}

export interface ExtendedColumnFilter<TData> extends FilterItemSchema {
  id: Extract<keyof TData, string>;
}

export type ColumnResizeStorageMode = 'localStorage' | 'sessionStorage' | false;
export type ColumnOrderStorageMode = ColumnResizeStorageMode;

export interface DataTableColumnOrderMeta {
  hasCustomOrder: boolean;
  reset: () => void;
}

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
  initialHeight: number;
  minHeight?: number;
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
   * Controls how virtualization is activated:
   * - `auto` (default): respects gate checks and `rowCountThreshold`
   * - `on`: forces virtualization when the runtime/browser gate allows it, even for small datasets
   * - `off`: disables virtualization explicitly
   */
  mode?: DataTableVirtualizationMode;
  /**
   * Backward-compatible alias for the old API.
   * `enabled: false` maps to `mode: 'off'`.
   * `enabled: true` maps to auto mode and still respects the row threshold.
   */
  enabled?: boolean;
  /**
   * Controls how center-column virtualization is activated:
   * - omitted / `off` (default): keep the existing full-column render path
   * - `auto`: virtualize center columns when the column threshold is met
   * - `on`: force center-column virtualization when table structure allows it
   */
  columnVirtualizationMode?: DataTableVirtualizationMode;
  estimateRowHeight?: number;
  overscan?: number;
  rowCountThreshold?: number;
  columnCountThreshold?: number;
  columnOverscan?: number;
  /**
   * Called only when virtualization was intended to run but was blocked by
   * a gate (`disabled-by-config` / `unsupported-browser`) or by a runtime error.
   * Explicit `mode: 'off'` does not trigger this callback.
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
  columnId: string;
  leafIndex: number;
  centerIndex: number;
  size: number;
  column: Column<TData>;
}

export interface DataTableColumnVirtualWindow<TData> {
  enabled: boolean;
  items: DataTableColumnRenderItem<TData>[];
  leftItems: DataTableColumnRenderItem<TData>[];
  rightItems: DataTableColumnRenderItem<TData>[];
  virtualPaddingLeft: number;
  virtualPaddingRight: number;
  virtualTotalSize: number;
}
