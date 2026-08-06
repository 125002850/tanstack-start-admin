import type {
  DataTableCellEditableContext,
  DataTableEditCodec,
  DataTableEditableColumnMeta
} from '@/types/data-table';
import { dataTableMessages } from '@/config/data-table-messages';

const DEFAULT_MAX_MATRIX_PASTE_CELLS = 10_000;
const DEFAULT_MATRIX_PASTE_YIELD_EVERY = 250;

export type DataTableMatrixPasteSourceCoordinate = {
  readonly rowIndex: number;
  readonly columnIndex: number;
  readonly columnId?: string;
};

export type DataTableMatrixPasteTargetCoordinate = {
  readonly rowIndex: number;
  readonly columnIndex: number;
  readonly rowId?: string;
  readonly columnId?: string;
};

export type DataTableMatrixPasteFailureCode =
  | 'aborted'
  | 'clipboard-syntax'
  | 'non-rectangular'
  | 'too-many-cells'
  | 'invalid-fill-shape'
  | 'fill-source-unavailable'
  | 'out-of-bounds'
  | 'pinned-column-excluded'
  | 'hidden-column'
  | 'not-editable'
  | 'readonly'
  | 'codec-unavailable'
  | 'parse'
  | 'validate';

export type DataTableMatrixPasteFailure = {
  readonly code: DataTableMatrixPasteFailureCode;
  readonly errors: readonly string[];
  readonly source?: DataTableMatrixPasteSourceCoordinate;
  readonly target?: DataTableMatrixPasteTargetCoordinate;
};

export type DataTableMatrixPasteSkipped = {
  readonly code: 'unchanged';
  readonly source: DataTableMatrixPasteSourceCoordinate;
  readonly target: DataTableMatrixPasteTargetCoordinate & {
    readonly rowId: string;
    readonly columnId: string;
  };
};

export type DataTableMatrixPasteOperation<TData> = {
  readonly source: DataTableMatrixPasteSourceCoordinate;
  readonly target: DataTableMatrixPasteTargetCoordinate & {
    readonly rowId: string;
    readonly columnId: string;
  };
  readonly field: Extract<keyof TData, string>;
  readonly previousValue: unknown;
  readonly value: unknown;
  readonly editableCell: DataTableEditableColumnMeta<TData>;
};

type DataTableMatrixPasteShape = {
  readonly rows: number;
  readonly columns: number;
  readonly cells: number;
};

type DataTableMatrixPastePlanBase<TData> = {
  readonly revision: number;
  readonly sourceShape: DataTableMatrixPasteShape;
  readonly targetAnchor: {
    readonly rowIndex: number;
    readonly columnIndex: number;
  };
  readonly operations: readonly DataTableMatrixPasteOperation<TData>[];
  readonly failures: readonly DataTableMatrixPasteFailure[];
  readonly skipped: readonly DataTableMatrixPasteSkipped[];
};

export type DataTableMatrixPastePlan<TData> =
  | (DataTableMatrixPastePlanBase<TData> & {
      readonly status: 'ready';
      readonly failures: readonly [];
    })
  | (DataTableMatrixPastePlanBase<TData> & {
      readonly status: 'invalid';
    });

export type DataTableMatrixPasteRow<TData> = {
  readonly rowId: string;
  readonly row: TData;
};

export type DataTableMatrixPasteColumn<TData> = {
  readonly columnId: string;
  readonly visible: boolean;
  readonly editableCell?: DataTableEditableColumnMeta<TData>;
};

export type DataTableClipboardMatrixParseResult =
  | {
      readonly status: 'valid';
      readonly matrix: readonly (readonly string[])[];
      readonly rowCount: number;
      readonly columnCount: number;
      readonly cellCount: number;
    }
  | {
      readonly status: 'invalid';
      readonly code: Extract<
        DataTableMatrixPasteFailureCode,
        'clipboard-syntax' | 'non-rectangular' | 'too-many-cells'
      >;
      readonly errors: readonly string[];
    };

type ParseDataTableClipboardMatrixOptions = {
  maxCells?: number;
};

