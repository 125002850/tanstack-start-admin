import * as React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import {
  getCoreRowModel,
  useReactTable,
  type CellContext,
  type ColumnDef
} from '@tanstack/react-table';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

import { env } from '@/config';
import { DataTable } from './data-table';

const data = Array.from({ length: 150 }, (_, id) => ({ id }));
const columns: ColumnDef<{ id: number }>[] = Array.from({ length: 30 }, (_, index) => ({
  id: `column-${index}`,
  accessorFn: (row) => `${row.id}-${index}`,
  header: `Column ${index}`,
  size: 150
}));

// 使用真实 DataTable / ScrollArea / Virtualizer，只为 jsdom 补充浏览器几何信息。
const StableTable = React.memo(function StableTable({
  rowHeight = 48,
  columnWidth = 150,
  virtualizeColumns = true,
  contentLabel = 'initial',
  selectedRowId,
  onCellRender
}: {
  rowHeight?: number;
  columnWidth?: number;
  virtualizeColumns?: boolean;
  contentLabel?: string;
  selectedRowId?: string;
  onCellRender?: (rowId: string, columnId: string) => void;
}) {
  const renderedColumns = React.useMemo(
    () =>
      onCellRender
        ? columns.map((column) => ({
            ...column,
            cell: ({ row, column, table }: CellContext<{ id: number }, unknown>) => {
              onCellRender(row.id, column.id);
              return `${table.options.meta?.dataTableInstanceId}:${row.id}:${column.id}`;
            }
          }))
        : columns,
    [onCellRender]
  );
  const columnSizing = React.useMemo(
    () => Object.fromEntries(columns.map((column) => [column.id!, columnWidth])),
    [columnWidth]
  );
  const table = useReactTable({
    data,
    columns: renderedColumns,
    state: { columnSizing, rowSelection: selectedRowId ? { [selectedRowId]: true } : {} },
    meta: { dataTableInstanceId: contentLabel },
    getCoreRowModel: getCoreRowModel()
  });
  return (
    <DataTable
      table={table}
      showPagination={false}
      showViewOptions={false}
      virtualization={{
        mode: 'on',
        estimateRowHeight: rowHeight,
        columnVirtualizationMode: virtualizeColumns ? 'on' : 'off',
        overscan: 0,
        columnOverscan: 0
      }}
    />
  );
});

const originalVirtualization = env.dataTableVirtualization;
const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo');

beforeEach(() => {
  Object.assign(env, { dataTableVirtualization: true });
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(600);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(480);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 600,
    bottom: 480,
    width: 600,
    height: 480,
    toJSON: () => ({})
  });
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) =>
    window.setTimeout(() => callback(0), 0)
  );
  vi.stubGlobal('cancelAnimationFrame', (id: number) => window.clearTimeout(id));
  Object.defineProperty(HTMLElement.prototype, 'scrollTo', {
    configurable: true,
    value: function (this: HTMLElement, options: ScrollToOptions) {
      if (options.top !== undefined) this.scrollTop = options.top;
      if (options.left !== undefined) this.scrollLeft = options.left;
    }
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalScrollTo) {
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalScrollTo);
  } else {
    Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo');
  }
  Object.assign(env, { dataTableVirtualization: originalVirtualization });
});

it('resumes real row and column virtualizers after Activity hides and restores the viewport', async () => {
  const content = <StableTable />;
  const { container, rerender } = render(<React.Activity mode='visible'>{content}</React.Activity>);
  const viewport = container.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
  const body = () => container.querySelector('tbody[data-virtual-enabled="true"]')!;
  const firstColumn = () =>
    body().querySelector('tr td[data-column-id]')?.getAttribute('data-column-id');
  await waitFor(() => expect(body()).toHaveAttribute('data-virtual-first-index', '0'));
  fireEvent.scroll(viewport, { target: { scrollTop: 2400, scrollLeft: 1500 } });
  await waitFor(() => expect(body()).toHaveAttribute('data-virtual-first-index', '50'));
  await waitFor(() => expect(firstColumn()).toBe('column-10'));

  for (const [top, left] of [
    [960, 600],
    [3360, 2400],
    [0, 0]
  ]) {
    const previousTop = viewport.scrollTop;
    const previousLeft = viewport.scrollLeft;
    rerender(<React.Activity mode='hidden'>{content}</React.Activity>);
    rerender(<React.Activity mode='visible'>{content}</React.Activity>);
    expect(viewport.scrollTop).toBe(previousTop);
    expect(viewport.scrollLeft).toBe(previousLeft);
    fireEvent.scroll(viewport, { target: { scrollTop: top, scrollLeft: left } });
    await waitFor(() =>
      expect(body()).toHaveAttribute('data-virtual-first-index', String(top / 48))
    );
    await waitFor(() => expect(firstColumn()).toBe(`column-${left / 150}`));
  }
});

