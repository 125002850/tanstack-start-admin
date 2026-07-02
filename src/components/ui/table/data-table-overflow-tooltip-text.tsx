import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useCellTooltip } from '@/components/ui/table/data-table-cell-tooltip';
import { cn } from '@/lib/utils';

interface DataTableOverflowTooltipTextProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

/**
 * Shared truncate + overflow-tooltip wrapper for plain text in table headers/cells.
 */
export function DataTableOverflowTooltipText({
  value,
  children,
  className
}: DataTableOverflowTooltipTextProps) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);
  const cellTooltip = useCellTooltip();

  useLayoutEffect(() => {
    const el = spanRef.current;
    if (!el) return;

    const check = () => {
      const overflowing = el.scrollWidth > el.clientWidth;
      setIsOverflowing((prev) => (prev !== overflowing ? overflowing : prev));
    };

    check();

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value]);

  const handleMouseEnter = useCallback(() => {
    if (cellTooltip && isOverflowing && spanRef.current) {
      cellTooltip.showTooltip(spanRef.current, value);
    }
  }, [cellTooltip, isOverflowing, value]);

  const handleMouseLeave = useCallback(() => {
    cellTooltip?.hideTooltip();
  }, [cellTooltip]);

  return (
    <span
      ref={spanRef}
      className={cn('block max-w-full truncate', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </span>
  );
}
