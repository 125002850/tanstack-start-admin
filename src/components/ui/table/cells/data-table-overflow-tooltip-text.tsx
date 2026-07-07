import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useCellTooltip } from '@/components/ui/table/cells/data-table-cell-tooltip';
import { cn } from '@/lib/utils';

/**
 * 可复用的文本截断组件。
 *
 * 只有检测到 scrollWidth > clientWidth 时才打开共享 Tooltip，避免所有普通文本 hover
 * 都弹提示；ResizeObserver 保证列宽拖拽、窗口变化和列显隐后重新判断是否溢出。
 */
interface DataTableOverflowTooltipTextProps {
  value: string;
  children: React.ReactNode;
  className?: string;
}

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
      // 溢出状态相同则复用旧 state，降低 ResizeObserver 高频触发时的重渲染。
      const overflowing = el.scrollWidth > el.clientWidth;
      setIsOverflowing((prev) => (prev !== overflowing ? overflowing : prev));
    };

    check();

    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [value]);

  useLayoutEffect(() => {
    const el = spanRef.current;
    return () => {
      // value 改变或组件卸载时立即隐藏旧 tooltip，避免悬浮内容滞留。
      if (el) {
        cellTooltip?.hideTooltip(el, { immediate: true });
      }
    };
  }, [cellTooltip, value]);

  const handleMouseEnter = useCallback(() => {
    // 只有文本实际溢出且存在共享 tooltip provider 时才显示浮层。
    if (cellTooltip && isOverflowing && spanRef.current) {
      cellTooltip.showTooltip(spanRef.current, value);
    }
  }, [cellTooltip, isOverflowing, value]);

  const handleMouseLeave = useCallback(() => {
    if (spanRef.current) {
      cellTooltip?.hideTooltip(spanRef.current);
    } else {
      cellTooltip?.hideTooltip();
    }
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
