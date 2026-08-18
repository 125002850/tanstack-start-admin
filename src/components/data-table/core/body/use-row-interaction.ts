import type { Row } from '@tanstack/react-table';
import { useCallback } from 'react';

import { cn } from '@/lib/utils';

import type { DataTableBodyRowInteraction } from './types';

const ROW_EXPAND_IGNORE_SELECTOR = [
  '[data-row-expand-ignore]',
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="menuitem"]',
  '[role="checkbox"]'
].join(',');

function shouldIgnoreRowExpandTarget(target: EventTarget | null, currentTarget: HTMLElement) {
  if (!(target instanceof HTMLElement) || !currentTarget.contains(target)) return true;
  return Boolean(target.closest(ROW_EXPAND_IGNORE_SELECTOR));
}

export function useRowInteraction<TData>({
  onRowClick,
  expandedRowKey,
  getExpandRowKey
}: {
  onRowClick?: (rowKey: string) => void;
  expandedRowKey?: string | null;
  getExpandRowKey?: (row: TData) => string | null;
}): DataTableBodyRowInteraction<TData> {
  const handleClick = useCallback(
    (event: React.MouseEvent<HTMLTableRowElement>, row: Row<TData>) => {
      if (shouldIgnoreRowExpandTarget(event.target, event.currentTarget)) return;
      const rowKey = getExpandRowKey?.(row.original);
      if (rowKey) onRowClick?.(rowKey);
    },
    [getExpandRowKey, onRowClick]
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTableRowElement>, row: Row<TData>) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (shouldIgnoreRowExpandTarget(event.target, event.currentTarget)) return;
      const rowKey = getExpandRowKey?.(row.original);
      if (!rowKey) return;
      event.preventDefault();
      onRowClick?.(rowKey);
    },
    [getExpandRowKey, onRowClick]
  );

  const getTabIndex = useCallback(
    (row: Row<TData>) => (onRowClick && getExpandRowKey?.(row.original) ? 0 : undefined),
    [getExpandRowKey, onRowClick]
  );

  const isExpanded = useCallback(
    (row: Row<TData>) =>
      Boolean(expandedRowKey && getExpandRowKey?.(row.original) === expandedRowKey),
    [expandedRowKey, getExpandRowKey]
  );

  return {
    className: cn(onRowClick && 'cursor-pointer'),
    getTabIndex,
    handleClick,
    handleKeyDown,
    isExpanded,
    shouldIgnoreTarget: shouldIgnoreRowExpandTarget
  };
}
