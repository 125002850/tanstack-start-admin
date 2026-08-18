import type { Cell, Column, Row } from '@tanstack/react-table';
import type {
  ButtonHTMLAttributes,
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  RefCallback,
  RefObject
} from 'react';

import type {
  DataTableFillBounds,
  DataTableFillColumn,
  DataTableFillTarget
} from '../editing/batch/data-table-fill-plan';
import type { DataTableEditingRuntime } from '../editing/types';
import type {
  DataTableCellRange,
  DataTableCellRangeBounds,
  DataTableCellRangeIndex
} from './data-table-cell-range';

export type DataTableCellCopyFeedbackState = {
  range: DataTableCellRange;
  run: 'a' | 'b';
};

export type DataTableCellSelectionProps = {
  ref: RefCallback<HTMLTableCellElement>;
  tabIndex: number;
  'data-cell-id': string;
  'data-cell-row-id': string;
  'data-cell-column-id': string;
  'data-cell-selection-owner': string;
  'data-cell-copy-flash'?: 'true';
  'data-cell-copy-flash-run'?: DataTableCellCopyFeedbackState['run'];
  'data-cell-fill-preview'?: 'true';
  'data-cell-server-invalid'?: 'true';
  'data-cell-selected'?: 'true';
  'data-cell-range-anchor'?: 'true';
  'data-cell-range-focus'?: 'true';
  'data-cell-range-edge'?: string;
  'data-cell-editable'?: 'true';
  'data-cell-edit-ready'?: 'true';
  'data-cell-editing'?: 'true';
  'data-cell-interaction-state'?: 'selected' | 'edit-ready' | 'editing';
  'aria-invalid'?: true;
  'aria-describedby'?: string;
  onFocus: (event: React.FocusEvent<HTMLTableCellElement>) => void;
  onPointerDown: (event: ReactPointerEvent<HTMLTableCellElement>) => void;
  onDoubleClick: (event: React.MouseEvent<HTMLTableCellElement>) => void;
  onKeyDown: (event: ReactKeyboardEvent<HTMLTableCellElement>) => void;
};

export type DataTableCellFillHandleProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  'data-slot': 'data-table-cell-fill-handle';
};

export type UseDataTableCellSelectionOptions<TData> = {
  rows: readonly Row<TData>[];
  columns: readonly Column<TData, unknown>[];
  matrixPasteColumns?: readonly Column<TData, unknown>[];
  scrollViewportRef: RefObject<HTMLDivElement | null>;
  shouldIgnoreTarget?: (target: EventTarget | null, currentTarget: HTMLElement) => boolean;
  editing?: DataTableEditingRuntime<TData>;
};

export type DataTableCellSelectionModel<TData> = {
  selectableColumns: readonly Column<TData, unknown>[];
  pasteColumns: readonly Column<TData, unknown>[];
  resolveColumnLabel: (columnId: string) => string;
  matrixPasteColumnContracts: readonly DataTableFillColumn<TData>[];
  rightPinnedColumnIds: readonly string[];
  rangeIndex: DataTableCellRangeIndex;
  rangeBounds: DataTableCellRangeBounds | null;
  cellsByCoordinate: ReadonlyMap<string, Cell<TData, unknown>>;
};

export type DataTableFillPreviewState = DataTableFillTarget & {
  readonly sourceRange: DataTableCellRange;
  readonly sourceBounds: DataTableCellRangeBounds;
  readonly planSourceBounds: DataTableFillBounds;
  readonly planTargetBounds: DataTableFillBounds;
};
