import {
  type DragEndEvent,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { type Column, type Table as TanstackTable } from '@tanstack/react-table';
import * as React from 'react';

import { getCanReorderColumn } from '@/components/ui/table/core/data-table-header';
import { moveDataTableColumnOrder } from '@/lib/data-table-state-persistence';

/**
 * 表头列顺序拖拽 hook。
 *
 * 只允许中间区域的可重排列参与拖拽；左/右固定列以及工具列由表格状态统一管理。
 * 拖拽结束后只更新 TanStack columnOrder，持久化由 useTableState 接管。
 */
const COLUMN_ORDER_LONG_PRESS_DELAY_MS = 180;
const COLUMN_ORDER_LONG_PRESS_TOLERANCE_PX = 8;
const COLUMN_ORDER_LONG_PRESS_TOUCH_TOLERANCE_PX = 12;

export function useDataTableColumnDnd<TData>({
  table,
  centerVisibleLeafColumns,
  isFlatLeafHeader
}: {
  table: TanstackTable<TData>;
  centerVisibleLeafColumns: Array<Column<TData>>;
  isFlatLeafHeader: boolean;
}) {
  // dnd-kit 拖拽结束时可能紧接着触发 click capture，这里用短生命周期标记吞掉误点击。
  const suppressHeaderClickRef = React.useRef(false);
  const suppressHeaderClickTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [activeColumnDrag, setActiveColumnDrag] = React.useState<{
    columnId: string;
    width: number | null;
  } | null>(null);
  const columnOrderSensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        delay: COLUMN_ORDER_LONG_PRESS_DELAY_MS,
        tolerance: COLUMN_ORDER_LONG_PRESS_TOLERANCE_PX
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: COLUMN_ORDER_LONG_PRESS_DELAY_MS,
        tolerance: COLUMN_ORDER_LONG_PRESS_TOUCH_TOLERANCE_PX
      }
    })
  );

  React.useEffect(() => {
    return () => {
      if (suppressHeaderClickTimerRef.current !== null) {
        clearTimeout(suppressHeaderClickTimerRef.current);
      }
    };
  }, []);

  const sortableColumnIds = React.useMemo(() => {
    // 分组/多层表头不启用拖拽，避免 header colSpan 与叶子列顺序不一致。
    if (!isFlatLeafHeader) return [];

    const draggableColumnIds = centerVisibleLeafColumns
      .filter(getCanReorderColumn)
      .map((column) => column.id);

    return draggableColumnIds.length > 1 ? draggableColumnIds : [];
  }, [centerVisibleLeafColumns, isFlatLeafHeader]);
  const draggableColumnIdSet = React.useMemo(() => new Set(sortableColumnIds), [sortableColumnIds]);
  const activeDragHeader = activeColumnDrag?.columnId
    ? table.getFlatHeaders().find((header) => header.column.id === activeColumnDrag.columnId)
    : undefined;

  const armSuppressHeaderClick = React.useCallback(() => {
    // setTimeout(0) 只跨过当前事件循环，足以覆盖拖拽释放后的合成点击。
    suppressHeaderClickRef.current = true;

    if (suppressHeaderClickTimerRef.current !== null) {
      clearTimeout(suppressHeaderClickTimerRef.current);
    }

    suppressHeaderClickTimerRef.current = setTimeout(() => {
      suppressHeaderClickRef.current = false;
      suppressHeaderClickTimerRef.current = null;
    }, 0);
  }, []);

  const handleHeaderClickCapture = React.useCallback(
    (event: React.MouseEvent<HTMLTableCellElement>) => {
      if (!suppressHeaderClickRef.current) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      suppressHeaderClickRef.current = false;

      if (suppressHeaderClickTimerRef.current !== null) {
        clearTimeout(suppressHeaderClickTimerRef.current);
        suppressHeaderClickTimerRef.current = null;
      }
    },
    []
  );

  const handleColumnDragStart = React.useCallback(
    (event: DragStartEvent) => {
      const columnId = String(event.active.id);
      if (!draggableColumnIdSet.has(columnId)) return;

      const activeRect = event.active.rect.current.initial;
      setActiveColumnDrag({
        columnId,
        // overlay 宽度取起始矩形，避免拖动过程中因为表格布局变化而抖动。
        width: activeRect?.width ? Math.round(activeRect.width) : null
      });
      armSuppressHeaderClick();
    },
    [armSuppressHeaderClick, draggableColumnIdSet]
  );

  const handleColumnDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const activeId = String(event.active.id);
      const overId = event.over ? String(event.over.id) : null;

      setActiveColumnDrag(null);

      if (
        !overId ||
        activeId === overId ||
        !draggableColumnIdSet.has(activeId) ||
        !draggableColumnIdSet.has(overId)
      ) {
        return;
      }

      const currentColumnOrder = table.getAllLeafColumns().map((column) => column.id);
      // moveDataTableColumnOrder 保持原数组中其他列顺序不变，只移动 activeId。
      const nextColumnOrder = moveDataTableColumnOrder(currentColumnOrder, activeId, overId);

      table.setColumnOrder(nextColumnOrder);
    },
    [draggableColumnIdSet, table]
  );

  const handleColumnDragCancel = React.useCallback(() => {
    setActiveColumnDrag(null);
  }, []);

  return {
    activeColumnDrag,
    activeDragHeader,
    columnOrderSensors,
    draggableColumnIdSet,
    handleColumnDragCancel,
    handleColumnDragEnd,
    handleColumnDragStart,
    handleHeaderClickCapture,
    sortableColumnIds
  };
}
