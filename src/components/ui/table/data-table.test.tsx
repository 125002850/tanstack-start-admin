import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import {
  getCoreRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  getPaginationRowModel
} from '@tanstack/react-table';
import { DataTable } from '@/components/ui/table/data-table';
import { DataTableColumnHeader } from '@/components/ui/table/data-table-column-header';
import { DataTableHeaderDragOverlay } from '@/components/ui/table/data-table-header';
import type { DataTableAction } from '@/components/ui/table/data-table-actions-bar';
import { useDataTable } from '@/hooks/use-data-table';
import type { DataTableRowAction } from '@/components/ui/table/data-table-row-action';
import type { DataTableVirtualizationOptions } from '@/types/data-table';
import * as React from 'react';
import { createPortal } from 'react-dom';
import userEvent from '@testing-library/user-event';
import { env } from '@/config';
import { resolveDataTableVirtualizationOptions } from '@/config/data-table';
import { DATA_TABLE_DEFAULT_EXPAND_TABLE_SIZING } from '@/lib/data-table-expand-split';

const virtualizerMocks = vi.hoisted(() => ({
  calls: [] as Array<{
    count: number;
    enabled?: boolean;
    horizontal?: boolean;
    overscan?: number;
  }>,
  instances: [] as Array<{
    horizontal?: boolean;
    measure: ReturnType<typeof vi.fn>;
  }>
}));

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
    estimateSize,
    horizontal,
    overscan
  }: {
    count: number;
    enabled?: boolean;
    estimateSize: (index: number) => number;
    horizontal?: boolean;
    overscan?: number;
  }) => {
    virtualizerMocks.calls.push({ count, enabled, horizontal, overscan });
    const measure = vi.fn();
    virtualizerMocks.instances.push({ horizontal, measure });
    const virtualItems: MockVirtualItem[] = [];
    const itemCount = enabled ? Math.min(count, horizontal ? 6 : 4) : 0;
    let start = 0;

    for (let index = 0; index < itemCount; index += 1) {
      const size = estimateSize(index);
      virtualItems.push({
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
      getVirtualItems: () => virtualItems,
      getTotalSize: () =>
        Array.from({ length: count }, (_, index) => estimateSize(index)).reduce(
          (sum, size) => sum + size,
          0
        ),
      scrollToIndex: vi.fn(),
      measure
    };
  }
}));

// Mock ScrollArea — avoids Radix instance conflicts in jsdom
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

vi.mock('@/components/ui/table/data-table-view-options', () => ({
  DataTableViewOptions: ({
    iconOnly,
    className
  }: {
    table: unknown;
    iconOnly?: boolean;
    className?: string;
  }) => (
    <button
      data-testid='view-options-button'
      data-icon-only={iconOnly ? 'true' : 'false'}
      className={className}
    >
      显示列
    </button>
  )
}));

type TestRow = { id: number; name: string };
type TestVirtualizationProp =
  | boolean
  | DataTableVirtualizationOptions
  | {
      mode?: 'auto' | 'on' | 'off';
      enabled?: boolean;
      estimateRowHeight?: number;
      overscan?: number;
      rowCountThreshold?: number;
      columnVirtualizationMode?: 'auto' | 'on' | 'off';
      columnCountThreshold?: number;
      columnOverscan?: number;
      onVirtualizationFallback?: (
        reason:
          | 'runtime-error'
          | 'unsupported-browser'
          | 'disabled-by-config'
          | 'grouped-header'
          | 'header-colspan'
      ) => void;
    };

const COLUMNS: ColumnDef<TestRow>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' }
];

const SIZED_COLUMNS: ColumnDef<TestRow>[] = [
  { accessorKey: 'id', header: 'ID', size: 80 },
  { accessorKey: 'name', header: 'Name', size: 170 }
];

const OVERFLOW_HEADER_LABEL = 'A very long customer name header';
const OVERFLOW_HEADER_COLUMNS: ColumnDef<TestRow>[] = [
  { accessorKey: 'id', header: 'ID', size: 80 },
  { accessorKey: 'name', header: OVERFLOW_HEADER_LABEL, size: 80 }
];
const OVERFLOW_COMPONENT_HEADER_LABEL = 'A very long sortable customer name header';
const OVERFLOW_COMPONENT_HEADER_COLUMNS: ColumnDef<TestRow>[] = [
  { accessorKey: 'id', header: 'ID', size: 80 },
  {
    accessorKey: 'name',
    size: 80,
    header: ({ column }: { column: Column<TestRow, unknown> }) => (
      <DataTableColumnHeader column={column} title={OVERFLOW_COMPONENT_HEADER_LABEL} />
    )
  }
];

type WideRow = { id: number; pinnedLeft: string; pinnedRight: string } & Record<
  `field${number}`,
  string
>;

function makeWideColumns(count = 40): ColumnDef<WideRow>[] {
  return [
    { accessorKey: 'pinnedLeft', header: 'Pinned Left', size: 90 },
    ...Array.from({ length: count }, (_, index): ColumnDef<WideRow> => {
      const key = `field${index}` as const;
      return {
        accessorKey: key,
        header: `Field ${index}`,
        size: 120 + (index % 3) * 10
      };
    }),
    { accessorKey: 'pinnedRight', header: 'Pinned Right', size: 110 }
  ];
}

function makeWideRows(rowCount: number, columnCount = 40): WideRow[] {
  return Array.from({ length: rowCount }, (_, rowIndex) => {
    const row: WideRow = {
      id: rowIndex + 1,
      pinnedLeft: `L${rowIndex + 1}`,
      pinnedRight: `R${rowIndex + 1}`
    } as WideRow;

    for (let columnIndex = 0; columnIndex < columnCount; columnIndex += 1) {
      row[`field${columnIndex}`] = `R${rowIndex + 1}C${columnIndex}`;
    }

    return row;
  });
}

