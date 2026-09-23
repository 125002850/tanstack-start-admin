import userEvent from '@testing-library/user-event';
import { cleanup, render, screen } from '@testing-library/react';
import {
  getCoreRowModel,
  getExpandedRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef
} from '@tanstack/react-table';
import { afterEach, describe, expect, it } from 'vitest';

import { DataTablePagination } from './data-table-pagination';

afterEach(cleanup);

type TestRow = { id: number; name: string };

const columns: Array<ColumnDef<TestRow>> = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' }
];

const rows: TestRow[] = Array.from({ length: 5 }, (_, index) => ({
  id: index + 1,
  name: `Item ${index + 1}`
}));

function Harness({
  rowCount,
  selectedRowCount,
  rowSelection
}: {
  rowCount?: number;
  selectedRowCount?: number;
  rowSelection?: Record<string, boolean>;
}) {
  const table = useReactTable({
    data: rows,
    columns,
    rowCount,
    manualPagination: rowCount !== undefined,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 5, pageIndex: 0 },
      rowSelection
    }
  });

  return <DataTablePagination table={table} selectedRowCount={selectedRowCount} />;
}

describe('DataTablePagination', () => {
  it('reads the server total row count from the table instance', () => {
    render(<Harness rowCount={42} />);

    expect(screen.getByText('共 42 条数据')).toBeInTheDocument();
  });

  it('falls back to the filtered row count when no server total is provided', () => {
    render(<Harness />);

    expect(screen.getByText('共 5 条数据')).toBeInTheDocument();
  });

  it('uses the current page row count for selected summary when selectedRowCount is implicit', () => {
    render(<Harness rowCount={42} rowSelection={{ '0': true }} />);

    expect(screen.getByText('已选择 1 / 5 行')).toBeInTheDocument();
  });

  it('uses the provided selectedRowCount with the server total when explicitly controlled', () => {
    render(<Harness rowCount={42} selectedRowCount={7} rowSelection={{ '0': true }} />);

    expect(screen.getByText('已选择 7 / 42 行')).toBeInTheDocument();
  });
});

interface TreePaginationRow {
  id: string;
  selectable: boolean;
  children?: TreePaginationRow[];
}

function TreeHarness({ controlledCount }: { controlledCount: boolean }) {
  const data: TreePaginationRow[] = [
    { id: 'parent', selectable: true, children: [{ id: 'child', selectable: true }] },
    { id: 'other', selectable: true, children: [{ id: 'disabled-child', selectable: false }] }
  ];
  const table = useReactTable({
    data,
    columns: [{ accessorKey: 'id' }],
    meta: { dataTableTree: { columnId: 'id' } },
    getRowId: (row) => row.id,
    getSubRows: (row) => row.children,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    enableRowSelection: (row) => row.original.selectable,
    enableSubRowSelection: false,
    manualPagination: true,
    rowCount: 40,
    initialState: { rowSelection: { child: true } }
  });

  return (
    <>
      <button type='button' onClick={() => table.toggleAllRowsExpanded()}>
        切换展开
      </button>
      <DataTablePagination table={table} selectedRowCount={controlledCount ? 1 : undefined} />
    </>
  );
}

it.each([false, true])('树表选择分母使用本页可选节点，受控数量为 %s', async (controlledCount) => {
  const user = userEvent.setup();
  render(<TreeHarness controlledCount={controlledCount} />);
  expect(screen.getByText('已选择 1 / 3 行')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '切换展开' }));
  expect(screen.getByText('已选择 1 / 3 行')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '切换展开' }));
  expect(screen.getByText('已选择 1 / 3 行')).toBeInTheDocument();
});

it.each(['Enter', 'blur'])(
  'enters editing, selects the current page and submits on %s',
  async (submitMethod) => {
    const user = userEvent.setup();
    render(<Harness rowCount={100} />);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '前往下一页' }));
    await user.click(screen.getByRole('button', { name: '跳转页码' }));
    const input = screen.getByRole<HTMLInputElement>('textbox', { name: '跳转页码' });
    expect(input).toHaveFocus();
    expect(input).toHaveValue('2');
    expect(input.selectionStart).toBe(0);
    expect(input.selectionEnd).toBe(1);
    await user.keyboard('8');
    expect(input).toHaveValue('8');
    if (submitMethod === 'Enter') await user.keyboard('{Enter}');
    else await user.tab();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '跳转页码' })).toHaveTextContent('第 8 / 20 页');
    await user.click(screen.getByRole('button', { name: '前往下一页' }));
    expect(screen.getByRole('button', { name: '跳转页码' })).toHaveTextContent('第 9 / 20 页');
  }
);

it('exits editing on Escape or invalid input without navigating', async () => {
  const user = userEvent.setup();
  render(<Harness rowCount={100} />);
  for (const ending of ['escape', 'invalid']) {
    await user.click(screen.getByRole('button', { name: '跳转页码' }));
    await user.keyboard(ending === 'invalid' ? '2.5{Enter}' : '8');
    if (ending === 'escape') await user.keyboard('{Escape}');
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '跳转页码' })).toHaveTextContent('第 1 / 20 页');
    expect(screen.getByRole('button', { name: '前往上一页' })).toBeDisabled();
  }
});

it('clamps pages and closes editing when the total changes', async () => {
  const user = userEvent.setup();
  const { rerender } = render(<Harness rowCount={100} />);
  await user.click(screen.getByRole('button', { name: '跳转页码' }));
  await user.keyboard('999{Enter}');
  expect(screen.getByRole('button', { name: '跳转页码' })).toHaveTextContent('第 20 / 20 页');
  expect(screen.getByRole('button', { name: '前往下一页' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: '跳转页码' }));
  await user.keyboard('0{Enter}');
  expect(screen.getByRole('button', { name: '跳转页码' })).toHaveTextContent('第 1 / 20 页');
  await user.click(screen.getByRole('button', { name: '跳转页码' }));
  await user.keyboard('8');
  rerender(<Harness rowCount={10} />);
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '跳转页码' })).toHaveTextContent('第 1 / 2 页');
});

it.each([0, 5])('does not enter editing for %s server rows', async (rowCount) => {
  const user = userEvent.setup();
  render(<Harness rowCount={rowCount} />);
  const page = rowCount === 0 ? 0 : 1;
  await user.click(screen.getByText(`第 ${page} / ${page} 页`));
  expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '跳转页码' })).not.toBeInTheDocument();
});
