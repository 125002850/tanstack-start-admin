import type { CellContext } from '@tanstack/react-table';
import type { ReactNode } from 'react';

import type {
  DataTableChoiceOption,
  DataTableChoiceValue,
  DataTableDateTimeGranularity,
  DataTableDateTimeValueKind,
  DataTableEditCodec,
  DataTableEditableChoiceColumnMeta,
  DataTableEditableColumnMeta,
  DataTableInvalidEditBehavior,
  DataTableRemoteOptions,
  PlannedEditableType
} from '@/types/data-table';

export type EditableRuntimeEditOptions<TData = unknown> = {
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
  isDateUnavailable?: (value: string, row: TData) => boolean;
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
  edit?: Readonly<EditableRuntimeEditOptions<TData>>;
  valueOptions?: readonly DataTableChoiceOption[];
  remoteOptions?: DataTableRemoteOptions<DataTableChoiceValue>;
}

export type EditableCellRendererContext<TData> = {
  context: CellContext<TData, unknown>;
  formattedValue?: unknown;
  className?: string;
};

export type EditableDisplayFormatterContext<TData> = {
  value: unknown;
  row: TData;
  editableCell?: DataTableEditableColumnMeta<TData>;
  columnFormatter?: (value: unknown, row: TData) => unknown;
  typeFormatter?: (value: unknown, row: TData) => unknown;
  fallbackFormatter: () => unknown;
};

export type AdapterResolvedEditableCellMeta<TData> = {
  editableCell: DataTableEditableColumnMeta<TData>;
  editableChoice?: DataTableEditableChoiceColumnMeta<TData>;
  copyValue?: (value: unknown, row: TData) => unknown;
};

export interface EnabledEditableTypeAdapter {
  editor: string;
  resolve<TData>(
    context: ResolveDataTableEditableCellContext<TData>
  ): AdapterResolvedEditableCellMeta<TData> | null;
  renderCell<TData>(context: EditableCellRendererContext<TData>): ReactNode;
  resolveFormattedValue<TData>(context: EditableDisplayFormatterContext<TData>): unknown;
}

export type EnabledEditableTypeAdapterRegistry<TType extends PlannedEditableType> = Readonly<
  Partial<Record<TType, EnabledEditableTypeAdapter>>
>;

export type ResolvedEditableCellMeta<TData> = Omit<
  AdapterResolvedEditableCellMeta<TData>,
  'editableCell'
> & {
  editableCell: DataTableEditableColumnMeta<TData> & {
    codec: DataTableEditCodec<TData, unknown>;
  };
};

export interface ResolvedDataTableEditableCell<TData> {
  columnMeta: ResolvedEditableCellMeta<TData>;
  renderCell(context: EditableCellRendererContext<TData>): ReactNode;
  resolveFormattedValue(context: EditableDisplayFormatterContext<TData>): unknown;
}
