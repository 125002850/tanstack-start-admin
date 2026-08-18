import type { ExpandConfig, ExpandRowKeyField, ExpandTab } from './types';

/** 保留 tabs id 字面量类型，运行时直接返回原配置。 */
export function defineExpandConfig<
  TData,
  TKey extends ExpandRowKeyField<TData>,
  const TTabs extends readonly ExpandTab<TData, string>[]
>(config: ExpandConfig<TData, TKey, TTabs>) {
  return config;
}
