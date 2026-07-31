import { flexRender, type Column, type Table } from '@tanstack/react-table';
import * as React from 'react';

/**
 * 从 ColumnDef 中提取人类可读列名。
 *
 * 优先级：meta.label -> 渲染后的 header 文本 -> column.id。列面板、拖拽 overlay 和
 * 无障碍文案都依赖这个 helper，避免每处各自解析 header。
 */
function extractTextFromNode(node: React.ReactNode): string | undefined {
  if (node == null || typeof node === 'boolean') {
    return undefined;
  }

  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') {
    const text = String(node).trim();
    return text.length > 0 ? text : undefined;
  }

  if (Array.isArray(node)) {
    // 递归拼接数组子节点，适配 header 返回多个文本片段的场景。
    const texts = node.map(extractTextFromNode).filter((value): value is string => !!value);
    return texts.length > 0 ? texts.join(' ') : undefined;
  }

  if (React.isValidElement(node)) {
    // 自定义 header 组件可通过 title prop 显式暴露可读文本。
    const props = node.props as { title?: unknown; children?: React.ReactNode };

    if (typeof props.title === 'string' && props.title.trim().length > 0) {
      return props.title;
    }

    return extractTextFromNode(props.children);
  }

  return undefined;
}

/** 获取列名，尽量从用户可见文案中推导，最后才退回 column.id。 */
export function getDataTableColumnLabel<TData>(column: Column<TData>, table: Table<TData>): string {
  const explicitLabel = column.columnDef.meta?.label;
  if (typeof explicitLabel === 'string' && explicitLabel.trim().length > 0) {
    return explicitLabel;
  }

  const header = table
    .getFlatHeaders()
    .find((candidate) => !candidate.isPlaceholder && candidate.column.id === column.id);

  if (header) {
    const headerDef = header.column.columnDef.header;
    const renderedHeader =
      typeof headerDef === 'function'
        ? headerDef(header.getContext())
        : flexRender(headerDef, header.getContext());
    const headerText = extractTextFromNode(renderedHeader);
    if (headerText) {
      return headerText;
    }
  }

  return column.id;
}
