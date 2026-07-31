import { createElement, type ReactNode } from 'react';
import type { CellContext } from '@tanstack/react-table';

import { DataTableEditableChoiceCell } from '@/components/data-table/cells/data-table-editable-choice-cell';
import { DataTableEditableDateCell } from '@/components/data-table/cells/data-table-editable-date-cell';
import { DataTableEditableDateTimeCell } from '@/components/data-table/cells/data-table-editable-date-time-cell';
import { DataTableEditableNumberCell } from '@/components/data-table/cells/data-table-editable-number-cell';
import { DataTableEditableTextareaCell } from '@/components/data-table/cells/data-table-editable-textarea-cell';
import {
  DataTableEditableInputCell,
  DataTableEditableSwitchCell
} from '@/components/data-table/cells/data-table-editable-value-cell';
import {
  createDateEditCodec,
  createDateTimeEditCodec,
  createLegacyChoiceEditCodec,
  createLegacySwitchEditCodec,
  createLegacyTextEditCodec,
  createLongTextEditCodec,
  createNumericEditCodec
} from '@/components/data-table/columns/data-table-edit-codecs';
import { parseDataTableDateValue } from '@/components/data-table/columns/data-table-edit-codecs';
import { resolveDataTableTimeZone } from '@/components/data-table/columns/data-table-time-zone';
import type {
  DataTableChoiceOption,
  DataTableChoiceValue,
  DataTableEditCodec,
  DataTableEditableChoiceColumnMeta,
  DataTableEditableColumnMeta,
  DataTableEditableDateColumnMeta,
  DataTableEditableDateTimeColumnMeta,
  DataTableEditableNumberColumnMeta,
  DataTableEditableNumericType,
  DataTableEditableTextareaColumnMeta,
  DataTableInvalidEditBehavior,
  DataTableDateValue,
  DataTableDateTimeGranularity,
  DataTableDateTimeValueKind,
  DataTableTimeZoneSource,
  DataTableRemoteOptions,
  PlannedEditableType
} from '@/types/data-table';

export const PLANNED_EDITABLE_TYPES = [
  'text',
  'enum',
  'select',
  'remoteSelect',
  'longText',
  'number',
  'int',
  'decimal',
  'money',
  'percent',
  'date',
  'dateTime'
] as const satisfies readonly PlannedEditableType[];

type EditableRuntimeEditOptions = {
  control?: 'input' | 'combobox' | 'switch' | 'textarea';
  selectionMode?: 'single' | 'multiple';
  allowEmpty?: boolean;
  maxSelected?: number;
  checkedValue?: DataTableChoiceValue;
  uncheckedValue?: DataTableChoiceValue;
  checkedLabel?: string;
  uncheckedLabel?: string;
  inputType?: 'text' | 'tel' | 'email' | 'url' | 'search';
  inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
  placeholder?: string;
  emptyValue?: '' | null;
  minLength?: number;
  maxLength?: number;
  rows?: number;
  cols?: number;
  min?: number | string;
  max?: number | string;
  step?: number | 'any';
  maxFractionDigits?: number;
  allowScientificNotation?: boolean;
  preventStepping?: boolean;
  showStepperButtons?: boolean;
  currency?: string;
  currencyDisplay?: 'symbol' | 'narrowSymbol' | 'code';
  accounting?: boolean;
  isDateUnavailable?: (value: string, row: never) => boolean;
  valueKind?: DataTableDateTimeValueKind;
  timeZone?: string;
  granularity?: DataTableDateTimeGranularity;
  hourCycle?: 12 | 24;
  defaultTime?: 'now' | '00:00' | string;
  invalidEditBehavior?: DataTableInvalidEditBehavior;
};

export interface ResolveDataTableEditableCellContext<TData> {
  type: PlannedEditableType;
  field: Extract<keyof TData, string>;
  title: string;
  tableId?: string;
  tableTimeZone?: string;
  appTimeZone?: string;
  edit?: Readonly<EditableRuntimeEditOptions>;
  valueOptions?: readonly DataTableChoiceOption[];
  remoteOptions?: DataTableRemoteOptions<DataTableChoiceValue>;
}

type EditableCellRendererContext<TData> = {
  context: CellContext<TData, unknown>;
  formattedValue?: unknown;
  className?: string;
};

