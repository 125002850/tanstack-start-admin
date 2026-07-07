import type { Cell } from '@tanstack/react-table';
import { DataTableOverflowTooltipText } from '@/components/ui/table/cells/data-table-overflow-tooltip-text';

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

function isTextLikeNode(node: React.ReactNode): node is string | number | bigint | boolean {
  const t = typeof node;
  return t === 'string' || t === 'number' || t === 'bigint' || t === 'boolean';
}

function textLikeNodeToString(node: React.ReactNode): string | null {
  if (isTextLikeNode(node)) return displayText(node);
  if (!Array.isArray(node)) return null;

  const parts = node.map(textLikeNodeToString);
  if (parts.some((part) => part === null)) return null;
  return parts.join('');
}

/** TanStack's default cell renderer calls `renderValue()` instead of `getValue()`. */
function isDefaultCellFn(fn: unknown): fn is Function {
  return typeof fn === 'function' && fn.toString().includes('renderValue');
}

/** "—" placeholder for falsy accessor values, consistent with `|| '-'` pattern. */
function displayText(value: unknown): string {
  if (value == null || value === '') return '-';
  return String(value);
}

function TextCellContent({ value, children }: { value: string; children: React.ReactNode }) {
  return <DataTableOverflowTooltipText value={value}>{children}</DataTableOverflowTooltipText>;
}

/**
 * Automatically applies truncate + Tooltip for text-like cells and
 * overflow-hidden for structured cells (badges, images, etc.).
 */
export function DataTableCellContent<TData, TValue>({
  cell,
  children
}: DataTableCellContentProps<TData, TValue>) {
  if (cell.column.columnDef.meta?.cellOwnsTooltip) {
    return children;
  }

  const rawValue = cell.getValue();
  const hasAccessor = typeof cell.column.accessorFn === 'function';

  if (isTextLikeValue(rawValue) && hasAccessor) {
    const text = displayText(rawValue);
    const isDefaultRender = isDefaultCellFn(cell.column.columnDef.cell);

    // Default renderer: use computed display text so falsy values show "-".
    // Custom primitive renderers use their rendered text for tooltip; structured cells keep accessor text.
    const tooltipText = !isDefaultRender ? (textLikeNodeToString(children) ?? text) : text;
    return (
      <TextCellContent value={tooltipText}>{isDefaultRender ? text : children}</TextCellContent>
    );
  }

  // Non-primitive or no accessor (select/actions/group columns).
  return <div className='overflow-hidden'>{children}</div>;
}
