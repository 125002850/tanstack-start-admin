import type { CellContext, ColumnDef } from '@tanstack/react-table';
import type { ComponentProps } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  createDataTableRowActionsResolver,
  renderDataTableActionsCell
} from '@/components/data-table/columns/data-table-column-actions';
import {
  ACTIONS_COLUMN_DEFAULTS,
  BADGE_COLUMN_DEFAULTS,
  CUSTOM_COLUMN_DEFAULTS,
  FIELD_COLUMN_DEFAULTS
} from '@/components/data-table/columns/data-table-column-defaults';
import {
  resolveDataTableEditableCell,
  type ResolveDataTableEditableCellContext
} from '@/components/data-table/columns/data-table-edit-adapters';
import type {
  DataTableColumnKey,
  DataTableFieldFormatter,
  DataTableFieldFormatterRule,
  DataTableFieldValue
} from '@/components/data-table/columns/data-table-column-formatters';
import { hasFormatterKey } from '@/components/data-table/columns/data-table-column-formatters';
import {
  dataTableHeaderFactory,
  getDataTableAlignClassName,
  renderDataTableTextCell,
  resolveDataTableEnumLabel,
  type ColumnHeader
} from '@/components/data-table/columns/data-table-column-rendering';
import {
  resolveDataTableColumnOptions,
  type DataTableColumnOptions
} from '@/components/data-table/columns/data-table-column-options';
import {
  resolveDataTableColumnTypeDefaults,
  validateDataTableColumnTypeRegistry,
  type DataTableColumnTypeRegistry
} from '@/components/data-table/columns/data-table-column-types';
import { nullableText } from '@/lib/formatters/display';
import { cn } from '@/lib/utils';
import type { DataTableColumnSize } from '@/config/data-table';
import type {
  DataTableColumnPanelOptions,
  DataTableChoiceOption,
  DataTableChoiceValue,
  DataTableColumnValueType,
  DataTableDateEditOptions,
  DataTableDateTimeEditOptions,
  DataTableEditableNumericType,
  DataTableMoneyEditOptions,
  DataTableNumericEditOptions,
  DataTableTextareaEditOptions,
  PlannedEditableType,
  DataTableRemoteOptions,
  DataTableRowActionOption
} from '@/types/data-table';

type BadgeVariant = ComponentProps<typeof Badge>['variant'];
type DataTableColumn<TData> = ColumnDef<TData>;

/** 字段 type 到当前页筛选控件的默认映射；未知扩展类型按文本匹配兜底。 */
function inferLocalFilterVariant(
  type: DataTableColumnValueType,
  selectionMode?: 'single' | 'multiple'
): DataTableColumnOptions<unknown, unknown>['localFilter'] {
  switch (type) {
    case 'number':
    case 'int':
    case 'decimal':
    case 'money':
    case 'percent':
    case 'fileSize':
      return 'number';
    case 'date':
    case 'dateTime':
      return 'date';
    case 'boolean':
      return 'boolean';
    case 'enum':
    case 'select':
      return selectionMode === 'multiple' ? 'multiSelect' : 'select';
    case 'remoteSelect':
    case 'text':
    case 'longText':
    default:
      return 'text';
  }
}

/**
 * createDataTableColumnDsl 的全局选项。
 *
 * fieldFormatters 用于跨字段统一格式化；customTypes 用于扩展内置 type 注册表，
 * fallbackFormatValue 则兜底所有普通字段的空值和基础展示。
 */
interface DataTableColumnDslOptions<TData> {
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
  cellClassName?: string;
}

