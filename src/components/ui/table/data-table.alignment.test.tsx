import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  getPaginationRowModel
} from '@tanstack/react-table';
import { DataTable } from '@/components/ui/table/data-table';
import * as React from 'react';
import { vi } from 'vitest';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({
    count,
    enabled,
    estimateSize
  }: {
    count: number;
    enabled?: boolean;
    estimateSize: () => number;
  }) => {
    const size = estimateSize();
    const items = enabled
      ? Array.from({ length: Math.min(count, 4) }, (_, i) => ({ index: i, start: i * size, size }))
      : [];
    return {
      getVirtualItems: () => items,
      getTotalSize: () => count * size,
      scrollToIndex: vi.fn(),
      measure: vi.fn()
    };
  }
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    viewportRef,
    viewportProps
  }: {
    children: React.ReactNode;
    viewportRef?: React.Ref<HTMLDivElement>;
    viewportProps?: Record<string, unknown>;
  }) => {
    const id = viewportProps?.['data-scroll-target-id'] as string | undefined;
    return (
      <div data-testid='scroll-area'>
        <div ref={viewportRef} data-scroll-target-id={id} data-testid='scroll-viewport'>
          {children}
        </div>
      </div>
    );
  },
  ScrollBar: () => null
}));

type TestRow = { id: number; name: string; price: number };

const COLUMNS_WITH_SIZING: ColumnDef<TestRow>[] = [
  { accessorKey: 'id', header: 'ID', size: 80, minSize: 60 },
  { accessorKey: 'name', header: 'Name', size: 170, minSize: 100 },
  { accessorKey: 'price', header: 'Price', size: 111, minSize: 80 }
];