type EditableDisplayFormatterContext<TData> = {
  value: unknown;
  row: TData;
  editableCell?: DataTableEditableColumnMeta<TData>;
  columnFormatter?: (value: unknown, row: TData) => unknown;
  typeFormatter?: (value: unknown, row: TData) => unknown;
  fallbackFormatter: () => unknown;
};

type ResolvedEditableCellMeta<TData> = {
  editableCell: DataTableEditableColumnMeta<TData> & {
    codec: DataTableEditCodec<TData, unknown>;
  };
  editableChoice?: DataTableEditableChoiceColumnMeta<TData>;
  copyValue?: (value: unknown, row: TData) => unknown;
};

interface EnabledEditableTypeAdapter {
  editor: string;
  createCodec<TData>(
    context: ResolveDataTableEditableCellContext<TData>
  ): DataTableEditCodec<TData, unknown> | null;
  resolveMeta<TData>(
    context: ResolveDataTableEditableCellContext<TData>,
    codec: DataTableEditCodec<TData, unknown>
  ): ResolvedEditableCellMeta<TData>;
  renderCell<TData>(context: EditableCellRendererContext<TData>): ReactNode;
  resolveFormattedValue<TData>(context: EditableDisplayFormatterContext<TData>): unknown;
}

function resolveTextEditOptions(edit?: Readonly<EditableRuntimeEditOptions>) {
  return {
    allowEmpty: edit?.allowEmpty ?? true,
    inputType: edit?.inputType ?? 'text',
    inputMode: edit?.inputMode,
    placeholder: edit?.placeholder,
    maxLength: edit?.maxLength
  };
}