function makeRows(count: number): TestRow[] {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));
}

function useHarnessTable(data: TestRow[], pageSize = 10) {
  return useReactTable({
    data,
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize, pageIndex: 0 } }
  });
}

function useSizedHarnessTable(data: TestRow[], pageSize = 10) {
  return useReactTable({
    data,
    columns: SIZED_COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize, pageIndex: 0 } }
  });
}

function useOverflowHeaderHarnessTable(data: TestRow[], pageSize = 10) {
  return useReactTable({
    data,
    columns: OVERFLOW_HEADER_COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize, pageIndex: 0 } }
  });
}

function useOverflowComponentHeaderHarnessTable(data: TestRow[], pageSize = 10) {
  return useReactTable({
    data,
    columns: OVERFLOW_COMPONENT_HEADER_COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize, pageIndex: 0 } }
  });
}

function Harness({
  rows,
  virtualization
}: {
  rows: TestRow[];
  virtualization?: TestVirtualizationProp;
}) {
  const table = useHarnessTable(rows, rows.length);
  return <DataTable table={table} virtualization={virtualization as never} />;
}

function SizedHarness({ rows }: { rows: TestRow[] }) {
  const table = useSizedHarnessTable(rows, rows.length);
  return <DataTable table={table} />;
}

function OverflowHeaderHarness({ rows }: { rows: TestRow[] }) {
  const table = useOverflowHeaderHarnessTable(rows, rows.length);
  return <DataTable table={table} />;
}

function OverflowComponentHeaderHarness({ rows }: { rows: TestRow[] }) {
  const table = useOverflowComponentHeaderHarnessTable(rows, rows.length);
  return <DataTable table={table} />;
}

function HeaderDragOverlayHarness() {
  const table = useOverflowComponentHeaderHarnessTable([{ id: 1, name: 'Alice' }], 1);
  const header = table.getFlatHeaders().find((candidate) => candidate.column.id === 'name');

  if (!header) return null;

  return <DataTableHeaderDragOverlay header={header} width={160} />;
}

function ControlsHarness({
  toolbar,
  actions,
  getSelectedRows,
  actionBar
}: {
  toolbar?: React.ReactNode;
  actions?: DataTableAction<TestRow>[];
  getSelectedRows?: () => TestRow[];
  actionBar?: React.ReactNode;
}) {
  const table = useHarnessTable(makeRows(5), 5);

  return (
    <DataTable
      table={table}
      tableActions={actions}
      getSelectedRows={getSelectedRows}
      actionBar={actionBar}
    >
      {toolbar}
    </DataTable>
  );
}

function ExpandHarness({
  rows,
  virtualization,
  rowActions,
  expandConfigOverride
}: {
  rows: TestRow[];
  virtualization?: TestVirtualizationProp;
  rowActions?: DataTableRowAction<TestRow>[];
  expandConfigOverride?: {
    rowKey: 'id';
    tabs: Array<{
      id: string;
      label: string;
      disabled?: boolean | ((row: TestRow) => boolean);
      render: (row: TestRow) => React.ReactNode;
    }>;
    defaultTab?: string;
    tableSizing?: {
      initialHeight: number;
      minHeight?: number;
      maxHeight?: number;
    };
  };
}) {
  const expandConfig =
    expandConfigOverride ??
    ({
      rowKey: 'id',
      tabs: [
        {
          id: 'summary',
          label: '概览',
          render: (row: TestRow) => <div>{`summary:${row.name}`}</div>
        }
      ]
    } as const);

  const { table, expandedRow, expandedRowKey, setExpandedRowKey, expandPanelId } = useDataTable({
    data: rows,
    columns: COLUMNS,
    pageCount: 1,
    showRowNumberColumn: false,
    rowActions,
    tableId: 'test-users',
    expandConfig
  });

  return (
    <div>
      <span data-testid='expanded-row-key'>{expandedRowKey ?? 'null'}</span>
      <span data-testid='expanded-row-name'>{expandedRow?.name ?? 'null'}</span>
      <DataTable
        table={table}
        virtualization={virtualization as never}
        expandConfig={expandConfig}
        expandedRow={expandedRow}
        expandedRowKey={expandedRowKey}
        onExpandedRowKeyChange={setExpandedRowKey}
        expandPanelId={expandPanelId}
      />
    </div>
  );
}

function SelectableHarness({ rows }: { rows: TestRow[] }) {
  const { table } = useDataTable({
    tableId: 'data-table-selectable',
    data: rows,
    columns: COLUMNS,
    pageCount: 1,
    showRowNumberColumn: false,
    showSelectColumn: true
  });

  return <DataTable table={table} />;
}

function WideHarness({
  rows = makeWideRows(20),
  centerColumnCount = 40,
  virtualization = { columnVirtualizationMode: 'on' as const }
}: {
  rows?: WideRow[];
  centerColumnCount?: number;
  virtualization?: TestVirtualizationProp;
}) {
  const table = useReactTable({
    data: rows,
    columns: makeWideColumns(centerColumnCount),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableColumnPinning: true,
    initialState: {
      pagination: { pageSize: rows.length, pageIndex: 0 },
      columnPinning: { left: ['pinnedLeft'], right: ['pinnedRight'] }
    }
  });

  return <DataTable table={table} virtualization={virtualization as never} />;
}

function GroupedHeaderHarness() {
  const columns: Array<ColumnDef<WideRow>> = [
    {
      header: 'Grouped',
      columns: [
        { accessorKey: 'field0', header: 'Field 0' },
        { accessorKey: 'field1', header: 'Field 1' }
      ]
    },
    { accessorKey: 'field2', header: 'Field 2' }
  ];
  const table = useReactTable({
    data: makeWideRows(5, 3),
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 5, pageIndex: 0 } }
  });

  return (
    <DataTable
      table={table}
      virtualization={{ columnVirtualizationMode: 'on', columnCountThreshold: 1 }}
    />
  );
}

