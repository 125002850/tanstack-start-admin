import type { CellContext } from '@tanstack/react-table';
import type { ReactNode } from 'react';

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
  | 'select'
  | 'remoteSelect'
  | 'fileSize';

export type DataTableColumnValueType = BuiltInColumnValueType | (string & {});

export type DataTableColumnAlign = 'left' | 'center' | 'right';

export interface DataTableColumnTypeDefinition<TData, TValue> {
  formatValue?: (value: TValue, row: TData) => ReactNode;
  copyValue?: (value: TValue, row: TData) => unknown;
  renderCell?: (context: CellContext<TData, TValue>) => ReactNode;
  size?: number;
  minSize?: number;
  maxSize?: number;
  align?: DataTableColumnAlign;
  headerAlign?: DataTableColumnAlign;
  cellClassName?: string;
  headerClassName?: string;
}

/** columnDsl.audit() 接受的通用审计字段契约。 */
export interface DataTableAuditFields {
  createById?: number | null;
  createByName?: string | null;
  createTime?: string | null;
  updateById?: number | null;
  updateByName?: string | null;
  updateTime?: string | null;
}
