import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  getPaginationRowModel
} from '@tanstack/react-table';
import { DataTable } from '@/components/ui/table/core/data-table';
import { useDataTable } from '@/hooks/use-data-table';
import { DATA_TABLE_PINNED_SHADOWS } from '@/lib/data-table';
import * as React from 'react';
import { vi } from 'vitest';

type MockVirtualItem = {
  key: number;
  index: number;
  start: number;
  end: number;
  size: number;
  lane: number;
};

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({
    count,
    enabled,
    estimateSize
  }: {
    count: number;
    enabled?: boolean;
    estimateSize: (index: number) => number;
  }) => {
    const items: MockVirtualItem[] = [];
    const itemCount = enabled ? Math.min(count, 4) : 0;
    let start = 0;

    for (let index = 0; index < itemCount; index += 1) {
      const size = estimateSize(index);
      items.push({
        key: index,
        index,
        start,
        end: start + size,
        size,
        lane: 0
      });
      start += size;
    }

    return {
      getVirtualItems: () => items,
      getTotalSize: () =>
        Array.from({ length: count }, (_, index) => estimateSize(index)).reduce(
          (sum, size) => sum + size,
          0
        ),
      scrollToIndex: vi.fn(),
      measure: vi.fn()
    };
  }
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    horizontalScrollbarProps,
    verticalScrollbarProps,
    viewportRef,
    viewportProps
  }: {
    children: React.ReactNode;
    horizontalScrollbarProps?: React.HTMLAttributes<HTMLDivElement>;
    verticalScrollbarProps?: React.HTMLAttributes<HTMLDivElement>;
    viewportRef?: React.Ref<HTMLDivElement>;
    viewportProps?: Record<string, unknown>;
  }) => {
    const id = viewportProps?.['data-scroll-target-id'] as string | undefined;
    return (
      <div data-testid='scroll-area'>
        <div ref={viewportRef} data-scroll-target-id={id} data-testid='scroll-viewport'>
          {children}
        </div>
        <div data-testid='vertical-scrollbar' {...verticalScrollbarProps} />
        <div data-testid='horizontal-scrollbar' {...horizontalScrollbarProps} />
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

function ExpandAlignHarness({ rows }: { rows: TestRow[] }) {
  const { table, expandConfig, expandedRow, expandedRowKey, setExpandedRowKey, expandPanelId } =
    useDataTable({
      data: rows,
      columns: COLUMNS_WITH_SIZING,
      pageCount: 1,
      tableId: 'alignment-expand',
      showRowNumberColumn: false,
      expandConfig: {
        rowKey: 'id',
        tabs: [
          {
            id: 'summary',
            label: '概览',
            render: (row) => row.name
          }
        ]
      }
    });

  React.useEffect(() => {
    setExpandedRowKey('1');
  }, [setExpandedRowKey]);

  return (
    <DataTable
      table={table}
      expandConfig={expandConfig}
      expandedRow={expandedRow}
      expandedRowKey={expandedRowKey}
      onExpandedRowKeyChange={setExpandedRowKey}
      expandPanelId={expandPanelId}
    />
  );
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

      // Header cells are sticky; body cells should not add unnecessary positioning.
      expect(thStyle).not.toContain('position: relative');
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
      expect(style).toContain('display: flex');
      expect(style).toContain('height: 100%');
      expect(style).toContain('align-items: center');
    }
  });

  it('column virtualized header and body cells share explicit render-item widths', () => {
    const rows = makeRows(20);
    const { container } = render(
      React.createElement(() => {
        const table = useReactTable({
          data: rows,
          columns: COLUMNS_WITH_SIZING,
          getCoreRowModel: getCoreRowModel(),
          getPaginationRowModel: getPaginationRowModel(),
          enableColumnResizing: true,
          initialState: { pagination: { pageSize: rows.length, pageIndex: 0 } }
        });

        return <DataTable table={table} virtualization={{ columnVirtualizationMode: 'on' }} />;
      })
    );

    expect(container.querySelectorAll('col')).toHaveLength(0);

    const headerCells = Array.from(
      container.querySelectorAll('thead th[data-column-center-index]')
    );
    const bodyCells = Array.from(
      container.querySelectorAll('tbody tr:first-child td[data-column-center-index]')
    );

    expect(headerCells).toHaveLength(3);
    expect(bodyCells).toHaveLength(3);

    for (let i = 0; i < headerCells.length; i++) {
      expect(extractWidth(headerCells[i]?.getAttribute('style') ?? '')).toBe(
        extractWidth(bodyCells[i]?.getAttribute('style') ?? '')
      );
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

  it('renders pinned body cell base and overlay layers that match row state styling', () => {
    const rows = makeRows(5);
    const { container } = render(
      React.createElement(() => {
        const table = useReactTable({
          data: rows,
          columns: [
            { accessorKey: 'id', header: 'ID', size: 80 },
            { accessorKey: 'name', header: 'Name', size: 170 }
          ],
          getCoreRowModel: getCoreRowModel(),
          getPaginationRowModel: getPaginationRowModel(),
          initialState: {
            pagination: { pageSize: 5, pageIndex: 0 },
            columnPinning: { left: ['id'] }
          }
        });

        return <DataTable table={table} />;
      })
    );

    const firstPinnedCellBase = container.querySelector(
      'tbody td [data-slot="data-table-pinned-cell-base"]'
    );
    const firstPinnedCellOverlay = container.querySelector(
      'tbody td [data-slot="data-table-pinned-cell-overlay"]'
    );

    expect(firstPinnedCellBase).not.toBeNull();
    expect(firstPinnedCellOverlay).not.toBeNull();
    expect(firstPinnedCellBase?.getAttribute('class')).toContain('bg-background');
    expect(firstPinnedCellBase?.getAttribute('class')).toContain(
      'group-data-[expanded=true]:bg-accent'
    );
    expect(firstPinnedCellOverlay?.getAttribute('class')).toContain('group-hover:bg-muted/50');
    expect(firstPinnedCellOverlay?.getAttribute('class')).toContain(
      'group-data-[state=selected]:bg-muted'
    );
  });

  it('applies theme-aware edge shadows to left and right pinned columns', () => {
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
          initialState: {
            pagination: { pageSize: 5, pageIndex: 0 },
            columnPinning: { left: ['id'], right: ['price'] }
          }
        });

        return <DataTable table={table} />;
      })
    );

    const gradientColor =
      'var(--data-table-pinned-shadow-gradient-color, color-mix(in oklch, var(--foreground) 3.5%, transparent))';
    const headerCells = Array.from(container.querySelectorAll('thead th'));
    const bodyCells = Array.from(container.querySelectorAll('tbody tr:first-child td'));
    const leftPinnedCellShadow = bodyCells[0]?.querySelector(
      '[data-slot="data-table-pinned-cell-shadow"]'
    );
    const rightPinnedCellShadow = bodyCells[2]?.querySelector(
      '[data-slot="data-table-pinned-cell-shadow"]'
    );

    expect(headerCells[0]?.getAttribute('style')).toContain(
      `box-shadow: ${DATA_TABLE_PINNED_SHADOWS.left}`
    );
    expect(headerCells[2]?.getAttribute('style')).toContain(
      `box-shadow: ${DATA_TABLE_PINNED_SHADOWS.right}`
    );
    expect(bodyCells[0]?.getAttribute('style')).toContain(
      `box-shadow: ${DATA_TABLE_PINNED_SHADOWS.left}`
    );
    expect(bodyCells[2]?.getAttribute('style')).toContain(
      `box-shadow: ${DATA_TABLE_PINNED_SHADOWS.right}`
    );
    expect(leftPinnedCellShadow?.getAttribute('data-pinning-shadow-edge')).toBe('right');
    expect(leftPinnedCellShadow?.getAttribute('style')).toContain('right: -18px');
    expect(leftPinnedCellShadow?.getAttribute('style')).toContain('width: 18px');
    expect(leftPinnedCellShadow?.getAttribute('style')).toContain(
      `background: linear-gradient(to right, ${gradientColor} 0%, transparent 78%)`
    );
    expect(rightPinnedCellShadow?.getAttribute('data-pinning-shadow-edge')).toBe('left');
    expect(rightPinnedCellShadow?.getAttribute('style')).toContain('left: -18px');
    expect(rightPinnedCellShadow?.getAttribute('style')).toContain('width: 18px');
    expect(rightPinnedCellShadow?.getAttribute('style')).toContain(
      `background: linear-gradient(to left, ${gradientColor} 0%, transparent 78%)`
    );
  });

  it('insets the horizontal scrollbar by pinned column widths', () => {
    const rows = makeRows(5);
    const { getByTestId } = render(
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
          initialState: {
            pagination: { pageSize: 5, pageIndex: 0 },
            columnPinning: { left: ['id'], right: ['price'] }
          }
        });

        return <DataTable table={table} />;
      })
    );

    const horizontalScrollbar = getByTestId('horizontal-scrollbar');

    expect(horizontalScrollbar.getAttribute('data-left-pinned-width')).toBe('80');
    expect(horizontalScrollbar.getAttribute('data-right-pinned-width')).toBe('111');
    expect(horizontalScrollbar.getAttribute('style')).toContain('left: 80px');
    expect(horizontalScrollbar.getAttribute('style')).toContain('right: 111px');
  });

  it('insets the vertical scrollbar below the sticky header and above the horizontal scrollbar', () => {
    const rows = makeRows(5);
    const { getByTestId } = render(<AlignHarness rows={rows} />);

    const verticalScrollbar = getByTestId('vertical-scrollbar');

    const scrollbarStyle = verticalScrollbar.getAttribute('style') ?? '';
    expect(scrollbarStyle).toContain('top: 40px');
    expect(scrollbarStyle).toContain('bottom: 10px');
  });

  it('anchors the horizontal scrollbar to both viewport edges without pinned columns', () => {
    const rows = makeRows(5);
    const { getByTestId } = render(<AlignHarness rows={rows} />);

    const horizontalScrollbar = getByTestId('horizontal-scrollbar');

    const scrollbarStyle = horizontalScrollbar.getAttribute('style') ?? '';
    expect(scrollbarStyle).toContain('left: 0px');
    expect(scrollbarStyle).toContain('right: 0px');
  });

  it('colgroup widths follow the visual leaf-column order after pinning reorders columns', () => {
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
            columnPinning: { left: ['price'] }
          }
        });
        return <DataTable table={table} />;
      })
    );

    const ths = Array.from(container.querySelectorAll('thead th'));
    const cols = Array.from(container.querySelectorAll('col'));

    expect(ths[0]?.textContent).toContain('Price');
    expect(extractWidth(cols[0]?.getAttribute('style') ?? '')).toBe('111px');
    expect(extractWidth(cols[1]?.getAttribute('style') ?? '')).toBe('80px');
    expect(extractWidth(cols[2]?.getAttribute('style') ?? '')).toBe('170px');
  });

  it('keeps colgroup and pinned utility widths aligned when the expand panel is open', () => {
    const rows = makeRows(5);
    const { container } = render(<ExpandAlignHarness rows={rows} />);

    const cols = Array.from(container.querySelectorAll('col'));

    expect(document.querySelector('[data-slot="data-table-expand-panel"]')).not.toBeNull();
    expect(cols).toHaveLength(3);
    expect(extractWidth(cols[0]?.getAttribute('style') ?? '')).toBe('80px');
    expect(extractWidth(cols[1]?.getAttribute('style') ?? '')).toBe('170px');
    expect(extractWidth(cols[2]?.getAttribute('style') ?? '')).toBe('111px');
  });
});
