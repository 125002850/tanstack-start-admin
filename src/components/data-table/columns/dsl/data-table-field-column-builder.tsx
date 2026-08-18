import type { ColumnDef } from '@tanstack/react-table';

import { FIELD_COLUMN_DEFAULTS } from '@/components/data-table/columns/dsl/data-table-column-defaults';
import type {
  DataTableColumn,
  DataTableColumnDslOptions,
  DataTableFieldBuilder,
  FieldColumnOptions
} from '@/components/data-table/columns/dsl/types';
import {
  hasFormatterKey,
  type DataTableColumnKey,
  type DataTableFieldValue
} from '@/components/data-table/columns/dsl/data-table-column-formatters';
import {
  resolveDataTableColumnOptions,
  type DataTableColumnOptions
} from '@/components/data-table/columns/dsl/data-table-column-options';
import {
  dataTableHeaderFactory,
  getDataTableAlignClassName,
  renderDataTableTextCell,
  resolveDataTableEnumLabel
} from '@/components/data-table/columns/dsl/data-table-column-rendering';
import {
  resolveDataTableColumnTypeDefaults,
  validateDataTableColumnTypeRegistry,
  type DataTableColumnTypeRegistry
} from '@/components/data-table/columns/dsl/type-registry';
import { nullableText } from '@/lib/formatters/display';
import { cn } from '@/lib/utils';
import type { DataTableColumnValueType } from './contracts';

export interface DataTableColumnBuilderContext<TData> {
  resolvedCustomTypes: DataTableColumnTypeRegistry<TData>;
  tableId?: string;
  tableTimeZone?: string;
  appTimeZone?: string;
  formatField<TKey extends DataTableColumnKey<TData>>(key: TKey, row: TData): unknown;
}

/** 字段 type 到当前页筛选控件的默认映射；未知扩展类型按文本匹配兜底。 */
export function inferDataTableLocalFilterVariant(
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

/** 抹平 ColumnDef 的 TValue 泛型，方便 DSL 返回统一的 ColumnDef<TData>[]。 */
export function eraseDataTableColumnValue<TData, TValue>(
  column: ColumnDef<TData, TValue>
): DataTableColumn<TData> {
  return column as DataTableColumn<TData>;
}

/** 初始化所有 column builder 共享的格式化、type registry 和编辑时区上下文。 */
export function createDataTableColumnBuilderContext<TData>({
  fieldFormatters = [],
  fallbackFormatValue = (value) => nullableText(value),
  customTypes = {},
  tableId,
  tableTimeZone,
  appTimeZone
}: DataTableColumnDslOptions<TData>): DataTableColumnBuilderContext<TData> {
  const resolvedCustomTypes = validateDataTableColumnTypeRegistry(customTypes);

  function formatField<TKey extends DataTableColumnKey<TData>>(key: TKey, row: TData) {
    const value = row[key] as DataTableFieldValue<TData>;
    const formatter = fieldFormatters.find((rule) => hasFormatterKey(rule.keys, key));

    if (!formatter) return fallbackFormatValue(value, row, key);
    return formatter.formatValue(value, row, key);
  }

  return {
    resolvedCustomTypes,
    tableId,
    tableTimeZone,
    appTimeZone,
    formatField
  };
}

/** 创建普通字段列 builder；editableField 的只读降级也复用该入口。 */
export function createDataTableFieldBuilder<TData>(
  context: DataTableColumnBuilderContext<TData>
): DataTableFieldBuilder<TData> {
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
      headerAlign,
      header,
      ...columnOptions
    } = fieldOptions;
    const typeDefaults = resolveDataTableColumnTypeDefaults<TData, TData[TKey]>(
      type,
      context.resolvedCustomTypes
    );
    // 类型默认值先给出对齐、列宽和复制值，调用方 options 再做覆盖。
    const resolvedCellClassName = cn(
      getDataTableAlignClassName(typeDefaults.align),
      typeDefaults.cellClassName,
      cellClassName
    );
    const resolvedHeaderClassName = cn(typeDefaults.headerClassName, headerClassName);
    const columnFormatter = format ?? formatValue;
    const resolveFieldFormattedValue = (value: unknown, row: TData) => {
      const typedValue = value as TData[TKey];
      const enumLabel =
        type === 'enum' ? resolveDataTableEnumLabel(typedValue, columnOptions) : undefined;

      return (
        columnFormatter?.(typedValue, row) ??
        enumLabel ??
        typeDefaults.formatValue?.(typedValue, row) ??
        context.formatField(key, row)
      );
    };
    const resolveLocalFilterFormattedValue = (value: unknown, row: TData) =>
      Array.isArray(row[key]) ? value : resolveFieldFormattedValue(value, row);
    const resolvedMeta = typeDefaults.copyValue
      ? {
          // copyValue 放进 meta，单元格复制逻辑会优先读取它。
          copyValue: typeDefaults.copyValue,
          ...columnOptions.meta
        }
      : columnOptions.meta;

    return eraseDataTableColumnValue({
      accessorKey: key,
      header:
        header ??
        dataTableHeaderFactory<TData>(
          title,
          resolvedHeaderClassName,
          headerAlign ?? typeDefaults.headerAlign
        ),
      cell: (cellContext) => {
        if (renderCell) {
          // renderCell 优先级最高，调用方完全控制展示。
          return renderCell(cellContext);
        }

        if (typeDefaults.renderCell) {
          // 自定义/内置 type 可以接管 cell 渲染，例如复杂布尔态或文件尺寸。
          return typeDefaults.renderCell(cellContext);
        }

        const value = cellContext.getValue() as TData[TKey];
        const row = cellContext.row.original;
        // 展示值优先级：列级 formatter -> enum label -> 类型默认 formatter -> 全局字段 formatter。
        const formattedValue = resolveFieldFormattedValue(value, row);

        return renderDataTableTextCell(formattedValue, resolvedCellClassName);
      },
      ...resolveDataTableColumnOptions<TData, TData[TKey]>({
        title,
        defaults: {
          ...FIELD_COLUMN_DEFAULTS,
          localFilter: inferDataTableLocalFilterVariant(type),
          size: typeDefaults.size,
          minSize: typeDefaults.minSize,
          maxSize: typeDefaults.maxSize
        },
        options: {
          ...columnOptions,
          localFilterFormatValue: resolveLocalFilterFormattedValue,
          meta: resolvedMeta
        }
      })
    } satisfies ColumnDef<TData, TData[TKey]>);
  }

  return field;
}
