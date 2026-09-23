import type { ExpandedState, OnChangeFn } from '@tanstack/react-table';
import { useLayoutEffect, useRef } from 'react';

import { pruneTreeExpanded } from '@/lib/data-table/tree';

/** 展开状态只保存在内存；筛选期间暂存原状态，清除筛选后还原。 */
export function useDataTableTreeExpansion({
  expanded,
  onExpandedChange,
  scopeKey,
  filterKey,
  nodeIds
}: {
  expanded: ExpandedState;
  onExpandedChange: OnChangeFn<ExpandedState>;
  scopeKey?: string;
  filterKey?: string;
  nodeIds?: ReadonlySet<string>;
}) {
  const previousScope = useRef(scopeKey);
  const previousFilter = useRef(filterKey);
  const restoreExpanded = useRef<ExpandedState | undefined>(undefined);
  const hasLoadedNodes = useRef(false);

  useLayoutEffect(() => {
    if (scopeKey === undefined || !nodeIds) return;
    const scopeChanged = previousScope.current !== scopeKey;
    const filterChanged = previousFilter.current !== filterKey;
    previousScope.current = scopeKey;
    previousFilter.current = filterKey;

    if (scopeChanged) {
      restoreExpanded.current = undefined;
      hasLoadedNodes.current = nodeIds.size > 0;
      onExpandedChange({});
      return;
    }
    if (filterKey !== undefined && filterChanged) {
      restoreExpanded.current ??= expanded;
      onExpandedChange(true);
      return;
    }
    if (filterKey === undefined && restoreExpanded.current !== undefined) {
      const restored = pruneTreeExpanded(restoreExpanded.current, nodeIds);
      restoreExpanded.current = undefined;
      onExpandedChange(restored);
      return;
    }
    // 初次异步查询尚未返回时保留 initialState.expanded；实际删除后才清理失效 ID。
    if (nodeIds.size > 0) hasLoadedNodes.current = true;
    if (hasLoadedNodes.current && filterKey === undefined) {
      const next = pruneTreeExpanded(expanded, nodeIds);
      if (next !== expanded) onExpandedChange(next);
    }
  }, [expanded, filterKey, onExpandedChange, nodeIds, scopeKey]);
}
