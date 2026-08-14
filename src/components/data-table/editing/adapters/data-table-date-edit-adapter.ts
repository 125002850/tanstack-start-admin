import { createElement } from 'react';

import { DataTableEditableDateCell } from '@/components/data-table/editing/cells/data-table-editable-date-cell';
import type {
  AdapterResolvedEditableCellMeta,
  EditableCellRendererContext,
  EditableDisplayFormatterContext,
  EditableRuntimeEditOptions,
  EnabledEditableTypeAdapter,
  ResolveDataTableEditableCellContext
} from '@/components/data-table/editing/data-table-edit-contracts';
import {
  createDateEditCodec,
  parseDataTableDateValue
} from '@/components/data-table/editing/codecs/data-table-date-edit-codec';
import type { DataTableDateValue, DataTableEditableDateColumnMeta } from '@/types/data-table';

function resolveDateEditOptions<TData>(edit?: Readonly<EditableRuntimeEditOptions<TData>>) {
  const min = edit?.min === undefined ? undefined : parseDataTableDateValue(edit.min)?.value;
  const max = edit?.max === undefined ? undefined : parseDataTableDateValue(edit.max)?.value;
  if (edit?.min !== undefined && min === undefined) {
    throw new Error('DataTable editable date min must be a valid YYYY-MM-DD string.');
  }
  if (edit?.max !== undefined && max === undefined) {
    throw new Error('DataTable editable date max must be a valid YYYY-MM-DD string.');
  }
  if (min !== undefined && max !== undefined && min > max) {
    throw new Error('DataTable editable date min cannot exceed max.');
  }
  return {
    allowEmpty: edit?.allowEmpty ?? true,
    emptyValue: null,
    min,
    max,
    isDateUnavailable: edit?.isDateUnavailable as
      | ((value: DataTableDateValue, row: TData) => boolean)
      | undefined,
    invalidEditBehavior: edit?.invalidEditBehavior ?? ('block' as const)
  };
}

export const dateAdapter: EnabledEditableTypeAdapter = {
  editor: 'date',
  resolve: <TData>(
    context: ResolveDataTableEditableCellContext<TData>
  ): AdapterResolvedEditableCellMeta<TData> => {
    const edit = resolveDateEditOptions(context.edit);
    const codec = createDateEditCodec<TData>(edit);
    const editableCell: DataTableEditableDateColumnMeta<TData> = {
      field: context.field,
      title: context.title,
      type: 'date',
      editor: 'date',
      codec,
      commitMode: 'blur',
      ...edit
    };
    return { editableCell };
  },
  renderCell: <TData>({ context, formattedValue, className }: EditableCellRendererContext<TData>) =>
    createElement(DataTableEditableDateCell<TData, unknown>, {
      context,
      formattedValue,
      className
    }),
  resolveFormattedValue: <TData>({
    value,
    row,
    columnFormatter,
    typeFormatter,
    fallbackFormatter
  }: EditableDisplayFormatterContext<TData>) =>
    columnFormatter?.(value, row) ?? typeFormatter?.(value, row) ?? fallbackFormatter()
};
