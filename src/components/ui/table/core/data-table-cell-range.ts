export type DataTableCellCoordinate = {
  rowId: string;
  columnId: string;
};

export type DataTableCellRange = {
  anchor: DataTableCellCoordinate;
  focus: DataTableCellCoordinate;
};

export type DataTableCellRangeBounds = {
  rowStart: number;
  rowEnd: number;
  columnStart: number;
  columnEnd: number;
};

export type DataTableCellRangeIndex = {
  rowIds: readonly string[];
  columnIds: readonly string[];
  rowIndexById: ReadonlyMap<string, number>;
  columnIndexById: ReadonlyMap<string, number>;
};

export type DataTableCellRangeEdge = 'block-start' | 'inline-end' | 'block-end' | 'inline-start';

type DataTableCellArrowKey = 'ArrowUp' | 'ArrowRight' | 'ArrowDown' | 'ArrowLeft';

export function createDataTableCellRangeIndex(
  rowIds: readonly string[],
  columnIds: readonly string[]
): DataTableCellRangeIndex {
  return {
    rowIds,
    columnIds,
    rowIndexById: new Map(rowIds.map((id, index) => [id, index])),
    columnIndexById: new Map(columnIds.map((id, index) => [id, index]))
  };
}

export function resolveDataTableCellRangeBounds(
  range: DataTableCellRange,
  index: DataTableCellRangeIndex
): DataTableCellRangeBounds | null {
  const anchorRow = index.rowIndexById.get(range.anchor.rowId);
  const anchorColumn = index.columnIndexById.get(range.anchor.columnId);
  const focusRow = index.rowIndexById.get(range.focus.rowId);
  const focusColumn = index.columnIndexById.get(range.focus.columnId);

  if (
    anchorRow === undefined ||
    anchorColumn === undefined ||
    focusRow === undefined ||
    focusColumn === undefined
  ) {
    return null;
  }

  return {
    rowStart: Math.min(anchorRow, focusRow),
    rowEnd: Math.max(anchorRow, focusRow),
    columnStart: Math.min(anchorColumn, focusColumn),
    columnEnd: Math.max(anchorColumn, focusColumn)
  };
}

function resolveCoordinateIndexes(
  coordinate: DataTableCellCoordinate,
  index: DataTableCellRangeIndex
) {
  const row = index.rowIndexById.get(coordinate.rowId);
  const column = index.columnIndexById.get(coordinate.columnId);
  return row === undefined || column === undefined ? null : { row, column };
}

export function isDataTableCellInRange(
  coordinate: DataTableCellCoordinate,
  bounds: DataTableCellRangeBounds,
  index: DataTableCellRangeIndex
): boolean {
  const position = resolveCoordinateIndexes(coordinate, index);
  if (!position) return false;

  return (
    position.row >= bounds.rowStart &&
    position.row <= bounds.rowEnd &&
    position.column >= bounds.columnStart &&
    position.column <= bounds.columnEnd
  );
}

export function getDataTableCellRangeEdges(
  coordinate: DataTableCellCoordinate,
  bounds: DataTableCellRangeBounds,
  index: DataTableCellRangeIndex
): string | undefined {
  const position = resolveCoordinateIndexes(coordinate, index);
  if (!position || !isDataTableCellInRange(coordinate, bounds, index)) return undefined;

  const edges: DataTableCellRangeEdge[] = [];
  if (position.row === bounds.rowStart) edges.push('block-start');
  if (position.column === bounds.columnEnd) edges.push('inline-end');
  if (position.row === bounds.rowEnd) edges.push('block-end');
  if (position.column === bounds.columnStart) edges.push('inline-start');
  return edges.length ? edges.join(' ') : undefined;
}

export function moveDataTableCellCoordinate(
  coordinate: DataTableCellCoordinate,
  key: DataTableCellArrowKey,
  direction: 'ltr' | 'rtl',
  index: DataTableCellRangeIndex
): DataTableCellCoordinate {
  const position = resolveCoordinateIndexes(coordinate, index);
  if (!position) return coordinate;

  let rowDelta = 0;
  let columnDelta = 0;

  if (key === 'ArrowUp') rowDelta = -1;
  if (key === 'ArrowDown') rowDelta = 1;
  if (key === 'ArrowLeft') columnDelta = direction === 'rtl' ? 1 : -1;
  if (key === 'ArrowRight') columnDelta = direction === 'rtl' ? -1 : 1;

  const row = Math.max(0, Math.min(position.row + rowDelta, index.rowIds.length - 1));
  const column = Math.max(0, Math.min(position.column + columnDelta, index.columnIds.length - 1));

  return {
    rowId: index.rowIds[row] ?? coordinate.rowId,
    columnId: index.columnIds[column] ?? coordinate.columnId
  };
}

export function buildDataTableCellRangeTsv(
  bounds: DataTableCellRangeBounds,
  index: DataTableCellRangeIndex,
  getText: (coordinate: DataTableCellCoordinate) => unknown
): string {
  const lines: string[] = [];

  for (let rowIndex = bounds.rowStart; rowIndex <= bounds.rowEnd; rowIndex += 1) {
    const rowId = index.rowIds[rowIndex];
    if (rowId === undefined) continue;
    const cells: string[] = [];

    for (let columnIndex = bounds.columnStart; columnIndex <= bounds.columnEnd; columnIndex += 1) {
      const columnId = index.columnIds[columnIndex];
      if (columnId === undefined) continue;
      cells.push(normalizeDataTableCellClipboardText(getText({ rowId, columnId })));
    }

    lines.push(cells.join('\t'));
  }

  return lines.join('\n');
}

export function normalizeDataTableCellClipboardText(value: unknown): string {
  return String(value ?? '').replace(/\r\n?/g, '\n');
}

export function resolveDataTableCellClipboardText({
  copyValue,
  renderedText,
  rawValue
}: {
  copyValue?: unknown;
  renderedText?: string;
  rawValue: unknown;
}): string {
  if (copyValue !== undefined) {
    return normalizeDataTableCellClipboardText(copyValue);
  }
  if (renderedText !== undefined) {
    return normalizeDataTableCellClipboardText(renderedText);
  }
  return normalizeDataTableCellClipboardText(rawValue);
}