function ColumnResizeMeasureHarness() {
  const table = useReactTable({
    data: makeWideRows(20),
    columns: makeWideColumns(40),
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableColumnPinning: true,
    enableColumnResizing: true,
    columnResizeMode: 'onChange',
    initialState: {
      pagination: { pageSize: 20, pageIndex: 0 },
      columnPinning: { left: ['pinnedLeft'], right: ['pinnedRight'] }
    }
  });

  return (
    <>
      <button
        type='button'
        onClick={() => table.setColumnSizing((prev) => ({ ...prev, field0: 260 }))}
      >
        Resize column
      </button>
      <DataTable table={table} virtualization={{ columnVirtualizationMode: 'on' }} />
    </>
  );
}

const originalNavigatorUserAgent = window.navigator.userAgent;
const originalNavigatorVendor = window.navigator.vendor;

function mockNavigator(userAgent: string, vendor: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: userAgent
  });
  Object.defineProperty(window.navigator, 'vendor', {
    configurable: true,
    value: vendor
  });
}

function ServerSelectableHarness({ rows, totalCount }: { rows: TestRow[]; totalCount: number }) {
  const { table } = useDataTable({
    tableId: 'data-table-server-selectable',
    data: rows,
    columns: COLUMNS,
    totalCount,
    pageSize: rows.length,
    pageCount: Math.ceil(totalCount / rows.length),
    showRowNumberColumn: false,
    showSelectColumn: true
  });

  return <DataTable table={table} statusTotalCount={totalCount} />;
}

function SelectedRowModelCounterHarness({
  rows,
  onFilteredSelectedRowModelAccess
}: {
  rows: TestRow[];
  onFilteredSelectedRowModelAccess: () => void;
}) {
  const { table } = useDataTable({
    tableId: 'data-table-selected-row-counter',
    data: rows,
    columns: COLUMNS,
    getRowId: (row) => String(row.id),
    pageCount: 1,
    showRowNumberColumn: false,
    showSelectColumn: true
  });
  const patchedRef = React.useRef(false);

  if (!patchedRef.current) {
    const original = table.getFilteredSelectedRowModel.bind(table);
    const mutableTable = table as typeof table & {
      getFilteredSelectedRowModel: typeof table.getFilteredSelectedRowModel;
    };

    mutableTable.getFilteredSelectedRowModel = () => {
      onFilteredSelectedRowModelAccess();
      return original();
    };
    patchedRef.current = true;
  }

  return <DataTable table={table} />;
}

const originalResizeObserver = globalThis.ResizeObserver;
const originalRequestAnimationFrame = window.requestAnimationFrame;
const originalCancelAnimationFrame = window.cancelAnimationFrame;
const envRecord = env as Record<string, unknown>;
const originalDataTableVirtualization = envRecord.dataTableVirtualization;

beforeEach(() => {
  virtualizerMocks.calls.length = 0;
  virtualizerMocks.instances.length = 0;
  window.requestAnimationFrame = ((callback: FrameRequestCallback) => {
    callback(0);
    return 0;
  }) as typeof window.requestAnimationFrame;
  window.cancelAnimationFrame = (() => undefined) as typeof window.cancelAnimationFrame;
  globalThis.ResizeObserver = class ResizeObserver {
    disconnect() {}
    observe() {}
    unobserve() {}
  } as typeof ResizeObserver;
  envRecord.dataTableVirtualization = true;
  const w = window as unknown as Record<string, unknown>;
  delete w.__DATA_TABLE_VIRTUAL_EVENTS__;
});

afterEach(() => {
  cleanup();
  if (originalResizeObserver === undefined) {
    // @ts-expect-error restoring test baseline when ResizeObserver is absent
    delete globalThis.ResizeObserver;
  } else {
    globalThis.ResizeObserver = originalResizeObserver;
  }
  window.requestAnimationFrame = originalRequestAnimationFrame;
  window.cancelAnimationFrame = originalCancelAnimationFrame;
  envRecord.dataTableVirtualization = originalDataTableVirtualization;
  mockNavigator(originalNavigatorUserAgent, originalNavigatorVendor);
  const w = window as unknown as Record<string, unknown>;
  delete w.__DATA_TABLE_VIRTUAL_EVENTS__;
});

describe('DataTable virtualization option resolution', () => {
  it('keeps column virtualization disabled by default while preserving row auto mode', () => {
    const resolved = resolveDataTableVirtualizationOptions();

    expect(resolved.value?.enabled).toBe(true);
    expect(resolved.value?.rowCountThreshold).toBeUndefined();
    expect(resolved.value?.column.enabled).toBe(false);
    expect(resolved.value?.column.columnCountThreshold).toBe(20);
    expect(resolved.value?.column.overscan).toBe(3);
  });

  it('forces column virtualization candidate mode independently of row threshold', () => {
    const resolved = resolveDataTableVirtualizationOptions({
      columnVirtualizationMode: 'on',
      rowCountThreshold: 100,
      columnCountThreshold: 40,
      columnOverscan: 5
    });

    expect(resolved.value?.enabled).toBe(true);
    expect(resolved.value?.rowCountThreshold).toBe(100);
    expect(resolved.value?.column.enabled).toBe(true);
    expect(resolved.value?.column.columnCountThreshold).toBe(0);
    expect(resolved.value?.column.overscan).toBe(5);
  });

  it('supports auto column thresholds and explicit column overscan', () => {
    const resolved = resolveDataTableVirtualizationOptions({
      columnVirtualizationMode: 'auto',
      columnCountThreshold: 32,
      columnOverscan: 7
    });

    expect(resolved.value?.column.enabled).toBe(true);
    expect(resolved.value?.column.columnCountThreshold).toBe(32);
    expect(resolved.value?.column.overscan).toBe(7);
  });

  it('allows column virtualization to be explicitly disabled without disabling rows', () => {
    const resolved = resolveDataTableVirtualizationOptions({
      enabled: true,
      rowCountThreshold: 10,
      columnVirtualizationMode: 'off',
      columnCountThreshold: 1
    });

    expect(resolved.value?.enabled).toBe(true);
    expect(resolved.value?.rowCountThreshold).toBe(10);
    expect(resolved.value?.column.enabled).toBe(false);
  });

  it('keeps virtualization=false as a full row and column opt-out', () => {
    const resolved = resolveDataTableVirtualizationOptions(false);

    expect(resolved.value?.enabled).toBe(false);
    expect(resolved.value?.column.enabled).toBe(false);
  });
});

