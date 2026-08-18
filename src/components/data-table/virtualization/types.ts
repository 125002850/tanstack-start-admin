import type { Column } from '@tanstack/react-table';

export type DataTableVirtualizationMode = 'auto' | 'on' | 'off';

export type DataTableVirtualizationFallbackReason =
  | 'runtime-error'
  | 'unsupported-browser'
  | 'disabled-by-config'
  | 'grouped-header'
  | 'header-colspan';

export interface DataTableVirtualizationOptions {
  mode?: DataTableVirtualizationMode;
  /** @deprecated 使用 mode。 */
  enabled?: boolean;
  columnVirtualizationMode?: DataTableVirtualizationMode;
  estimateRowHeight?: number;
  overscan?: number;
  rowCountThreshold?: number;
  columnCountThreshold?: number;
  columnOverscan?: number;
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
