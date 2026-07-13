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
import { dataTableColumnSizes } from '@/config/data-table';

/**
 * DataTable 列类型注册表。
 *
 * 内置 type 提供列宽、对齐、默认展示格式和复制值策略；createDataTableColumnDsl.field()
 * 会优先读取这里的默认值，再合并调用方传入的列级配置。
 */
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

/** boolean 字段兼容布尔值和常见后端字符串标记。 */
function formatBooleanValue(value: unknown) {
  if (value === true || value === '1') return '是';
  if (value === false || value === '0') return '否';
  return '-';
}

/** 金额等数值列复制时保留原始数字字符串，而不是带货币符号的展示文本。 */
function copyRawNumberValue(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? String(value) : '-';
}

/** 内置列类型默认值；业务可以新增自定义 type，但不能覆盖这些 key。 */
export const dataTableColumnTypes = {
  text: {
    size: 160,
    minSize: 80,
    align: 'left'
  },
  longText: {
    size: dataTableColumnSizes.xxl,
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
    size: dataTableColumnSizes.lg,
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
  // 禁止覆盖内置 type，避免同名扩展在不同业务表里产生难以追踪的不一致行为。
  for (const key of Object.keys(customTypes)) {
    if (BUILT_IN_TYPE_KEYS.has(key)) {
      throw new Error(`Custom data-table column type "${key}" cannot override a built-in type.`);
    }
  }

  return customTypes;
}

/** 解析 type 默认值：自定义 type 优先，其次内置 type，未知值回退为 text。 */
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
