import { flexRender, type Column, type Table } from '@tanstack/react-table';
import * as React from 'react';

function extractTextFromNode(node: React.ReactNode): string | undefined {
  if (node == null || typeof node === 'boolean') {
    return undefined;
  }

  if (typeof node === 'string' || typeof node === 'number' || typeof node === 'bigint') {
    const text = String(node).trim();
    return text.length > 0 ? text : undefined;
  }

  if (Array.isArray(node)) {
    const texts = node.map(extractTextFromNode).filter((value): value is string => !!value);
    return texts.length > 0 ? texts.join(' ') : undefined;
  }

  if (React.isValidElement(node)) {
    const props = node.props as { title?: unknown; children?: React.ReactNode };

    if (typeof props.title === 'string' && props.title.trim().length > 0) {
      return props.title;
    }

    return extractTextFromNode(props.children);
  }

  return undefined;
}

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