/** 普通字段列配置：负责 accessorKey、筛选/排序 DSL、类型默认值和 cell 渲染。 */
interface FieldColumnOptions<TData, TKey extends DataTableColumnKey<TData>>
  extends BaseColumnOptions<TData, TData[TKey]>, DataTableColumnOptions<TData, TData[TKey]> {
  type?: DataTableColumnValueType;
  format?: (value: TData[TKey], row: TData) => unknown;
  formatValue?: (value: TData[TKey], row: TData) => unknown;
  renderCell?: (context: CellContext<TData, TData[TKey]>) => React.ReactNode;
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

type EditableRuntimeOptions<TData> = EditableChoiceBaseOptions<TData, unknown> & {
  type: PlannedEditableType;
  valueOptions?: readonly DataTableChoiceOption<DataTableChoiceValue>[];
  remoteOptions?: DataTableRemoteOptions<DataTableChoiceValue>;
  edit?: ResolveDataTableEditableCellContext<TData>['edit'];
};

/** badge 列配置：适合状态、枚举、标签类字段，展示为 shadcn Badge。 */
interface BadgeDslColumnOptions<TData, TKey extends DataTableColumnKey<TData>>
  extends BaseColumnOptions<TData, TData[TKey]>, DataTableColumnOptions<TData, TData[TKey]> {
  format?: (value: TData[TKey], row: TData) => unknown;
  formatValue?: (value: TData[TKey], row: TData) => unknown;
  variant?: BadgeVariant | ((value: TData[TKey], row: TData) => BadgeVariant);
  headerClassName?: string;
}

/** 操作列配置：把行操作声明转换为固定宽度的 action cell。 */
interface ActionsDslColumnOptions<TData> extends DataTableColumnPanelOptions {
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
}

/** 自定义列配置：调用方完全接管 accessorFn/cell，但仍复用列面板和筛选 meta 合并。 */
interface CustomDslColumnOptions<TData, TValue> extends DataTableColumnOptions<TData, TValue> {
  id: string;
  title: string;
  accessorFn?: (row: TData) => TValue;
  cell: ColumnDef<TData, TValue>['cell'];
  header?: ColumnHeader<TData>;
}

/** 抹平 ColumnDef 的 TValue 泛型，方便 DSL 返回统一的 ColumnDef<TData>[]。 */
function eraseDataTableColumnValue<TData, TValue>(
  column: ColumnDef<TData, TValue>
): DataTableColumn<TData> {
  return column as DataTableColumn<TData>;
}

/**
 * 创建 DataTable 列声明 DSL。
 *
 * DSL 的目标是把列宽、类型、格式化、筛选、复制值、列面板行为和后端查询 meta
 * 收敛到一处声明，避免业务页面直接拼装大量 TanStack ColumnDef 细节。
 */
export function createDataTableColumnDsl<TData>(options: DataTableColumnDslOptions<TData> = {}) {
  const {
    fieldFormatters = [],
    fallbackFormatValue = (value) => nullableText(value),
    customTypes = {},
    tableId,
    tableTimeZone,
    appTimeZone
  } = options;
  const resolvedCustomTypes = validateDataTableColumnTypeRegistry(customTypes);

  /** 根据字段 key 选择匹配的格式化规则；没有规则时走 fallback。 */
  function formatField<TKey extends DataTableColumnKey<TData>>(key: TKey, row: TData) {
    const value = row[key] as DataTableFieldValue<TData>;
    const formatter = fieldFormatters.find((rule) => hasFormatterKey(rule.keys, key));

    if (!formatter) return fallbackFormatValue(value, row, key);
    return formatter.formatValue(value, row, key);
  }

  function field<TKey extends DataTableColumnKey<TData>>(
    key: TKey,
    title: string,
    fieldOptions: FieldColumnOptions<TData, TKey> = {}
  ): DataTableColumn<TData> {
    const {
      type = 'text',
      format,
      formatValue,
      renderCell,
      cellClassName,
      headerClassName,
      header,
      ...columnOptions
    } = fieldOptions;
    const typeDefaults = resolveDataTableColumnTypeDefaults<TData, TData[TKey]>(
      type,
      resolvedCustomTypes
    );
    // 类型默认值先给出对齐、列宽和复制值，调用方 options 再做覆盖。
    const resolvedCellClassName = cn(
      getDataTableAlignClassName(typeDefaults.align),
      typeDefaults.cellClassName,
      cellClassName
    );
    const resolvedHeaderClassName = cn(
      getDataTableAlignClassName(typeDefaults.align),
      typeDefaults.headerClassName,
      headerClassName
    );
    const columnFormatter = format ?? formatValue;
    const resolveFieldFormattedValue = (value: unknown, row: TData) => {
      const typedValue = value as TData[TKey];
      const enumLabel =
        type === 'enum' ? resolveDataTableEnumLabel(typedValue, columnOptions) : undefined;

      return (
        columnFormatter?.(typedValue, row) ??
        enumLabel ??
        typeDefaults.formatValue?.(typedValue, row) ??
        formatField(key, row)
      );
    };
    const resolvedMeta = typeDefaults.copyValue
      ? {
          // copyValue 放进 meta，单元格复制逻辑会优先读取它。
          copyValue: typeDefaults.copyValue,
          ...columnOptions.meta
        }
      : columnOptions.meta;

    return eraseDataTableColumnValue({
      accessorKey: key,
      header: header ?? dataTableHeaderFactory<TData>(title, resolvedHeaderClassName),
      cell: (context) => {
        if (renderCell) {
          // renderCell 优先级最高，调用方完全控制展示。
          return renderCell(context);
        }

        if (typeDefaults.renderCell) {
          // 自定义/内置 type 可以接管 cell 渲染，例如复杂布尔态或文件尺寸。
          return typeDefaults.renderCell(context);
        }

        const value = context.getValue() as TData[TKey];
        const row = context.row.original;
        // 展示值优先级：列级 formatter -> enum label -> 类型默认 formatter -> 全局字段 formatter。
        const formattedValue = resolveFieldFormattedValue(value, row);

        return renderDataTableTextCell(formattedValue, resolvedCellClassName);
      },
      ...resolveDataTableColumnOptions<TData, TData[TKey]>({
        title,
        defaults: {
          ...FIELD_COLUMN_DEFAULTS,
          localFilter: inferLocalFilterVariant(type),
          size: typeDefaults.size,
          minSize: typeDefaults.minSize,
          maxSize: typeDefaults.maxSize
        },
        options: {
          ...columnOptions,
          localFilterFormatValue: resolveFieldFormattedValue,
          meta: resolvedMeta
        }
      })
    } satisfies ColumnDef<TData, TData[TKey]>);
  }

  function editableField<TKey extends TextFieldKey<TData>>(
    key: TKey,
    title: string,
    editableOptions: EditableInputColumnOptions<TData, TKey>
  ): DataTableColumn<TData>;
  function editableField<TKey extends TextFieldKey<TData>>(
    key: TKey,
    title: string,
    editableOptions: EditableTextareaColumnOptions<TData, TKey>
  ): DataTableColumn<TData>;
  function editableField<
    TKey extends NumericFieldKey<TData>,
    TType extends Exclude<DataTableEditableNumericType, 'money'>,
    const TEdit extends DataTableNumericEditOptions = never
  >(
    key: TKey,
    title: string,
    editableOptions: EditableNumericColumnOptions<TData, TKey, TType, TEdit>
  ): DataTableColumn<TData>;
  function editableField<
    TKey extends NumericFieldKey<TData>,
    const TEdit extends DataTableMoneyEditOptions = never
  >(
    key: TKey,
    title: string,
    editableOptions: EditableMoneyColumnOptions<TData, TKey, TEdit>
  ): DataTableColumn<TData>;
  function editableField<TKey extends DateFieldKey<TData>>(
    key: TKey,
    title: string,
    editableOptions: EditableDateColumnOptions<TData, TKey>
  ): DataTableColumn<TData>;
  function editableField<TKey extends DateFieldKey<TData>>(
    key: TKey,
    title: string,
    editableOptions: EditableDateTimeColumnOptions<TData, TKey>
  ): DataTableColumn<TData>;
  function editableField<TKey extends SingleChoiceFieldKey<TData>>(
    key: TKey,
    title: string,
    editableOptions: EditableSingleColumnOptions<TData, TKey>
  ): DataTableColumn<TData>;
  function editableField<TKey extends MultipleChoiceFieldKey<TData>>(
    key: TKey,
    title: string,
    editableOptions: EditableMultipleColumnOptions<TData, TKey>
  ): DataTableColumn<TData>;
  function editableField(
    key: DataTableColumnKey<TData>,
    title: string,
    editableOptionsInput: object
  ): DataTableColumn<TData> {
    const editableOptions = editableOptionsInput as EditableRuntimeOptions<TData>;
    const {
      type,
      valueOptions,
      remoteOptions,
      edit,
      format,
      formatValue,
      cellClassName,
      headerClassName,
      header,
      ...columnOptions
    } = editableOptions;
    const derivedFilterOptions =
      valueOptions &&
      !columnOptions.filterOptions &&
      (columnOptions.filter === 'select' || columnOptions.filter === 'multiSelect')
        ? valueOptions.map((option) => ({
            label: option.label,
            value: String(option.value)
          }))
        : columnOptions.filterOptions;
    const derivedLocalFilterOptions =
      valueOptions && !columnOptions.localFilterOptions
        ? valueOptions.map((option) => ({
            label: option.label,
            value: String(option.value)
          }))
        : columnOptions.localFilterOptions;
    const resolvedEditable = resolveDataTableEditableCell<TData>({
      type,
      field: key,
      title,
      edit,
      tableId,
      tableTimeZone,
      appTimeZone,
      valueOptions,
      remoteOptions
    });
    if (!resolvedEditable) {
      const readOnlyOptions = {
        ...columnOptions,
        type,
        format,
        formatValue,
        cellClassName,
        headerClassName,
        header,
        filterOptions: derivedFilterOptions
      } as FieldColumnOptions<TData, DataTableColumnKey<TData>>;
      return field(key, title, readOnlyOptions);
    }

    const typeDefaults = resolveDataTableColumnTypeDefaults<TData, unknown>(
      type,
      resolvedCustomTypes
    );
    const resolvedCellClassName = cn(
      getDataTableAlignClassName(typeDefaults.align),
      typeDefaults.cellClassName,
      cellClassName
    );
    const resolvedHeaderClassName = cn(
      getDataTableAlignClassName(typeDefaults.align),
      typeDefaults.headerClassName,
      headerClassName
    );
    const resolvedMeta = {
      ...columnOptions.meta,
      cellOwnsTooltip: true,
      ...resolvedEditable.columnMeta
    };
    const columnFormatter = (format ?? formatValue) as
      | ((value: unknown, row: TData) => unknown)
      | undefined;
    const typeFormatter = typeDefaults.formatValue as
      | ((value: unknown, row: TData) => unknown)
      | undefined;
    const resolveEditableFormattedValue = (value: unknown, row: TData) =>
      resolvedEditable.resolveFormattedValue({
        value,
        row,
        columnFormatter,
        typeFormatter,
        fallbackFormatter: () => formatField(key, row)
      });

    return eraseDataTableColumnValue({
      accessorKey: key,
      header: header ?? dataTableHeaderFactory<TData>(title, resolvedHeaderClassName),
      cell: (context) => {
        const value = context.getValue();
        const row = context.row.original;
        return resolvedEditable.renderCell({
          context,
          formattedValue: resolveEditableFormattedValue(value, row),
          className: resolvedCellClassName
        });
      },
      ...resolveDataTableColumnOptions<TData, unknown>({
        title,
        defaults: {
          ...FIELD_COLUMN_DEFAULTS,
          localFilter: inferLocalFilterVariant(type, edit?.selectionMode),
          size: typeDefaults.size,
          minSize: typeDefaults.minSize,
          maxSize: typeDefaults.maxSize
        },
        options: {
          ...columnOptions,
          filterOptions: derivedFilterOptions,
          localFilterOptions: derivedLocalFilterOptions,
          localFilterFormatValue: resolveEditableFormattedValue,
          meta: resolvedMeta
        }
      })
    } satisfies ColumnDef<TData, unknown>);
  }

  function badge<TKey extends DataTableColumnKey<TData>>(
    key: TKey,
    title: string,
    badgeOptions: BadgeDslColumnOptions<TData, TKey> = {}
  ): DataTableColumn<TData> {
    const {
      variant = 'secondary',
      format,
      formatValue,
      header,
      headerClassName,
      cellClassName,
      ...columnOptions
    } = badgeOptions;
    const formatter = format ?? formatValue;
    const resolvedOptions = resolveDataTableColumnOptions<TData, TData[TKey]>({
      title,
      defaults: { ...BADGE_COLUMN_DEFAULTS, localFilter: 'text' },
      options: {
        ...columnOptions,
        localFilterFormatValue: (value, row) =>
          formatter ? formatter(value as TData[TKey], row) : value
      }
    });

    return eraseDataTableColumnValue({
      accessorKey: key,
      header: header ?? dataTableHeaderFactory<TData>(title, headerClassName),
      cell: ({ row }) => {
        const value = row.original[key];
        const label = nullableText(formatter ? formatter(value, row.original) : value);
        // 空值保持纯文本占位，不渲染空 Badge，避免状态列误传达“有一个标签”。
        if (label === '-') return '-';
        const resolvedVariant =
          typeof variant === 'function' ? variant(value, row.original) : variant;
        return (
          <Badge variant={resolvedVariant} className={cellClassName}>
            {label}
          </Badge>
        );
      },
      ...resolvedOptions
    } satisfies ColumnDef<TData, TData[TKey]>);
  }

  function actions(actionsOptions: ActionsDslColumnOptions<TData>): DataTableColumn<TData> {
    const {
      id = 'actions',
      title = '操作',
      actions: actionOptions,
      header,
      meta,
      ...columnOptions
    } = actionsOptions;
    const resolveActions = createDataTableRowActionsResolver(actionOptions);
    // 操作列默认不参与筛选/隐藏/重排，但仍允许调用方覆盖宽度范围和 meta。
    const resolvedOptions = resolveDataTableColumnOptions<TData, unknown>({
      title,
      defaults: ACTIONS_COLUMN_DEFAULTS,
      options: {
        ...columnOptions,
        filter: false,
        meta
      }
    });

    return {
      id,
      header: header ?? title,
      cell: ({ row }) => renderDataTableActionsCell(row, resolveActions),
      ...resolvedOptions
    } satisfies ColumnDef<TData>;
  }

  function custom<TValue = unknown>(
    customOptions: CustomDslColumnOptions<TData, TValue>
  ): DataTableColumn<TData> {
    const { id, title, accessorFn, cell, header, ...columnOptions } = customOptions;
    const resolvedOptions = resolveDataTableColumnOptions<TData, TValue>({
      // 自定义列使用 CUSTOM defaults，仍可声明 filter/dsl/columnPanel 等统一选项。
      title,
      defaults: CUSTOM_COLUMN_DEFAULTS,
      options: columnOptions
    });

    return eraseDataTableColumnValue({
      id,
      accessorFn,
      header: header ?? dataTableHeaderFactory<TData>(title),
      cell,
      ...resolvedOptions
    } satisfies ColumnDef<TData, TValue>);
  }

  return {
    formatField,
    field,
    editableField,
    badge,
    actions,
    custom
  };
}
