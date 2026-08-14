import { createElement } from 'react';

import { DataTableEditableChoiceCell } from '@/components/data-table/editing/cells/data-table-editable-choice-cell';
import { DataTableEditableSwitchCell } from '@/components/data-table/editing/cells/data-table-editable-value-cell';
import type {
  AdapterResolvedEditableCellMeta,
  EditableCellRendererContext,
  EditableDisplayFormatterContext,
  EnabledEditableTypeAdapter,
  ResolveDataTableEditableCellContext
} from '@/components/data-table/editing/data-table-edit-contracts';
import {
  createChoiceEditCodec,
  createSwitchEditCodec
} from '@/components/data-table/editing/codecs/data-table-choice-edit-codecs';
import type {
  DataTableChoiceValue,
  DataTableEditableChoiceColumnMeta,
  DataTableEditableColumnMeta
} from '@/types/data-table';

function resolveChoiceEditOptions<TData>(context: ResolveDataTableEditableCellContext<TData>) {
  const selectionMode = context.edit?.selectionMode ?? 'single';
  const allowEmpty = context.edit?.allowEmpty ?? true;
  const maxSelected = context.edit?.maxSelected;
  if (
    selectionMode === 'multiple' &&
    maxSelected !== undefined &&
    (!Number.isInteger(maxSelected) || maxSelected <= 0)
  ) {
    throw new Error('DataTable editable choice maxSelected must be a positive integer.');
  }
  return { selectionMode, allowEmpty, maxSelected };
}

export function createChoiceAdapter(
  type: 'enum' | 'select' | 'remoteSelect'
): EnabledEditableTypeAdapter {
  return {
    editor: 'choice',
    resolve: <TData>(
      context: ResolveDataTableEditableCellContext<TData>
    ): AdapterResolvedEditableCellMeta<TData> | null => {
      if (context.edit?.control === 'switch') {
        const { checkedValue, uncheckedValue } = context.edit;
        if (checkedValue === undefined || uncheckedValue === undefined) return null;
        if (Object.is(checkedValue, uncheckedValue)) {
          throw new Error('DataTable editable switch values must be different.');
        }
        if (type === 'remoteSelect') {
          throw new Error('DataTable remoteSelect does not support the switch control.');
        }
        const codec = createSwitchEditCodec<TData>({ checkedValue, uncheckedValue });
        const optionByValue = new Map(
          (context.valueOptions ?? []).map((option) => [option.value, option.label])
        );
        const editableCell: DataTableEditableColumnMeta<TData> = {
          field: context.field,
          title: context.title,
          type,
          editor: 'switch',
          codec,
          invalidEditBehavior: 'revert',
          commitMode: 'selection',
          allowEmpty: false,
          checkedValue,
          uncheckedValue,
          checkedLabel:
            context.edit.checkedLabel ?? optionByValue.get(checkedValue) ?? String(checkedValue),
          uncheckedLabel:
            context.edit.uncheckedLabel ??
            optionByValue.get(uncheckedValue) ??
            String(uncheckedValue)
        };
        return { editableCell };
      }

      const edit = resolveChoiceEditOptions(context);
      const codec = createChoiceEditCodec<TData>({
        ...edit,
        valueOptions: context.valueOptions?.map((option) => option.value),
        parseJson: type === 'remoteSelect'
      });
      const editableCell: DataTableEditableChoiceColumnMeta<TData> = {
        field: context.field,
        title: context.title,
        type,
        editor: 'choice',
        codec,
        invalidEditBehavior: 'revert',
        commitMode: edit.selectionMode === 'single' ? 'selection' : 'blur',
        ...edit,
        valueOptions: context.valueOptions,
        remoteOptions: context.remoteOptions
      };
      return {
        editableCell,
        editableChoice: editableCell,
        copyValue: (value) =>
          edit.selectionMode === 'multiple' || type === 'remoteSelect'
            ? JSON.stringify(
                value ?? (edit.selectionMode === 'multiple' ? ([] as DataTableChoiceValue[]) : null)
              )
            : (value ?? '')
      };
    },
    renderCell: <TData>({
      context,
      formattedValue,
      className
    }: EditableCellRendererContext<TData>) => {
      const editableCell = context.column.columnDef.meta?.editableCell;
      const Component =
        editableCell?.editor === 'switch'
          ? DataTableEditableSwitchCell
          : DataTableEditableChoiceCell;
      return createElement(Component<TData, unknown>, {
        context,
        formattedValue,
        className
      });
    },
    resolveFormattedValue: <TData>({
      value,
      row,
      columnFormatter
    }: EditableDisplayFormatterContext<TData>) => columnFormatter?.(value, row)
  };
}