type PrepareDataTableMatrixPasteOptions<TData> = {
  clipboardText: string;
  rows: readonly DataTableMatrixPasteRow<TData>[];
  columns: readonly DataTableMatrixPasteColumn<TData>[];
  rightPinnedColumnIds?: readonly string[];
  anchor: {
    rowIndex: number;
    columnIndex: number;
  };
  revision: number;
  isCellEditable: (context: DataTableCellEditableContext<TData>) => boolean;
  maxCells?: number;
  yieldEvery?: number;
  yieldControl?: () => Promise<void>;
  signal?: AbortSignal;
};

function createClipboardParseFailure(
  code: Extract<
    DataTableMatrixPasteFailureCode,
    'clipboard-syntax' | 'non-rectangular' | 'too-many-cells'
  >,
  message: string
): DataTableClipboardMatrixParseResult {
  return {
    status: 'invalid',
    code,
    errors: [message]
  };
}

export function parseDataTableClipboardMatrix(
  clipboardText: string,
  options: ParseDataTableClipboardMatrixOptions = {}
): DataTableClipboardMatrixParseResult {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  let quoteClosed = false;
  let endedWithRowDelimiter = false;

  const pushCell = () => {
    row.push(cell);
    cell = '';
    quoteClosed = false;
  };
  const pushRow = () => {
    pushCell();
    rows.push(row);
    row = [];
    endedWithRowDelimiter = true;
  };

  for (let index = 0; index < clipboardText.length; index += 1) {
    const character = clipboardText[index]!;

    if (quoted) {
      if (character === '"') {
        if (clipboardText[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else {
          quoted = false;
          quoteClosed = true;
        }
      } else if (character === '\r') {
        if (clipboardText[index + 1] === '\n') index += 1;
        cell += '\n';
      } else {
        cell += character;
      }
      endedWithRowDelimiter = false;
      continue;
    }

    if (quoteClosed && character !== '\t' && character !== '\r' && character !== '\n') {
      return createClipboardParseFailure(
        'clipboard-syntax',
        dataTableMessages.matrix.textAfterClosingQuote
      );
    }

    if (character === '\t') {
      pushCell();
      endedWithRowDelimiter = false;
      continue;
    }

    if (character === '\r' || character === '\n') {
      if (character === '\r' && clipboardText[index + 1] === '\n') index += 1;
      pushRow();
      continue;
    }

    if (character === '"' && cell.length === 0) {
      quoted = true;
      endedWithRowDelimiter = false;
      continue;
    }

    cell += character;
    endedWithRowDelimiter = false;
  }

  if (quoted) {
    return createClipboardParseFailure(
      'clipboard-syntax',
      dataTableMessages.matrix.unterminatedQuotedCell
    );
  }

  if (!endedWithRowDelimiter || rows.length === 0) {
    pushRow();
  }

  const columnCount = rows[0]?.length ?? 0;
  if (rows.some((candidate) => candidate.length !== columnCount)) {
    return createClipboardParseFailure(
      'non-rectangular',
      dataTableMessages.matrix.nonRectangularClipboard
    );
  }

  const cellCount = rows.length * columnCount;
  const maxCells = options.maxCells ?? DEFAULT_MAX_MATRIX_PASTE_CELLS;
  if (cellCount > maxCells) {
    return createClipboardParseFailure(
      'too-many-cells',
      dataTableMessages.matrix.tooManyCells(cellCount, maxCells)
    );
  }

  return {
    status: 'valid',
    matrix: rows,
    rowCount: rows.length,
    columnCount,
    cellCount
  };
}

function cloneRow<TData>(row: TData): TData {
  return Object.assign({}, row) as TData;
}

function setRowField<TData>(row: TData, field: Extract<keyof TData, string>, value: unknown): void {
  (row as Record<string, unknown>)[field] = value;
}

function areValuesEqual(left: unknown, right: unknown): boolean {
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => Object.is(value, right[index]))
    );
  }
  return Object.is(left, right);
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

function freezeSourceCoordinate(
  rowIndex: number,
  columnIndex: number
): DataTableMatrixPasteSourceCoordinate {
  return Object.freeze({ rowIndex, columnIndex });
}

