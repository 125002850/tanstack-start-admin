import { useCallback, useLayoutEffect, useState } from 'react';

function measureHeaderWidths(headerRow: HTMLTableRowElement): ReadonlyMap<string, number> {
  const widths = new Map<string, number>();
  for (const th of headerRow.querySelectorAll<HTMLTableCellElement>('th[data-column-id]')) {
    const columnId = th.dataset.columnId;
    if (columnId) widths.set(columnId, th.offsetWidth);
  }
  return widths;
}

function getHeaderWidth(headerRow: HTMLTableRowElement, columnId: string): number | undefined {
  for (const th of headerRow.querySelectorAll<HTMLTableCellElement>('th[data-column-id]')) {
    if (th.dataset.columnId === columnId) return th.offsetWidth;
  }
  return undefined;
}

function areColumnWidthsEqual(
  current: ReadonlyMap<string, number>,
  next: ReadonlyMap<string, number>
) {
  if (current.size !== next.size) return false;
  for (const [columnId, width] of current) {
    if (next.get(columnId) !== width) return false;
  }
  return true;
}

export function useHeaderWidths(
  headerRowRef: React.RefObject<HTMLTableRowElement | null>
): (columnId: string) => number | undefined {
  const [columnWidths, setColumnWidths] = useState<ReadonlyMap<string, number>>(() => new Map());

  useLayoutEffect(() => {
    const headerRow = headerRowRef.current;
    if (!headerRow) return;
    const measure = () => {
      const nextWidths = measureHeaderWidths(headerRow);
      setColumnWidths((current) =>
        areColumnWidthsEqual(current, nextWidths) ? current : nextWidths
      );
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(measure);
    headerRow.querySelectorAll('th').forEach((th) => observer.observe(th));
    return () => observer.disconnect();
  }, [headerRowRef]);

  return useCallback(
    (columnId: string) =>
      columnWidths.get(columnId) ??
      (headerRowRef.current ? getHeaderWidth(headerRowRef.current, columnId) : undefined),
    [columnWidths, headerRowRef]
  );
}
