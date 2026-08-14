import type { CellContext, ColumnDef } from '@tanstack/react-table';
import type { ComponentProps, ReactNode } from 'react';

import type { Badge } from '@/components/ui/badge';
import type { ResolveDataTableEditableCellContext } from '@/components/data-table/editing/data-table-edit-adapters';
import type {
  DataTableColumnKey,
  DataTableFieldFormatter,
  DataTableFieldFormatterRule
} from '@/components/data-table/columns/dsl/data-table-column-formatters';
import type { ColumnHeader } from '@/components/data-table/columns/dsl/data-table-column-rendering';
import type { DataTableColumnOptions } from '@/components/data-table/columns/dsl/data-table-column-options';
import type { DataTableColumnTypeRegistry } from '@/components/data-table/columns/dsl/data-table-column-types';
import type { DataTableColumnSize } from '@/config/data-table';
import type {
  DataTableChoiceOption,
  DataTableChoiceValue,
  DataTableColumnAlign,
  DataTableColumnPanelOptions,
  DataTableColumnValueType,
  DataTableDateEditOptions,
  DataTableDateTimeEditOptions,
  DataTableEditableNumericType,
  DataTableMoneyEditOptions,
  DataTableNumericEditOptions,
  DataTableRemoteOptions,
  DataTableRowActionOption,
  DataTableTextareaEditOptions,
  PlannedEditableType
} from '@/types/data-table';

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

export type DataTableColumn<TData> = ColumnDef<TData>;

/** createDataTableColumnDsl 的全局选项。 */
export interface DataTableColumnDslOptions<TData> {
  fieldFormatters?: Array<DataTableFieldFormatterRule<TData>>;
  fallbackFormatValue?: DataTableFieldFormatter<TData>;
  customTypes?: DataTableColumnTypeRegistry<TData>;
  tableId?: string;
  tableTimeZone?: string;
  appTimeZone?: string;
}

interface BaseColumnOptions<TData, TValue = unknown> {
  size?: DataTableColumnSize;
  minSize?: number;
  maxSize?: number;
  enableSorting?: boolean;
  enableHiding?: boolean;
  enableResizing?: boolean;
  meta?: ColumnDef<TData, TValue>['meta'];
  header?: ColumnHeader<TData>;
  /** 表头文字对齐，默认 center；不影响单元格内容对齐。 */
  headerAlign?: DataTableColumnAlign;
  cellClassName?: string;
}

/** 普通字段列配置：负责 accessorKey、筛选/排序 DSL、类型默认值和 cell 渲染。 */
export interface FieldColumnOptions<TData, TKey extends DataTableColumnKey<TData>>
  extends BaseColumnOptions<TData, TData[TKey]>, DataTableColumnOptions<TData, TData[TKey]> {
  type?: DataTableColumnValueType;
  format?: (value: TData[TKey], row: TData) => unknown;
  formatValue?: (value: TData[TKey], row: TData) => unknown;
  renderCell?: (context: CellContext<TData, TData[TKey]>) => ReactNode;
  headerClassName?: string;
}

type SingleChoiceFieldKey<TData> = Extract<
  {
    [K in keyof TData]-?: Exclude<TData[K], null> extends DataTableChoiceValue
      ? TData[K] extends readonly unknown[]
        ? never
        : K
      : never;
  }[keyof TData],
  string
>;

type MultipleChoiceFieldKey<TData> = Extract<
  {
    [K in keyof TData]-?: TData[K] extends Array<infer TValue>
      ? TValue extends DataTableChoiceValue
        ? K
        : never
      : never;
  }[keyof TData],
  string
>;

type TextFieldKey<TData> = Extract<
  {
    [K in keyof TData]-?: Exclude<TData[K], null | undefined> extends string ? K : never;
  }[keyof TData],
  string
>;

type NumericFieldKey<TData> = Extract<
  {
    [K in keyof TData]-?: [Exclude<TData[K], null | undefined>] extends [never]
      ? never
      : Exclude<TData[K], null | undefined> extends number
        ? K
        : never;
  }[keyof TData],
  string
