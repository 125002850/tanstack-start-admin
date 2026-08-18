import { escapeDataTableCellClipboardText } from '../../selection/data-table-cell-range';
import {
  prepareDataTableMatrixPaste,
  type DataTableMatrixPasteColumn,
  type DataTableMatrixPasteFailure,
  type DataTableMatrixPasteOperation,
  type DataTableMatrixPastePlan,
  type DataTableMatrixPasteRow,
  type DataTableMatrixPasteSkipped,
  type DataTableMatrixPasteSourceCoordinate,
  type DataTableMatrixPasteTargetCoordinate
} from './data-table-matrix-paste';
import type {
  DataTableCellEditableContext,
  DataTableEditCodec,
  DataTableEditableColumnMeta
} from '../types';
import { dataTableMessages } from '@/config/data-table-messages';

export type DataTableFillDirection =
  | 'up'
  | 'right'
  | 'down'
  | 'left'
  | 'up-left'
  | 'up-right'
  | 'down-left'
  | 'down-right';

export type DataTableFillBounds = {
  readonly rowStart: number;
  readonly rowEnd: number;
  readonly columnStart: number;
  readonly columnEnd: number;
};

export type DataTableFillTarget = {
  readonly direction: DataTableFillDirection;
  readonly targetBounds: DataTableFillBounds;
};

export type DataTableFillShape = {
  readonly rows: number;
  readonly columns: number;
  readonly cells: number;
};

export type DataTableFillRow<TData> = DataTableMatrixPasteRow<TData>;

export type DataTableFillColumn<TData> = DataTableMatrixPasteColumn<TData> & {
  readonly copyValue?: (value: unknown, row: TData) => unknown;
};

export type DataTableFillPlan<TData> = DataTableMatrixPastePlan<TData> & {
  readonly direction?: DataTableFillDirection;
  readonly fillSourceShape: DataTableFillShape;
  readonly fillTargetShape: DataTableFillShape;
  readonly sourceBounds: DataTableFillBounds;
  readonly targetBounds: DataTableFillBounds;
};

type PrepareDataTableFillPlanOptions<TData> = {
  rows: readonly DataTableFillRow<TData>[];
  columns: readonly DataTableFillColumn<TData>[];
  rightPinnedColumnIds?: readonly string[];
  sourceBounds: DataTableFillBounds;
  targetBounds: DataTableFillBounds;
  revision: number;
  isCellEditable: (context: DataTableCellEditableContext<TData>) => boolean;
  maxCells?: number;
  yieldEvery?: number;
  yieldControl?: () => Promise<void>;
  signal?: AbortSignal;
};

function getShape(bounds: DataTableFillBounds): DataTableFillShape {
  const rows = Math.max(0, bounds.rowEnd - bounds.rowStart + 1);
  const columns = Math.max(0, bounds.columnEnd - bounds.columnStart + 1);
  return Object.freeze({ rows, columns, cells: rows * columns });
}

function isSameRows(left: DataTableFillBounds, right: DataTableFillBounds): boolean {
  return left.rowStart === right.rowStart && left.rowEnd === right.rowEnd;
}

function isSameColumns(left: DataTableFillBounds, right: DataTableFillBounds): boolean {
  return left.columnStart === right.columnStart && left.columnEnd === right.columnEnd;
}

function resolveFillDirection(
  sourceBounds: DataTableFillBounds,
  targetBounds: DataTableFillBounds
): DataTableFillDirection | null {
  if (isSameColumns(sourceBounds, targetBounds)) {
    if (targetBounds.rowEnd + 1 === sourceBounds.rowStart) return 'up';
    if (sourceBounds.rowEnd + 1 === targetBounds.rowStart) return 'down';
  }
  if (isSameRows(sourceBounds, targetBounds)) {
    if (targetBounds.columnEnd + 1 === sourceBounds.columnStart) return 'left';
    if (sourceBounds.columnEnd + 1 === targetBounds.columnStart) return 'right';
  }
  const spansRows =
    targetBounds.rowStart <= sourceBounds.rowStart && targetBounds.rowEnd >= sourceBounds.rowEnd;
  const spansColumns =
    targetBounds.columnStart <= sourceBounds.columnStart &&
    targetBounds.columnEnd >= sourceBounds.columnEnd;
  if (spansRows && spansColumns) {
    const up = targetBounds.rowStart < sourceBounds.rowStart;
    const down = targetBounds.rowEnd > sourceBounds.rowEnd;
    const left = targetBounds.columnStart < sourceBounds.columnStart;
    const right = targetBounds.columnEnd > sourceBounds.columnEnd;
    if ((up || down) && (left || right)) {
      return `${up ? 'up' : 'down'}-${left ? 'left' : 'right'}` as DataTableFillDirection;
    }
  }
  return null;
}

