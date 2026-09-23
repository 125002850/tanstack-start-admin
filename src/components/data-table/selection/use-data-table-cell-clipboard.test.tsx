import { getCoreRowModel, getExpandedRowModel, useReactTable } from '@tanstack/react-table';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useMemo, useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createDataTableColumnDsl } from '@/components/data-table/columns/data-table-column-factory';
import { DataTableBody } from '@/components/data-table/core/data-table-body';

type TreeRecord = { id: string; label: string; children?: TreeRecord[] };

const data: TreeRecord[] = [
  {
    id: 'resource',
    label: '客户资源',
    children: [{ id: 'employee', label: '张三' }]
  }
];
const dsl = createDataTableColumnDsl<TreeRecord>();

function ClipboardTable({
  tree = true,
  explicitCopy = false,
  unmountLabelColumn = false
}: {
  tree?: boolean;
  explicitCopy?: boolean;
  unmountLabelColumn?: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLTableRowElement>(null);
  const columns = useMemo(
    () => [
      dsl.field('label', '名称', {
        format: (value) => `显示：${value}`,
        meta: explicitCopy ? { copyValue: (_value, row) => row.id } : undefined
      }),
      dsl.field('id', '编码')
    ],
    [explicitCopy]
  );
  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.id,
    getSubRows: (row) => row.children,
    getCoreRowModel: getCoreRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    initialState: { expanded: true },
    meta: tree ? { dataTableTree: { columnId: 'label' } } : undefined
  });

  return (
    <div ref={viewportRef}>
      <table>
        <DataTableBody
          table={table}
          enableZebraStriping={false}
          emptyMessage='暂无数据'
          columnDragMotionById={new Map()}
          columnVirtualWindow={
            unmountLabelColumn
              ? {
                  enabled: true,
                  items: table
                    .getVisibleLeafColumns()
                    .filter((column) => column.id !== 'label')
                    .map((column) => ({
                      column,
                      columnId: column.id,
                      leafIndex: column.getIndex(),
                      centerIndex: column.getIndex(),
                      size: column.getSize()
                    })),
                  leftItems: [],
                  rightItems: [],
                  virtualPaddingLeft: table.getColumn('label')!.getSize(),
                  virtualPaddingRight: 0,
                  virtualTotalSize: table.getTotalSize()
                }
              : undefined
          }
          isColumnDragging={false}
          scrollViewportRef={viewportRef}
          scrollViewport={null}
          headerRowRef={headerRef}
        />
      </table>
    </div>
  );
}

function copySelectedCells() {
  const clipboardData = { setData: vi.fn() };
  const event = new Event('copy', { bubbles: true, cancelable: true }) as ClipboardEvent;
  Object.defineProperty(event, 'clipboardData', { configurable: true, value: clipboardData });
  document.getSelection()?.removeAllRanges();
  act(() => document.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(true);
  return clipboardData.setData;
}

afterEach(cleanup);

describe('DataTable cell clipboard content', () => {
  it('copies formatted parent and leaf values without tree accessibility descriptions', () => {
    render(<ClipboardTable />);
    const parentCell = screen.getByText('显示：客户资源', { exact: true }).closest('td')!;
    act(() => parentCell.focus());
    fireEvent.keyDown(parentCell, { key: 'ArrowDown', shiftKey: true });

    expect(copySelectedCells()).toHaveBeenCalledWith('text/plain', '显示：客户资源\n显示：张三');
  });

  it('preserves explicit copyValue precedence over formatted tree content', () => {
    render(<ClipboardTable explicitCopy />);
    act(() => screen.getByText('显示：客户资源', { exact: true }).closest('td')!.focus());

    expect(copySelectedCells()).toHaveBeenCalledWith('text/plain', 'resource');
  });

  it('keeps formatted clipboard values for ordinary cells', () => {
    render(<ClipboardTable tree={false} />);
    act(() => screen.getByText('显示：客户资源', { exact: true }).closest('td')!.focus());

    expect(copySelectedCells()).toHaveBeenCalledWith('text/plain', '显示：客户资源');
  });

  it('falls back to the raw value when column virtualization unmounts a selected tree cell', () => {
    const { rerender } = render(<ClipboardTable />);
    act(() => screen.getByText('显示：客户资源', { exact: true }).closest('td')!.focus());
    rerender(<ClipboardTable unmountLabelColumn />);
    expect(screen.queryByText('显示：客户资源', { exact: true })).not.toBeInTheDocument();

    expect(copySelectedCells()).toHaveBeenCalledWith('text/plain', '客户资源');
  });
});