function freezeTargetCoordinate(
  rowIndex: number,
  columnIndex: number,
  rowId?: string,
  columnId?: string
): DataTableMatrixPasteTargetCoordinate {
  return Object.freeze({
    rowIndex,
    columnIndex,
    ...(rowId === undefined ? {} : { rowId }),
    ...(columnId === undefined ? {} : { columnId })
  });
}

function freezeValue(value: unknown): unknown {
  return Array.isArray(value) ? Object.freeze([...value]) : value;
}

function createFailure({
  code,
  message,
  source,
  target
}: {
  code: DataTableMatrixPasteFailureCode;
  message: string;
  source?: DataTableMatrixPasteSourceCoordinate;
  target?: DataTableMatrixPasteTargetCoordinate;
}): DataTableMatrixPasteFailure {
  return Object.freeze({
    code,
    errors: Object.freeze([message]),
    ...(source ? { source } : {}),
    ...(target ? { target } : {})
  });
}

function freezePlan<TData>({
  revision,
  sourceShape,
  targetAnchor,
  operations,
  failures,
  skipped
}: Omit<DataTableMatrixPastePlanBase<TData>, 'operations' | 'failures' | 'skipped'> & {
  operations: DataTableMatrixPasteOperation<TData>[];
  failures: DataTableMatrixPasteFailure[];
  skipped: DataTableMatrixPasteSkipped[];
}): DataTableMatrixPastePlan<TData> {
  const base = {
    revision,
    sourceShape: Object.freeze(sourceShape),
    targetAnchor: Object.freeze(targetAnchor),
    operations: Object.freeze(operations),
    failures: Object.freeze(failures),
    skipped: Object.freeze(skipped)
  };
  if (failures.length === 0) {
    const noFailures = Object.freeze([]) as readonly [];
    return Object.freeze({ ...base, status: 'ready' as const, failures: noFailures });
  }
  return Object.freeze({ ...base, status: 'invalid' as const });
}

function defaultYieldControl(): Promise<void> {
  return new Promise((resolve) => {
    globalThis.setTimeout(resolve, 0);
  });
}

