import type { Cell } from '@tanstack/react-table';
import { DataTableOverflowTooltipText } from '@/components/ui/table/cells/data-table-overflow-tooltip-text';

/**
 * 单元格内容包装器。
 *
 * 对纯文本/原始值单元格自动套用截断和 Tooltip；对 Badge、图片、按钮等结构化内容只做
 * overflow 保护。列可以通过 meta.cellOwnsTooltip 声明自己完全接管 Tooltip 行为。
 */
interface DataTableCellContentProps<TData, TValue> {
  cell: Cell<TData, TValue>;
  children: React.ReactNode;
}

/**
 * 判断 accessor 的原始值是否属于纯文本友好类型。
 *
 * 这里检查 `cell.getValue()`，不是渲染后的 children；因为 flexRender 可能把输出包装成
 * React element，直接看 children 会误判自定义文本单元格。
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

/** TanStack 默认 cell renderer 内部会调用 `renderValue()`，可用函数源码做轻量识别。 */
function isDefaultCellFn(fn: unknown): fn is Function {
  return typeof fn === 'function' && fn.toString().includes('renderValue');
}

/** 空值统一展示为 `-`，保持和业务列常见的 `|| '-'` 语义一致。 */
function displayText(value: unknown): string {
  if (value == null || value === '') return '-';
  return String(value);
}

/** 文本单元格统一经过 DataTableOverflowTooltipText 处理截断和溢出提示。 */
function TextCellContent({ value, children }: { value: string; children: React.ReactNode }) {
  return <DataTableOverflowTooltipText value={value}>{children}</DataTableOverflowTooltipText>;
}

/**
 * 自动为文本型单元格添加 truncate + Tooltip；
 * 非文本结构化内容只包一层 overflow-hidden，避免内部组件被错误转换成文本。
 */
export function DataTableCellContent<TData, TValue>({
  cell,
  children
}: DataTableCellContentProps<TData, TValue>) {
  if (cell.column.columnDef.meta?.cellOwnsTooltip) {
    // 复杂单元格如果自己已经渲染 Tooltip，外层不再重复包裹。
    return children;
  }

  const rawValue = cell.getValue();
  const hasAccessor = typeof cell.column.accessorFn === 'function';

  if (isTextLikeValue(rawValue) && hasAccessor) {
    const text = displayText(rawValue);
    const isDefaultRender = isDefaultCellFn(cell.column.columnDef.cell);

    // 默认 renderer 使用规范化 displayText，确保空值显示为 "-";
    // 自定义 primitive renderer 则优先用渲染文本作为 Tooltip 内容。
    const tooltipText = !isDefaultRender ? (textLikeNodeToString(children) ?? text) : text;
    return (
      <TextCellContent value={tooltipText}>{isDefaultRender ? text : children}</TextCellContent>
    );
  }

  // 非 primitive 或无 accessor 的列（选择列、操作列、分组列等）不自动加文本 Tooltip。
  return <div className='overflow-hidden'>{children}</div>;
}
