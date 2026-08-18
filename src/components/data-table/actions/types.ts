import type { Table } from '@tanstack/react-table';
import type { ComponentType, ReactNode } from 'react';

/** 每个表格操作回调收到的上下文；selectedRows 默认只代表当前已加载页。 */
export interface DataTableActionContext<TData> {
  table: Table<TData>;
  selectedRows: TData[];
}

export type DataTableActionResolver<TData, TValue> =
  | TValue
  | ((ctx: DataTableActionContext<TData>) => TValue);

interface DataTableActionBase<TData> {
  label: string;
  icon?: ReactNode;
  type?: 'default' | 'danger';
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  disabled?: DataTableActionResolver<TData, boolean>;
  className?: DataTableActionResolver<TData, string>;
  callback?: (ctx: DataTableActionContext<TData>) => void | Promise<void>;
  children?: DataTableAction<TData>[];
}

export interface DataTableRegularAction<TData> extends DataTableActionBase<TData> {
  kind?: 'regular';
  hidden?: DataTableActionResolver<TData, boolean>;
}

export interface DataTableSelectionAction<TData> extends DataTableActionBase<TData> {
  kind: 'selection';
  hidden?: never;
}

export type DataTableAction<TData> =
  | DataTableRegularAction<TData>
  | DataTableSelectionAction<TData>;

export interface DataTableRowAction<TData> {
  id?: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean | ((row: TData) => boolean);
  hidden?: boolean | ((row: TData) => boolean);
  onClick?: (row: TData) => void;
  confirmDelete?: {
    title?: string;
    description?: (row: TData) => string;
    confirmText?: string;
    cancelText?: string;
  };
  Sheet?: ComponentType<{
    data: TData;
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }>;
}
