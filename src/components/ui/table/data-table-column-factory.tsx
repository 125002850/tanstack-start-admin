import type { Column, ColumnDef } from '@tanstack/react-table';
import type { ComponentProps } from 'react';

import { Badge } from '@/components/ui/badge';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { DataTableLinkButtonCell } from '@/components/ui/table/data-table-link-button-cell';
import { DataTableOverflowTooltipText } from '@/components/ui/table/data-table-overflow-tooltip-text';
import {
  nullableDate,
  nullableDateTime,
  nullableDecimal,
  nullableFileSize,
  nullableInt,
  nullableMoney,
  nullablePercent,
  nullableText,
  nullableYesNo
} from '@/lib/display-formatters';

type DataTableColumnKey<TData> = Extract<keyof TData, string>;
type DataTableFieldValue<TData> = TData[DataTableColumnKey<TData>];
type BadgeVariant = ComponentProps<typeof Badge>['variant'];

type ColumnHeader<TData> = ColumnDef<TData>['header'];
type DataTableFieldFormatter<TData> = (
  value: DataTableFieldValue<TData>,
  row: TData,
  key: DataTableColumnKey<TData>
) => unknown;
type DataTableFieldFormatterKeys<TData> = ReadonlySet<keyof TData> | ReadonlyArray<keyof TData>;

export interface DataTableFieldFormatterRule<TData> {
  keys: DataTableFieldFormatterKeys<TData>;
  formatValue: DataTableFieldFormatter<TData>;
}

interface DataTableColumnDslOptions<TData> {
  fieldFormatters?: Array<DataTableFieldFormatterRule<TData>>;
  fallbackFormatValue?: DataTableFieldFormatter<TData>;
}

interface BaseColumnOptions<TData> {
  id?: string;
  size?: number;
  minSize?: number;
  maxSize?: number;
  enableSorting?: boolean;
  enableColumnFilter?: boolean;
  enableHiding?: boolean;
  enableResizing?: boolean;
  meta?: ColumnDef<TData>['meta'];
  header?: ColumnHeader<TData>;
  cellClassName?: string;
}

interface TextColumnOptions<
  TData,
  TKey extends DataTableColumnKey<TData>
> extends BaseColumnOptions<TData> {
  format?: (value: TData[TKey], row: TData) => unknown;
  formatValue?: (value: TData[TKey], row: TData) => unknown;
}

interface BadgeColumnOptions<
  TData,
  TKey extends DataTableColumnKey<TData>
> extends TextColumnOptions<TData, TKey> {
  variant?: BadgeVariant | ((value: TData[TKey], row: TData) => BadgeVariant);
}

interface LinkColumnOptions<
  TData,
  TKey extends DataTableColumnKey<TData>
> extends TextColumnOptions<TData, TKey> {
  onClick: (row: TData) => void;
}

function hasFormatterKey<TData>(
  keys: DataTableFieldFormatterKeys<TData>,
  key: DataTableColumnKey<TData>
) {
  if (Array.isArray(keys)) return (keys as ReadonlyArray<keyof TData>).includes(key);
  return (keys as ReadonlySet<keyof TData>).has(key);
}

function rawPercent(value: unknown) {
  if (value == null || value === '') return '-';
  if (typeof value === 'number') return `${value.toLocaleString('zh-CN')}%`;
  return String(value);
}

function createFieldFormatterRule<TData>(
  keys: DataTableFieldFormatterKeys<TData>,
  formatValue: DataTableFieldFormatter<TData>
): DataTableFieldFormatterRule<TData> {
  return { keys, formatValue };
}