const textAdapter: EnabledEditableTypeAdapter = {
  editor: 'input',
  createCodec: <TData>(context: ResolveDataTableEditableCellContext<TData>) => {
    const edit = resolveTextEditOptions(context.edit);
    return createLegacyTextEditCodec<TData>({
      allowEmpty: edit.allowEmpty
    }) as DataTableEditCodec<TData, unknown>;
  },
  resolveMeta: <TData>(
    context: ResolveDataTableEditableCellContext<TData>,
    codec: DataTableEditCodec<TData, unknown>
  ) => {
    const edit = resolveTextEditOptions(context.edit);
    const editableCell: DataTableEditableColumnMeta<TData> = {
      field: context.field,
      title: context.title,
      type: 'text',
      editor: 'input',
      codec: codec as DataTableEditCodec<TData, string | null | undefined>,
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
  resolveFormattedValue: <TData>({
    value,
    row,
    columnFormatter,
    typeFormatter,
    fallbackFormatter
  }: EditableDisplayFormatterContext<TData>) =>
    columnFormatter?.(value, row) ?? typeFormatter?.(value, row) ?? fallbackFormatter()
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

function resolveTextareaEditOptions(edit?: Readonly<EditableRuntimeEditOptions>) {
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

const longTextAdapter: EnabledEditableTypeAdapter = {
  editor: 'textarea',
  createCodec: <TData>(context: ResolveDataTableEditableCellContext<TData>) => {
    const edit = resolveTextareaEditOptions(context.edit);
    return createLongTextEditCodec<TData>(edit) as DataTableEditCodec<TData, unknown>;
  },
  resolveMeta: <TData>(
    context: ResolveDataTableEditableCellContext<TData>,
    codec: DataTableEditCodec<TData, unknown>
  ) => {
    const edit = resolveTextareaEditOptions(context.edit);
    const editableCell: DataTableEditableTextareaColumnMeta<TData> = {
      field: context.field,
      title: context.title,
      type: 'longText',
      editor: 'textarea',
      codec: codec as DataTableEditCodec<TData, string | null | undefined>,
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
  resolveFormattedValue: <TData>({
    value,
    row,
    columnFormatter,
    typeFormatter,
    fallbackFormatter
  }: EditableDisplayFormatterContext<TData>) =>
    columnFormatter?.(value, row) ?? typeFormatter?.(value, row) ?? fallbackFormatter()
};

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

function resolveNumericEditOptions(
  type: DataTableEditableNumericType,
  edit?: Readonly<EditableRuntimeEditOptions>
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

function createNumericAdapter(type: DataTableEditableNumericType): EnabledEditableTypeAdapter {
  return {
    editor: 'number',
    createCodec: <TData>(context: ResolveDataTableEditableCellContext<TData>) => {
      const edit = resolveNumericEditOptions(type, context.edit);
      return createNumericEditCodec<TData>({
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
      }) as DataTableEditCodec<TData, unknown>;
    },
    resolveMeta: <TData>(
      context: ResolveDataTableEditableCellContext<TData>,
      codec: DataTableEditCodec<TData, unknown>
    ): ResolvedEditableCellMeta<TData> => {
      const edit = resolveNumericEditOptions(type, context.edit);
      const numericCodec = codec as DataTableEditCodec<TData, number | null | undefined>;
      const editableCell: DataTableEditableNumberColumnMeta<TData> = {
        field: context.field,
        title: context.title,
        type,
        editor: 'number',
        codec: numericCodec,
        commitMode: 'blur',
        ...edit
      };
      return {
        editableCell,
        copyValue: (value, row) =>
          value == null ? '-' : numericCodec.formatForEdit(value as number, row)
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

export function percentPoints(value: number) {
  return value / 100;
}

function resolveDateEditOptions<TData>(edit?: Readonly<EditableRuntimeEditOptions>) {
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

const dateAdapter: EnabledEditableTypeAdapter = {
  editor: 'date',
  createCodec: <TData>(context: ResolveDataTableEditableCellContext<TData>) => {
    const edit = resolveDateEditOptions<TData>(context.edit);
    return createDateEditCodec<TData>(edit) as DataTableEditCodec<TData, unknown>;
  },
  resolveMeta: <TData>(
    context: ResolveDataTableEditableCellContext<TData>,
    codec: DataTableEditCodec<TData, unknown>
  ) => {
    const edit = resolveDateEditOptions<TData>(context.edit);
    const editableCell: DataTableEditableDateColumnMeta<TData> = {
      field: context.field,
      title: context.title,
      type: 'date',
      editor: 'date',
      codec: codec as DataTableEditCodec<TData, DataTableDateValue | null>,
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

type ResolvedDateTimeEditOptions = {
  valueKind: DataTableDateTimeValueKind;
  timeZone?: string;
  timeZoneSource?: DataTableTimeZoneSource;
  granularity: DataTableDateTimeGranularity;
  step: number;
  hourCycle: 12 | 24;
  defaultTime: 'now' | string;
  min?: string;
  max?: string;
  allowEmpty: boolean;
  emptyValue: null;
  invalidEditBehavior: DataTableInvalidEditBehavior;
};

const dateTimeOptionsByCodec = new WeakMap<object, ResolvedDateTimeEditOptions>();

function normalizeDateTimeDefaultTime(
  value: string | undefined,
  granularity: DataTableDateTimeGranularity
) {
  if (value === 'now') return value;
  const fallback = granularity === 'second' ? '00:00:00' : '00:00';
  if (value === undefined || value === '00:00') return fallback;
  const pattern = granularity === 'second' ? /^\d{2}:\d{2}(?::\d{2})?$/ : /^\d{2}:\d{2}$/;
  if (!pattern.test(value)) {
    throw new Error(`DataTable editable dateTime defaultTime must match ${fallback}.`);
  }
  const normalized = granularity === 'second' && value.length === 5 ? `${value}:00` : value;
  const [hour, minute, second = '0'] = normalized.split(':');
  if (Number(hour) > 23 || Number(minute) > 59 || Number(second) > 59) {
    throw new Error(`DataTable editable dateTime defaultTime must match ${fallback}.`);
  }
  return normalized;
}

function resolveDateTimeEditOptions<TData>(
  context: ResolveDataTableEditableCellContext<TData>
): ResolvedDateTimeEditOptions | null {
  const edit = context.edit;
  if (edit?.valueKind !== 'instant' && edit?.valueKind !== 'local') {
    throw new Error('DataTable editable dateTime requires valueKind "instant" or "local".');
  }
  const granularity = edit.granularity ?? 'minute';
  const step = edit.step ?? 1;
  if (typeof step !== 'number' || !Number.isInteger(step) || step <= 0) {
    throw new Error('DataTable editable dateTime step must be a positive integer.');
  }
  const hourCycle = edit.hourCycle ?? 24;
  if (hourCycle !== 12 && hourCycle !== 24) {
    throw new Error('DataTable editable dateTime hourCycle must be 12 or 24.');
  }
  if (edit.valueKind === 'local' && edit.timeZone !== undefined) {
    throw new Error('DataTable local dateTime must not configure a time zone.');
  }

  let timeZone: string | undefined;
  let timeZoneSource: DataTableTimeZoneSource | undefined;
  if (edit.valueKind === 'instant') {
    try {
      const resolved = resolveDataTableTimeZone({
        columnTimeZone: edit.timeZone,
        tableTimeZone: context.tableTimeZone,
        appTimeZone: context.appTimeZone,
        tableId: context.tableId,
        columnId: context.field
      });
      timeZone = resolved.timeZone;
      timeZoneSource = resolved.source;
    } catch (error) {
      if (!import.meta.env.PROD) throw error;
      console.error(error);
      return null;
    }
  }

  return {
    valueKind: edit.valueKind,
    timeZone,
    timeZoneSource,
    granularity,
    step,
    hourCycle,
    defaultTime: normalizeDateTimeDefaultTime(edit.defaultTime, granularity),
    min: typeof edit.min === 'string' ? edit.min : undefined,
    max: typeof edit.max === 'string' ? edit.max : undefined,
    allowEmpty: edit.allowEmpty ?? true,
    emptyValue: null,
    invalidEditBehavior: edit.invalidEditBehavior ?? 'block'
  };
}

const dateTimeAdapter: EnabledEditableTypeAdapter = {
  editor: 'dateTime',
  createCodec: <TData>(context: ResolveDataTableEditableCellContext<TData>) => {
    const edit = resolveDateTimeEditOptions(context);
    if (!edit) return null;
    const codec = createDateTimeEditCodec<TData>(edit) as DataTableEditCodec<TData, unknown>;
    dateTimeOptionsByCodec.set(codec, edit);
    return codec;
  },
  resolveMeta: <TData>(
    context: ResolveDataTableEditableCellContext<TData>,
    codec: DataTableEditCodec<TData, unknown>
  ) => {
    const edit = dateTimeOptionsByCodec.get(codec);
    if (!edit) {
      throw new Error(
        `DataTable dateTime codec metadata is missing for column "${context.field}".`
      );
    }
    const editableCell: DataTableEditableDateTimeColumnMeta<TData> = {
      field: context.field,
      title: context.title,
      type: 'dateTime',
      editor: 'dateTime',
      codec: codec as DataTableEditCodec<TData, string | null>,
      commitMode: 'explicit-confirm',
      ...edit
    };
    const dateTimeCodec = codec as DataTableEditCodec<TData, string | null>;
    return {
      editableCell,
      copyValue: (value: unknown, row: TData) =>
        value == null ? '' : dateTimeCodec.formatForEdit(value as string, row)
    };
  },
  renderCell: <TData>({ context, formattedValue, className }: EditableCellRendererContext<TData>) =>
    createElement(DataTableEditableDateTimeCell<TData, unknown>, {
      context,
      formattedValue,
      className
    }),
  resolveFormattedValue: <TData>({
    value,
    row,
    editableCell,
    columnFormatter,
    fallbackFormatter
  }: EditableDisplayFormatterContext<TData>) => {
    if (columnFormatter) return columnFormatter(value, row);
    if (editableCell?.editor !== 'dateTime') return fallbackFormatter();
    const formatted = editableCell.codec.formatForEdit(value as string | null, row) as unknown;
    return formatted;
  }
};

function resolveChoiceEditOptions(edit?: Readonly<EditableRuntimeEditOptions>) {
  const selectionMode = edit?.selectionMode ?? 'single';
  const allowEmpty = edit?.allowEmpty ?? true;
  const maxSelected = edit?.maxSelected;
  if (
    selectionMode === 'multiple' &&
    maxSelected !== undefined &&
    (!Number.isInteger(maxSelected) || maxSelected <= 0)
  ) {
    throw new Error('DataTable editable choice maxSelected must be a positive integer.');
  }
  return { selectionMode, allowEmpty, maxSelected };
}

function createChoiceAdapter(type: 'enum' | 'select' | 'remoteSelect'): EnabledEditableTypeAdapter {
  return {
    editor: 'choice',
    createCodec: <TData>(context: ResolveDataTableEditableCellContext<TData>) => {
      if (context.edit?.control === 'switch') {
        const { checkedValue, uncheckedValue } = context.edit;
        if (checkedValue === undefined || uncheckedValue === undefined) return null;
        return createLegacySwitchEditCodec<TData>({
          checkedValue,
          uncheckedValue
        }) as DataTableEditCodec<TData, unknown>;
      }

      const edit = resolveChoiceEditOptions(context.edit);
      return createLegacyChoiceEditCodec<TData>({
        ...edit,
        valueOptions: context.valueOptions?.map((option) => option.value),
        parseJson: type === 'remoteSelect'
      }) as DataTableEditCodec<TData, unknown>;
    },
    resolveMeta: <TData>(
      context: ResolveDataTableEditableCellContext<TData>,
      codec: DataTableEditCodec<TData, unknown>
    ) => {
      if (context.edit?.control === 'switch') {
        const { checkedValue, uncheckedValue } = context.edit;
        if (checkedValue === undefined || uncheckedValue === undefined) {
          throw new Error('DataTable editable switch requires checkedValue and uncheckedValue.');
        }
        if (Object.is(checkedValue, uncheckedValue)) {
          throw new Error('DataTable editable switch values must be different.');
        }
        if (type === 'remoteSelect') {
          throw new Error('DataTable remoteSelect does not support the switch control.');
        }
        const optionByValue = new Map(
          (context.valueOptions ?? []).map((option) => [option.value, option.label])
        );
        const editableCell: DataTableEditableColumnMeta<TData> = {
          field: context.field,
          title: context.title,
          type,
          editor: 'switch',
          codec: codec as DataTableEditCodec<TData, DataTableChoiceValue | null>,
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

      const edit = resolveChoiceEditOptions(context.edit);
      const editableCell: DataTableEditableChoiceColumnMeta<TData> = {
        field: context.field,
        title: context.title,
        type,
        editor: 'choice',
        codec: codec as DataTableEditCodec<
          TData,
          DataTableChoiceValue | DataTableChoiceValue[] | null
        >,
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

export const enabledEditableTypeAdapters = {
  text: textAdapter,
  enum: createChoiceAdapter('enum'),
  select: createChoiceAdapter('select'),
  remoteSelect: createChoiceAdapter('remoteSelect'),
  longText: longTextAdapter,
  number: createNumericAdapter('number'),
  int: createNumericAdapter('int'),
  decimal: createNumericAdapter('decimal'),
  money: createNumericAdapter('money'),
  percent: createNumericAdapter('percent'),
  date: dateAdapter,
  dateTime: dateTimeAdapter
} as const;

export type SupportedEditableType = keyof typeof enabledEditableTypeAdapters;

export type EnabledEditableTypeAdapterRegistry = Readonly<
  Partial<Record<SupportedEditableType, EnabledEditableTypeAdapter>>
>;

export interface ResolvedDataTableEditableCell<TData> {
  columnMeta: ResolvedEditableCellMeta<TData>;
  renderCell(context: EditableCellRendererContext<TData>): ReactNode;
  resolveFormattedValue(context: EditableDisplayFormatterContext<TData>): unknown;
}

export function resolveDataTableEditableCell<TData>(
  context: ResolveDataTableEditableCellContext<TData>,
  registry: EnabledEditableTypeAdapterRegistry = enabledEditableTypeAdapters
): ResolvedDataTableEditableCell<TData> | null {
  const adapter = registry[context.type as SupportedEditableType];
  if (!adapter) return null;
  const codec = adapter.createCodec(context);
  if (!codec) return null;
  const resolvedColumnMeta = adapter.resolveMeta(context, codec);
  const columnMeta = resolvedColumnMeta.copyValue
    ? resolvedColumnMeta
    : {
        ...resolvedColumnMeta,
        copyValue: (value: unknown, row: TData) => codec.formatForEdit(value, row)
      };

  return {
    columnMeta,
    renderCell: adapter.renderCell,
    resolveFormattedValue: (formatterContext) =>
      adapter.resolveFormattedValue({
        ...formatterContext,
        editableCell: columnMeta.editableCell
      })
  };
}