export async function prepareDataTableMatrixPaste<TData>({
  clipboardText,
  rows,
  columns,
  rightPinnedColumnIds = [],
  anchor,
  revision,
  isCellEditable,
  maxCells = DEFAULT_MAX_MATRIX_PASTE_CELLS,
  yieldEvery = DEFAULT_MATRIX_PASTE_YIELD_EVERY,
  yieldControl = defaultYieldControl,
  signal
}: PrepareDataTableMatrixPasteOptions<TData>): Promise<DataTableMatrixPastePlan<TData>> {
  const parsed = parseDataTableClipboardMatrix(clipboardText, { maxCells });
  const emptyShape = { rows: 0, columns: 0, cells: 0 };
  if (parsed.status === 'invalid') {
    return freezePlan({
      revision,
      sourceShape: emptyShape,
      targetAnchor: anchor,
      operations: [],
      failures: [
        createFailure({
          code: parsed.code,
          message: parsed.errors[0] ?? dataTableMessages.matrix.invalidClipboard
        })
      ],
      skipped: []
    });
  }

  const sourceShape = {
    rows: parsed.rowCount,
    columns: parsed.columnCount,
    cells: parsed.cellCount
  };
  const operations: DataTableMatrixPasteOperation<TData>[] = [];
  const failures: DataTableMatrixPasteFailure[] = [];
  const skipped: DataTableMatrixPasteSkipped[] = [];
  const projectedRows = new Map<number, TData>();
  let processedCells = 0;

  const addAbortedFailure = () => {
    failures.push(
      createFailure({
        code: 'aborted',
        message: dataTableMessages.matrix.preparationCancelled
      })
    );
  };
  if (signal?.aborted) addAbortedFailure();

  for (
    let sourceRowIndex = 0;
    sourceRowIndex < parsed.rowCount && failures.every((failure) => failure.code !== 'aborted');
    sourceRowIndex += 1
  ) {
    for (
      let sourceColumnIndex = 0;
      sourceColumnIndex < parsed.columnCount;
      sourceColumnIndex += 1
    ) {
      const source = freezeSourceCoordinate(sourceRowIndex, sourceColumnIndex);
      const targetRowIndex = anchor.rowIndex + sourceRowIndex;
      const targetColumnIndex = anchor.columnIndex + sourceColumnIndex;
      const targetRow = rows[targetRowIndex];
      const targetColumn = columns[targetColumnIndex];
      const pinnedColumnId =
        targetColumn === undefined
          ? rightPinnedColumnIds[targetColumnIndex - columns.length]
          : undefined;
      const target = freezeTargetCoordinate(
        targetRowIndex,
        targetColumnIndex,
        targetRow?.rowId,
        targetColumn?.columnId ?? pinnedColumnId
      );

      if (!targetRow) {
        failures.push(
          createFailure({
            code: 'out-of-bounds',
            message: dataTableMessages.matrix.targetRowOutOfBounds,
            source,
            target
          })
        );
      } else if (!targetColumn) {
        failures.push(
          createFailure({
            code: pinnedColumnId ? 'pinned-column-excluded' : 'out-of-bounds',
            message: pinnedColumnId
              ? dataTableMessages.matrix.pinnedColumnExcluded
              : dataTableMessages.matrix.targetColumnOutOfBounds,
            source,
            target
          })
        );
      } else if (!targetColumn.visible) {
        failures.push(
          createFailure({
            code: 'hidden-column',
            message: dataTableMessages.matrix.hiddenColumn,
            source,
            target
          })
        );
      } else if (!targetColumn.editableCell) {
        failures.push(
          createFailure({
            code: 'not-editable',
            message: dataTableMessages.matrix.targetColumnNotEditable,
            source,
            target
          })
        );
      } else {
        const currentRow = projectedRows.get(targetRowIndex) ?? cloneRow(targetRow.row);
        if (!projectedRows.has(targetRowIndex)) {
          projectedRows.set(targetRowIndex, currentRow);
        }
        if (
          !isCellEditable({
            rowId: targetRow.rowId,
            row: currentRow,
            columnId: targetColumn.columnId
          })
        ) {
          failures.push(
            createFailure({
              code: 'readonly',
              message: dataTableMessages.matrix.targetCellReadonly,
              source,
              target
            })
          );
        } else {
          const codec = getExecutableCodec(targetColumn.editableCell);
          if (!codec) {
            failures.push(
              createFailure({
                code: 'codec-unavailable',
                message: dataTableMessages.matrix.targetCodecUnavailable,
                source,
                target
              })
            );
          } else {
            const rawDraft = parsed.matrix[sourceRowIndex]?.[sourceColumnIndex] ?? '';
            const parseResult = codec.parse(rawDraft, currentRow);
            if (parseResult.status === 'invalid') {
              failures.push(
                createFailure({
                  code: 'parse',
                  message: parseResult.errors.join(' '),
                  source,
                  target
                })
              );
            } else {
              const validationErrors = codec.validate(parseResult.value, currentRow);
              if (validationErrors.length > 0) {
                failures.push(
                  createFailure({
                    code: 'validate',
                    message: validationErrors.join(' '),
                    source,
                    target
                  })
                );
              } else {
                const field = targetColumn.editableCell.field;
                const previousValue = currentRow[field];
                const value = freezeValue(parseResult.value);
                if (areValuesEqual(previousValue, value)) {
                  skipped.push(
                    Object.freeze({
                      code: 'unchanged' as const,
                      source,
                      target: target as DataTableMatrixPasteSkipped['target']
                    })
                  );
                } else {
                  operations.push(
                    Object.freeze({
                      source,
                      target: target as DataTableMatrixPasteOperation<TData>['target'],
                      field,
                      previousValue: freezeValue(previousValue),
                      value,
                      editableCell: targetColumn.editableCell
                    })
                  );
                  setRowField(currentRow, field, value);
                }
              }
            }
          }
        }
      }

      processedCells += 1;
      if (
        processedCells < parsed.cellCount &&
        yieldEvery > 0 &&
        processedCells % yieldEvery === 0
      ) {
        await yieldControl();
        if (signal?.aborted) {
          addAbortedFailure();
          break;
        }
      }
    }
  }

  return freezePlan({
    revision,
    sourceShape,
    targetAnchor: anchor,
    operations,
    failures,
    skipped
  });
}
