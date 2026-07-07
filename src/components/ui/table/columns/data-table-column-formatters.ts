import {
  nullableDate,
  nullableDecimal,
  nullableInt,
  nullableMoney,
  nullableRawPercent,
  nullableYesNo
} from '@/lib/display-formatters';

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

export function hasFormatterKey<TData>(
  keys: DataTableFieldFormatterKeys<TData>,
  key: DataTableColumnKey<TData>
) {
  if (Array.isArray(keys)) return (keys as ReadonlyArray<keyof TData>).includes(key);
  return (keys as ReadonlySet<keyof TData>).has(key);
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
    return createFieldFormatterRule<TData>(keys, (value) => nullableRawPercent(value));
  }
};
