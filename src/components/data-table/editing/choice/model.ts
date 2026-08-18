import type { DataTableChoiceOption, DataTableChoiceValue } from './types';

export function isDataTableChoiceValue(value: unknown): value is DataTableChoiceValue {
  return typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value));
}

export function getDataTableChoiceValues(value: unknown): DataTableChoiceValue[] {
  const values = Array.isArray(value) ? value : value == null ? [] : [value];
  return [...new Set(values.filter(isDataTableChoiceValue))];
}

export function mergeDataTableChoiceOptions(
  ...groups: Array<readonly DataTableChoiceOption[] | undefined>
): DataTableChoiceOption[] {
  const optionByValue = new Map<DataTableChoiceValue, DataTableChoiceOption>();
  for (const group of groups) {
    for (const option of group ?? []) {
      if (!optionByValue.has(option.value)) optionByValue.set(option.value, option);
    }
  }
  return [...optionByValue.values()];
}

export function resolveDataTableChoiceLabels(
  value: unknown,
  ...optionMaps: Array<ReadonlyMap<DataTableChoiceValue, DataTableChoiceOption>>
): string[] {
  return getDataTableChoiceValues(value).map((item) => {
    for (const optionMap of optionMaps) {
      const option = optionMap.get(item);
      if (option) return option.label;
    }
    return String(item);
  });
}
