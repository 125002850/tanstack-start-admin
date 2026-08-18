import { useCallback, useRef, type ComponentProps, type Key } from 'react';

import { useCellTooltip } from '@/components/data-table/cells/data-table-cell-tooltip';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type BadgeVariant = ComponentProps<typeof Badge>['variant'];

export interface DataTableBadgeListItem {
  key: Key;
  label: string;
  variant?: BadgeVariant;
}

interface DataTableBadgeListCellProps {
  items: readonly DataTableBadgeListItem[];
  maxVisible?: number;
  className?: string;
}

const DEFAULT_MAX_VISIBLE = 2;

/**
 * 数组字段的紧凑 Badge 列表。
 *
 * 默认只展示前两个值，其余值折叠为 +N；存在折叠项或容器实际溢出时，通过
 * DataTable 的单例 Tooltip 展示完整列表，避免每个 Badge 常驻一个 Tooltip 实例。
 */
export function DataTableBadgeListCell({
  items,
  maxVisible = DEFAULT_MAX_VISIBLE,
  className
}: DataTableBadgeListCellProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cellTooltip = useCellTooltip();
  const visibleCount = Number.isFinite(maxVisible)
    ? Math.max(1, Math.floor(maxVisible))
    : DEFAULT_MAX_VISIBLE;
  const visibleItems = items.slice(0, visibleCount);
  const hiddenCount = Math.max(0, items.length - visibleItems.length);
  const tooltipText = items.map((item) => item.label).join('，');

  const setContainerRef = useCallback(
    (node: HTMLDivElement | null) => {
      const previous = containerRef.current;
      if (previous && previous !== node) {
        cellTooltip?.hideTooltip(previous, { immediate: true });
      }
      containerRef.current = node;
    },
    [cellTooltip]
  );

  const handleMouseEnter = useCallback(() => {
    const element = containerRef.current;
    if (cellTooltip && element && (hiddenCount > 0 || element.scrollWidth > element.clientWidth)) {
      cellTooltip.showTooltip(element, tooltipText);
    }
  }, [cellTooltip, hiddenCount, tooltipText]);

  const handleMouseLeave = useCallback(() => {
    if (containerRef.current) {
      cellTooltip?.hideTooltip(containerRef.current);
    } else {
      cellTooltip?.hideTooltip();
    }
  }, [cellTooltip]);

  if (items.length === 0) return '-';

  return (
    <div
      key={tooltipText}
      ref={setContainerRef}
      data-slot='data-table-badge-list'
      aria-label={tooltipText}
      className={cn('flex max-w-full items-center gap-1 overflow-hidden', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {visibleItems.map((item) => (
        <Badge key={item.key} variant={item.variant ?? 'secondary'}>
          {item.label}
        </Badge>
      ))}
      {hiddenCount > 0 ? <Badge variant='outline'>+{hiddenCount}</Badge> : null}
    </div>
  );
}
