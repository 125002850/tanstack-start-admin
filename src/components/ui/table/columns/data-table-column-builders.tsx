import type { CellContext, ColumnDef } from '@tanstack/react-table';
import type { ComponentProps } from 'react';

import { Badge } from '@/components/ui/badge';
import {
  createDataTableRowActionsResolver,
  renderDataTableActionsCell
} from '@/components/ui/table/columns/data-table-column-actions';
import {
  ACTIONS_COLUMN_DEFAULTS,
  BADGE_COLUMN_DEFAULTS,
  CUSTOM_COLUMN_DEFAULTS,
  FIELD_COLUMN_DEFAULTS
} from '@/components/ui/table/columns/data-table-column-defaults';
import type {
  DataTableColumnKey,
  DataTableFieldFormatter,
  DataTableFieldFormatterRule,
  DataTableFieldValue
} from '@/components/ui/table/columns/data-table-column-formatters';
import { hasFormatterKey } from '@/components/ui/table/columns/data-table-column-formatters';
import {
  dataTableHeaderFactory,
  getDataTableAlignClassName,
  renderDataTableTextCell,
  resolveDataTableEnumLabel,
  type ColumnHeader
} from '@/components/ui/table/columns/data-table-column-rendering';
import {
  resolveDataTableColumnOptions,
  type DataTableColumnOptions
} from '@/components/ui/table/columns/data-table-column-options';
import {
  resolveDataTableColumnTypeDefaults,
  validateDataTableColumnTypeRegistry,
  type DataTableColumnTypeRegistry
} from '@/components/ui/table/columns/data-table-column-types';
import type { DataTableColumnSize } from '@/config/data-table';
import { nullableText } from '@/lib/display-formatters';
import { cn } from '@/lib/utils';
import type {
  DataTableColumnPanelOptions,
  DataTableColumnValueType,
  DataTableRowActionOption
} from '@/types/data-table';

type BadgeVariant = ComponentProps<typeof Badge>['variant'];
type DataTableColumn<TData> = ColumnDef<TData>;

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
    customTypes = {}
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
        const formatter = format ?? formatValue;
        const enumLabel =
          // enum 类型优先从 filterOptions 里解析 label，保证筛选选项和展示文案一致。
          type === 'enum' ? resolveDataTableEnumLabel(value, columnOptions) : undefined;
        const formattedValue =
          // 展示值优先级：列级 formatter -> enum label -> 类型默认 formatter -> 全局字段 formatter。
          formatter?.(value, row) ??
          enumLabel ??
          typeDefaults.formatValue?.(value, row) ??
          formatField(key, row);

        return renderDataTableTextCell(formattedValue, resolvedCellClassName);
      },
      ...resolveDataTableColumnOptions<TData, TData[TKey]>({
        title,
        defaults: {
          ...FIELD_COLUMN_DEFAULTS,
          size: typeDefaults.size,
          minSize: typeDefaults.minSize,
          maxSize: typeDefaults.maxSize
        },
        options: {
          ...columnOptions,
          meta: resolvedMeta
        }
      })
    } satisfies ColumnDef<TData, TData[TKey]>);
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
      defaults: BADGE_COLUMN_DEFAULTS,
      options: columnOptions
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
    badge,
    actions,
    custom
  };
}