export function resolveDataTableFillTarget(
  sourceBounds: DataTableFillBounds,
  coordinate: { readonly rowIndex: number; readonly columnIndex: number }
): DataTableFillTarget | null {
  const rowWithinSource =
    coordinate.rowIndex >= sourceBounds.rowStart && coordinate.rowIndex <= sourceBounds.rowEnd;
  const columnWithinSource =
    coordinate.columnIndex >= sourceBounds.columnStart &&
    coordinate.columnIndex <= sourceBounds.columnEnd;

  if (columnWithinSource && coordinate.rowIndex < sourceBounds.rowStart) {
    return {
      direction: 'up',
      targetBounds: {
        rowStart: coordinate.rowIndex,
        rowEnd: sourceBounds.rowStart - 1,
        columnStart: sourceBounds.columnStart,
        columnEnd: sourceBounds.columnEnd
      }
    };
  }
  if (columnWithinSource && coordinate.rowIndex > sourceBounds.rowEnd) {
    return {
      direction: 'down',
      targetBounds: {
        rowStart: sourceBounds.rowEnd + 1,
        rowEnd: coordinate.rowIndex,
        columnStart: sourceBounds.columnStart,
        columnEnd: sourceBounds.columnEnd
      }
    };
  }
  if (rowWithinSource && coordinate.columnIndex < sourceBounds.columnStart) {
    return {
      direction: 'left',
      targetBounds: {
        rowStart: sourceBounds.rowStart,
        rowEnd: sourceBounds.rowEnd,
        columnStart: coordinate.columnIndex,
        columnEnd: sourceBounds.columnStart - 1
      }
    };
  }
  if (rowWithinSource && coordinate.columnIndex > sourceBounds.columnEnd) {
    return {
      direction: 'right',
      targetBounds: {
        rowStart: sourceBounds.rowStart,
        rowEnd: sourceBounds.rowEnd,
        columnStart: sourceBounds.columnEnd + 1,
        columnEnd: coordinate.columnIndex
      }
    };
  }

  // Diagonal corner fill: the pointer is beyond the source band on both axes.
  // The target is the expanded rectangle (source ∪ pointer); source cells are
  // excluded from the generated operations by prepareDataTableFillPlan.
  const expandedBounds = {
    rowStart: Math.min(sourceBounds.rowStart, coordinate.rowIndex),
    rowEnd: Math.max(sourceBounds.rowEnd, coordinate.rowIndex),
    columnStart: Math.min(sourceBounds.columnStart, coordinate.columnIndex),
    columnEnd: Math.max(sourceBounds.columnEnd, coordinate.columnIndex)
  };
  const direction = resolveFillDirection(sourceBounds, expandedBounds);
  if (!direction) return null;
  return {
    direction,
    targetBounds: expandedBounds
  };
}