export const dataTableColumnFormatters = {
  money<TData>(keys: DataTableFieldFormatterKeys<TData>) {
    return createFieldFormatterRule<TData>(keys, (value) =>
      nullableMoney(typeof value === 'number' ? value : undefined)
    );
  },

  date<TData>(keys: DataTableFieldFormatterKeys<TData>) {
    return createFieldFormatterRule<TData>(keys, (value) =>
      nullableDate(typeof value === 'string' ? value : undefined)
    );
  },

  decimal<TData>(keys: DataTableFieldFormatterKeys<TData>, maximumFractionDigits?: number) {
    return createFieldFormatterRule<TData>(keys, (value) =>
      nullableDecimal(value, maximumFractionDigits)
    );
  },

  int<TData>(keys: DataTableFieldFormatterKeys<TData>) {
    return createFieldFormatterRule<TData>(keys, (value) =>
      nullableInt(typeof value === 'number' ? value : undefined)
    );
  },

  yesNo<TData>(keys: DataTableFieldFormatterKeys<TData>) {
    return createFieldFormatterRule<TData>(keys, (value) => nullableYesNo(value));
  },

  rawPercent<TData>(keys: DataTableFieldFormatterKeys<TData>) {
    return createFieldFormatterRule<TData>(keys, (value) => rawPercent(value));
  }
};

export function dataTableHeader<TData>(column: Column<TData, unknown>, title: string) {
  return <DataTableColumnHeader column={column} title={title} />;
}

export function dataTableHeaderFactory<TData>(title: string): ColumnHeader<TData> {
  return ({ column }) => dataTableHeader(column, title);
}

function renderTextCell(value: unknown, className?: string) {
  const text = nullableText(value);

  return (
    <DataTableOverflowTooltipText value={text} className={className}>
      {text}
    </DataTableOverflowTooltipText>
  );
}

export function dataTableTextCell(value: unknown, className?: string) {
  return renderTextCell(value, className);
}

function createFormattedColumn<TData, TKey extends DataTableColumnKey<TData>>(
  key: TKey,
  title: string,
  options: TextColumnOptions<TData, TKey> = {}
): ColumnDef<TData> {
  const { cellClassName, format, formatValue, header, meta, ...columnOptions } = options;
  const formatter = format ?? formatValue;

  return {
    accessorKey: key,
    header: header ?? dataTableHeaderFactory<TData>(title),
    meta: {
      ...meta,
      cellOwnsTooltip: true
    },
    enableSorting: false,
    cell: ({ row }) => {
      const value = row.original[key];
      return renderTextCell(formatter ? formatter(value, row.original) : value, cellClassName);
    },
    ...columnOptions
  };
}

