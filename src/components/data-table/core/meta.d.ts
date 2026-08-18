import type { Column, PaginationState, RowData } from '@tanstack/react-table';
import type { FC, SVGProps } from 'react';

import type { DataTableRowAction } from '../actions/types';
import type { DataTableColumnOrderMeta } from './types';
import type {
  DataTableEditableChoiceColumnMeta,
  DataTableEditableColumnMeta,
  DataTableEditingRuntime
} from '../editing/types';
import type {
  DataTableDslFilterNodeType,
  DataTableDslOperator,
  DataTableFilterOptions,
  DataTableLocalFilteringRuntime,
  DataTableLocalFilterMeta,
  FilterVariant
} from '../filters/types';

declare module '@tanstack/react-table' {
  // biome-ignore lint/correctness/noUnusedVariables: Interface type parameters required by @tanstack/react-table
  interface ColumnMeta<TData extends RowData, TValue> {
    label?: string;
    placeholder?: string;
    variant?: FilterVariant;
    localFilter?: DataTableLocalFilterMeta<TData>;
    query?: {
      operator?: DataTableDslOperator;
      filterNodeType?: DataTableDslFilterNodeType;
      filterField?: string;
      sortField?: string;
      serializeFilter?: (value: unknown, column: Column<TData, TValue>) => unknown;
    };
    options?: DataTableFilterOptions;
    editableCell?: DataTableEditableColumnMeta<TData>;
    editableChoice?: DataTableEditableChoiceColumnMeta<TData>;
    range?: [number, number];
    unit?: string;
    icon?: FC<SVGProps<SVGSVGElement>>;
    pinningShadow?: Partial<Record<'left' | 'right', string>>;
    cellOwnsTooltip?: boolean;
    copyValue?: (value: TValue, row: TData) => unknown;
    columnMenuVisible?: boolean;
    columnPanelVisible?: boolean;
    columnPanelReorder?: boolean;
  }

  // biome-ignore lint/correctness/noUnusedVariables: Interface type parameters required by @tanstack/react-table
  interface TableMeta<TData extends RowData> {
    rowNumberDisplayMode?: 'static' | 'original';
    rowNumberPagination?: PaginationState;
    dataTableColumnOrder?: DataTableColumnOrderMeta;
    enableZebraStriping?: boolean;
    dataTableId?: string;
    dataTableEditing?: DataTableEditingRuntime<TData>;
    dataTableLocalFiltering?: DataTableLocalFilteringRuntime;
    dataTableRowActions?: DataTableRowAction<TData>[];
  }
}
