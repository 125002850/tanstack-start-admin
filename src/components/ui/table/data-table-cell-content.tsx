import type { Cell } from '@tanstack/react-table';
import { useLayoutEffect, useRef, useState } from 'react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface DataTableCellContentProps<TData, TValue> {
  cell: Cell<TData, TValue>;
  children: React.ReactNode;
}

/**
 * Checks whether a cell value is a primitive that renders as plain text
 * (as opposed to structured JSX like badges/images).
 *
 * We check `cell.getValue()` — NOT the rendered children — because
 * flexRender always wraps output in a React element.
 */
function isTextLikeValue(value: unknown): boolean {
  if (value == null) return true;
  const t = typeof value;
  return t === 'string' || t === 'number' || t === 'bigint' || t === 'boolean';
}

/**
 * Distinguishes TanStack Table's built-in default cell renderer from a
 * user-provided custom `cell` function.
 *
 * TanStack's default calls `props.renderValue()`. User code universally
 * destructures `cell.getValue()` instead. Fingerprinting the function
 * source on `renderValue` reliably tells them apart.
 */
function isDefaultCellFn(fn: unknown): fn is Function {
  return typeof fn === 'function' && fn.toString().includes('renderValue');
}

/**
 * Text cell with truncate. Only wraps in Tooltip when the content actually
 * overflows (scrollWidth > clientWidth). Otherwise the span is rendered
 * without a tooltip to avoid showing tooltips on cells that already fit.
 */
function TextCellContent({ value, children }: { value: string; children: React.ReactNode }) {
  const spanRef = useRef<HTMLSpanElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

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

  const span = (
    <span ref={spanRef} className='block truncate max-w-full'>
      {children}
    </span>
  );

  // Only show tooltip when text is actually truncated
  return (
    <Tooltip open={isOverflowing ? undefined : false}>
      <TooltipTrigger asChild>{span}</TooltipTrigger>
      <TooltipContent side='top' sideOffset={4}>
        {value}
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Automatically applies truncate + Tooltip for text-like cells and
 * overflow-hidden for structured cells (badges, images, etc.).
 */
export function DataTableCellContent<TData, TValue>({
  cell,
  children
}: DataTableCellContentProps<TData, TValue>) {
  const rawValue = cell.getValue();
  // Use column.accessorFn (on the Column object, not columnDef union type)
  const hasAccessor = typeof cell.column.accessorFn === 'function';
  const hasCustomCell = !isDefaultCellFn(cell.column.columnDef.cell);

  // Structured content: custom cell render (badge, image, checkbox),
  // no accessor (select/actions column), or non-primitive value.
  if (hasCustomCell || !hasAccessor || !isTextLikeValue(rawValue)) {
    return <div className='overflow-hidden'>{children}</div>;
  }

  // Default cell render + primitive value = plain text.
  // Always truncate, only show tooltip on actual overflow.
  return (
    <TextCellContent value={String(rawValue)}>{children}</TextCellContent>
  );
}
