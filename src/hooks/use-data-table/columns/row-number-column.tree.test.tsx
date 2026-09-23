import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  getSortedRowModel,
  useReactTable
} from '@tanstack/react-table';
import { afterEach, describe, expect, it } from 'vitest';

import { createRowNumberColumn, type RowNumberDisplayMode } from './row-number-column';

afterEach(cleanup);

interface TestRow {
  id: string;
  name: string;
  children?: TestRow[];
}

const rows: TestRow[] = [
  { id: 'parent-b', name: 'B', children: [{ id: 'child', name: 'C' }] },
  { id: 'parent-a', name: 'A' }
];
const columns = [createRowNumberColumn<TestRow>(), { accessorKey: 'name' }];

function Harness({ mode = 'static' }: { mode?: RowNumberDisplayMode }) {
  const table = useReactTable({
    data: rows,
    columns,
    meta: { dataTableTree: { columnId: 'name' }, rowNumberDisplayMode: mode },
    getRowId: (row) => row.id,
    getSubRows: (row) => row.children,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    rowCount: 50,
    initialState: { pagination: { pageIndex: 2, pageSize: 10 } }
  });

  return (
    <>
      <button type='button' onClick={() => table.toggleAllRowsExpanded()}>
        切换展开
      </button>
      <button type='button' onClick={() => table.setSorting([{ id: 'name', desc: false }])}>
        按名称排序
      </button>
      {table.getRowModel().rows.map((row) => {
        const cell = row.getVisibleCells()[0]!;
        return (
          <div key={row.id} aria-label={`序号 ${row.id}`}>
            {flexRender(cell.column.columnDef.cell, cell.getContext())}
          </div>
        );
      })}
    </>
  );
}

describe('树表序号列', () => {
  it('按排序后的根节点和页偏移编号，展开子行不影响下一条根记录', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    expect(screen.getByLabelText('序号 parent-b')).toHaveTextContent('21');
    expect(screen.getByLabelText('序号 parent-a')).toHaveTextContent('22');

    await user.click(screen.getByRole('button', { name: '切换展开' }));
    expect(screen.getByLabelText('序号 child')).toBeEmptyDOMElement();
    expect(screen.getByLabelText('序号 parent-a')).toHaveTextContent('22');
    await user.click(screen.getByRole('button', { name: '按名称排序' }));
    expect(screen.getByLabelText('序号 parent-a')).toHaveTextContent('21');
    expect(screen.getByLabelText('序号 parent-b')).toHaveTextContent('22');
    expect(screen.getByLabelText('序号 child')).toBeEmptyDOMElement();
  });

  it('original 模式保留根数组序号，不使用子节点同级索引', async () => {
    const user = userEvent.setup();
    render(<Harness mode='original' />);
    await user.click(screen.getByRole('button', { name: '切换展开' }));
    await user.click(screen.getByRole('button', { name: '按名称排序' }));
    expect(screen.getByLabelText('序号 parent-b')).toHaveTextContent('1');
    expect(screen.getByLabelText('序号 parent-a')).toHaveTextContent('2');
    expect(screen.getByLabelText('序号 child')).toBeEmptyDOMElement();
  });
});