it('updates cached row heights and column widths when geometry changes while hidden', async () => {
  const { container, rerender } = render(
    <React.Activity mode='visible'>
      <StableTable />
    </React.Activity>
  );
  const body = () => container.querySelector('tbody[data-virtual-enabled="true"]')!;
  const table = () => container.querySelector('table')!;
  await waitFor(() => expect(body()).toHaveAttribute('data-virtual-total-size', '7200'));
  await waitFor(() => expect(table()).toHaveAttribute('data-column-virtual-total-size', '4500'));
  rerender(
    <React.Activity mode='hidden'>
      <StableTable />
    </React.Activity>
  );
  rerender(
    <React.Activity mode='hidden'>
      <StableTable rowHeight={64} columnWidth={200} />
    </React.Activity>
  );
  rerender(
    <React.Activity mode='visible'>
      <StableTable rowHeight={64} columnWidth={200} />
    </React.Activity>
  );
  await waitFor(() => expect(body()).toHaveAttribute('data-virtual-total-size', '9600'));
  await waitFor(() => expect(table()).toHaveAttribute('data-column-virtual-total-size', '6000'));
  expect(body().querySelector('tr')).toHaveStyle({ height: '64px' });

  rerender(
    <React.Activity mode='visible'>
      <StableTable rowHeight={48} columnWidth={150} />
    </React.Activity>
  );
  await waitFor(() => expect(body()).toHaveAttribute('data-virtual-total-size', '7200'));
  await waitFor(() => expect(table()).toHaveAttribute('data-column-virtual-total-size', '4500'));
});

it.each([false, true])(
  'only renders newly visible cells while scrolling (column virtualization: %s)',
  async (virtualizeColumns) => {
    const onCellRender = vi.fn();
    const { container } = render(
      <StableTable virtualizeColumns={virtualizeColumns} onCellRender={onCellRender} />
    );
    const viewport = container.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
    const body = container.querySelector('tbody[data-virtual-enabled="true"]')!;
    await waitFor(() => expect(body).toHaveAttribute('data-virtual-first-index', '0'));
    fireEvent.scroll(viewport, { target: { scrollTop: 48 } });
    await waitFor(() => expect(body).toHaveAttribute('data-virtual-first-index', '1'));
    const retainedRow = body.querySelector('tr[data-index="5"]');

    onCellRender.mockClear();
    fireEvent.scroll(viewport, { target: { scrollTop: 96 } });
    await waitFor(() => expect(body).toHaveAttribute('data-virtual-first-index', '2'));

    expect(body.querySelector('tr[data-index="5"]')).toBe(retainedRow);
    expect(onCellRender).toHaveBeenCalled();
    expect(onCellRender.mock.calls.every(([rowId]) => rowId === '11')).toBe(true);
  }
);

it('refreshes cached virtual rows when selection, metadata, or column geometry changes', async () => {
  const onCellRender = vi.fn();
  const { container, rerender } = render(<StableTable onCellRender={onCellRender} />);
  const row = () => container.querySelector('tbody[data-virtual-enabled="true"] tr')!;
  const cell = () => row().querySelector('td[data-column-id="column-0"]')!;
  await waitFor(() => expect(cell()).toHaveTextContent('initial:0:column-0'));

  rerender(
    <StableTable
      onCellRender={onCellRender}
      contentLabel='updated'
      selectedRowId='0'
      columnWidth={200}
    />
  );

  await waitFor(() => expect(cell()).toHaveTextContent('updated:0:column-0'));
  expect(row()).toHaveAttribute('aria-selected', 'true');
  await waitFor(() => expect(cell()).toHaveStyle({ width: '200px' }));

  rerender(<StableTable onCellRender={onCellRender} />);
  await waitFor(() => expect(cell()).toHaveTextContent('initial:0:column-0'));
  expect(row()).not.toHaveAttribute('aria-selected');
  await waitFor(() => expect(cell()).toHaveStyle({ width: '150px' }));
});

it.each([false, true])(
  'renders real cells during repeated fast scrolls without waiting for scroll end (columns: %s)',
  async (virtualizeColumns) => {
    const onCellRender = vi.fn();
    const { container } = render(
      <StableTable virtualizeColumns={virtualizeColumns} onCellRender={onCellRender} />
    );
    const viewport = container.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
    const body = container.querySelector('tbody[data-virtual-enabled="true"]')!;
    await waitFor(() => expect(body).toHaveAttribute('data-virtual-first-index', '0'));
    for (const top of [2400, 4800, 2400, 0]) {
      onCellRender.mockClear();
      fireEvent.scroll(viewport, { target: { scrollTop: top } });
      const index = top / 48;
      const row = body.querySelector(`tr[data-index="${index}"]`)!;
      // 立即断言内容，不能等 scroll-end 或借助 waitFor 掩盖滚动中的空内容。
      expect(row).toHaveTextContent(`initial:${index}:column-0`);
      expect(row).toHaveStyle({ height: '48px' });
      expect(row.querySelector('[data-slot="skeleton"]')).not.toBeInTheDocument();
      expect(onCellRender).toHaveBeenCalledWith(String(index), 'column-0');
    }
  }
);

it('keeps real row content when Activity interrupts fast scrolling', async () => {
  const content = <StableTable onCellRender={() => {}} />;
  const { container, rerender } = render(<React.Activity mode='visible'>{content}</React.Activity>);
  const viewport = container.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
  const body = () => container.querySelector('tbody[data-virtual-enabled="true"]')!;
  await waitFor(() => expect(body()).toHaveAttribute('data-virtual-first-index', '0'));
  fireEvent.scroll(viewport, { target: { scrollTop: 2400 } });
  expect(body().querySelector('tr[data-index="50"]')).toHaveTextContent('initial:50:column-0');

  rerender(<React.Activity mode='hidden'>{content}</React.Activity>);
  rerender(<React.Activity mode='visible'>{content}</React.Activity>);
  await waitFor(() =>
    expect(body().querySelector('tr[data-index="50"]')).toHaveTextContent('initial:50:column-0')
  );
});
