import type { ColumnSort } from '@tanstack/react-table';

export interface ExtendedColumnSort<TData> extends Omit<ColumnSort, 'id'> {
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
