import {
  nullableDate,
  nullableDateTime,
  nullableDecimal,
  nullableFileSize,
  nullableInt,
  nullableMoney,
  nullablePercent,
  nullableText
} from '@/lib/display-formatters';
import type {
  BuiltInColumnValueType,
  DataTableColumnTypeDefinition,
  DataTableColumnValueType
} from '@/types/data-table';

export type DataTableColumnTypeRegistry<TData> = Record<
  string,
  DataTableColumnTypeDefinition<TData, unknown>
>;

const BUILT_IN_TYPE_KEYS = new Set<string>([
  'text',
  'longText',
  'number',
  'int',
  'decimal',
  'money',
  'percent',
  'date',
  'dateTime',
  'boolean',
  'enum',
  'fileSize'
]);

function formatBooleanValue(value: unknown) {
  if (value === true || value === '1') return '是';
  if (value === false || value === '0') return '否';
  return '-';
}

function copyRawNumberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '-';
}

export const dataTableColumnTypes = {
  text: {
    size: 160,
    minSize: 80,
    align: 'left'
  },
  longText: {
    size: 240,
    minSize: 120,
    align: 'left',
    cellClassName: 'text-muted-foreground'
  },
  number: {
    size: 120,
    minSize: 96,
    align: 'right',
    formatValue: (value) => nullableText(value)
  },
  int: {
    size: 120,
    minSize: 96,
    align: 'right',
    formatValue: (value) => nullableInt(typeof value === 'number' ? value : undefined)
  },
  decimal: {
    size: 120,
    minSize: 96,
    align: 'right',
    formatValue: (value) => nullableDecimal(value)
  },
  money: {
    size: 140,
    minSize: 110,
    align: 'right',
    formatValue: (value) => nullableMoney(typeof value === 'number' ? value : undefined),
    copyValue: (value) => copyRawNumberValue(value)
  },
  percent: {
    size: 120,
    minSize: 96,
    align: 'right',
    formatValue: (value) => nullablePercent(typeof value === 'number' ? value : undefined)
  },
  date: {
    size: 140,
    minSize: 120,
    align: 'left',
    formatValue: (value) => nullableDate(typeof value === 'string' ? value : undefined)
  },
  dateTime: {
    size: 180,
    minSize: 150,
    align: 'left',
    formatValue: (value) => nullableDateTime(value as string | number | Date | null | undefined)
  },
  boolean: {
    size: 100,
    minSize: 80,
    align: 'center',
    formatValue: (value) => formatBooleanValue(value)
  },
  enum: {
    size: 140,
    minSize: 100,
    align: 'left'
  },
  fileSize: {
    size: 120,
    minSize: 96,
    align: 'right',
    formatValue: (value) => nullableFileSize(typeof value === 'number' ? value : undefined)
  }
} satisfies Record<BuiltInColumnValueType, DataTableColumnTypeDefinition<unknown, unknown>>;

export function validateDataTableColumnTypeRegistry<TData>(
  customTypes: DataTableColumnTypeRegistry<TData> = {}
) {
  for (const key of Object.keys(customTypes)) {
    if (BUILT_IN_TYPE_KEYS.has(key)) {
      throw new Error(`Custom data-table column type "${key}" cannot override a built-in type.`);
    }
  }

  return customTypes;
}

export function resolveDataTableColumnTypeDefaults<TData, TValue>(
  type: DataTableColumnValueType | undefined,
  customTypes: DataTableColumnTypeRegistry<TData> = {}
): DataTableColumnTypeDefinition<TData, TValue> {
  const customType = type ? customTypes[type] : undefined;
  if (customType) {
    return customType as DataTableColumnTypeDefinition<TData, TValue>;
  }

  const builtInType = dataTableColumnTypes[(type ?? 'text') as BuiltInColumnValueType];
  return (builtInType ?? dataTableColumnTypes.text) as DataTableColumnTypeDefinition<TData, TValue>;
}
