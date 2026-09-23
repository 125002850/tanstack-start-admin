import type { Row } from '@tanstack/react-table';
import { useLayoutEffect, useRef } from 'react';

import type { DataTableRowVirtualizer } from '@/components/data-table/virtualization/use-row-virtualizer';
import type { DataTableColumnVirtualWindow } from '@/components/data-table/virtualization/types';

type FocusedTreeRow = {
  element: HTMLElement;
  rowId: string;
  ancestorIds: string[];
};

/** 仅在折叠移除了焦点行时恢复焦点；滚动卸载和用户主动移出表格不抢焦点。 */
export function useDataTableTreeFocus<TData>({
  enabled,
  rows,
  scrollViewport,
  virtualizer,
  shouldVirtualize,
  columnVirtualWindow,
  ensureTreeColumnVisible
}: {
  enabled: boolean;
  rows: Row<TData>[];
  scrollViewport: HTMLDivElement | null;
  virtualizer: DataTableRowVirtualizer;
  shouldVirtualize: boolean;
  columnVirtualWindow?: DataTableColumnVirtualWindow<TData>;
  ensureTreeColumnVisible?: () => void;
}) {
  const focusedRowRef = useRef<FocusedTreeRow | null>(null);

  useLayoutEffect(() => {
    if (!enabled || !scrollViewport) return;
    const rowsById = new Map(rows.map((row) => [row.id, row]));
    const handleFocus = (event: FocusEvent) => {
      const element = event.target;
      if (!(element instanceof HTMLElement)) return;
      const rowElement = element.closest<HTMLElement>('[data-tree-row-id]');
      const row = rowElement ? rowsById.get(rowElement.dataset.treeRowId ?? '') : undefined;
      if (!row) {
        focusedRowRef.current = null;
        return;
      }
      focusedRowRef.current = {
        element,
        rowId: row.id,
        ancestorIds: row
          .getParentRows()
          .map((ancestor) => ancestor.id)
          .toReversed()
      };
    };
    scrollViewport.addEventListener('focusin', handleFocus);
    return () => scrollViewport.removeEventListener('focusin', handleFocus);
  }, [enabled, rows, scrollViewport]);

  useLayoutEffect(() => {
    const previous = focusedRowRef.current;
    if (!enabled || !scrollViewport || !previous || previous.element.isConnected) return;
    if (document.activeElement && document.activeElement !== document.body) return;
    if (rows.some((row) => row.id === previous.rowId)) return;

    const collapsedParent = previous.ancestorIds
      .map((id) => rows.find((row) => row.id === id))
      .find((row) => row?.getCanExpand() && !row.getIsExpanded());
    if (!collapsedParent) return;

    const focusParent = () => {
      // 等待虚拟窗口挂载期间，用户可能已经主动把焦点移到其他控件。
      if (document.activeElement && document.activeElement !== document.body) return false;
      const trigger = Array.from(
        scrollViewport.querySelectorAll<HTMLButtonElement>('[data-tree-toggle]')
      ).find((element) => element.dataset.treeToggle === collapsedParent.id);
      if (!trigger) return false;
      // 原生 focus 同时把已经挂载但位于 overscan/横向视口外的按钮带回可见范围。
      trigger.focus();
      return true;
    };
    if (focusParent()) return;
    ensureTreeColumnVisible?.();
    if (shouldVirtualize) {
      virtualizer.scrollToIndex(rows.indexOf(collapsedParent), { align: 'auto' });
    }
    const frame = requestAnimationFrame(focusParent);
    return () => cancelAnimationFrame(frame);
  }, [
    enabled,
    rows,
    scrollViewport,
    shouldVirtualize,
    virtualizer,
    columnVirtualWindow,
    ensureTreeColumnVisible
  ]);
}
