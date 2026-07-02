import * as React from 'react';
import { describe, expect, it } from 'vitest';

import {
  createDataTableColumnDsl,
  dataTableColumnFormatters,
  dataTableColumns
} from './data-table-column-factory';

interface Row {
  name?: string;
  amount?: number;
  status?: string;
  createdAt?: string;
}

function renderCell(column: { cell?: unknown }, row: Row) {
  if (typeof column.cell !== 'function') return undefined;
  return column.cell({ row: { original: row } });
}

function getNodeText(node: unknown): string | undefined {
  if (node == null) return undefined;

  const nodeType = typeof node;
  if (
    nodeType === 'string' ||
    nodeType === 'number' ||
    nodeType === 'bigint' ||
    nodeType === 'boolean'
  ) {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(getNodeText).join('');
  }

  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return getNodeText(node.props.children);
  }

  return undefined;
}

function renderCellText(column: { cell?: unknown }, row: Row) {
  return getNodeText(renderCell(column, row));
}

describe('data-table-column-factory', () => {
  it('creates text columns with normalized empty values', () => {
    const column = dataTableColumns.text<Row, 'name'>('name', '名称');

    expect((column as { accessorKey?: unknown }).accessorKey).toBe('name');
    expect(renderCellText(column, { name: '' })).toBe('-');
    expect(renderCellText(column, { name: '云禾' })).toBe('云禾');
  });

  it('creates formatted money columns', () => {
    const column = dataTableColumns.money<Row, 'amount'>('amount', '金额');

    expect(renderCellText(column, { amount: 1234.5 })).toBe('1,234.50');
  });

  it('formats text columns through the format option', () => {
    const column = dataTableColumns.text<Row, 'status'>('status', '状态', {
      format: (value) => (value === 'DONE' ? '已完成' : value)
    });

    expect(renderCellText(column, { status: 'DONE' })).toBe('已完成');
  });

  it('creates badge columns without rendering empty badges', () => {
    const emptyColumn = dataTableColumns.badge<Row, 'status'>('status', '状态');
    const badgeColumn = dataTableColumns.badge<Row, 'status'>('status', '状态');

    expect(renderCell(emptyColumn, {})).toBe('-');
    expect(renderCell(badgeColumn, { status: '成功' })).toBeTruthy();
  });

  it('creates a page scoped column dsl with field formatters', () => {
    const columnDsl = createDataTableColumnDsl<Row>({
      fieldFormatters: [
        dataTableColumnFormatters.money<Row>(['amount']),
        dataTableColumnFormatters.date<Row>(['createdAt'])
      ]
    });

    expect(renderCellText(columnDsl.text('amount', '金额'), { amount: 12 })).toBe('12.00');
    expect(renderCellText(columnDsl.text('createdAt', '创建时间'), { createdAt: '2026-06-29' })).toBe(
      '2026-06-29'
    );
    expect(
      renderCellText(
        columnDsl.text('status', '状态', {
          format: (value) => (value === 'DONE' ? '已完成' : value)
        }),
        { status: 'DONE' }
      )
    ).toBe('已完成');
  });
});