export const dataTableColumns = {
  text<TData, TKey extends DataTableColumnKey<TData>>(
    key: TKey,
    title: string,
    options?: TextColumnOptions<TData, TKey>
  ) {
    return createFormattedColumn(key, title, options);
  },

  date<TData, TKey extends DataTableColumnKey<TData>>(
    key: TKey,
    title: string,
    options?: BaseColumnOptions<TData>
  ) {
    return createFormattedColumn(key, title, {
      ...options,
      formatValue: (value) => nullableDate(value as string | null | undefined)
    });
  },

  dateTime<TData, TKey extends DataTableColumnKey<TData>>(
    key: TKey,
    title: string,
    options?: BaseColumnOptions<TData>
  ) {
    return createFormattedColumn(key, title, {
      ...options,
      formatValue: (value) => nullableDateTime(value as string | number | Date | null | undefined)
    });
  },

  fileSize<TData, TKey extends DataTableColumnKey<TData>>(
    key: TKey,
    title: string,
    options?: BaseColumnOptions<TData>
  ) {
    return createFormattedColumn(key, title, {
      ...options,
      formatValue: (value) => nullableFileSize(value as number | null | undefined)
    });
  },

  money<TData, TKey extends DataTableColumnKey<TData>>(
    key: TKey,
    title: string,
    options?: BaseColumnOptions<TData>
  ) {
    return createFormattedColumn(key, title, {
      ...options,
      formatValue: (value) => nullableMoney(value as number | null | undefined)
    });
  },

  int<TData, TKey extends DataTableColumnKey<TData>>(
    key: TKey,
    title: string,
    options?: BaseColumnOptions<TData>
  ) {
    return createFormattedColumn(key, title, {
      ...options,
      formatValue: (value) => nullableInt(value as number | null | undefined)
    });
  },

  percent<TData, TKey extends DataTableColumnKey<TData>>(
    key: TKey,
    title: string,
    options?: BaseColumnOptions<TData>
  ) {
    return createFormattedColumn(key, title, {
      ...options,
      formatValue: (value) => nullablePercent(value as number | null | undefined)
    });
  },

  decimal<TData, TKey extends DataTableColumnKey<TData>>(
    key: TKey,
    title: string,
    options?: BaseColumnOptions<TData> & { maximumFractionDigits?: number }
  ) {
    const { maximumFractionDigits, ...columnOptions } = options ?? {};
    return createFormattedColumn(key, title, {
      ...columnOptions,
      formatValue: (value) => nullableDecimal(value, maximumFractionDigits)
    });
  },

  badge<TData, TKey extends DataTableColumnKey<TData>>(
    key: TKey,
    title: string,
    options: BadgeColumnOptions<TData, TKey> = {}
  ): ColumnDef<TData> {
    const {
      variant = 'secondary',
      format,
      formatValue,
      header,
      cellClassName,
      ...columnOptions
    } = options;
    const formatter = format ?? formatValue;

    return {
      accessorKey: key,
      header: header ?? dataTableHeaderFactory<TData>(title),
      enableSorting: false,
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
      ...columnOptions
    };
  },

  link<TData, TKey extends DataTableColumnKey<TData>>(
    key: TKey,
    title: string,
    options: LinkColumnOptions<TData, TKey>
  ): ColumnDef<TData> {
    const { onClick, format, formatValue, header, cellClassName, ...columnOptions } = options;
    const formatter = format ?? formatValue;

    return {
      accessorKey: key,
      header: header ?? dataTableHeaderFactory<TData>(title),
      enableSorting: false,
      cell: ({ row }) => {
        const value = row.original[key];
        const label = nullableText(formatter ? formatter(value, row.original) : value);
        return (
          <DataTableLinkButtonCell
            value={label === '-' ? undefined : label}
            className={cellClassName}
            onClick={() => onClick(row.original)}
          />
        );
      },
      ...columnOptions
    };
  }
};

export function createDataTableColumnDsl<TData>(options: DataTableColumnDslOptions<TData> = {}) {
  const { fieldFormatters = [], fallbackFormatValue = (value) => nullableText(value) } = options;

  function formatField<TKey extends DataTableColumnKey<TData>>(key: TKey, row: TData) {
    const value = row[key] as DataTableFieldValue<TData>;
    const formatter = fieldFormatters.find((rule) => hasFormatterKey(rule.keys, key));

    if (!formatter) return fallbackFormatValue(value, row, key);
    return formatter.formatValue(value, row, key);
  }

  function text<TKey extends DataTableColumnKey<TData>>(
    key: TKey,
    title: string,
    textOptions: TextColumnOptions<TData, TKey> = {}
  ) {
    const { format, formatValue } = textOptions;

    return dataTableColumns.text<TData, TKey>(key, title, {
      ...textOptions,
      formatValue: format ?? formatValue ?? ((_value, row) => formatField(key, row))
    });
  }

  function longText<TKey extends DataTableColumnKey<TData>>(
    key: TKey,
    title: string,
    textOptions: TextColumnOptions<TData, TKey> = {}
  ) {
    return text(key, title, {
      ...textOptions,
      cellClassName: textOptions.cellClassName ?? 'text-muted-foreground'
    });
  }

  function filterableText<TKey extends DataTableColumnKey<TData>>(
    key: TKey,
    title: string,
    placeholder: string,
    textOptions: TextColumnOptions<TData, TKey> = {}
  ) {
    const { meta, enableColumnFilter, ...columnOptions } = textOptions;

    return text(key, title, {
      ...columnOptions,
      enableColumnFilter: enableColumnFilter ?? true,
      meta: {
        variant: 'text',
        label: title,
        placeholder,
        ...meta
      }
    });
  }

  return {
    formatField,
    text,
    longText,
    filterableText
  };
}
