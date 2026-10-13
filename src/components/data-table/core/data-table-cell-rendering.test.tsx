import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import {
  getCoreRowModel,
  useReactTable,
  type CellContext,
  type ColumnDef
} from '@tanstack/react-table';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { env } from '@/config';
import { TableCell } from '@/components/ui/table';
import { DataTable } from './data-table';

vi.mock('@/components/ui/table', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/components/ui/table')>();
  return { ...actual, TableCell: vi.fn(actual.TableCell) };
});

type TestRow = { id: number; name: string };
const data = Array.from({ length: 12 }, (_, id) => ({ id, name: `row-${id}` }));
const renderCell = vi.fn(({ getValue, row, table }: CellContext<TestRow, unknown>) => (
  <span>{`${getValue()}|${row.getIsSelected() ? 'selected' : 'idle'}|${table.options.meta?.dataTableId}`}</span>
));
const columns: ColumnDef<TestRow>[] = Array.from({ length: 30 }, (_, index) => ({
  id: `column-${index}`,
  accessorFn: (row) => `${row.name}-${index}`,
  header: `Column ${index}`,
  size: 150,
  cell: renderCell
}));

function Harness({
  rows = data,
  metaLabel = 'initial',
  columnDefinitions = columns,
  virtualRows = true,
  virtualColumns = true
}: {
  rows?: TestRow[];
  metaLabel?: string;
  columnDefinitions?: ColumnDef<TestRow>[];
  virtualRows?: boolean;
  virtualColumns?: boolean;
}) {
  const table = useReactTable({
    data: rows,
    columns: columnDefinitions,
    meta: { dataTableId: metaLabel },
    initialState: { columnPinning: { left: ['column-0'], right: ['column-29'] } },
    getCoreRowModel: getCoreRowModel()
  });
  return (
    <>
      <button onClick={() => table.getRow('0').toggleSelected()}>选择第一行</button>
      <DataTable
        table={table}
        showPagination={false}
        showViewOptions={false}
        virtualization={{
          mode: 'auto',
          rowCountThreshold: virtualRows ? 0 : 1000,
          columnVirtualizationMode: virtualColumns ? 'on' : 'off',
          overscan: 0,
          columnOverscan: 0
        }}
      />
    </>
  );
}

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
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  if (originalScrollTo) Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalScrollTo);
  else Reflect.deleteProperty(HTMLElement.prototype, 'scrollTo');
  Object.assign(env, { dataTableVirtualization: originalVirtualization });
});

const firstRowCell = (container: HTMLElement, column = 'column-0') =>
  container.querySelector<HTMLElement>(
    `tbody tr[data-row-index="0"] td[data-column-id="${column}"]`
  )!;

describe('DataTable cell content reuse', () => {
  it.each([false, true])(
    'reuses pinned and overlapping cells while columns scroll (virtual rows: %s)',
    async (virtualRows) => {
      const { container } = render(<Harness virtualRows={virtualRows} />);
      const viewport = container.querySelector<HTMLElement>('[data-slot="scroll-area-viewport"]')!;
      await waitFor(() => expect(firstRowCell(container, 'column-4')).not.toBeNull());
      const count = (columnId: string) =>
        renderCell.mock.calls.filter(
          ([context]) => context.row.id === '0' && context.column.id === columnId
        ).length;
      const stableColumns = ['column-0', 'column-4', 'column-29'];
      const before = stableColumns.map(count);
      const frameCount = (columnId: string) =>
        vi
          .mocked(TableCell)
          .mock.calls.filter(
            ([props]) =>
              Reflect.get(props, 'data-cell-row-id') === '0' &&
              Reflect.get(props, 'data-column-id') === columnId
          ).length;
      const framesBefore = stableColumns.map(frameCount);
      expect(before.every((value) => value > 0)).toBe(true);
      expect(framesBefore.every((value) => value > 0)).toBe(true);
      fireEvent.scroll(viewport, { target: { scrollLeft: 150 } });
      await waitFor(() => expect(firstRowCell(container, 'column-5')).not.toBeNull());
      expect(stableColumns.map(count)).toEqual(before);
      expect(stableColumns.map(frameCount)).toEqual(framesBefore);
      expect(count('column-5')).toBeGreaterThan(0);
    }
  );

  it.each([
    { virtualRows: false, virtualColumns: false },
    { virtualRows: true, virtualColumns: false },
    { virtualRows: true, virtualColumns: true }
  ])(
    'updates content when table state changes in $virtualRows/$virtualColumns rendering',
    async (mode) => {
      const { container } = render(<Harness {...mode} />);
      await waitFor(() =>
        expect(firstRowCell(container)).toHaveTextContent('row-0-0|idle|initial')
      );
      const cell = firstRowCell(container);
      fireEvent.click(screen.getByRole('button', { name: '选择第一行' }));
      expect(firstRowCell(container)).toBe(cell);
      expect(cell).toHaveTextContent('row-0-0|selected|initial');
      expect(cell.closest('tr')).toHaveAttribute('aria-selected', 'true');
      fireEvent.click(screen.getByRole('button', { name: '选择第一行' }));
      expect(cell).toHaveTextContent('row-0-0|idle|initial');
    }
  );

  it('updates cached content for meta, column renderer and same-id row replacement', async () => {
    const { container, rerender } = render(<Harness />);
    await waitFor(() => expect(firstRowCell(container)).toHaveTextContent('row-0-0|idle|initial'));
    const cell = firstRowCell(container);
    rerender(<Harness metaLabel='updated' />);
    expect(firstRowCell(container)).toBe(cell);
    expect(cell).toHaveTextContent('row-0-0|idle|updated');
    const nextColumns = columns.map((column, index) =>
      index === 0
        ? {
            ...column,
            cell: ({ getValue }: CellContext<TestRow, unknown>) => `formatted:${getValue()}`
          }
        : column
    );
    rerender(<Harness metaLabel='updated' columnDefinitions={nextColumns} />);
    expect(firstRowCell(container)).toHaveTextContent('formatted:row-0-0');
    const nextRows = [{ ...data[0], name: 'refreshed' }, ...data.slice(1)];
    rerender(<Harness rows={nextRows} metaLabel='updated' columnDefinitions={nextColumns} />);
    expect(firstRowCell(container)).toHaveTextContent('formatted:refreshed-0');
  });
});
