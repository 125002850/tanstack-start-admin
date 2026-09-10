import * as React from 'react';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
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
  columnWidth = 150
}: {
  rowHeight?: number;
  columnWidth?: number;
}) {
  const columnSizing = React.useMemo(
    () => Object.fromEntries(columns.map((column) => [column.id!, columnWidth])),
    [columnWidth]
  );
  const table = useReactTable({
    data,
    columns,
    state: { columnSizing },
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
        columnVirtualizationMode: 'on',
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
