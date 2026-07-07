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
import { nullableText } from '@/lib/display-formatters';
import { cn } from '@/lib/utils';
import type {
  DataTableColumnPanelOptions,
  DataTableColumnValueType,
  DataTableRowActionOption
} from '@/types/data-table';

type BadgeVariant = ComponentProps<typeof Badge>['variant'];
type DataTableColumn<TData> = ColumnDef<TData>;

interface DataTableColumnDslOptions<TData> {
  fieldFormatters?: Array<DataTableFieldFormatterRule<TData>>;
  fallbackFormatValue?: DataTableFieldFormatter<TData>;
  customTypes?: DataTableColumnTypeRegistry<TData>;
}

interface BaseColumnOptions<TData, TValue = unknown> {
  size?: number;
  minSize?: number;
  maxSize?: number;
  enableSorting?: boolean;
  enableHiding?: boolean;
  enableResizing?: boolean;
  meta?: ColumnDef<TData, TValue>['meta'];
  header?: ColumnHeader<TData>;
  cellClassName?: string;
}

interface FieldColumnOptions<TData, TKey extends DataTableColumnKey<TData>>
  extends BaseColumnOptions<TData, TData[TKey]>, DataTableColumnOptions<TData, TData[TKey]> {
  type?: DataTableColumnValueType;
  format?: (value: TData[TKey], row: TData) => unknown;
  formatValue?: (value: TData[TKey], row: TData) => unknown;
  renderCell?: (context: CellContext<TData, TData[TKey]>) => React.ReactNode;
  headerClassName?: string;
}

interface BadgeDslColumnOptions<TData, TKey extends DataTableColumnKey<TData>>
  extends BaseColumnOptions<TData, TData[TKey]>, DataTableColumnOptions<TData, TData[TKey]> {
  format?: (value: TData[TKey], row: TData) => unknown;
  formatValue?: (value: TData[TKey], row: TData) => unknown;
  variant?: BadgeVariant | ((value: TData[TKey], row: TData) => BadgeVariant);
  headerClassName?: string;
}

interface ActionsDslColumnOptions<TData> extends DataTableColumnPanelOptions {
  id?: string;
  title?: string;
  actions: Array<DataTableRowActionOption<TData>>;
  size?: number;
  minSize?: number;
  maxSize?: number;
  enableHiding?: boolean;
  enableResizing?: boolean;
  meta?: ColumnDef<TData>['meta'];
  header?: ColumnHeader<TData>;
}

interface CustomDslColumnOptions<TData, TValue> extends DataTableColumnOptions<TData, TValue> {
  id: string;
  title: string;
  accessorFn?: (row: TData) => TValue;
  cell: ColumnDef<TData, TValue>['cell'];
  header?: ColumnHeader<TData>;
}

function eraseDataTableColumnValue<TData, TValue>(
  column: ColumnDef<TData, TValue>
): DataTableColumn<TData> {
  return column as DataTableColumn<TData>;
}

export function createDataTableColumnDsl<TData>(options: DataTableColumnDslOptions<TData> = {}) {
  const {
    fieldFormatters = [],
    fallbackFormatValue = (value) => nullableText(value),
    customTypes = {}
  } = options;
  const resolvedCustomTypes = validateDataTableColumnTypeRegistry(customTypes);

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
          copyValue: typeDefaults.copyValue,
          ...columnOptions.meta
        }
      : columnOptions.meta;

    return eraseDataTableColumnValue({
      accessorKey: key,
      header: header ?? dataTableHeaderFactory<TData>(title, resolvedHeaderClassName),
      cell: (context) => {
        if (renderCell) {
          return renderCell(context);
        }

        if (typeDefaults.renderCell) {
          return typeDefaults.renderCell(context);
        }

        const value = context.getValue() as TData[TKey];
        const row = context.row.original;
        const formatter = format ?? formatValue;
        const enumLabel =
          type === 'enum' ? resolveDataTableEnumLabel(value, columnOptions) : undefined;
        const formattedValue =
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
    const resolvedOptions = resolveDataTableColumnOptions<TData, unknown>({
      title,
      defaults: {
        ...ACTIONS_COLUMN_DEFAULTS,
        size: columnOptions.size ?? ACTIONS_COLUMN_DEFAULTS.size,
        minSize: columnOptions.minSize ?? ACTIONS_COLUMN_DEFAULTS.minSize,
        maxSize: columnOptions.maxSize ?? ACTIONS_COLUMN_DEFAULTS.maxSize
      },
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