describe('DataTable body', () => {
  it('renders all rows in normal mode', () => {
    const rows = makeRows(10);
    render(<Harness rows={rows} />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 10')).toBeInTheDocument();
  });

  it('renders empty message when no rows', () => {
    render(<Harness rows={[]} />);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });

  it('passes scrollTargetId to viewport', () => {
    const rows = makeRows(5);
    function HarnessWithScrollId() {
      const table = useHarnessTable(rows, 5);
      return <DataTable table={table} scrollTargetId='test-table' />;
    }
    render(<HarnessWithScrollId />);
    expect(screen.getByTestId('scroll-viewport')).toHaveAttribute(
      'data-scroll-target-id',
      'test-table'
    );
  });

  it('renders the table using the resolved total column width', () => {
    const rows = makeRows(5);
    const { container } = render(<SizedHarness rows={rows} />);

    const tableEl = container.querySelector('table');
    expect(tableEl?.getAttribute('style')).toContain('width: 250px');
    expect(tableEl?.getAttribute('style')).toContain('table-layout: fixed');
  });

  it('keeps header cells sticky at the top of the table viewport', () => {
    const rows = makeRows(5);
    const { container } = render(<SizedHarness rows={rows} />);

    const headerCells = container.querySelectorAll('thead th');
    expect(headerCells).toHaveLength(2);

    headerCells.forEach((cell) => {
      expect(cell).toHaveClass('bg-muted');
      expect(cell).toHaveStyle({
        position: 'sticky',
        top: '-1px',
        zIndex: '10'
      });
    });
  });

  it('uses the rendered component header title for the column drag overlay', () => {
    render(<HeaderDragOverlayHarness />);

    expect(screen.getByText(OVERFLOW_COMPONENT_HEADER_LABEL)).toBeInTheDocument();
    expect(screen.queryByText('name')).not.toBeInTheDocument();
  });

  it('renders a themed separator between toolbar and actions when both exist', () => {
    render(
      <ControlsHarness
        toolbar={<div data-testid='table-toolbar'>toolbar</div>}
        actions={[
          {
            label: '新增用户',
            callback: vi.fn()
          }
        ]}
      />
    );

    expect(screen.getByTestId('table-toolbar')).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '表格操作' })).toBeInTheDocument();
    const viewOptionsButton = screen.getByTestId('view-options-button');
    expect(viewOptionsButton).toHaveAttribute('data-icon-only', 'true');
    expect(viewOptionsButton).toHaveClass('ml-auto');
    expect(viewOptionsButton.parentElement).toContainElement(
      screen.getByRole('group', { name: '表格操作' })
    );
    const separator = document.querySelector('[data-slot="separator"]');
    expect(separator).not.toBeNull();
    expect(separator).toHaveClass(
      'ml-[calc(var(--page-container-padding-x,0rem)*-1)]',
      'data-[orientation=horizontal]:!w-[calc(100%+var(--page-container-padding-x,0rem)*2)]'
    );
  });

  it('does not render the top separator when only one top section exists', () => {
    const { rerender } = render(
      <ControlsHarness toolbar={<div data-testid='table-toolbar'>toolbar</div>} />
    );

    expect(document.querySelector('[data-slot="separator"]')).not.toBeNull();
    expect(screen.getByTestId('view-options-button')).toBeInTheDocument();

    rerender(
      <ControlsHarness
        actions={[
          {
            label: '新增用户',
            callback: vi.fn()
          }
        ]}
      />
    );

    expect(document.querySelector('[data-slot="separator"]')).toBeNull();
    expect(screen.getByTestId('view-options-button')).toBeInTheDocument();
  });

  it('passes explicit selected-row accessors down to the actions bar', () => {
    render(
      <ControlsHarness
        actions={[
          {
            label: '导出选中',
            hidden: (ctx) => ctx.selectedRows.length === 0,
            callback: vi.fn()
          }
        ]}
        getSelectedRows={() => makeRows(1)}
      />
    );

    expect(screen.getByRole('button', { name: /导出选中/ })).toBeInTheDocument();
  });

  it('uses explicit selected rows to control custom actionBar visibility', () => {
    const { rerender } = render(
      <ControlsHarness
        getSelectedRows={() => []}
        actionBar={<div data-testid='selection-bar'>选中操作</div>}
      />
    );

    expect(screen.queryByTestId('selection-bar')).toBeNull();

    rerender(
      <ControlsHarness
        getSelectedRows={() => makeRows(1)}
        actionBar={<div data-testid='selection-bar'>选中操作</div>}
      />
    );

    expect(screen.getByTestId('selection-bar')).toBeInTheDocument();
  });

  it('uses explicit selected rows for pagination summary text', () => {
    const { rerender } = render(<ControlsHarness getSelectedRows={() => []} />);

    expect(screen.getByText('共 5 条数据')).toBeInTheDocument();

    rerender(<ControlsHarness getSelectedRows={() => makeRows(2)} />);

    expect(screen.getByText('已选择 2 / 5 行')).toBeInTheDocument();
  });

  it('passes the server total row count to the pagination summary', () => {
    function HarnessWithServerTotal() {
      const table = useHarnessTable(makeRows(5), 5);
      return <DataTable table={table} statusTotalCount={42} />;
    }

    render(<HarnessWithServerTotal />);

    expect(screen.getByText('共 42 条数据')).toBeInTheDocument();
  });

  it('expands the select-column click target to the full table cell', async () => {
    const user = userEvent.setup();
    const { container } = render(<SelectableHarness rows={makeRows(2)} />);

    const hitboxes = container.querySelectorAll('[data-slot="data-table-select-hitbox"]');
    const firstRowHitbox = hitboxes.item(1);

    if (!(firstRowHitbox instanceof HTMLElement)) {
      throw new Error('first row select hitbox missing');
    }

    await user.click(firstRowHitbox);

    expect(screen.getByText('已选择 1 / 2 行')).toBeInTheDocument();
  });

  it('avoids filtered selected row model work and keeps implicit selection summaries page-scoped', async () => {
    const user = userEvent.setup();
    let filteredSelectedRowModelAccessCount = 0;
    const { container } = render(
      <SelectedRowModelCounterHarness
        rows={makeRows(200)}
        onFilteredSelectedRowModelAccess={() => {
          filteredSelectedRowModelAccessCount += 1;
        }}
      />
    );

    expect(filteredSelectedRowModelAccessCount).toBe(0);

    const hitboxes = container.querySelectorAll('[data-slot="data-table-select-hitbox"]');
    const firstRowHitbox = hitboxes.item(1);

    if (!(firstRowHitbox instanceof HTMLElement)) {
      throw new Error('first row select hitbox missing');
    }

    await user.click(firstRowHitbox);

    expect(screen.getByText('已选择 1 / 200 行')).toBeInTheDocument();
    expect(filteredSelectedRowModelAccessCount).toBe(0);
  });

  it('keeps implicit selection summaries page-scoped even when a server total row count is provided', async () => {
    const user = userEvent.setup();
    const { container } = render(<ServerSelectableHarness rows={makeRows(10)} totalCount={42} />);

    const hitboxes = container.querySelectorAll('[data-slot="data-table-select-hitbox"]');
    const firstRowHitbox = hitboxes.item(1);

    if (!(firstRowHitbox instanceof HTMLElement)) {
      throw new Error('first row select hitbox missing');
    }

    await user.click(firstRowHitbox);

    expect(screen.getByText('已选择 1 / 10 行')).toBeInTheDocument();
  });

  it('renders all rows when virtualization is explicitly disabled', () => {
    const rows = makeRows(150);
    render(<Harness rows={rows} virtualization={false} />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 150')).toBeInTheDocument();
  });

  it('renders all rows when virtualization mode is explicitly off', () => {
    const rows = makeRows(150);
    const { container } = render(<Harness rows={rows} virtualization={{ mode: 'off' }} />);

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 150')).toBeInTheDocument();
    expect(container.querySelector('tbody[data-virtual-enabled="true"]')).toBeNull();
  });

  it('virtualizes by default when row count is above threshold', () => {
    const rows = makeRows(150);
    const { container } = render(<Harness rows={rows} />);

    const rowElements = screen.queryAllByText(/^Item \d+$/);
    expect(rowElements.length).toBeLessThan(150);

    const virtualRows = container.querySelectorAll(
      'tbody[data-virtual-enabled="true"] tr[data-index]'
    );
    expect(virtualRows.length).toBeGreaterThan(0);
  });

  it('forces virtualization when mode is on even below the auto threshold', () => {
    const rows = makeRows(50);
    const { container } = render(<Harness rows={rows} virtualization={{ mode: 'on' }} />);

    const rowElements = screen.queryAllByText(/^Item \d+$/);
    expect(rowElements.length).toBeLessThan(50);
    expect(container.querySelector('tbody[data-virtual-enabled="true"]')).not.toBeNull();
  });

  it('disables auto virtualization when the shared env gate is off', () => {
    envRecord.dataTableVirtualization = false;
    const rows = makeRows(150);
    const { container } = render(<Harness rows={rows} />);

    expect(screen.getByText('Item 150')).toBeInTheDocument();
    expect(container.querySelector('tbody[data-virtual-enabled="true"]')).toBeNull();

    const events = (
      window as unknown as { __DATA_TABLE_VIRTUAL_EVENTS__?: Array<Record<string, unknown>> }
    ).__DATA_TABLE_VIRTUAL_EVENTS__;
    expect(events?.some((evt) => evt.event === 'disabled-by-config')).toBe(true);
  });

  it('disables auto virtualization when ResizeObserver is unavailable', () => {
    // @ts-expect-error simulate unsupported browser for virtualization gate
    delete globalThis.ResizeObserver;
    const rows = makeRows(150);
    const { container } = render(<Harness rows={rows} />);

    expect(screen.getByText('Item 150')).toBeInTheDocument();
    expect(container.querySelector('tbody[data-virtual-enabled="true"]')).toBeNull();

    const events = (
      window as unknown as { __DATA_TABLE_VIRTUAL_EVENTS__?: Array<Record<string, unknown>> }
    ).__DATA_TABLE_VIRTUAL_EVENTS__;
    expect(events?.some((evt) => evt.event === 'unsupported-browser')).toBe(true);
  });

  it('keeps supporting the legacy enabled flag in virtualization config', () => {
    const rows = makeRows(200);
    const { container } = render(
      <Harness rows={rows} virtualization={{ enabled: true, rowCountThreshold: 10, overscan: 0 }} />
    );

    const virtualRows = container.querySelectorAll(
      'tbody[data-virtual-enabled="true"] tr[data-index]'
    );
    expect(virtualRows.length).toBeGreaterThan(0);
  });

  it('column virtualization creates a horizontal virtualizer for center columns only', () => {
    render(<WideHarness centerColumnCount={40} />);

    const horizontalCall = virtualizerMocks.calls.find((call) => call.horizontal);
    expect(horizontalCall).toMatchObject({
      count: 40,
      enabled: true,
      overscan: 3
    });
  });

  it('column virtualization renders pinned cells and clips center body cells', () => {
    const rows = makeWideRows(20);
    const { container } = render(<WideHarness rows={rows} centerColumnCount={40} />);

    expect(container.querySelector('tbody[data-column-virtual-enabled="true"]')).not.toBeNull();
    expect(screen.getByText('L1')).toBeInTheDocument();
    expect(screen.getByText('R1')).toBeInTheDocument();
    expect(screen.getByText('R1C0')).toBeInTheDocument();
    expect(screen.queryByText('R1C39')).toBeNull();
    expect(container.querySelectorAll('tbody td').length).toBeLessThan(20 * 42);

    const firstBodyRow = container.querySelector('tbody tr');
    if (!firstBodyRow) throw new Error('first body row missing');
    const firstRowTexts = Array.from(firstBodyRow.querySelectorAll('td')).map((td) =>
      td.textContent?.trim()
    );
    expect(firstRowTexts).toContain('R1C0');
    expect(firstRowTexts.filter((text) => text === 'L1')).toHaveLength(1);
  });

  it('column virtualization skips full colgroup and emits enabled telemetry', async () => {
    const { container } = render(<WideHarness centerColumnCount={40} />);

    expect(container.querySelectorAll('col')).toHaveLength(0);
    expect(container.querySelector('[data-column-virtual-enabled="true"]')).not.toBeNull();

    await waitFor(() => {
      const events = (
        window as unknown as { __DATA_TABLE_VIRTUAL_EVENTS__?: Array<Record<string, unknown>> }
      ).__DATA_TABLE_VIRTUAL_EVENTS__;
      expect(events).toEqual(
        expect.arrayContaining([expect.objectContaining({ event: 'columns-enabled', count: 40 })])
      );
    });
  });

  it('column virtualization falls back for grouped headers and records telemetry', () => {
    const { container } = render(<GroupedHeaderHarness />);

    const horizontalCall = virtualizerMocks.calls.find((call) => call.horizontal);
    expect(horizontalCall).toMatchObject({
      count: 3,
      enabled: false
    });
    expect(container.querySelector('[data-column-virtual-enabled="true"]')).toBeNull();

    const events = (
      window as unknown as { __DATA_TABLE_VIRTUAL_EVENTS__?: Array<Record<string, unknown>> }
    ).__DATA_TABLE_VIRTUAL_EVENTS__;
    expect(events).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: 'columns-fallback', reason: 'grouped-header' })
      ])
    );
  });

  it('row and column virtualization together reduce rendered rows and cells', () => {
    const { container } = render(
      <WideHarness
        rows={makeWideRows(200)}
        centerColumnCount={40}
        virtualization={{
          enabled: true,
          rowCountThreshold: 10,
          columnVirtualizationMode: 'on',
          columnOverscan: 3
        }}
      />
    );

    const tbody = container.querySelector(
      'tbody[data-virtual-enabled="true"][data-column-virtual-enabled="true"]'
    );
    expect(tbody).not.toBeNull();
    expect(container.querySelectorAll('tbody tr[data-index]').length).toBeLessThan(200);
    expect(container.querySelectorAll('tbody td').length).toBeLessThan(200 * 42);
  });

  it('shows the shared tooltip on the first hover of overflowing cell text', async () => {
    const scrollWidthSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockReturnValue(240);
    const clientWidthSpy = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(80);

    try {
      const user = userEvent.setup();

      render(<Harness rows={[{ id: 1, name: 'A very long customer name' }]} />);

      await user.hover(screen.getByText('A very long customer name'));

      expect(await screen.findByRole('tooltip')).toHaveTextContent('A very long customer name');
    } finally {
      scrollWidthSpy.mockRestore();
      clientWidthSpy.mockRestore();
    }
  });

  it('shows the shared tooltip on the first hover of overflowing header text', async () => {
    const scrollWidthSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockReturnValue(240);
    const clientWidthSpy = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(80);

    try {
      const user = userEvent.setup();

      render(<OverflowHeaderHarness rows={[{ id: 1, name: 'Alice' }]} />);

      await user.hover(screen.getByText(OVERFLOW_HEADER_LABEL));

      expect(await screen.findByRole('tooltip')).toHaveTextContent(OVERFLOW_HEADER_LABEL);
    } finally {
      scrollWidthSpy.mockRestore();
      clientWidthSpy.mockRestore();
    }
  });

  it('shows the shared tooltip on the first hover of overflowing sortable header text', async () => {
    const scrollWidthSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockReturnValue(260);
    const clientWidthSpy = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(80);

    try {
      const user = userEvent.setup();

      render(<OverflowComponentHeaderHarness rows={[{ id: 1, name: 'Alice' }]} />);

      await user.hover(screen.getByText(OVERFLOW_COMPONENT_HEADER_LABEL));

      expect(await screen.findByRole('tooltip')).toHaveTextContent(OVERFLOW_COMPONENT_HEADER_LABEL);
    } finally {
      scrollWidthSpy.mockRestore();
      clientWidthSpy.mockRestore();
    }
  });

  it('remeasures the horizontal virtualizer after column sizing changes', async () => {
    const user = userEvent.setup();
    render(<ColumnResizeMeasureHarness />);

    for (const instance of virtualizerMocks.instances) {
      instance.measure.mockClear();
    }

    await user.click(screen.getByRole('button', { name: 'Resize column' }));

    await waitFor(() => {
      const measureCount = virtualizerMocks.instances
        .filter((instance) => instance.horizontal)
        .reduce((sum, instance) => sum + instance.measure.mock.calls.length, 0);
      expect(measureCount).toBeGreaterThan(0);
    });
  });

  it('uses top positioning for Safari row and column virtualization with pinned columns', () => {
    mockNavigator(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
      'Apple Computer, Inc.'
    );

    const { container } = render(
      <WideHarness
        rows={makeWideRows(200)}
        virtualization={{
          enabled: true,
          rowCountThreshold: 10,
          columnVirtualizationMode: 'on'
        }}
      />
    );

    const secondVirtualRow = container.querySelector(
      'tbody tr[data-index="1"]'
    ) as HTMLTableRowElement | null;
    expect(secondVirtualRow).not.toBeNull();
    expect(secondVirtualRow?.dataset.virtualRowPositioning).toBe('top');
    expect(secondVirtualRow?.style.top).toBe('56px');
    expect(secondVirtualRow?.style.transform).toBe('');
  });

  it('keeps transform positioning outside Safari for row and column virtualization with pinned columns', () => {
    mockNavigator(
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Google Inc.'
    );

    const { container } = render(
      <WideHarness
        rows={makeWideRows(200)}
        virtualization={{
          enabled: true,
          rowCountThreshold: 10,
          columnVirtualizationMode: 'on'
        }}
      />
    );

    const secondVirtualRow = container.querySelector(
      'tbody tr[data-index="1"]'
    ) as HTMLTableRowElement | null;
    expect(secondVirtualRow).not.toBeNull();
    expect(secondVirtualRow?.dataset.virtualRowPositioning).toBe('transform');
    expect(secondVirtualRow?.style.top).toBe('0px');
    expect(secondVirtualRow?.style.transform).toBe('translateY(56px)');
  });

  it('renders all rows when below threshold', () => {
    const rows = makeRows(50);
    render(<Harness rows={rows} virtualization={{ enabled: true, rowCountThreshold: 100 }} />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 50')).toBeInTheDocument();
  });

  it('renders fewer DOM rows when virtualizing above threshold', () => {
    const rows = makeRows(200);
    const { container } = render(
      <Harness rows={rows} virtualization={{ enabled: true, rowCountThreshold: 10, overscan: 0 }} />
    );
    // Virtual scroll with absolute positioning: some rows are rendered, but not all 200
    const rowElements = screen.queryAllByText(/^Item \d+$/);
    expect(rowElements.length).toBeLessThan(200);

    const virtualRows = container.querySelectorAll(
      'tbody[data-virtual-enabled="true"] tr[data-index]'
    );
    expect(virtualRows.length).toBeGreaterThan(0);
    expect((virtualRows[0] as HTMLTableRowElement).style.height).toBe('56px');
  });

  it('expands the clicked row when clicking normal cell content', async () => {
    const user = userEvent.setup();
    render(<ExpandHarness rows={makeRows(5)} />);

    await user.click(screen.getByText('Item 2'));

    expect(screen.getByTestId('expanded-row-key').textContent).toBe('2');
    expect(screen.getByTestId('expanded-row-name').textContent).toBe('Item 2');
  });

  it('does not expand when clicking a row action button', async () => {
    const user = userEvent.setup();
    const onEdit = vi.fn();

    render(
      <ExpandHarness
        rows={makeRows(5)}
        rowActions={[
          {
            label: '编辑',
            icon: <span>edit</span>,
            onClick: onEdit
          }
        ]}
      />
    );

    const actionButtons = screen.getAllByRole('button', { name: '编辑' });
    await user.click(actionButtons[0]);

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('expanded-row-key').textContent).toBe('null');
  });

  it('does not expand when clicking portaled row action content', async () => {
    const user = userEvent.setup();

    function PortalSheet({
      open
    }: {
      data: TestRow;
      open: boolean;
      onOpenChange: (open: boolean) => void;
    }) {
      if (!open) return null;
      return createPortal(<div>Sheet content title</div>, document.body);
    }

    render(
      <ExpandHarness
        rows={makeRows(5)}
        rowActions={[
          {
            label: '编辑',
            icon: <span>edit</span>,
            Sheet: PortalSheet
          }
        ]}
      />
    );

    await user.click(screen.getAllByRole('button', { name: '编辑' })[0]);
    await user.click(await screen.findByText('Sheet content title'));

    expect(screen.getByTestId('expanded-row-key').textContent).toBe('null');
  });

  it('applies the same row-click boundary rules in the virtualized branch', async () => {
    const user = userEvent.setup();

    render(
      <ExpandHarness
        rows={makeRows(200)}
        virtualization={{ enabled: true, rowCountThreshold: 10, overscan: 0 }}
      />
    );

    const firstRowText = screen.getAllByText('Item 1').at(-1);
    if (!firstRowText) {
      throw new Error('row text for Item 1 missing');
    }

    await user.click(firstRowText);

    expect(screen.getByTestId('expanded-row-key').textContent).toBe('1');
  });

  it('renders and closes the expand panel after a row is opened', async () => {
    const user = userEvent.setup();
    render(<ExpandHarness rows={makeRows(5)} />);

    const firstRowText = screen.getAllByText('Item 1').at(-1);
    if (!firstRowText) {
      throw new Error('row text for Item 1 missing');
    }

    await user.click(firstRowText);

    expect(screen.getByTestId('expanded-row-key').textContent).toBe('1');
    expect(screen.getByText('summary:Item 1')).toBeInTheDocument();
    expect(document.querySelector('[data-slot="data-table-expand-panel"]')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: '关闭详情面板' }));

    expect(screen.getByTestId('expanded-row-key').textContent).toBe('null');
    expect(document.querySelector('[data-slot="data-table-expand-panel"]')).toBeNull();
  });

  it('uses default table height while keeping the expand panel content-sized', async () => {
    const user = userEvent.setup();

    render(<ExpandHarness rows={makeRows(5)} />);

    await user.click(screen.getByText('Item 1'));

    const separator = screen.getByRole('separator');
    const topPanel = document.querySelector<HTMLElement>('[data-slot="data-table-expand-main"]');
    const detailPanel = document.querySelector<HTMLElement>(
      '[data-slot="data-table-expand-panel-host"]'
    );

    expect(separator).toHaveAttribute(
      'aria-valuemin',
      String(DATA_TABLE_DEFAULT_EXPAND_TABLE_SIZING.minHeight)
    );
    expect(separator).toHaveAttribute(
      'aria-valuemax',
      String(DATA_TABLE_DEFAULT_EXPAND_TABLE_SIZING.maxHeight)
    );
    expect(separator).toHaveAttribute(
      'aria-valuenow',
      String(DATA_TABLE_DEFAULT_EXPAND_TABLE_SIZING.initialHeight)
    );
    expect(topPanel?.style.flex).toBe(
      `0 0 ${DATA_TABLE_DEFAULT_EXPAND_TABLE_SIZING.initialHeight}px`
    );
    expect(detailPanel?.style.height).toBe('');
  });

  it('uses configured table height while keeping the expand panel content-sized', async () => {
    const user = userEvent.setup();

    render(
      <ExpandHarness
        rows={makeRows(5)}
        expandConfigOverride={{
          rowKey: 'id',
          tabs: [
            {
              id: 'summary',
              label: '概览',
              render: (row) => <div>{`summary:${row.name}`}</div>
            }
          ],
          tableSizing: {
            initialHeight: 420,
            minHeight: 300,
            maxHeight: 700
          }
        }}
      />
    );

    await user.click(screen.getByText('Item 1'));

    const separator = screen.getByRole('separator');
    const topPanel = document.querySelector<HTMLElement>('[data-slot="data-table-expand-main"]');
    const detailPanel = document.querySelector<HTMLElement>(
      '[data-slot="data-table-expand-panel-host"]'
    );

    expect(separator).toHaveAttribute('aria-valuemin', '300');
    expect(separator).toHaveAttribute('aria-valuemax', '700');
    expect(separator).toHaveAttribute('aria-valuenow', '420');
    expect(topPanel?.style.flex).toBe('0 0 420px');
    expect(detailPanel?.style.height).toBe('');
  });

  it('preserves splitter height on same-row click and after close/reopen within the same mount', async () => {
    const user = userEvent.setup();
    render(<ExpandHarness rows={makeRows(5)} />);

    await user.click(screen.getByText('Item 1'));

    const separator = screen.getByRole('separator');
    separator.focus();
    await user.keyboard('{End}');

    expect(separator).toHaveAttribute(
      'aria-valuenow',
      String(DATA_TABLE_DEFAULT_EXPAND_TABLE_SIZING.maxHeight)
    );

    const sameRowText = screen.getAllByText('Item 1').at(-1);
    if (!sameRowText) {
      throw new Error('row text for Item 1 missing');
    }

    await user.click(sameRowText);
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      String(DATA_TABLE_DEFAULT_EXPAND_TABLE_SIZING.maxHeight)
    );

    await user.click(screen.getByRole('button', { name: '关闭详情面板' }));
    await user.click(screen.getByText('Item 2'));

    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      String(DATA_TABLE_DEFAULT_EXPAND_TABLE_SIZING.maxHeight)
    );
  });

  it('resets splitter height after remount', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<ExpandHarness rows={makeRows(5)} />);

    await user.click(screen.getByText('Item 1'));

    const separator = screen.getByRole('separator');
    separator.focus();
    await user.keyboard('{End}');
    expect(separator).toHaveAttribute(
      'aria-valuenow',
      String(DATA_TABLE_DEFAULT_EXPAND_TABLE_SIZING.maxHeight)
    );

    unmount();
    render(<ExpandHarness rows={makeRows(5)} />);

    await user.click(screen.getByText('Item 1'));
    expect(screen.getByRole('separator')).toHaveAttribute(
      'aria-valuenow',
      String(DATA_TABLE_DEFAULT_EXPAND_TABLE_SIZING.initialHeight)
    );
  });

  it('falls back to the default available tab when switching rows invalidates the active tab', async () => {
    const user = userEvent.setup();

    render(
      <ExpandHarness
        rows={makeRows(5)}
        expandConfigOverride={{
          rowKey: 'id',
          defaultTab: 'summary',
          tabs: [
            {
              id: 'summary',
              label: '概览',
              render: (row) => <div>{`summary:${row.name}`}</div>
            },
            {
              id: 'audit',
              label: '审计',
              disabled: (row) => row.id === 2,
              render: (row) => <div>{`audit:${row.name}`}</div>
            }
          ]
        }}
      />
    );

    await user.click(screen.getByText('Item 1'));
    await user.click(screen.getByRole('tab', { name: '审计' }));

    expect(screen.getByText('audit:Item 1')).toBeInTheDocument();

    await user.click(screen.getByText('Item 2'));

    expect(screen.getByText('summary:Item 2')).toBeInTheDocument();
    expect(screen.queryByText('audit:Item 2')).toBeNull();
  });
});