>;

type DateFieldKey<TData> = Extract<
  {
    [K in keyof TData]-?: [Exclude<TData[K], null>] extends [never]
      ? never
      : TData[K] extends string | null
        ? Exclude<TData[K], null> extends string
          ? K
          : never
        : never;
  }[keyof TData],
  string
>;

type SingleChoiceFieldValue<TData, TKey extends keyof TData> = Extract<
  Exclude<TData[TKey], null>,
  DataTableChoiceValue
>;

type MultipleChoiceFieldValue<TData, TKey extends keyof TData> =
  TData[TKey] extends Array<infer TValue> ? Extract<TValue, DataTableChoiceValue> : never;

type StaticChoiceSource<TValue extends DataTableChoiceValue> = {
  type: 'enum' | 'select';
  valueOptions: readonly DataTableChoiceOption<TValue>[];
  remoteOptions?: never;
};

type RemoteChoiceSource<TValue extends DataTableChoiceValue> = {
  type: 'remoteSelect';
  remoteOptions: DataTableRemoteOptions<TValue>;
  valueOptions?: never;
};

type EditableChoiceBaseOptions<TData, TValue> = BaseColumnOptions<TData, TValue> &
  DataTableColumnOptions<TData, TValue> & {
    format?: (value: TValue, row: TData) => unknown;
    formatValue?: (value: TValue, row: TData) => unknown;
    headerClassName?: string;
  };

type EditableInputColumnOptions<
  TData,
  TKey extends TextFieldKey<TData>
> = EditableChoiceBaseOptions<TData, TData[TKey]> & {
  type: 'text';
  edit?: {
    control?: 'input';
    allowEmpty?: boolean;
    inputType?: 'text' | 'tel' | 'email' | 'url' | 'search';
    inputMode?: 'none' | 'text' | 'tel' | 'url' | 'email' | 'numeric' | 'decimal' | 'search';
    placeholder?: string;
    maxLength?: number;
  };
};

type EditableTextareaEdit<TValue> = Omit<DataTableTextareaEditOptions, 'emptyValue'> & {
  emptyValue?: null extends TValue ? '' | null : '';
};

type EditableTextareaColumnOptions<
  TData,
  TKey extends TextFieldKey<TData>
> = EditableChoiceBaseOptions<TData, TData[TKey]> & {
  type: 'longText';
  edit: EditableTextareaEdit<TData[TKey]>;
};

type EditableNumericEditConstraint<TValue, TEdit> = TEdit extends { allowEmpty: false }
  ? 'emptyValue' extends keyof TEdit
    ? never
    : unknown
  : 'emptyValue' extends keyof TEdit
    ? TEdit extends { emptyValue: infer TEmpty }
      ? [TEmpty] extends [null]
        ? null extends TValue
          ? unknown
          : never
        : [TEmpty] extends [undefined]
          ? undefined extends TValue
            ? unknown
            : never
          : never
      : never
    : null extends TValue
      ? unknown
      : never;

type EditableNumericColumnOptions<
  TData,
  TKey extends NumericFieldKey<TData>,
  TType extends Exclude<DataTableEditableNumericType, 'money'>,
  TEdit extends DataTableNumericEditOptions
> = EditableChoiceBaseOptions<TData, TData[TKey]> & {
  type: TType;
} & (null extends TData[TKey]
    ? {
        edit?: TEdit & EditableNumericEditConstraint<TData[TKey], TEdit>;
      }
    : {
        edit: TEdit & EditableNumericEditConstraint<TData[TKey], TEdit>;
      });

type EditableMoneyColumnOptions<
  TData,
  TKey extends NumericFieldKey<TData>,
  TEdit extends DataTableMoneyEditOptions
