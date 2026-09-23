import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  flexRender,
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable
} from '@tanstack/react-table';
import { afterEach, describe, expect, it } from 'vitest';

import { getSelectedPageRowIds } from '@/lib/data-table/selection';
import { createSelectColumn } from './select-column';

afterEach(cleanup);

interface TestRow {
  id: string;
  selectable?: boolean;
  children?: TestRow[];
}

const rows: TestRow[] = [
  {
    id: 'resource-a',
    children: [{ id: 'grant-a' }, { id: 'disabled-grant', selectable: false }]
  },
  { id: 'resource-b' }
];
const columns = [createSelectColumn<TestRow>(), { accessorKey: 'id' }];

function Harness({
  data = rows,
  selectRootsOnly = false
}: {
  data?: TestRow[];
  selectRootsOnly?: boolean;
}) {
  const table = useReactTable({
    data,
    columns,
    meta: { dataTableTree: { columnId: 'id' } },
    getRowId: (row) => row.id,
    getSubRows: (row) => row.children,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    manualPagination: true,
    enableSubRowSelection: false,
    enableRowSelection: (row) =>
      row.original.selectable !== false && (!selectRootsOnly || row.depth === 0),
    initialState: { rowSelection: { 'previous-page': true } }
  });

  return (
    <>
      <button type='button' onClick={() => table.toggleAllRowsExpanded()}>
        切换展开
      </button>
      <output aria-label='已选标识'>{getSelectedPageRowIds(table).join(',')}</output>
      <output aria-label='所有选择状态'>{JSON.stringify(table.getState().rowSelection)}</output>
      <table>
        <thead>
          {table.getHeaderGroups().map((group) => (
            <tr key={group.id}>
              {group.headers.map((header) => (
                <th key={header.id}>
                  {flexRender(header.column.columnDef.header, header.getContext())}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id} aria-label={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

describe('树表选择列', () => {
  it('单行选择不级联，全选包含折叠的可选子节点，收起后保持选择', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const selectAll = screen.getByRole('checkbox', { name: '全选' });

    await user.click(within(screen.getByRole('row', { name: 'resource-a' })).getByRole('checkbox'));
    expect(screen.getByLabelText('已选标识')).toHaveTextContent(/^resource-a$/);
    expect(selectAll).toHaveAttribute('aria-checked', 'mixed');

    await user.click(selectAll);
    expect(screen.getByLabelText('已选标识')).toHaveTextContent(/^resource-a,grant-a,resource-b$/);
    expect(selectAll).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('button', { name: '切换展开' }));
    expect(
      within(screen.getByRole('row', { name: 'disabled-grant' })).getByRole('checkbox')
    ).toBeDisabled();
    await user.click(screen.getByRole('button', { name: '切换展开' }));
    expect(screen.getByLabelText('已选标识')).toHaveTextContent(/^resource-a,grant-a,resource-b$/);

    await user.click(selectAll);
    expect(screen.getByLabelText('已选标识')).toBeEmptyDOMElement();
    expect(screen.getByLabelText('所有选择状态')).toHaveTextContent('{"previous-page":true}');
  });

  it('全选只影响筛选后保留的节点，不清除筛选外已有选择', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<Harness />);
    await user.click(screen.getByRole('checkbox', { name: '全选' }));
    rerender(<Harness data={[rows[1]!]} />);
    expect(screen.getByLabelText('已选标识')).toHaveTextContent(/^resource-b$/);
    await user.click(screen.getByRole('checkbox', { name: '全选' }));
    expect(screen.getByLabelText('已选标识')).toBeEmptyDOMElement();

    rerender(<Harness />);
    expect(screen.getByLabelText('已选标识')).toHaveTextContent(/^resource-a,grant-a$/);
    expect(screen.getByRole('checkbox', { name: '全选' })).toHaveAttribute('aria-checked', 'mixed');
  });

  it('允许只选择资源父行，子授权不进入批量操作对象', async () => {
    const user = userEvent.setup();
    render(<Harness selectRootsOnly />);
    await user.click(screen.getByRole('checkbox', { name: '全选' }));
    expect(screen.getByLabelText('已选标识')).toHaveTextContent(/^resource-a,resource-b$/);
    await user.click(screen.getByRole('button', { name: '切换展开' }));
    expect(
      within(screen.getByRole('row', { name: 'grant-a' })).getByRole('checkbox')
    ).toBeDisabled();
    expect(screen.getByRole('checkbox', { name: '全选' })).toHaveAttribute('aria-checked', 'true');
  });

  it('根节点不可选而折叠子节点可选时，全选仍可用', async () => {
    const user = userEvent.setup();
    render(<Harness data={[{ id: 'parent', selectable: false, children: [{ id: 'child' }] }]} />);
    const selectAll = screen.getByRole('checkbox', { name: '全选' });
    expect(selectAll).toBeEnabled();
    await user.click(selectAll);
    expect(screen.getByLabelText('已选标识')).toHaveTextContent(/^child$/);
    expect(selectAll).toHaveAttribute('aria-checked', 'true');
  });
});
