import { createElement } from 'react';

import { DataTableEditableTextareaCell } from '@/components/data-table/editing/cells/data-table-editable-textarea-cell';
import { DataTableEditableInputCell } from '@/components/data-table/editing/cells/data-table-editable-value-cell';
import type {
  AdapterResolvedEditableCellMeta,
  EditableCellRendererContext,
  EditableDisplayFormatterContext,
  EditableRuntimeEditOptions,
  EnabledEditableTypeAdapter,
  ResolveDataTableEditableCellContext
} from '@/components/data-table/editing/contracts';
import {
  createLongTextEditCodec,
  createTextEditCodec
} from '@/components/data-table/editing/codecs/data-table-text-edit-codecs';
import type { DataTableEditableColumnMeta, DataTableEditableTextareaColumnMeta } from '../types';

function resolveFormattedValue<TData>({
  value,
  row,
  columnFormatter,
  typeFormatter,
  fallbackFormatter
}: EditableDisplayFormatterContext<TData>) {
  return columnFormatter?.(value, row) ?? typeFormatter?.(value, row) ?? fallbackFormatter();
}

function resolveTextEditOptions<TData>(edit?: Readonly<EditableRuntimeEditOptions<TData>>) {
  return {
    allowEmpty: edit?.allowEmpty ?? true,
    inputType: edit?.inputType ?? 'text',
    inputMode: edit?.inputMode,
    placeholder: edit?.placeholder,
    maxLength: edit?.maxLength
  };
}

export const textAdapter: EnabledEditableTypeAdapter = {
  editor: 'input',
  resolve: <TData>(
    context: ResolveDataTableEditableCellContext<TData>
  ): AdapterResolvedEditableCellMeta<TData> => {
    const edit = resolveTextEditOptions(context.edit);
    const codec = createTextEditCodec<TData>({ allowEmpty: edit.allowEmpty });
    const editableCell: DataTableEditableColumnMeta<TData> = {
      field: context.field,
      title: context.title,
      type: 'text',
      editor: 'input',
      codec,
      invalidEditBehavior: 'revert',
      commitMode: 'blur',
      ...edit
    };
    return { editableCell };
  },
  renderCell: <TData>({ context, formattedValue, className }: EditableCellRendererContext<TData>) =>
    createElement(DataTableEditableInputCell<TData, unknown>, {
      context,
      formattedValue,
      className
    }),
  resolveFormattedValue
};

function assertOptionalLength(name: string, value: number | undefined) {
  if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
    throw new Error(`DataTable editable longText ${name} must be a non-negative integer.`);
  }
}

function assertOptionalDimension(name: string, value: number | undefined) {
  if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
    throw new Error(`DataTable editable longText ${name} must be a positive integer.`);
  }
}

function resolveTextareaEditOptions<TData>(edit?: Readonly<EditableRuntimeEditOptions<TData>>) {
  if (edit?.control !== 'textarea') {
    throw new Error('DataTable editable longText requires edit.control="textarea".');
  }
  assertOptionalLength('minLength', edit.minLength);
  assertOptionalLength('maxLength', edit.maxLength);
  assertOptionalDimension('rows', edit.rows);
  assertOptionalDimension('cols', edit.cols);
  if (
    edit.minLength !== undefined &&
    edit.maxLength !== undefined &&
    edit.minLength > edit.maxLength
  ) {
    throw new Error('DataTable editable longText minLength cannot exceed maxLength.');
  }

  return {
    control: 'textarea' as const,
    allowEmpty: edit.allowEmpty ?? true,
    emptyValue: edit.emptyValue === undefined ? ('' as const) : edit.emptyValue,
    minLength: edit.minLength,
    maxLength: edit.maxLength,
    rows: edit.rows ?? 6,
    cols: edit.cols,
    invalidEditBehavior: edit.invalidEditBehavior ?? ('block' as const)
  };
}

export const longTextAdapter: EnabledEditableTypeAdapter = {
  editor: 'textarea',
  resolve: <TData>(
    context: ResolveDataTableEditableCellContext<TData>
  ): AdapterResolvedEditableCellMeta<TData> => {
    const edit = resolveTextareaEditOptions(context.edit);
    const codec = createLongTextEditCodec<TData>(edit);
    const editableCell: DataTableEditableTextareaColumnMeta<TData> = {
      field: context.field,
      title: context.title,
      type: 'longText',
      editor: 'textarea',
      codec,
      commitMode: 'explicit-confirm',
      ...edit
    };
    return { editableCell };
  },
  renderCell: <TData>({ context, formattedValue, className }: EditableCellRendererContext<TData>) =>
    createElement(DataTableEditableTextareaCell<TData, unknown>, {
      context,
      formattedValue,
      className
    }),
  resolveFormattedValue
};
