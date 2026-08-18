import type { Cell, Row, Table as TanstackTable } from '@tanstack/react-table';
import type { MouseEvent, KeyboardEvent, ReactNode, RefObject } from 'react';

import type { DataTableColumnDragMotionMap } from '@/components/data-table/dnd/data-table-column-drag-motion';
import type { DataTableStatusConfig } from '@/components/data-table/feedback/data-table-status';
import type {
  DataTableColumnVirtualWindow,
  DataTableResolvedVirtualizationOptions
} from '@/components/data-table/virtualization/types';
import type { DataTableCellSelectionProps } from '@/components/data-table/selection/types';

export interface DataTableBodyProps<TData> {
  table: TanstackTable<TData>;
  enableZebraStriping: boolean;
  emptyMessage: ReactNode;
  status?: DataTableStatusConfig;
  virtualization?: DataTableResolvedVirtualizationOptions;
  columnVirtualWindow?: DataTableColumnVirtualWindow<TData>;
  columnDragMotionById: DataTableColumnDragMotionMap;
  isColumnDragging: boolean;
  useTransformFreeVirtualRows?: boolean;
  scrollViewportRef: RefObject<HTMLDivElement | null>;
  headerRowRef: RefObject<HTMLTableRowElement | null>;
  onRowClick?: (rowKey: string) => void;
  expandedRowKey?: string | null;
  getExpandRowKey?: (row: TData) => string | null;
}

export type DataTableBodyCellServices<TData> = {
  columnDragMotionById: DataTableColumnDragMotionMap;
  isColumnDragging: boolean;
  getCellSelectionProps: (cell: Cell<TData, unknown>) => DataTableCellSelectionProps;
  renderCellServerError: (cell: Cell<TData, unknown>) => ReactNode;
  renderCellFillHandle: (cell: Cell<TData, unknown>) => ReactNode;
};

export type DataTableBodyRowInteraction<TData> = {
  className: string;
  getTabIndex: (row: Row<TData>) => number | undefined;
  handleClick: (event: MouseEvent<HTMLTableRowElement>, row: Row<TData>) => void;
  handleKeyDown: (event: KeyboardEvent<HTMLTableRowElement>, row: Row<TData>) => void;
  isExpanded: (row: Row<TData>) => boolean;
  shouldIgnoreTarget: (target: EventTarget | null, currentTarget: HTMLElement) => boolean;
};
