import type { ColumnSizingState, Table } from '@tanstack/react-table';
import * as React from 'react';

import {
  clearDataTableColumnSizing,
  saveDataTableColumnSizing
} from '@/lib/data-table-state-persistence';
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
    // tableId 是存储 key 的组成部分，运行中变化会导致读写错位，开发环境提示调用方修正。
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
    // 记录初始列宽，用于拖拽结束后判断哪些列真的发生了变化。
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
      // 只在“从拖拽中 -> 拖拽结束”这个边沿做持久化，避免拖拽过程中高频写 storage。
      const currentSizing = table.getState().columnSizing;
      const sanitizedSizing = omitFixedWidthColumnSizing(currentSizing) ?? {};

      if (tableId && resolvedStorageMode !== false) {
        saveDataTableColumnSizing(tableId, sanitizedSizing, resolvedStorageMode);
      }

      if (onColumnResizeEnd) {
        const prev = prevSizingRef.current;
        // 回调只通知实际变化过的列，调用方不需要自己 diff。
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
      clearDataTableColumnSizing(tableId, resolvedStorageMode);
    }

    // reset 后恢复 initialState 中的非固定列列宽，同时同步 prevSizingRef。
    const nextColumnSizing = omitFixedWidthColumnSizing(resolvedInitialColumnSizing) ?? {};
    setColumnSizing(nextColumnSizing);
    prevSizingRef.current = nextColumnSizing;
  }, [resolvedInitialColumnSizing, resolvedStorageMode, setColumnSizing, tableId]);

  return {
    resetColumnSizing
  };
}