function getExecutableCodec<TData>(editableCell: DataTableEditableColumnMeta<TData>) {
  const codec = editableCell.codec as Partial<DataTableEditCodec<TData, unknown>> | undefined;
  return codec &&
    typeof codec.parse === 'function' &&
    typeof codec.validate === 'function' &&
    typeof codec.formatForEdit === 'function'
    ? (codec as DataTableEditCodec<TData, unknown>)
    : null;
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

function freezeBounds(bounds: DataTableFillBounds): DataTableFillBounds {
  return Object.freeze({ ...bounds });
}

function createInvalidFillPlan<TData>({
  sourceBounds,
  targetBounds,
  revision,
  code,
  message,
  source
}: {
  sourceBounds: DataTableFillBounds;
  targetBounds: DataTableFillBounds;
  revision: number;
  code: 'invalid-fill-shape' | 'fill-source-unavailable';
  message: string;
  source?: DataTableMatrixPasteSourceCoordinate;
}): DataTableFillPlan<TData> {
  const failure = Object.freeze({
    code,
    errors: Object.freeze([message]),
    ...(source ? { source: Object.freeze(source) } : {})
  }) as DataTableMatrixPasteFailure;
  const failures = Object.freeze([failure]);
  return Object.freeze({
    status: 'invalid' as const,
    revision,
    sourceShape: getShape(targetBounds),
    targetAnchor: Object.freeze({
      rowIndex: targetBounds.rowStart,
      columnIndex: targetBounds.columnStart
    }),
    operations: Object.freeze([]),
    failures,
    skipped: Object.freeze([]),
    fillSourceShape: getShape(sourceBounds),
    fillTargetShape: getShape(targetBounds),
    sourceBounds: freezeBounds(sourceBounds),
    targetBounds: freezeBounds(targetBounds)
  });
}

function mapFillSourceCoordinate(
  coordinate: DataTableMatrixPasteSourceCoordinate,
  sourceBounds: DataTableFillBounds,
  targetBounds: DataTableFillBounds
): DataTableMatrixPasteSourceCoordinate {
  const targetRowIndex = targetBounds.rowStart + coordinate.rowIndex;
  const targetColumnIndex = targetBounds.columnStart + coordinate.columnIndex;
  const sourceRowCount = sourceBounds.rowEnd - sourceBounds.rowStart + 1;
  const sourceColumnCount = sourceBounds.columnEnd - sourceBounds.columnStart + 1;
  return Object.freeze({
    rowIndex:
      sourceBounds.rowStart +
      positiveModulo(targetRowIndex - sourceBounds.rowStart, sourceRowCount),
    columnIndex:
      sourceBounds.columnStart +
      positiveModulo(targetColumnIndex - sourceBounds.columnStart, sourceColumnCount)
  });
}

function isTargetInsideFillSource(
  target: DataTableMatrixPasteTargetCoordinate,
  sourceBounds: DataTableFillBounds
): boolean {
  return (
    target.rowIndex >= sourceBounds.rowStart &&
    target.rowIndex <= sourceBounds.rowEnd &&
    target.columnIndex >= sourceBounds.columnStart &&
    target.columnIndex <= sourceBounds.columnEnd
  );
}

function remapMatrixPlan<TData>(
  matrixPlan: DataTableMatrixPastePlan<TData>,
  sourceBounds: DataTableFillBounds,
  targetBounds: DataTableFillBounds,
  direction: DataTableFillDirection,
  resolveSourceColumnId?: (columnIndex: number) => string | undefined
): DataTableFillPlan<TData> {
  const mapSource = (source: DataTableMatrixPasteSourceCoordinate) => {
    const mapped = mapFillSourceCoordinate(source, sourceBounds, targetBounds);
    const columnId = resolveSourceColumnId?.(mapped.columnIndex);
    return columnId === undefined ? mapped : { ...mapped, columnId };
  };
  const operations = Object.freeze(
    matrixPlan.operations
      .filter((operation) => !isTargetInsideFillSource(operation.target, sourceBounds))
      .map((operation) =>
        Object.freeze({
          ...operation,
          source: mapSource(operation.source)
        })
      )
  ) as readonly DataTableMatrixPasteOperation<TData>[];
  const failures = Object.freeze(
    matrixPlan.failures.map((failure) =>
      failure.source
        ? Object.freeze({
            ...failure,
            source: mapSource(failure.source)
          })
        : failure
    )
  ) as readonly DataTableMatrixPasteFailure[];
  const skipped = Object.freeze(
    matrixPlan.skipped
      .filter((entry) => !isTargetInsideFillSource(entry.target, sourceBounds))
      .map((entry) =>
        Object.freeze({
          ...entry,
          source: mapSource(entry.source)
        })
      )
  ) as readonly DataTableMatrixPasteSkipped[];
  const shared = {
    ...matrixPlan,
    direction,
    operations,
    failures,
    skipped,
    fillSourceShape: getShape(sourceBounds),
    fillTargetShape: getShape(targetBounds),
    sourceBounds: freezeBounds(sourceBounds),
    targetBounds: freezeBounds(targetBounds)
  };
  if (matrixPlan.status === 'ready') {
    return Object.freeze({
      ...shared,
      status: 'ready' as const,
      failures: Object.freeze([]) as readonly []
    });
  }
  return Object.freeze({ ...shared, status: 'invalid' as const });
}

export async function prepareDataTableFillPlan<TData>({
  rows,
  columns,
  rightPinnedColumnIds = [],
  sourceBounds,
  targetBounds,
  revision,
  isCellEditable,
  maxCells,
  yieldEvery,
  yieldControl,
  signal
}: PrepareDataTableFillPlanOptions<TData>): Promise<DataTableFillPlan<TData>> {
  const direction = resolveFillDirection(sourceBounds, targetBounds);
  if (!direction) {
    return createInvalidFillPlan({
      sourceBounds,
      targetBounds,
      revision,
      code: 'invalid-fill-shape',
      message: dataTableMessages.fill.targetShapeInvalid
    });
  }

  const sourceShape = getShape(sourceBounds);
  const targetShape = getShape(targetBounds);
  if (sourceShape.cells === 0 || targetShape.cells === 0) {
    return createInvalidFillPlan({
      sourceBounds,
      targetBounds,
      revision,
      code: 'invalid-fill-shape',
      message: dataTableMessages.fill.emptyRange
    });
  }

  const clipboardRows: string[] = [];
  for (
    let targetRowIndex = targetBounds.rowStart;
    targetRowIndex <= targetBounds.rowEnd;
    targetRowIndex += 1
  ) {
    const clipboardCells: string[] = [];
    for (
      let targetColumnIndex = targetBounds.columnStart;
      targetColumnIndex <= targetBounds.columnEnd;
      targetColumnIndex += 1
    ) {
      const source = mapFillSourceCoordinate(
        {
          rowIndex: targetRowIndex - targetBounds.rowStart,
          columnIndex: targetColumnIndex - targetBounds.columnStart
        },
        sourceBounds,
        targetBounds
      );
      const sourceRow = rows[source.rowIndex];
      const sourceColumn = columns[source.columnIndex];
      const editableCell = sourceColumn?.editableCell;
      const codec = editableCell ? getExecutableCodec(editableCell) : null;
      if (!sourceRow || !sourceColumn || !sourceColumn.visible || !editableCell || !codec) {
        return createInvalidFillPlan({
          sourceBounds,
          targetBounds,
          revision,
          code: 'fill-source-unavailable',
          message: dataTableMessages.fill.sourceCellUnavailable,
          source
        });
      }
      const value = sourceRow.row[editableCell.field];
      const rawValue = sourceColumn.copyValue
        ? sourceColumn.copyValue(value, sourceRow.row)
        : codec.formatForEdit(value, sourceRow.row);
      clipboardCells.push(escapeDataTableCellClipboardText(rawValue));
    }
    clipboardRows.push(clipboardCells.join('\t'));
  }

  const matrixPlan = await prepareDataTableMatrixPaste({
    clipboardText: clipboardRows.join('\n'),
    rows,
    columns,
    rightPinnedColumnIds,
    anchor: {
      rowIndex: targetBounds.rowStart,
      columnIndex: targetBounds.columnStart
    },
    revision,
    isCellEditable,
    ...(maxCells === undefined ? {} : { maxCells }),
    ...(yieldEvery === undefined ? {} : { yieldEvery }),
    ...(yieldControl === undefined ? {} : { yieldControl }),
    ...(signal === undefined ? {} : { signal })
  });

  return remapMatrixPlan(
    matrixPlan,
    sourceBounds,
    targetBounds,
    direction,
    (columnIndex) => columns[columnIndex]?.columnId
  );
}
