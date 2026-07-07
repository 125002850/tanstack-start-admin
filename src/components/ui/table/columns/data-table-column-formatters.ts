import {
  nullableDate,
  nullableDecimal,
  nullableInt,
  nullableMoney,
  nullableRawPercent,
  nullableYesNo
} from '@/lib/display-formatters';

/**
 * DataTable 字段格式化规则集合。
 *
 * createDataTableColumnDsl 可以接收这些 rule：当字段 key 命中 keys 时，统一应用金额、
 * 日期、整数、百分比等展示格式，未命中时再走 fallbackFormatValue。
 */
export type DataTableColumnKey<TData> = Extract<keyof TData, string>;
export type DataTableFieldValue<TData> = TData[DataTableColumnKey<TData>];
export type DataTableFieldFormatter<TData> = (
  value: DataTableFieldValue<TData>,
  row: TData,
  key: DataTableColumnKey<TData>
) => unknown;
export type DataTableFieldFormatterKeys<TData> =
  | ReadonlySet<keyof TData>
  | ReadonlyArray<keyof TData>;

export interface DataTableFieldFormatterRule<TData> {
  keys: DataTableFieldFormatterKeys<TData>;
  formatValue: DataTableFieldFormatter<TData>;
}

/** keys 支持数组或 Set，这里统一判断某个字段是否命中格式化规则。 */
export function hasFormatterKey<TData>(
  keys: DataTableFieldFormatterKeys<TData>,
  key: DataTableColumnKey<TData>
) {
  if (Array.isArray(keys)) return (keys as ReadonlyArray<keyof TData>).includes(key);
  return (keys as ReadonlySet<keyof TData>).has(key);
}

/** 创建单条字段格式化规则，避免每个 formatter 重复拼装对象。 */
function createFieldFormatterRule<TData>(
  keys: DataTableFieldFormatterKeys<TData>,
  formatValue: DataTableFieldFormatter<TData>
): DataTableFieldFormatterRule<TData> {
  return { keys, formatValue };
}

/** 常用列格式化规则工厂；返回值需要传入 createDataTableColumnDsl({ fieldFormatters })。 */
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
    return createFieldFormatterRule<TData>(keys, (value) => nullableRawPercent(value));
  }
};