> = EditableChoiceBaseOptions<TData, TData[TKey]> & {
  type: 'money';
} & (null extends TData[TKey]
    ? {
        edit?: TEdit & EditableNumericEditConstraint<TData[TKey], TEdit>;
      }
    : {
        edit: TEdit & EditableNumericEditConstraint<TData[TKey], TEdit>;
      });

type EditableDateEdit<TData, TValue> = Omit<
  DataTableDateEditOptions<TData>,
  'allowEmpty' | 'emptyValue'
> &
  (null extends TValue
    ?
        | {
            allowEmpty?: true;
            emptyValue?: null;
          }
        | {
            allowEmpty: false;
            emptyValue?: never;
          }
    : {
        allowEmpty: false;
        emptyValue?: never;
      });

type EditableDateColumnOptions<TData, TKey extends DateFieldKey<TData>> = EditableChoiceBaseOptions<
  TData,
  TData[TKey]
> & {
  type: 'date';
} & (null extends TData[TKey]
    ? {
        edit?: EditableDateEdit<TData, TData[TKey]>;
      }
    : {
        edit: EditableDateEdit<TData, TData[TKey]>;
      });

type OmitDateTimeEmptyOptions<TOptions> = TOptions extends DataTableDateTimeEditOptions
  ? Omit<TOptions, 'allowEmpty' | 'emptyValue'>
  : never;

type EditableDateTimeEdit<TValue> = OmitDateTimeEmptyOptions<DataTableDateTimeEditOptions> &
  (null extends TValue
    ?
        | {
            allowEmpty?: true;
            emptyValue?: null;
          }
        | {
            allowEmpty: false;
            emptyValue?: never;
          }
    : {
        allowEmpty: false;
        emptyValue?: never;
      });

type EditableDateTimeColumnOptions<
  TData,
  TKey extends DateFieldKey<TData>
> = EditableChoiceBaseOptions<TData, TData[TKey]> & {
  type: 'dateTime';
  edit: EditableDateTimeEdit<TData[TKey]>;
};

type EditableSingleChoiceEdit = {
  control?: 'combobox';
  selectionMode?: 'single';
  allowEmpty?: boolean;
  maxSelected?: never;
};

type EditableSwitchEdit<TValue extends DataTableChoiceValue> = {
  control: 'switch';
  checkedValue: TValue;
  uncheckedValue: TValue;
  checkedLabel?: string;
  uncheckedLabel?: string;
  selectionMode?: never;
  allowEmpty?: never;
  maxSelected?: never;
};

type EditableSingleColumnOptions<
  TData,
  TKey extends SingleChoiceFieldKey<TData>
> = EditableChoiceBaseOptions<TData, TData[TKey]> &
  (
    | ((
        | StaticChoiceSource<SingleChoiceFieldValue<TData, TKey>>
        | RemoteChoiceSource<SingleChoiceFieldValue<TData, TKey>>
      ) & {
        edit?: EditableSingleChoiceEdit;
      })
    | (StaticChoiceSource<SingleChoiceFieldValue<TData, TKey>> & {
        edit: EditableSwitchEdit<SingleChoiceFieldValue<TData, TKey>>;
      })
  );

type EditableMultipleColumnOptions<
  TData,
  TKey extends MultipleChoiceFieldKey<TData>
> = EditableChoiceBaseOptions<TData, TData[TKey]> &
  (
    | StaticChoiceSource<MultipleChoiceFieldValue<TData, TKey>>
    | RemoteChoiceSource<MultipleChoiceFieldValue<TData, TKey>>
  ) & {
    edit: {
      selectionMode: 'multiple';
      allowEmpty?: boolean;
      maxSelected?: number;
    };
  };

export type EditableRuntimeOptions<TData> = EditableChoiceBaseOptions<TData, unknown> & {
  type: PlannedEditableType;
  valueOptions?: readonly DataTableChoiceOption<DataTableChoiceValue>[];
  remoteOptions?: DataTableRemoteOptions<DataTableChoiceValue>;
  edit?: ResolveDataTableEditableCellContext<TData>['edit'];
};

