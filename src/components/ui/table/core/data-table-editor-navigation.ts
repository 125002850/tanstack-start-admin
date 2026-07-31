import type { DataTableFinishEditingResult, DataTableEditingRuntime } from '@/types/data-table';

export type DataTableEditorNavigationDirection = 'next' | 'previous';

function focusAdjacentEditableCell(
  cell: HTMLTableCellElement | null,
  direction: DataTableEditorNavigationDirection
) {
  const table = cell?.closest('table');
  if (!cell || !table) return;
  if (cell.closest('tbody')?.dataset.columnVirtualEnabled === 'true') return;
  const cells = [...table.querySelectorAll<HTMLTableCellElement>('td[data-cell-editable="true"]')];
  const currentIndex = cells.indexOf(cell);
  if (currentIndex < 0) return;
  const offset = direction === 'previous' ? -1 : 1;
  cells[currentIndex + offset]?.focus({ preventScroll: true });
}

export function finishEditingAndNavigate<TData>({
  runtime,
  sessionId,
  cell,
  direction
}: {
  runtime: DataTableEditingRuntime<TData>;
  sessionId: number;
  cell: HTMLTableCellElement | null;
  direction: DataTableEditorNavigationDirection;
}): DataTableFinishEditingResult {
  const result = runtime.finishEditing(sessionId, 'tab');
  if (result.status === 'committed' || result.status === 'unchanged') {
    queueMicrotask(() => focusAdjacentEditableCell(cell, direction));
  }
  return result;
}
