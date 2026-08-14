import { createElement } from 'react';

import { DataTableEditableNumberCell } from '@/components/data-table/editing/cells/data-table-editable-number-cell';
import type {
  AdapterResolvedEditableCellMeta,
  EditableCellRendererContext,
  EditableDisplayFormatterContext,
  EditableRuntimeEditOptions,
  EnabledEditableTypeAdapter,
  ResolveDataTableEditableCellContext
} from '@/components/data-table/editing/data-table-edit-contracts';
import { createNumericEditCodec } from '@/components/data-table/editing/codecs/data-table-numeric-edit-codec';
import type {
  DataTableEditableNumberColumnMeta,
  DataTableEditableNumericType
} from '@/types/data-table';

function assertFiniteNumericOption(name: string, value: number | undefined) {
  if (value !== undefined && !Number.isFinite(value)) {
    throw new Error(`DataTable editable numeric ${name} must be finite.`);
  }
}

function getCurrencyConfig(currency: string, currencyDisplay: 'symbol' | 'narrowSymbol' | 'code') {
  let formatter: Intl.NumberFormat;
  try {
    formatter = new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency,
      currencyDisplay
    });
  } catch {
    throw new Error(`DataTable editable money currency "${currency}" is invalid.`);
  }
  const parts = formatter.formatToParts(0);
  const currencyIndex = parts.findIndex((part) => part.type === 'currency');
  const integerIndex = parts.findIndex((part) => part.type === 'integer');
  const currencyPart = parts[currencyIndex]?.value;
  return {
    formatter,
    prefix: currencyIndex >= 0 && currencyIndex < integerIndex ? currencyPart : undefined,
    suffix: currencyIndex > integerIndex ? currencyPart : undefined
  };
}

function resolveNumericEditOptions<TData>(
  type: DataTableEditableNumericType,
  edit?: Readonly<EditableRuntimeEditOptions<TData>>
) {
  const min = typeof edit?.min === 'number' ? edit.min : undefined;
  const max = typeof edit?.max === 'number' ? edit.max : undefined;
  if (edit?.min !== undefined && min === undefined) {
    throw new Error('DataTable editable numeric min must be finite.');
  }
  if (edit?.max !== undefined && max === undefined) {
    throw new Error('DataTable editable numeric max must be finite.');
  }
  assertFiniteNumericOption('min', min);
  assertFiniteNumericOption('max', max);
  if (min !== undefined && max !== undefined && min > max) {
    throw new Error('DataTable editable numeric min cannot exceed max.');
  }
  if (
    edit?.step !== undefined &&
    edit.step !== 'any' &&
    (!Number.isFinite(edit.step) || edit.step <= 0)
  ) {
    throw new Error('DataTable editable numeric step must be a positive finite number or "any".');
  }
  if (
    edit?.maxFractionDigits !== undefined &&
    (!Number.isInteger(edit.maxFractionDigits) || edit.maxFractionDigits < 0)
  ) {
    throw new Error('DataTable editable numeric maxFractionDigits must be a non-negative integer.');
  }
  if (type !== 'money' && (edit?.currency !== undefined || edit?.accounting !== undefined)) {
    throw new Error('DataTable editable currency options require type="money".');
  }

  const currencyDisplay = edit?.currencyDisplay ?? 'symbol';
  const currencyConfig =
    type === 'money' && edit?.currency
      ? getCurrencyConfig(edit.currency, currencyDisplay)
      : undefined;
  const currencyFractionDigits = currencyConfig?.formatter.resolvedOptions().maximumFractionDigits;
  const defaultMaxFractionDigits =
    type === 'int'
      ? 0
      : type === 'decimal'
        ? 3
        : type === 'money'
          ? (currencyFractionDigits ?? 2)
          : type === 'percent'
            ? 2
            : undefined;

  return {
    allowEmpty: edit?.allowEmpty ?? true,
    emptyValue:
      edit && Object.prototype.hasOwnProperty.call(edit, 'emptyValue')
        ? (edit.emptyValue as null | undefined)
        : null,
    min,
    max,
    step: edit?.step ?? (type === 'int' ? 1 : ('any' as const)),
    maxFractionDigits: edit?.maxFractionDigits ?? defaultMaxFractionDigits,
    allowScientificNotation: edit?.allowScientificNotation ?? false,
    preventStepping: edit?.preventStepping ?? false,
    showStepperButtons: edit?.showStepperButtons ?? false,
    invalidEditBehavior: edit?.invalidEditBehavior ?? ('block' as const),
    currency: type === 'money' ? edit?.currency : undefined,
    currencyDisplay: type === 'money' ? currencyDisplay : undefined,
    accounting: type === 'money' ? (edit?.accounting ?? false) : undefined,
    prefix: type === 'money' ? currencyConfig?.prefix : undefined,
    suffix: type === 'percent' ? '%' : currencyConfig?.suffix
  };
}

export function createNumericAdapter(
  type: DataTableEditableNumericType
): EnabledEditableTypeAdapter {
  return {
    editor: 'number',
    resolve: <TData>(
      context: ResolveDataTableEditableCellContext<TData>
    ): AdapterResolvedEditableCellMeta<TData> => {
      const edit = resolveNumericEditOptions(type, context.edit);
      const codec = createNumericEditCodec<TData>({
        type,
        allowEmpty: edit.allowEmpty,
        emptyValue: edit.emptyValue,
        min: edit.min,
        max: edit.max,
        step: edit.step,
        maxFractionDigits: edit.maxFractionDigits,
        allowScientificNotation: edit.allowScientificNotation,
        currency: edit.currency,
        accounting: edit.accounting
      });
      const editableCell: DataTableEditableNumberColumnMeta<TData> = {
        field: context.field,
        title: context.title,
        type,
        editor: 'number',
        codec,
        commitMode: 'blur',
        ...edit
      };
      return {
        editableCell,
        copyValue: (value, row) => (value == null ? '-' : codec.formatForEdit(value as number, row))
      };
    },
    renderCell: <TData>({
      context,
      formattedValue,
      className
    }: EditableCellRendererContext<TData>) =>
      createElement(DataTableEditableNumberCell<TData, unknown>, {
        context,
        formattedValue,
        className
      }),
    resolveFormattedValue: <TData>({
      value,
      row,
      editableCell,
      columnFormatter,
      typeFormatter,
      fallbackFormatter
    }: EditableDisplayFormatterContext<TData>) => {
      if (columnFormatter) return columnFormatter(value, row);
      if (
        editableCell?.editor === 'number' &&
        editableCell.type === 'money' &&
        editableCell.currency &&
        typeof value === 'number' &&
        Number.isFinite(value)
      ) {
        return new Intl.NumberFormat('zh-CN', {
          style: 'currency',
          currency: editableCell.currency,
          currencyDisplay: editableCell.currencyDisplay,
          currencySign: editableCell.accounting ? 'accounting' : 'standard'
        }).format(value);
      }
      return typeFormatter?.(value, row) ?? fallbackFormatter();
    }
  };
}
