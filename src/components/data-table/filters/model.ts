import type { DataTableFilterOption, DataTableFilterOptions } from './types';

/** Array.isArray 无法收窄 readonly 数组，统一通过领域守卫判断 flat options。 */
export function isDataTableFlatFilterOptions(
  value: DataTableFilterOptions | undefined
): value is readonly DataTableFilterOption[] {
  return Array.isArray(value);
}