function makeRows(count: number): TestRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Product ${i + 1}`,
    price: Math.round(Math.random() * 1000) / 10
  }));
}

function AlignHarness({ rows }: { rows: TestRow[] }) {
  const table = useReactTable({
    data: rows,
    columns: COLUMNS_WITH_SIZING,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableColumnResizing: true,
    initialState: { pagination: { pageSize: rows.length || 10, pageIndex: 0 } }
  });
  return <DataTable table={table} />;
}

function extractWidth(styleAttr: string): string | undefined {
  const m = styleAttr.match(/width:\s*([\d.]+px)/);
  return m?.[1];
}

afterEach(cleanup);

describe('DataTable column alignment', () => {
  it('colgroup is the single source of truth for column widths', () => {
    const rows = makeRows(5);
    const { container } = render(<AlignHarness rows={rows} />);

    const cols = container.querySelectorAll('col');
    expect(cols.length).toBe(COLUMNS_WITH_SIZING.length);

    expect(extractWidth(cols[0]?.getAttribute('style') ?? '')).toBe('80px');
    expect(extractWidth(cols[1]?.getAttribute('style') ?? '')).toBe('170px');
    expect(extractWidth(cols[2]?.getAttribute('style') ?? '')).toBe('111px');
  });

  it('uses table-layout:fixed', () => {
    const rows = makeRows(5);
    const { container } = render(<AlignHarness rows={rows} />);

    const tableEl = container.querySelector('table');
    expect(tableEl?.getAttribute('style')).toContain('table-layout: fixed');
  });

  it('non-pinned th/td do NOT set conflicting inline width', () => {
    const rows = makeRows(5);
    const { container } = render(<AlignHarness rows={rows} />);

    const theadRow = container.querySelector('thead tr');
    const tbodyRow = container.querySelector('tbody tr');
    if (!theadRow || !tbodyRow) throw new Error('missing rows');

    const ths = Array.from(theadRow.querySelectorAll('th'));
    const tds = Array.from(tbodyRow.querySelectorAll('td'));

    for (let i = 0; i < ths.length; i++) {
      const thStyle = ths[i].getAttribute('style') ?? '';
      const tdStyle = tds[i].getAttribute('style') ?? '';

      // Non-pinned cells should NOT have width in their inline styles.
      // With border-box sizing, inline width would conflict with <colgroup>.
      expect(extractWidth(thStyle)).toBeUndefined();
      expect(extractWidth(tdStyle)).toBeUndefined();

      // No unnecessary position:relative either
      expect(thStyle).not.toContain('position');
      expect(tdStyle).not.toContain('position');
    }
  });

  it('virtualized tbody rows get explicit width from measured header or fallback', () => {
    const rows = makeRows(150);
    const { container } = render(
      React.createElement(() => {
        const table = useReactTable({
          data: rows,
          columns: COLUMNS_WITH_SIZING,
          getCoreRowModel: getCoreRowModel(),
          getPaginationRowModel: getPaginationRowModel(),
          enableColumnResizing: true,
          initialState: { pagination: { pageSize: 150, pageIndex: 0 } }
        });
        return (
          <DataTable
            table={table}
            virtualization={{ enabled: true, rowCountThreshold: 10, overscan: 0 }}
          />
        );
      })
    );

    const tbody = container.querySelector('tbody[data-virtual-enabled="true"]');
    if (!tbody) throw new Error('virtual tbody missing');
    const virtualRow = tbody.querySelector('tr[data-index]');
    if (!virtualRow) throw new Error('virtual row missing');
    const tds = Array.from(virtualRow.querySelectorAll('td'));

    for (let i = 0; i < tds.length; i++) {
      const style = tds[i]?.getAttribute('style') ?? '';
      // Each td must have an explicit width (from measured header or fallback)
      expect(style).toContain('width:');
      expect(style).toContain('display: block');
    }
  });

  it('after column resize, colgroup widths update correctly', () => {
    const rows = makeRows(5);
    const { container } = render(
      React.createElement(() => {
        const table = useReactTable({
          data: rows,
          columns: COLUMNS_WITH_SIZING,
          getCoreRowModel: getCoreRowModel(),
          getPaginationRowModel: getPaginationRowModel(),
          enableColumnResizing: true,
          columnResizeMode: 'onChange' as const,
          initialState: { pagination: { pageSize: 5, pageIndex: 0 } }
        });

        React.useEffect(() => {
          table.setColumnSizing((prev) => ({ ...prev, name: 250 }));
        }, [table]);

        return <DataTable table={table} />;
      })
    );

    const cols = Array.from(container.querySelectorAll('col'));
    expect(extractWidth(cols[1]?.getAttribute('style') ?? '')).toBe('250px');
  });

  it('pinned columns still get inline width from getCommonPinningStyles', () => {
    const rows = makeRows(5);
    const { container } = render(
      React.createElement(() => {
        const table = useReactTable({
          data: rows,
          columns: [
            { accessorKey: 'id', header: 'ID', size: 80 },
            { accessorKey: 'name', header: 'Name', size: 170 },
            { accessorKey: 'price', header: 'Price', size: 111 }
          ],
          getCoreRowModel: getCoreRowModel(),
          getPaginationRowModel: getPaginationRowModel(),
          enableColumnResizing: true,
          initialState: {
            pagination: { pageSize: 5, pageIndex: 0 },
            columnPinning: { left: ['id'] }
          }
        });
        return <DataTable table={table} />;
      })
    );

    // Pinned column 0 (id) should have width in its style
    const ths = Array.from(container.querySelectorAll('thead th'));
    const tds = Array.from(container.querySelectorAll('tbody td'));

    // Column 0 is pinned — should have inline width
    expect(extractWidth(ths[0]?.getAttribute('style') ?? '')).toBe('80px');
    expect(tds[0]?.getAttribute('style')).toContain('sticky');
    expect(tds[0]?.getAttribute('style')).toContain('width');

    // Column 1 is NOT pinned — should NOT have inline width
    expect(extractWidth(ths[1]?.getAttribute('style') ?? '')).toBeUndefined();
    expect(extractWidth(tds[1]?.getAttribute('style') ?? '')).toBeUndefined();
  });
});