export interface DataTableFieldBuilder<TData> {
  <TKey extends DataTableColumnKey<TData>>(
    key: TKey,
    title: string,
    fieldOptions?: FieldColumnOptions<TData, TKey>
  ): DataTableColumn<TData>;
}

/** 可编辑字段 builder 的公开 overload 契约；实现集中在 editable builder 模块。 */
export interface DataTableEditableFieldBuilder<TData> {
  <TKey extends TextFieldKey<TData>>(
    key: TKey,
    title: string,
    editableOptions: EditableInputColumnOptions<TData, TKey>
  ): DataTableColumn<TData>;
  <TKey extends TextFieldKey<TData>>(
    key: TKey,
    title: string,
    editableOptions: EditableTextareaColumnOptions<TData, TKey>
  ): DataTableColumn<TData>;
  <
    TKey extends NumericFieldKey<TData>,
    TType extends Exclude<DataTableEditableNumericType, 'money'>,
    const TEdit extends DataTableNumericEditOptions = never
  >(
    key: TKey,
    title: string,
    editableOptions: EditableNumericColumnOptions<TData, TKey, TType, TEdit>
  ): DataTableColumn<TData>;
  <TKey extends NumericFieldKey<TData>, const TEdit extends DataTableMoneyEditOptions = never>(
    key: TKey,
    title: string,
    editableOptions: EditableMoneyColumnOptions<TData, TKey, TEdit>
  ): DataTableColumn<TData>;
  <TKey extends DateFieldKey<TData>>(
    key: TKey,
    title: string,
    editableOptions: EditableDateColumnOptions<TData, TKey>
  ): DataTableColumn<TData>;
  <TKey extends DateFieldKey<TData>>(
    key: TKey,
    title: string,
    editableOptions: EditableDateTimeColumnOptions<TData, TKey>
  ): DataTableColumn<TData>;
  <TKey extends SingleChoiceFieldKey<TData>>(
    key: TKey,
    title: string,
    editableOptions: EditableSingleColumnOptions<TData, TKey>
  ): DataTableColumn<TData>;
  <TKey extends MultipleChoiceFieldKey<TData>>(
    key: TKey,
    title: string,
    editableOptions: EditableMultipleColumnOptions<TData, TKey>
  ): DataTableColumn<TData>;
}

/** badge 列配置：适合状态、枚举、标签类字段，展示为 shadcn Badge。 */
export interface BadgeDslColumnOptions<TData, TKey extends DataTableColumnKey<TData>>
  extends BaseColumnOptions<TData, TData[TKey]>, DataTableColumnOptions<TData, TData[TKey]> {
  format?: (value: TData[TKey], row: TData) => unknown;
  formatValue?: (value: TData[TKey], row: TData) => unknown;
  variant?: BadgeVariant | ((value: TData[TKey], row: TData) => BadgeVariant);
  headerClassName?: string;
}

/** 操作列配置：把行操作声明转换为固定宽度的 action cell。 */
export interface ActionsDslColumnOptions<TData> extends DataTableColumnPanelOptions {
  id?: string;
  title?: string;
  actions: Array<DataTableRowActionOption<TData>>;
  size?: DataTableColumnSize;
  minSize?: number;
  maxSize?: number;
  enableHiding?: boolean;
  enableResizing?: boolean;
  meta?: ColumnDef<TData>['meta'];
  header?: ColumnHeader<TData>;
  headerAlign?: DataTableColumnAlign;
  headerClassName?: string;
}

/** 自定义列配置：调用方完全接管 accessorFn/cell，但仍复用列面板和筛选 meta 合并。 */
export interface CustomDslColumnOptions<TData, TValue> extends DataTableColumnOptions<
  TData,
  TValue
> {
  id: string;
  title: string;
  accessorFn?: (row: TData) => TValue;
  cell: ColumnDef<TData, TValue>['cell'];
  header?: ColumnHeader<TData>;
  headerAlign?: DataTableColumnAlign;
  headerClassName?: string;
}
