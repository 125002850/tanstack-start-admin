import type {
  DataTableEmptyFilterOption,
  DataTableFilterOption,
  DataTableFilterOptions
} from './types';

import { DATA_TABLE_EMPTY_FILTER_VALUE } from '@/lib/data-table/empty-filter';

export function prependDataTableEmptyFilterOption(
  options: readonly DataTableFilterOption[],
  emptyOption: DataTableEmptyFilterOption | undefined
): readonly DataTableFilterOption[] {
  if (!emptyOption) return options;
  return [
    { value: DATA_TABLE_EMPTY_FILTER_VALUE, label: emptyOption.label?.trim() || '空值' },
    ...options.filter((option) => option.value !== DATA_TABLE_EMPTY_FILTER_VALUE)
  ];
}

/** Array.isArray 无法收窄 readonly 数组，统一通过领域守卫判断 flat options。 */
export function isDataTableFlatFilterOptions(
  value: DataTableFilterOptions | undefined
): value is readonly DataTableFilterOption[] {
  return Array.isArray(value);
}
