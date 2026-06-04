import type { ColumnSizingState, Table } from '@tanstack/react-table';
import * as React from 'react';

import {
  clearColumnSizing,
  saveColumnSizing
} from '@/lib/data-table-column-resize-storage';
import type { ColumnResizeStorageMode } from '@/types/data-table';

import { omitFixedWidthColumnSizing } from './column-sizing';

/** 处理列宽持久化、副作用同步，以及“重置列宽”能力。 */
export function useColumnSizingPersistence<TData>({
  table,
  tableId,
  resolvedStorageMode,
  onColumnResizeEnd,
  resolvedInitialColumnSizing,
  setColumnSizing
}: {
  table: Table<TData>;
  tableId: string | undefined;
  resolvedStorageMode: ColumnResizeStorageMode;
  onColumnResizeEnd: ((columnKey: string, width: number) => void) | undefined;
  resolvedInitialColumnSizing: ColumnSizingState | undefined;
  setColumnSizing: React.Dispatch<React.SetStateAction<ColumnSizingState>>;
}) {
  const initialTableIdRef = React.useRef(tableId);

  React.useEffect(() => {
    if (
      import.meta.env.DEV &&
      tableId !== initialTableIdRef.current &&
      initialTableIdRef.current !== undefined
    ) {
      console.warn(
        `[useDataTable] tableId changed from "${initialTableIdRef.current}" to "${tableId}" at runtime. ` +
          'Column sizing persistence uses the initial tableId for storage keys. ' +
          'Changing tableId will cause mismatched storage reads/writes.'
      );
    }
  }, [tableId]);

  const prevSizingRef = React.useRef<ColumnSizingState>({});

  React.useEffect(() => {
    prevSizingRef.current = table.getState().columnSizing;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const prevIsResizingRef = React.useRef<string | false>(false);
  const isResizingColumn = table.getState().columnSizingInfo.isResizingColumn;

  React.useEffect(() => {
    const wasResizing = !!prevIsResizingRef.current;
    const isResizing = !!isResizingColumn;
    prevIsResizingRef.current = isResizingColumn;

    if (wasResizing && !isResizing) {
      const currentSizing = table.getState().columnSizing;
      const sanitizedSizing = omitFixedWidthColumnSizing(currentSizing) ?? {};

      if (tableId && resolvedStorageMode !== false) {
        saveColumnSizing(tableId, sanitizedSizing as Record<string, number>, resolvedStorageMode);
      }

      if (onColumnResizeEnd) {
        const prev = prevSizingRef.current;
        for (const [key, width] of Object.entries(sanitizedSizing)) {
          if (typeof width === 'number' && prev[key] !== width) {
            onColumnResizeEnd(key, width);
          }
        }
      }

      prevSizingRef.current = { ...currentSizing };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isResizingColumn]);

  const resetColumnSizing = React.useCallback(() => {
    if (tableId) {
      clearColumnSizing(tableId, resolvedStorageMode);
    }

    const nextColumnSizing = omitFixedWidthColumnSizing(resolvedInitialColumnSizing) ?? {};
    setColumnSizing(nextColumnSizing);
    prevSizingRef.current = nextColumnSizing;
  }, [resolvedInitialColumnSizing, resolvedStorageMode, setColumnSizing, tableId]);

  return {
    resetColumnSizing
  };
}
