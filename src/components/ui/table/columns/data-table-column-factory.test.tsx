import * as React from 'react';
import type { Row as TanStackRow } from '@tanstack/react-table';
import { describe, expect, it, vi } from 'vitest';

import { createDataTableColumnDsl, dataTableColumnFormatters } from './data-table-column-factory';

interface Row {
  id?: number;
  name?: string;
  amount?: number;
  status?: string;
  createdAt?: string;
  active?: boolean;
  kind?: string;
  phone?: string;
}

function renderCell(column: { cell?: unknown }, row: Row) {
  if (typeof column.cell !== 'function') return undefined;
  const accessorKey = (column as { accessorKey?: keyof Row }).accessorKey;
  return column.cell({
    row: { original: row },
    getValue: () => (accessorKey ? row[accessorKey] : undefined)
  });
}

function renderCellWithTableRow(column: { cell?: unknown }, tableRow: TanStackRow<Row>) {
  if (typeof column.cell !== 'function') return undefined;

  return column.cell({ row: tableRow });
}

function getRenderedRowActions(node: unknown) {
  expect(React.isValidElement(node)).toBe(true);

  return (
    node as React.ReactElement<{
      actions: Array<{ label: string; onClick?: (row: Row) => void | Promise<void> }>;
    }>
  ).props.actions;
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
  it('creates field columns with normalized empty values', () => {
    const columnDsl = createDataTableColumnDsl<Row>();
    const column = columnDsl.field('name', '名称');

    expect((column as { accessorKey?: unknown }).accessorKey).toBe('name');
    expect(column.meta?.label).toBe('名称');
    expect(renderCellText(column, { name: '' })).toBe('-');
    expect(renderCellText(column, { name: '云禾' })).toBe('云禾');
  });

  it('creates formatted money columns', () => {
    const columnDsl = createDataTableColumnDsl<Row>();
    const column = columnDsl.field('amount', '金额', { type: 'money' });

    expect(renderCellText(column, { amount: 1234.5 })).toBe('1,234.50');
    expect(column.meta?.copyValue?.(1234.5, { amount: 1234.5 })).toBe('1234.5');
  });

  it('formats field columns through the format option', () => {
    const columnDsl = createDataTableColumnDsl<Row>();
    const column = columnDsl.field('status', '状态', {
      format: (value) => (value === 'DONE' ? '已完成' : value)
    });

    expect(renderCellText(column, { status: 'DONE' })).toBe('已完成');
  });

  it('creates badge columns without rendering empty badges', () => {
    const columnDsl = createDataTableColumnDsl<Row>();
    const emptyColumn = columnDsl.badge('status', '状态');
    const badgeColumn = columnDsl.badge('status', '状态');

    expect(badgeColumn.meta?.label).toBe('状态');
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

    expect(renderCellText(columnDsl.field('amount', '金额'), { amount: 12 })).toBe('12.00');
    expect(
      renderCellText(columnDsl.field('createdAt', '创建时间'), {
        createdAt: '2026-06-29'
      })
    ).toBe('2026-06-29');
    expect(
      renderCellText(
        columnDsl.field('status', '状态', {
          format: (value) => (value === 'DONE' ? '已完成' : value)
        }),
        { status: 'DONE' }
      )
    ).toBe('已完成');
  });

  it('compiles field filter options and dsl query metadata', () => {
    const columnDsl = createDataTableColumnDsl<Row>();
    const column = columnDsl.field('name', '名称', {
      filter: 'text',
      filterPlaceholder: '搜索名称',
      enableSorting: true,
      dsl: {
        filterField: 'customer_name',
        sortField: 'customer_name_sort',
        filterOperator: 'EQ'
      }
    });

    expect((column as { accessorKey?: unknown }).accessorKey).toBe('name');
    expect(column.enableColumnFilter).toBe(true);
    expect(column.enableSorting).toBe(true);
    expect(column.meta).toMatchObject({
      label: '名称',
      variant: 'text',
      placeholder: '搜索名称',
      columnPanelVisible: true,
      columnPanelReorder: true,
      query: {
        filterField: 'customer_name',
        sortField: 'customer_name_sort',
        operator: 'EQ'
      }
    });
  });

  it('compiles filter false without leaking stale filter meta', () => {
    const columnDsl = createDataTableColumnDsl<Row>();
    const column = columnDsl.field('name', '名称', {
      filter: false,
      meta: {
        variant: 'text',
        placeholder: '旧占位',
        label: '旧名称'
      }
    });

    expect(column.enableColumnFilter).toBe(false);
    expect(column.meta?.label).toBe('旧名称');
    expect(column.meta?.variant).toBeUndefined();
    expect(column.meta?.placeholder).toBeUndefined();
  });

  it('infers default filter placeholders', () => {
    const columnDsl = createDataTableColumnDsl<Row>();

    expect(columnDsl.field('name', '名称', { filter: 'text' }).meta?.placeholder).toBe('搜索名称');
    expect(columnDsl.field('status', '状态', { filter: 'select' }).meta?.placeholder).toBe(
      '选择状态'
    );
    expect(columnDsl.field('status', '状态', { filter: 'multiSelect' }).meta?.placeholder).toBe(
      '选择状态'
    );
    expect(columnDsl.field('createdAt', '创建时间', { filter: 'date' }).meta?.placeholder).toBe(
      '选择创建时间'
    );
    expect(
      columnDsl.field('createdAt', '创建时间', { filter: 'dateRange' }).meta?.placeholder
    ).toBe('选择创建时间范围');
    expect(columnDsl.field('amount', '金额', { filter: 'number' }).meta?.placeholder).toBe(
      '输入金额'
    );

    const numberRangeColumn = columnDsl.field('amount', '金额', {
      filter: 'numberRange',
      filterMin: 0,
      filterMax: 100,
      filterUnit: '元'
    });

    expect(numberRangeColumn.meta?.placeholder).toBe('输入金额范围');
    expect(numberRangeColumn.meta?.variant).toBe('range');
    expect(numberRangeColumn.meta?.range).toEqual([0, 100]);
    expect(numberRangeColumn.meta?.unit).toBe('元');
    expect(columnDsl.field('active', '启用', { filter: 'boolean' }).meta?.placeholder).toBe(
      '选择启用'
    );
  });

  it('applies field type defaults and fallback formatting', () => {
    const columnDsl = createDataTableColumnDsl<Row>();
    const moneyColumn = columnDsl.field('amount', '金额', { type: 'money' });
    const booleanColumn = columnDsl.field('active', '启用', {
      type: 'boolean'
    });
    const enumColumn = columnDsl.field('kind', '类型', {
      type: 'enum',
      filterOptions: [{ label: '正式', value: 'A' }]
    });

    expect(moneyColumn.size).toBe(140);
    expect(moneyColumn.minSize).toBe(110);
    expect(renderCellText(moneyColumn, { amount: 1234.5 })).toBe('1,234.50');
    expect(renderCellText(booleanColumn, { active: true })).toBe('是');
    expect(renderCellText(booleanColumn, { active: false })).toBe('否');
    expect(renderCellText(enumColumn, { kind: 'A' })).toBe('正式');
  });

  it('creates badge, actions, custom, and custom type columns', () => {
    const onSelect = vi.fn();
    const columnDsl = createDataTableColumnDsl<Row>({
      customTypes: {
        phone: {
          size: 140,
          minSize: 120,
          formatValue: (value) => `tel:${String(value)}`
        }
      }
    });
    const badgeColumn = columnDsl.badge('status', '状态');
    const actionsColumn = columnDsl.actions({
      actions: [{ id: 'view', label: '查看', onSelect }]
    });
    const customColumn = columnDsl.custom({
      id: 'score',
      title: '评分',
      accessorFn: (row) => row.amount ?? 0,
      cell: ({ getValue }) => String(getValue())
    });
    const phoneColumn = columnDsl.field('phone', '电话', { type: 'phone' });

    expect(badgeColumn.size).toBe(120);
    expect(badgeColumn.minSize).toBe(96);
    expect(badgeColumn.meta?.label).toBe('状态');
    expect(renderCell(badgeColumn, { status: '成功' })).toBeTruthy();

    expect(actionsColumn.id).toBe('actions');
    expect((actionsColumn as { accessorKey?: unknown }).accessorKey).toBeUndefined();
    expect(actionsColumn.enableHiding).toBe(false);
    expect(actionsColumn.enableResizing).toBe(false);
    expect(actionsColumn.enableSorting).toBe(false);
    expect(actionsColumn.enableColumnFilter).toBe(false);
    expect(actionsColumn.size).toBe(96);
    expect(actionsColumn.minSize).toBe(72);
    expect(actionsColumn.maxSize).toBe(160);
    expect(actionsColumn.meta).toMatchObject({
      columnPanelVisible: false,
      columnPanelReorder: false
    });

    expect(customColumn.size).toBe(160);
    expect(customColumn.minSize).toBe(80);
    expect(customColumn.meta).toMatchObject({
      label: '评分',
      columnPanelVisible: true,
      columnPanelReorder: true
    });
    expect(phoneColumn.size).toBe(140);
    expect(phoneColumn.minSize).toBe(120);
    expect(renderCellText(phoneColumn, { phone: '13800138000' })).toBe('tel:13800138000');
  });

  it('resolves semantic size presets before creating native columns', () => {
    const columnDsl = createDataTableColumnDsl<Row>();
    const columns = [
      columnDsl.field('name', '名称', { size: 'md' }),
      columnDsl.badge('status', '状态', { size: 'sm' }),
      columnDsl.actions({ size: 'xs', actions: [] }),
      columnDsl.custom({
        id: 'score',
        title: '评分',
        size: 'xl',
        cell: () => null
      }),
      columnDsl.field('amount', '金额', { size: 137 })
    ];

    expect(columns.map((column) => column.size)).toEqual([150, 110, 90, 220, 137]);
  });

  it('keeps adapted row actions stable for the same TanStack row', () => {
    const onSelect = vi.fn();
    const columnDsl = createDataTableColumnDsl<Row>();
    const actionsColumn = columnDsl.actions({
      actions: [{ id: 'view', label: '查看', onSelect }]
    });
    const tableRow = { original: { id: 1, name: '云禾' } } as TanStackRow<Row>;

    const firstActions = getRenderedRowActions(renderCellWithTableRow(actionsColumn, tableRow));
    const secondActions = getRenderedRowActions(renderCellWithTableRow(actionsColumn, tableRow));

    expect(secondActions).toBe(firstActions);

    firstActions[0]?.onClick?.(tableRow.original);
    expect(onSelect).toHaveBeenCalledWith({ row: tableRow.original, tableRow });
  });

  it('rejects custom column types that override built-in types', () => {
    expect(() =>
      createDataTableColumnDsl<Row>({
        customTypes: {
          text: {}
        }
      })
    ).toThrow('cannot override a built-in type');
  });
});

function expectColumnDslTypeErrors() {
  const columnDsl = createDataTableColumnDsl<Row>();
  const filterObjectApi = { variant: 'text' };
  const disabledSerializeFilter = false;

  // @ts-expect-error filter object API is forbidden
  columnDsl.field('name', '名称', { filter: filterObjectApi });

  // @ts-expect-error serializeFilter only accepts a function
  columnDsl.field('name', '名称', { dsl: { serializeFilter: disabledSerializeFilter } });

  // @ts-expect-error size only accepts a known preset or an exact number
  columnDsl.field('name', '名称', { size: 'huge' });
}

void expectColumnDslTypeErrors;
