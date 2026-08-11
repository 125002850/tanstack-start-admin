import { useCallback, useRef } from 'react';
import { useCellTooltip } from '@/components/data-table/cells/data-table-cell-tooltip';
import { cn } from '@/lib/utils';

/**
 * 可复用的文本截断组件。
 *
 * 只有 hover 时检测到 scrollWidth > clientWidth 才打开共享 Tooltip，避免所有普通文本
 * 都弹提示，也避免为虚拟表格中的每个文本 cell 常驻 ResizeObserver。
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
  const cellTooltip = useCellTooltip();

  const setSpanRef = useCallback(
    (node: HTMLSpanElement | null) => {
      const previous = spanRef.current;
      if (previous && previous !== node) {
        // value 改变或组件卸载时立即隐藏旧 tooltip，避免悬浮内容滞留。
        cellTooltip?.hideTooltip(previous, { immediate: true });
      }
      spanRef.current = node;
    },
    [cellTooltip]
  );

  const handleMouseEnter = useCallback(() => {
    const element = spanRef.current;
    // 在交互发生时读取最新布局，列宽拖拽和窗口变化不需要逐 cell 订阅。
    if (cellTooltip && element && element.scrollWidth > element.clientWidth) {
      cellTooltip.showTooltip(element, value);
    }
  }, [cellTooltip, value]);

  const handleMouseLeave = useCallback(() => {
    if (spanRef.current) {
      cellTooltip?.hideTooltip(spanRef.current);
    } else {
      cellTooltip?.hideTooltip();
    }
  }, [cellTooltip]);

  return (
    <span
      key={value}
      ref={setSpanRef}
      data-slot='data-table-overflow-text'
      className={cn('block max-w-full truncate', className)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {children}
    </span>
  );
}
