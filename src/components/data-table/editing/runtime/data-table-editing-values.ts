import { dataTableMessages } from '@/config/data-table-messages';
import type {
  DataTableActiveEditingParseState,
  DataTableEditCodec,
  DataTableEditableColumnMeta,
  DataTableEditingCellCoordinate
} from '../types';

import type { EditableField } from './types';

export function getServerCellErrorKey(rowId: string, field: string): string {
  return `${rowId}\u0000${field}`;
}

export function areEditableValuesEqual(left: unknown, right: unknown) {
  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) {
      return false;
    }

    return left.every((value, index) => Object.is(value, right[index]));
  }

  return Object.is(left, right);
}

export function areServerValuesEqual(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (left instanceof Date || right instanceof Date) {
    return left instanceof Date && right instanceof Date && left.getTime() === right.getTime();
  }
  if (Array.isArray(left) || Array.isArray(right)) {
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => areServerValuesEqual(value, right[index]))
    );
  }
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') {
    return false;
  }

  const leftRecord = left as Record<string, unknown>;
  const rightRecord = right as Record<string, unknown>;
  const leftKeys = Object.keys(leftRecord);
  const rightKeys = Object.keys(rightRecord);
  return (
    leftKeys.length === rightKeys.length &&
    leftKeys.every(
      (key) =>
        Object.prototype.hasOwnProperty.call(rightRecord, key) &&
        areServerValuesEqual(leftRecord[key], rightRecord[key])
    )
  );
}

export function cloneRow<TData>(row: TData): TData {
  return Object.assign({}, row) as TData;
}

export function setRowField<TData>(row: TData, field: EditableField<TData>, value: unknown) {
  (row as Record<string, unknown>)[field] = value;
}

export function uniqueRowIds(rowIds: readonly string[]) {
  return [...new Set(rowIds)];
}

export function isSameEditingCell(
  left: DataTableEditingCellCoordinate | null,
  right: DataTableEditingCellCoordinate | null
) {
  return Boolean(left && right && left.rowId === right.rowId && left.columnId === right.columnId);
}

export function getEditableCodec<TData>(
  editableCell: DataTableEditableColumnMeta<TData>
): DataTableEditCodec<TData, unknown> | null {
  const codec = editableCell.codec as Partial<DataTableEditCodec<TData, unknown>> | undefined;
  return codec &&
    typeof codec.formatForEdit === 'function' &&
    typeof codec.parse === 'function' &&
    typeof codec.validate === 'function'
    ? (codec as DataTableEditCodec<TData, unknown>)
    : null;
}

export function resolveActiveEditingParseState<TData>(
  editableCell: DataTableEditableColumnMeta<TData>,
  draftValue: unknown,
  row: TData,
  shouldParse = true
): DataTableActiveEditingParseState {
  if (!shouldParse) {
    return {
      parseState: 'unparsed',
      validationErrors: []
    };
  }

  const codec = getEditableCodec(editableCell);
  if (!codec) {
    return {
      parseState: 'invalid',
      validationErrors: [dataTableMessages.editing.codecUnavailable]
    };
  }
  const parseResult = codec.parse(draftValue, row);
  if (parseResult.status === 'invalid') {
    return {
      parseState: 'invalid',
      validationErrors: parseResult.errors
    };
  }

  const validationErrors = codec.validate(parseResult.value, row);
  if (validationErrors.length > 0) {
    return {
      parseState: 'invalid',
      candidateValue: parseResult.value,
      validationErrors
    };
  }

  return {
    parseState: 'valid',
    candidateValue: parseResult.value,
    validationErrors: []
  };
}

export { isDataTableChoiceValue } from '../choice/model';
