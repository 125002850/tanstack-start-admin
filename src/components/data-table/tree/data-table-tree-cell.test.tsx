import {
  getCoreRowModel,
  getExpandedRowModel,
  useReactTable,
  type Table
} from '@tanstack/react-table';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataTableBody } from '@/components/data-table/core/data-table-body';

type TreeRecord = { id: string; label: string; children?: TreeRecord[] };

const data: TreeRecord[] = [
  {
    id: 'resource',
    label: '客户资源',
    children: [{ id: 'grant', label: '追加授权', children: [{ id: 'employee', label: '张三' }] }]
  },
  { id: 'other', label: '订单资源' }
];
const columns = [
  { accessorKey: 'label', header: '名称' },
  { accessorKey: 'id', header: '编码' }
];

function TreeBody({
  onTable,
  virtualizeColumns = false,
  onScrollToColumn
}: {
  onTable?: (table: Table<TreeRecord>) => void;
  virtualizeColumns?: boolean;
  onScrollToColumn?: (columnId: string) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLTableRowElement>(null);
  const [viewport, setViewport] = useState<HTMLDivElement | null>(null);
  const [treeColumnMounted, setTreeColumnMounted] = useState(!virtualizeColumns);
  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.id,
    getSubRows: (row) => row.children,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    initialState: { expanded: true },
    meta: { dataTableTree: { columnId: 'label' } }
  });
  useLayoutEffect(() => {
    onTable?.(table);
  }, [onTable, table]);
  const setViewportRef = useCallback((element: HTMLDivElement | null) => {
    viewportRef.current = element;
    setViewport(element);
  }, []);
  const scrollToColumn = useCallback(
    (columnId: string) => {
      onScrollToColumn?.(columnId);
      setTreeColumnMounted(true);
    },
    [onScrollToColumn]
  );
  const windowColumns = table
    .getVisibleLeafColumns()
    .filter((column) => treeColumnMounted || column.id !== 'label');

  return (
    <>
      <button type='button'>表格外操作</button>
      <div ref={setViewportRef}>
        <table>
          <DataTableBody
            table={table}
            enableZebraStriping={false}
            emptyMessage='暂无数据'
            columnDragMotionById={new Map()}
            columnVirtualWindow={
              virtualizeColumns
                ? {
                    enabled: true,
                    items: windowColumns.map((column) => ({
                      column,
                      columnId: column.id,
                      leafIndex: column.getIndex(),
                      centerIndex: column.getIndex(),
                      size: column.getSize()
                    })),
                    leftItems: [],
                    rightItems: [],
                    virtualPaddingLeft: treeColumnMounted ? 0 : table.getColumn('label')!.getSize(),
                    virtualPaddingRight: 0,
                    virtualTotalSize: table.getTotalSize()
                  }
                : undefined
            }
            scrollToColumn={scrollToColumn}
            isColumnDragging={false}
            scrollViewportRef={viewportRef}
            scrollViewport={viewport}
            headerRowRef={headerRef}
          />
        </table>
      </div>
    </>
  );
}

afterEach(cleanup);

describe('DataTable tree cells', () => {
  it('keeps the original content and only toggles from the arrow with native keyboard support', async () => {
    const user = userEvent.setup();
    render(<TreeBody />);

    const trigger = screen.getByRole('button', { name: '收起 客户资源' });
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAccessibleDescription('第 1 层，有下级');
    await user.click(screen.getByText('客户资源', { exact: true }));
    expect(screen.getByText('追加授权', { exact: true })).toBeVisible();

    await user.click(trigger);
    expect(screen.queryByText('追加授权', { exact: true })).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(screen.getByText('追加授权', { exact: true })).toBeVisible();
    await user.keyboard(' ');
    expect(screen.queryByText('追加授权', { exact: true })).not.toBeInTheDocument();
    await user.keyboard('{ArrowRight}');
    expect(screen.getByText('追加授权', { exact: true })).toBeVisible();
    expect(trigger).toHaveFocus();
    await user.keyboard('{ArrowLeft}');
    expect(screen.queryByText('追加授权', { exact: true })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
  });

  it('renders children as ordinary aligned rows and gives leaves an equal-width placeholder', () => {
    render(<TreeBody />);
    const row = screen.getByText('张三', { exact: true }).closest('tr');
    expect(row).toHaveAttribute('data-tree-row-id', 'employee');
    expect(row).toHaveAttribute('data-tree-depth', '2');
    expect(row).not.toHaveAttribute('data-expanded', 'true');
    expect(within(row!).queryByRole('button')).not.toBeInTheDocument();
    expect(row!.querySelector('[data-slot="data-table-tree-spacer"]')).toBeInTheDocument();
    expect(row!.querySelector('[data-slot="data-table-tree-cell"]')).toHaveStyle({
      paddingInlineStart: '40px'
    });
  });

  it('restores a removed descendant focus to the closest collapsed parent for programmatic changes', () => {
    let table: Table<TreeRecord> | undefined;
    render(<TreeBody onTable={(value) => (table = value)} />);
    const leafCell = screen.getByText('张三', { exact: true }).closest('td')!;
    act(() => leafCell.focus());
    expect(leafCell).toHaveFocus();

    act(() => table!.getRow('grant').toggleExpanded(false));
    expect(screen.getByRole('button', { name: '展开 追加授权' })).toHaveFocus();

    act(() => table!.getRow('resource').toggleExpanded(false));
    expect(screen.getByRole('button', { name: '展开 客户资源' })).toHaveFocus();
  });

  it('does not steal focus after the user moves to an outside action', () => {
    let table: Table<TreeRecord> | undefined;
    render(<TreeBody onTable={(value) => (table = value)} />);
    act(() => screen.getByRole('button', { name: '收起 追加授权' }).focus());
    const outside = screen.getByRole('button', { name: '表格外操作' });
    act(() => outside.focus());
    act(() => table!.toggleAllRowsExpanded(false));
    expect(outside).toHaveFocus();
  });

  it('mounts the tree column before restoring focus when column virtualization has removed it', () => {
    let table: Table<TreeRecord> | undefined;
    const scrollToColumn = vi.fn();
    render(
      <TreeBody
        virtualizeColumns
        onScrollToColumn={scrollToColumn}
        onTable={(value) => (table = value)}
      />
    );
    expect(screen.queryByRole('button', { name: '收起 客户资源' })).not.toBeInTheDocument();
    act(() => screen.getByText('employee', { exact: true }).closest('td')!.focus());
    act(() => table!.getRow('resource').toggleExpanded(false));

    expect(scrollToColumn).toHaveBeenCalledWith('label');
    expect(screen.getByRole('button', { name: '展开 客户资源' })).toHaveFocus();
  });

  it('keeps tree arrow clicks outside cell range selection', () => {
    render(<TreeBody />);
    const trigger = screen.getByRole('button', { name: '收起 客户资源' });
    const cell = trigger.closest('td')!;
    fireEvent.pointerDown(trigger, { pointerId: 1, button: 0 });
    expect(cell).not.toHaveAttribute('data-cell-selected', 'true');
    expect(cell).not.toHaveAttribute('data-cell-range-anchor', 'true');
  });
});
