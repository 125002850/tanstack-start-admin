import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { act, render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import {
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
  getPaginationRowModel,
  type SortingState
} from '@tanstack/react-table';
import { DataTable } from '@/components/data-table/core/data-table';
import { createDataTableColumnDsl } from '@/components/data-table/columns/data-table-column-factory';
import { DataTableColumnHeader } from '@/components/data-table/columns/data-table-column-header';
import { DataTableHeaderDragOverlay } from '@/components/data-table/core/data-table-header';
import { useDataTable } from '@/hooks/use-data-table';
import type {
  DataTableAction,
  DataTableEditingController,
  DataTableRowAction,
  DataTableVirtualizationOptions
} from '@/types/data-table';
import * as React from 'react';
import { createPortal } from 'react-dom';
import userEvent from '@testing-library/user-event';
import { env } from '@/config';
import { resolveDataTableVirtualizationOptions } from '@/config/data-table';
import { DATA_TABLE_DEFAULT_EXPAND_TABLE_SIZING } from '@/lib/data-table/expand-split';

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

vi.mock('@/components/data-table/toolbar/data-table-view-options', () => ({
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
type MoneyRow = { id: number; amount: number };
type EditableRow = {
  id: number;
  name: string;
  status: 'DRAFT' | 'READY' | null;
};
type EditableNumericRow = {
  id: number;
  rate: number | null;
};
type KeyboardEditableRow = {
  id: number;
  requiredName: string;
  amount: number | null;
  effectiveDate: string | null;
  startsAt: string | null;
};
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
const MONEY_COLUMN_DSL = createDataTableColumnDsl<MoneyRow>();
const MONEY_COLUMNS: ColumnDef<MoneyRow>[] = [
  { accessorKey: 'id', header: 'ID' },
  MONEY_COLUMN_DSL.field('amount', 'Amount', { type: 'money' })
];
const EDITABLE_COLUMN_DSL = createDataTableColumnDsl<EditableRow>();
const EDITABLE_COLUMNS = [
  EDITABLE_COLUMN_DSL.field('id', 'ID', { type: 'number' }),
  EDITABLE_COLUMN_DSL.editableField('name', '名称', {
    type: 'text'
  }),
  EDITABLE_COLUMN_DSL.editableField('status', '状态', {
    type: 'enum',
    valueOptions: [
      { value: 'DRAFT', label: '草稿' },
      { value: 'READY', label: '就绪' }
    ],
    edit: { selectionMode: 'single' }
  })
];
const EDITABLE_NUMERIC_COLUMN_DSL = createDataTableColumnDsl<EditableNumericRow>();
const EDITABLE_NUMERIC_COLUMNS = [
  EDITABLE_NUMERIC_COLUMN_DSL.editableField('rate', '比例', {
    type: 'percent',
    edit: {
      maxFractionDigits: 2
    }
  })
];
const KEYBOARD_EDITABLE_COLUMN_DSL = createDataTableColumnDsl<KeyboardEditableRow>({
  tableId: 'data-table-keyboard-selection',
  tableTimeZone: 'Asia/Shanghai'
});
const KEYBOARD_EDITABLE_COLUMNS = [
  KEYBOARD_EDITABLE_COLUMN_DSL.editableField('requiredName', '必填名称', {
    type: 'text',
    edit: { allowEmpty: false }
  }),
  KEYBOARD_EDITABLE_COLUMN_DSL.editableField('amount', '金额', {
    type: 'decimal',
    edit: { allowEmpty: true, emptyValue: null, step: 0.01 }
  }),
  KEYBOARD_EDITABLE_COLUMN_DSL.editableField('effectiveDate', '生效日期', {
    type: 'date'
  }),
  KEYBOARD_EDITABLE_COLUMN_DSL.editableField('startsAt', '开始时间', {
    type: 'dateTime',
    edit: {
      valueKind: 'local',
      granularity: 'minute',
      step: 1
    }
  })
];

const FILTERABLE_COLUMNS: ColumnDef<TestRow>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
    enableColumnFilter: true,
    meta: { variant: 'text', label: 'ID' }
  },
  {
    accessorKey: 'name',
    header: 'Name',
    enableColumnFilter: true,
    meta: { variant: 'text', label: 'Name' }
  }
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

function createCopyEvent() {
  const clipboardData = {
    setData: vi.fn()
  };
  const event = new Event('copy', { bubbles: true, cancelable: true }) as ClipboardEvent;

  Object.defineProperty(event, 'clipboardData', {
    configurable: true,
    value: clipboardData
  });

  return { clipboardData, event };
}

function createPasteEvent(text: string) {
  const clipboardData = {
    getData: vi.fn(() => text)
  };
  const event = new Event('paste', { bubbles: true, cancelable: true }) as ClipboardEvent;

  Object.defineProperty(event, 'clipboardData', {
    configurable: true,
    value: clipboardData
  });

  return { clipboardData, event };
}

function getBodyCell(container: HTMLElement, rowIndex: number, text: string) {
  const cell = Array.from(
    container.querySelectorAll<HTMLTableCellElement>(`tbody tr:nth-child(${rowIndex + 1}) td`)
  ).find((candidate) => candidate.textContent === text);

  if (!cell) throw new Error(`cell ${rowIndex}:${text} missing`);
  return cell;
}

function dispatchCellPointerEvent(
  target: HTMLElement,
  type: 'pointerdown' | 'pointermove' | 'pointerup',
  init: { pointerId: number; clientX?: number; clientY?: number; shiftKey?: boolean }
) {
  const event = new (window.PointerEvent ?? window.MouseEvent)(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: type === 'pointerup' ? 0 : 1,
    clientX: init.clientX,
    clientY: init.clientY,
    shiftKey: init.shiftKey
  });
  if (!('pointerId' in event)) {
    Object.defineProperty(event, 'pointerId', { value: init.pointerId });
  }
  fireEvent(target, event);
}

function dragCellRange(source: HTMLElement, target: HTMLElement) {
  dispatchCellPointerEvent(source, 'pointerdown', { pointerId: 1, clientX: 10, clientY: 10 });
  dispatchCellPointerEvent(target, 'pointermove', { pointerId: 1, clientX: 40, clientY: 40 });
  dispatchCellPointerEvent(target, 'pointerup', { pointerId: 1, clientX: 40, clientY: 40 });
}

function useHarnessTable(data: TestRow[], pageSize = 10, rowCount?: number) {
  return useReactTable({
    data,
    columns: COLUMNS,
    rowCount,
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

function useFilterableHarnessTable(data: TestRow[], pageSize = 10) {
  return useReactTable({
    data,
    columns: FILTERABLE_COLUMNS,
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
  virtualization,
  enableZebraStriping = false
}: {
  rows: TestRow[];
  virtualization?: TestVirtualizationProp;
  enableZebraStriping?: boolean;
}) {
  const table = useReactTable({
    data: rows,
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: rows.length, pageIndex: 0 } },
    meta: { enableZebraStriping }
  });
  return <DataTable table={table} virtualization={virtualization as never} />;
}

function MoneyCopyHarness({ rows }: { rows: MoneyRow[] }) {
  const table = useReactTable({
    data: rows,
    columns: MONEY_COLUMNS,
    getCoreRowModel: getCoreRowModel()
  });

  return <DataTable table={table} />;
}

function EditableSelectionHarness({
  onChange,
  isCellEditable,
  onEditingReady
}: {
  onChange: NonNullable<Parameters<typeof useDataTable<EditableRow>>[0]['editing']>['onChange'];
  isCellEditable?: NonNullable<
    Parameters<typeof useDataTable<EditableRow>>[0]['editing']
  >['isCellEditable'];
  onEditingReady?: (controller: DataTableEditingController<EditableRow>) => void;
}) {
  const data = React.useMemo(
    () => [
      { id: 1, name: '记录 1', status: 'DRAFT' as const },
      { id: 2, name: '记录 2', status: 'READY' as const }
    ],
    []
  );
  const { table, editing } = useDataTable({
    tableId: 'data-table-editable-selection',
    rowId: 'id',
    data,
    columns: EDITABLE_COLUMNS,
    editing: { onChange, isCellEditable },
    showRowNumberColumn: false
  });
  React.useEffect(() => onEditingReady?.(editing), [editing, onEditingReady]);

  return <DataTable table={table} virtualization={false} />;
}

function KeyboardSelectionHarness({
  onChange
}: {
  onChange: NonNullable<
    Parameters<typeof useDataTable<KeyboardEditableRow>>[0]['editing']
  >['onChange'];
}) {
  const { table } = useDataTable({
    tableId: 'data-table-keyboard-selection',
    rowId: 'id',
    data: [
      {
        id: 1,
        requiredName: '原名称',
        amount: 12.5,
        effectiveDate: '2026-07-31',
        startsAt: '2026-07-31T12:30'
      }
    ],
    columns: KEYBOARD_EDITABLE_COLUMNS,
    editing: { onChange },
    showRowNumberColumn: false
  });

  return <DataTable table={table} virtualization={false} />;
}

function EditableNumericSelectionHarness({
  onChange
}: {
  onChange: NonNullable<
    Parameters<typeof useDataTable<EditableNumericRow>>[0]['editing']
  >['onChange'];
}) {
  const { table } = useDataTable({
    tableId: 'data-table-editable-numeric-selection',
    rowId: 'id',
    data: [{ id: 1, rate: 0.1 }],
    columns: EDITABLE_NUMERIC_COLUMNS,
    editing: { onChange },
    showRowNumberColumn: false
  });

  return <DataTable table={table} virtualization={false} />;
}

function SizedHarness({ rows }: { rows: TestRow[] }) {
  const table = useSizedHarnessTable(rows, rows.length);
  return <DataTable table={table} />;
}

function LoadingSkeletonHarness({ rows = [] }: { rows?: TestRow[] }) {
  const table = useFilterableHarnessTable(rows, 10);

  return (
    <DataTable
      table={table}
      isLoading
      loadingSkeleton={{
        withViewOptions: false
      }}
    />
  );
}

function OverflowHeaderHarness({ rows }: { rows: TestRow[] }) {
  const table = useOverflowHeaderHarnessTable(rows, rows.length);
  return <DataTable table={table} />;
}

function OverflowComponentHeaderHarness({ rows }: { rows: TestRow[] }) {
  const table = useOverflowComponentHeaderHarnessTable(rows, rows.length);
  return <DataTable table={table} />;
}

function SortableHeaderHarness({ sorting }: { sorting: SortingState }) {
  const table = useReactTable({
    data: makeRows(3),
    columns: OVERFLOW_COMPONENT_HEADER_COLUMNS,
    state: { sorting },
    onSortingChange: vi.fn(),
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

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

function SpecialColumnsSelectionHarness({ rows }: { rows: TestRow[] }) {
  const { table } = useDataTable({
    tableId: 'data-table-special-columns-selection',
    data: rows,
    columns: COLUMNS,
    pageCount: 1,
    rowActions: [
      {
        label: '编辑',
        icon: <span>edit</span>,
        onClick: () => undefined
      }
    ]
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

  return <DataTable table={table} />;
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
    rowId: (row) => row.id,
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
  Element.prototype.hasPointerCapture ??= vi.fn(() => false);
  Element.prototype.setPointerCapture ??= vi.fn();
  Element.prototype.releasePointerCapture ??= vi.fn();
  Element.prototype.scrollIntoView ??= vi.fn();
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

describe('DataTable cell selection', () => {
  it('renders a server cell error with accessible invalid state and a non-color marker', async () => {
    const user = userEvent.setup();
    const editingRef: { current: DataTableEditingController<EditableRow> | null } = {
      current: null
    };
    const { container } = render(
      <EditableSelectionHarness
        onChange={vi.fn()}
        onEditingReady={(controller) => {
          editingRef.current = controller;
        }}
      />
    );
    await waitFor(() => expect(editingRef.current).not.toBeNull());
    const editing = editingRef.current;
    const nameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    const statusCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="status"]'
    );
    if (!nameCell || !statusCell || !editing) throw new Error('server error cells missing');

    let mutationResult: ReturnType<typeof editing.setServerCellErrors> | undefined;
    act(() => {
      mutationResult = editing.setServerCellErrors({
        revision: editing.getRevision(),
        errors: [{ rowId: '1', field: 'name', messages: ['名称已存在'] }]
      });
    });

    expect(mutationResult).toEqual({ applied: 1, skipped: 0 });
    expect(editing.getServerCellErrors()).toEqual([
      expect.objectContaining({ rowId: '1', field: 'name', messages: ['名称已存在'] })
    ]);
    await waitFor(() => expect(nameCell).toHaveAttribute('aria-invalid', 'true'));
    expect(nameCell).toHaveAttribute('data-cell-server-invalid', 'true');
    const descriptionId = nameCell.getAttribute('aria-describedby');
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId!)).toHaveTextContent('名称已存在');
    expect(
      nameCell.querySelector('[data-slot="data-table-cell-server-error-marker"]')
    ).toHaveTextContent('!');
    expect(statusCell).not.toHaveAttribute('aria-invalid');
    expect(editing.getSnapshot().changes).toEqual([]);

    await user.dblClick(nameCell);
    const input = screen.getByRole('textbox', { name: '编辑名称' });
    expect(nameCell).toHaveAttribute('data-cell-server-invalid', 'true');
    expect(document.getElementById(descriptionId!)).toHaveTextContent('名称已存在');
    await user.clear(input);
    await user.type(input, '修正名称{Enter}');

    await waitFor(() => expect(nameCell).not.toHaveAttribute('data-cell-server-invalid'));
    expect(document.getElementById(descriptionId!)).toBeNull();
  });

  it('does not run table hotkeys for composing or already-consumed events', async () => {
    const user = userEvent.setup();
    const { container } = render(<EditableSelectionHarness onChange={vi.fn()} />);
    const firstCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-column-id="status"]'
    );
    if (!firstCell) throw new Error('editable cell missing');

    await user.click(firstCell);
    fireEvent.keyDown(firstCell, { key: 'Enter', isComposing: true });

    expect(firstCell).toHaveAttribute('data-cell-interaction-state', 'selected');
    expect(screen.queryByRole('option', { name: '就绪' })).not.toBeInTheDocument();

    const consumedEvent = new KeyboardEvent('keydown', {
      key: 'Enter',
      bubbles: true,
      cancelable: true
    });
    consumedEvent.preventDefault();
    fireEvent(firstCell, consumedEvent);

    expect(firstCell).toHaveAttribute('data-cell-interaction-state', 'selected');
    expect(screen.queryByRole('option', { name: '就绪' })).not.toBeInTheDocument();

    fireEvent.keyDown(firstCell, { key: 'Enter' });
    expect(firstCell).toHaveAttribute('data-cell-interaction-state', 'editing');
    expect(await screen.findByRole('option', { name: '就绪' })).toBeInTheDocument();
  });

  it.each([
    { label: 'ASCII', key: 'a', composingKey: undefined },
    { label: 'full-width', key: 'Ａ', composingKey: undefined },
    { label: 'Chinese IME completion', key: '中', composingKey: 'Process' }
  ])('starts a text draft from a $label printable key without committing', async (testCase) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<EditableSelectionHarness onChange={onChange} />);
    const nameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    if (!nameCell) throw new Error('editable name cell missing');

    await user.click(nameCell);
    if (testCase.composingKey) {
      fireEvent.keyDown(nameCell, { key: testCase.composingKey, isComposing: true });
      expect(nameCell).toHaveAttribute('data-cell-interaction-state', 'selected');
    }
    fireEvent.keyDown(nameCell, { key: testCase.key });

    const input = await screen.findByRole('textbox', { name: '编辑名称' });
    expect(input).toHaveValue(testCase.key);
    expect(nameCell).toHaveAttribute('data-cell-interaction-state', 'editing');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ignores modified printable shortcuts and printable keys on a multi-cell range', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<EditableSelectionHarness onChange={onChange} />);
    const firstNameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    const secondNameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="2"][data-cell-column-id="name"]'
    );
    if (!firstNameCell || !secondNameCell) throw new Error('editable name cells missing');

    await user.click(firstNameCell);
    fireEvent.keyDown(firstNameCell, { key: 'a', ctrlKey: true });
    fireEvent.keyDown(firstNameCell, { key: 'a', metaKey: true });
    fireEvent.keyDown(firstNameCell, { key: 'a', altKey: true });
    expect(screen.queryByRole('textbox', { name: '编辑名称' })).not.toBeInTheDocument();

    dragCellRange(firstNameCell, secondNameCell);
    fireEvent.keyDown(secondNameCell, { key: 'x' });
    expect(screen.queryByRole('textbox', { name: '编辑名称' })).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('validates the first printable numeric draft with its codec', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<KeyboardSelectionHarness onChange={onChange} />);
    const targetCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-column-id="amount"]'
    );
    if (!targetCell) throw new Error('editable amount cell missing');

    await user.click(targetCell);
    fireEvent.keyDown(targetCell, { key: '1' });

    const input = await screen.findByRole('textbox', { name: '编辑金额' });
    expect(input).toHaveValue('1');
    expect(input).toHaveAttribute('aria-invalid', 'false');
    expect(onChange).not.toHaveBeenCalled();
  });

  it.each([
    {
      columnId: 'effectiveDate',
      dialogName: '生效日期日历',
      editorLabel: '编辑生效日期',
      error: '日期格式必须为 YYYY-MM-DD。'
    },
    {
      columnId: 'startsAt',
      dialogName: '开始时间日期时间编辑器',
      editorLabel: '编辑开始时间',
      error: '日期时间格式必须为 YYYY-MM-DD HH:mm:ss。'
    }
  ])(
    'validates a printable $columnId draft without restoring the removed full-text input',
    async (testCase) => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const { container } = render(<KeyboardSelectionHarness onChange={onChange} />);
      const targetCell = container.querySelector<HTMLTableCellElement>(
        `td[data-cell-column-id="${testCase.columnId}"]`
      );
      if (!targetCell) throw new Error(`editable ${testCase.columnId} cell missing`);

      await user.click(targetCell);
      fireEvent.keyDown(targetCell, { key: '2' });

      expect(await screen.findByRole('dialog', { name: testCase.dialogName })).toBeInTheDocument();
      expect(screen.queryByRole('textbox', { name: testCase.editorLabel })).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent(testCase.error);
      expect(targetCell).toHaveAttribute('data-cell-interaction-state', 'editing');
      expect(onChange).not.toHaveBeenCalled();
    }
  );

  it('clears a selected range through one atomic delete event', async () => {
    const onChange = vi.fn();
    const { container } = render(<EditableSelectionHarness onChange={onChange} />);
    const firstNameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    const secondStatusCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="2"][data-cell-column-id="status"]'
    );
    if (!firstNameCell || !secondStatusCell) throw new Error('delete range cells missing');

    dragCellRange(firstNameCell, secondStatusCell);
    fireEvent.keyDown(secondStatusCell, { key: 'Delete' });

    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'delete',
        changes: [
          expect.objectContaining({ rowId: '1', field: 'name', value: '' }),
          expect.objectContaining({ rowId: '1', field: 'status', value: null }),
          expect.objectContaining({ rowId: '2', field: 'name', value: '' }),
          expect.objectContaining({ rowId: '2', field: 'status', value: null })
        ]
      })
    );
    expect(firstNameCell).not.toHaveTextContent('记录 1');
    expect(secondStatusCell).not.toHaveTextContent('就绪');
  });

  it('only offers the fill handle for fully editable ranges', async () => {
    const user = userEvent.setup();
    const { container } = render(<EditableSelectionHarness onChange={vi.fn()} />);
    const firstIdCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="id"]'
    );
    const firstNameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    if (!firstIdCell || !firstNameCell) throw new Error('fill visibility cells missing');

    await user.click(firstIdCell);
    expect(firstIdCell).toHaveAttribute('data-cell-selected', 'true');
    expect(screen.queryByRole('button', { name: '填充所选单元格' })).not.toBeInTheDocument();

    dragCellRange(firstIdCell, firstNameCell);
    expect(container.querySelectorAll('td[data-cell-selected="true"]')).toHaveLength(2);
    expect(screen.queryByRole('button', { name: '填充所选单元格' })).not.toBeInTheDocument();

    await user.click(firstNameCell);
    expect(screen.getByRole('button', { name: '填充所选单元格' })).toBeInTheDocument();
  });

  it('fills a range from the accessible handle through one atomic change event', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<EditableSelectionHarness onChange={onChange} />);
    const firstNameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    const secondNameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="2"][data-cell-column-id="name"]'
    );
    if (!firstNameCell || !secondNameCell) throw new Error('fill target cells missing');

    await user.click(firstNameCell);
    const handle = screen.getByRole('button', { name: '填充所选单元格' });
    dispatchCellPointerEvent(handle, 'pointerdown', { pointerId: 7 });
    dispatchCellPointerEvent(secondNameCell, 'pointermove', {
      pointerId: 7,
      clientX: 40,
      clientY: 80
    });
    expect(secondNameCell).toHaveAttribute('data-cell-fill-preview', 'true');
    dispatchCellPointerEvent(secondNameCell, 'pointerup', {
      pointerId: 7,
      clientX: 40,
      clientY: 80
    });

    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'fill',
        changes: [
          {
            rowId: '2',
            field: 'name',
            previousValue: '记录 2',
            value: '记录 1'
          }
        ]
      })
    );
    expect(secondNameCell).toHaveTextContent('记录 1');
    expect(container.querySelectorAll('td[data-cell-selected="true"]')).toHaveLength(2);
  });

  it('offers arrow-key fill as an accessible fallback', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<EditableSelectionHarness onChange={onChange} />);
    const firstNameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    if (!firstNameCell) throw new Error('fill source cell missing');

    await user.click(firstNameCell);
    const handle = screen.getByRole('button', { name: '填充所选单元格' });
    handle.focus();
    await user.keyboard('{ArrowDown}');

    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'fill',
        changes: [expect.objectContaining({ rowId: '2', field: 'name', value: '记录 1' })]
      })
    );
  });

  it('auto-scrolls its own viewport while dragging the fill handle', async () => {
    let frame: FrameRequestCallback | null = null;
    const cancelAnimationFrame = vi.fn();
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frame = callback;
      return 17;
    });
    window.cancelAnimationFrame = cancelAnimationFrame;

    const user = userEvent.setup();
    const { container } = render(<EditableSelectionHarness onChange={vi.fn()} />);
    const viewport = screen.getByTestId('scroll-viewport');
    Object.defineProperties(viewport, {
      clientWidth: { value: 200 },
      clientHeight: { value: 100 },
      scrollWidth: { value: 500 },
      scrollHeight: { value: 400 }
    });
    Object.defineProperty(viewport, 'scrollLeft', { value: 100, writable: true });
    Object.defineProperty(viewport, 'scrollTop', { value: 100, writable: true });
    viewport.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
    viewport.scrollBy = vi.fn();

    const firstNameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    const secondNameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="2"][data-cell-column-id="name"]'
    );
    if (!firstNameCell || !secondNameCell) throw new Error('fill auto-scroll cells missing');
    secondNameCell.getBoundingClientRect = () =>
      ({ left: 100, top: 50, right: 200, bottom: 100, width: 100, height: 40 }) as DOMRect;

    await user.click(firstNameCell);
    const handle = screen.getByRole('button', { name: '填充所选单元格' });
    dispatchCellPointerEvent(handle, 'pointerdown', { pointerId: 9 });
    dispatchCellPointerEvent(secondNameCell, 'pointermove', {
      pointerId: 9,
      clientX: 200,
      clientY: 100
    });

    expect(viewport).toHaveAttribute('data-cell-fill-dragging', 'true');
    expect(window.requestAnimationFrame).toHaveBeenCalledOnce();
    act(() => frame?.(0));
    expect(viewport.scrollBy).toHaveBeenCalledWith({ behavior: 'auto', left: 20, top: 20 });

    dispatchCellPointerEvent(secondNameCell, 'pointerup', {
      pointerId: 9,
      clientX: 200,
      clientY: 100
    });
    expect(viewport).not.toHaveAttribute('data-cell-fill-dragging');
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('clears one cell with Backspace and keeps focus on the selected cell', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<EditableSelectionHarness onChange={onChange} />);
    const nameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    if (!nameCell) throw new Error('backspace target cell missing');

    await user.click(nameCell);
    fireEvent.keyDown(nameCell, { key: 'Backspace' });

    await waitFor(() => expect(onChange).toHaveBeenCalledOnce());
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'delete',
        changes: [expect.objectContaining({ rowId: '1', field: 'name', value: '' })]
      })
    );
    expect(nameCell).toHaveFocus();
    expect(nameCell).toHaveAttribute('data-cell-selected', 'true');
  });

  it('keeps an atomic delete at zero writes for required or readonly cells', async () => {
    const user = userEvent.setup();
    const requiredChange = vi.fn();
    const required = render(<KeyboardSelectionHarness onChange={requiredChange} />);
    const requiredName = required.container.querySelector<HTMLTableCellElement>(
      'td[data-cell-column-id="requiredName"]'
    );
    const amount = required.container.querySelector<HTMLTableCellElement>(
      'td[data-cell-column-id="amount"]'
    );
    if (!requiredName || !amount) throw new Error('required delete cells missing');

    dragCellRange(requiredName, amount);
    fireEvent.keyDown(amount, { key: 'Delete' });
    await act(async () => undefined);
    expect(requiredName).toHaveTextContent('原名称');
    expect(amount).toHaveTextContent('12.5');
    expect(requiredChange).not.toHaveBeenCalled();
    required.unmount();

    const readonlyChange = vi.fn();
    const readonly = render(
      <EditableSelectionHarness
        onChange={readonlyChange}
        isCellEditable={({ columnId }) => columnId !== 'status'}
      />
    );
    const firstName = readonly.container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    const firstStatus = readonly.container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="status"]'
    );
    if (!firstName || !firstStatus) throw new Error('readonly delete cells missing');

    await user.click(firstName);
    dragCellRange(firstName, firstStatus);
    fireEvent.keyDown(firstStatus, { key: 'Delete' });
    await act(async () => undefined);
    expect(firstName).toHaveTextContent('记录 1');
    expect(firstStatus).toHaveTextContent('草稿');
    expect(readonlyChange).not.toHaveBeenCalled();
  });

  it('keeps selected, edit-ready, and editing states exclusive across cells', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<EditableSelectionHarness onChange={onChange} />);
    const cells = container.querySelectorAll<HTMLTableCellElement>(
      'td[data-cell-column-id="status"]'
    );
    const firstCell = cells[0];
    const secondCell = cells[1];
    if (!firstCell || !secondCell) throw new Error('editable cells missing');

    await user.click(firstCell);
    expect(firstCell).toHaveAttribute('data-cell-selected', 'true');
    expect(firstCell).toHaveAttribute('data-cell-interaction-state', 'selected');
    expect(firstCell).not.toHaveAttribute('data-cell-edit-ready');
    expect(firstCell).not.toHaveAttribute('data-cell-editing');
    expect(screen.queryByRole('option', { name: '就绪' })).not.toBeInTheDocument();

    fireEvent.keyDown(firstCell, { key: 'Enter' });
    expect(firstCell).toHaveAttribute('data-cell-interaction-state', 'editing');
    expect(firstCell).toHaveAttribute('data-cell-editing', 'true');
    expect(await screen.findByRole('option', { name: '就绪' })).toBeInTheDocument();
    await user.keyboard('{Escape}');
    expect(firstCell).toHaveAttribute('data-cell-interaction-state', 'edit-ready');
    expect(firstCell).toHaveAttribute('data-cell-edit-ready', 'true');
    expect(firstCell).not.toHaveAttribute('data-cell-editing');
    expect(
      firstCell.querySelector('[data-slot="data-table-choice-editor-ready-trigger"]')
    ).toHaveAttribute('aria-expanded', 'false');
    expect(onChange).not.toHaveBeenCalled();

    await user.click(secondCell);
    expect(firstCell).not.toHaveAttribute('data-cell-interaction-state');
    expect(firstCell).not.toHaveAttribute('data-cell-edit-ready');
    expect(secondCell).toHaveAttribute('data-cell-interaction-state', 'selected');
    expect(
      container.querySelectorAll(
        'td[data-cell-interaction-state="selected"], td[data-cell-interaction-state="edit-ready"], td[data-cell-interaction-state="editing"]'
      )
    ).toHaveLength(1);

    await user.dblClick(secondCell);
    expect(secondCell).toHaveAttribute('data-cell-interaction-state', 'editing');
    expect(await screen.findByRole('option', { name: '草稿' })).toBeInTheDocument();
  });

  it('selects the rectangular cells between pointer anchor and focus in either direction', () => {
    const { container } = render(<Harness rows={makeRows(2)} />);
    const firstIdCell = getBodyCell(container, 0, '1');
    const secondNameCell = getBodyCell(container, 1, 'Item 2');

    dragCellRange(firstIdCell, secondNameCell);

    expect(container.querySelectorAll('tbody td[data-cell-selected="true"]')).toHaveLength(4);
    expect(firstIdCell).toHaveAttribute('data-cell-range-anchor', 'true');
    expect(secondNameCell).toHaveAttribute('data-cell-range-focus', 'true');

    dragCellRange(secondNameCell, firstIdCell);

    expect(container.querySelectorAll('tbody td[data-cell-selected="true"]')).toHaveLength(4);
    expect(secondNameCell).toHaveAttribute('data-cell-range-anchor', 'true');
    expect(firstIdCell).toHaveAttribute('data-cell-range-focus', 'true');
  });

  it('extends the current anchor with Shift plus pointer down', () => {
    const { container } = render(<Harness rows={makeRows(2)} />);
    const firstNameCell = getBodyCell(container, 0, 'Item 1');
    const secondIdCell = getBodyCell(container, 1, '2');

    dispatchCellPointerEvent(firstNameCell, 'pointerdown', { pointerId: 1 });
    dispatchCellPointerEvent(firstNameCell, 'pointerup', { pointerId: 1 });
    dispatchCellPointerEvent(secondIdCell, 'pointerdown', { pointerId: 2, shiftKey: true });
    dispatchCellPointerEvent(secondIdCell, 'pointerup', { pointerId: 2 });

    expect(container.querySelectorAll('tbody td[data-cell-selected="true"]')).toHaveLength(4);
    expect(firstNameCell).toHaveAttribute('data-cell-range-anchor', 'true');
    expect(secondIdCell).toHaveAttribute('data-cell-range-focus', 'true');
  });

  it('moves with arrows, extends with Shift arrows, and clears with Escape', () => {
    const { container } = render(<Harness rows={makeRows(2)} />);
    const firstIdCell = getBodyCell(container, 0, '1');
    const firstNameCell = getBodyCell(container, 0, 'Item 1');
    const secondNameCell = getBodyCell(container, 1, 'Item 2');

    dispatchCellPointerEvent(firstIdCell, 'pointerdown', { pointerId: 1 });
    dispatchCellPointerEvent(firstIdCell, 'pointerup', { pointerId: 1 });
    fireEvent.keyDown(firstIdCell, { key: 'ArrowRight' });

    expect(firstNameCell).toHaveAttribute('data-cell-selected', 'true');
    expect(firstNameCell).toHaveFocus();
    expect(firstIdCell).not.toHaveAttribute('data-cell-selected');

    fireEvent.keyDown(firstNameCell, { key: 'ArrowDown', shiftKey: true });

    expect(firstNameCell).toHaveAttribute('data-cell-selected', 'true');
    expect(secondNameCell).toHaveAttribute('data-cell-selected', 'true');
    expect(secondNameCell).toHaveFocus();

    fireEvent.keyDown(secondNameCell, { key: 'Escape' });
    expect(container.querySelectorAll('tbody td[data-cell-selected="true"]')).toHaveLength(0);
  });

  it('preserves a pointer range when its focus cell receives focus before Shift arrow', () => {
    const { container } = render(<Harness rows={makeRows(3)} />);
    const firstIdCell = getBodyCell(container, 0, '1');
    const secondNameCell = getBodyCell(container, 1, 'Item 2');

    dragCellRange(firstIdCell, secondNameCell);
    secondNameCell.focus();
    fireEvent.keyDown(secondNameCell, { key: 'ArrowDown', shiftKey: true });

    expect(container.querySelectorAll('tbody td[data-cell-selected="true"]')).toHaveLength(6);
    expect(firstIdCell).toHaveAttribute('data-cell-range-anchor', 'true');
    expect(getBodyCell(container, 2, 'Item 3')).toHaveAttribute('data-cell-range-focus', 'true');
  });

  it('copies a selected rectangle as row-major TSV', () => {
    const { container } = render(<Harness rows={makeRows(2)} />);
    const firstIdCell = getBodyCell(container, 0, '1');
    const secondNameCell = getBodyCell(container, 1, 'Item 2');

    dragCellRange(firstIdCell, secondNameCell);
    document.getSelection()?.removeAllRanges();

    const { clipboardData, event } = createCopyEvent();
    document.dispatchEvent(event);

    expect(clipboardData.setData).toHaveBeenCalledWith('text/plain', '1\tItem 1\n2\tItem 2');
    expect(event.defaultPrevented).toBe(true);
  });

  it('pastes one raw value through the selected cell bound codec', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<EditableSelectionHarness onChange={onChange} />);
    const nameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    if (!nameCell) throw new Error('editable name cell missing');

    await user.click(nameCell);
    const { clipboardData, event } = createPasteEvent('123.45');
    document.dispatchEvent(event);

    expect(clipboardData.getData).toHaveBeenCalledWith('text/plain');
    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => expect(nameCell).toHaveTextContent('123.45'));
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'paste',
        changes: [
          {
            rowId: '1',
            field: 'name',
            previousValue: '记录 1',
            value: '123.45'
          }
        ]
      })
    );
  });

  it('pastes and copies percent cells through percentage-point text without adornments', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<EditableNumericSelectionHarness onChange={onChange} />);
    const rateCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="rate"]'
    );
    if (!rateCell) throw new Error('editable percent cell missing');

    await user.click(rateCell);
    const paste = createPasteEvent('１２．５％');
    document.dispatchEvent(paste.event);

    expect(paste.event.defaultPrevented).toBe(true);
    await waitFor(() => expect(rateCell).toHaveTextContent('12.50%'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'paste',
        changes: [expect.objectContaining({ field: 'rate', value: 0.125 })]
      })
    );

    document.getSelection()?.removeAllRanges();
    const copy = createCopyEvent();
    document.dispatchEvent(copy.event);
    expect(copy.clipboardData.setData).toHaveBeenCalledWith('text/plain', '12.5');
  });

  it('keeps a readonly target unchanged and applies a valid matrix atomically', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const { container } = render(<EditableSelectionHarness onChange={onChange} />);
    const idCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="id"]'
    );
    const firstNameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    const secondStatusCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="2"][data-cell-column-id="status"]'
    );
    if (!idCell || !firstNameCell || !secondStatusCell) {
      throw new Error('paste target cells missing');
    }

    await user.click(idCell);
    const readonlyPaste = createPasteEvent('99');
    document.dispatchEvent(readonlyPaste.event);

    expect(readonlyPaste.event.defaultPrevented).toBe(true);
    expect(idCell).toHaveTextContent('1');
    expect(onChange).not.toHaveBeenCalled();

    dragCellRange(firstNameCell, secondStatusCell);
    const matrixPaste = createPasteEvent('新名称\tREADY\n另一名称\tDRAFT');
    document.dispatchEvent(matrixPaste.event);

    expect(matrixPaste.event.defaultPrevented).toBe(true);
    await waitFor(() => expect(firstNameCell).toHaveTextContent('新名称'));
    expect(secondStatusCell).toHaveTextContent('草稿');
    expect(onChange).toHaveBeenCalledOnce();
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'paste',
        changes: [
          {
            rowId: '1',
            field: 'name',
            previousValue: '记录 1',
            value: '新名称'
          },
          {
            rowId: '1',
            field: 'status',
            previousValue: 'DRAFT',
            value: 'READY'
          },
          {
            rowId: '2',
            field: 'name',
            previousValue: '记录 2',
            value: '另一名称'
          },
          {
            rowId: '2',
            field: 'status',
            previousValue: 'READY',
            value: 'DRAFT'
          }
        ]
      })
    );
  });

  it('keeps every target unchanged when one matrix value is invalid', async () => {
    const onChange = vi.fn();
    const { container } = render(<EditableSelectionHarness onChange={onChange} />);
    const firstNameCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="1"][data-cell-column-id="name"]'
    );
    const secondStatusCell = container.querySelector<HTMLTableCellElement>(
      'td[data-cell-row-id="2"][data-cell-column-id="status"]'
    );
    if (!firstNameCell || !secondStatusCell) {
      throw new Error('matrix paste target cells missing');
    }

    dragCellRange(firstNameCell, secondStatusCell);
    const matrixPaste = createPasteEvent('新名称\tREADY\t越界值\n另一名称\tDRAFT\t另一个越界值');
    document.dispatchEvent(matrixPaste.event);

    expect(matrixPaste.event.defaultPrevented).toBe(true);
    await act(async () => undefined);
    expect(firstNameCell).toHaveTextContent('记录 1');
    expect(secondStatusCell).toHaveTextContent('就绪');
    expect(onChange).not.toHaveBeenCalled();
  });

  it('auto-scrolls its own viewport while dragging in the bottom-right edge zone', () => {
    let frame: FrameRequestCallback | null = null;
    const cancelAnimationFrame = vi.fn();
    window.requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frame = callback;
      return 11;
    });
    window.cancelAnimationFrame = cancelAnimationFrame;

    const { container } = render(<Harness rows={makeRows(2)} />);
    const viewport = screen.getByTestId('scroll-viewport');
    Object.defineProperties(viewport, {
      clientWidth: { value: 200 },
      clientHeight: { value: 100 },
      scrollWidth: { value: 500 },
      scrollHeight: { value: 400 }
    });
    Object.defineProperty(viewport, 'scrollLeft', { value: 100, writable: true });
    Object.defineProperty(viewport, 'scrollTop', { value: 100, writable: true });
    viewport.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
    viewport.scrollBy = vi.fn();

    const firstIdCell = getBodyCell(container, 0, '1');
    const secondNameCell = getBodyCell(container, 1, 'Item 2');
    secondNameCell.getBoundingClientRect = () =>
      ({ left: 100, top: 50, right: 200, bottom: 100, width: 100, height: 40 }) as DOMRect;

    dispatchCellPointerEvent(firstIdCell, 'pointerdown', { pointerId: 1 });
    dispatchCellPointerEvent(secondNameCell, 'pointermove', {
      pointerId: 1,
      clientX: 200,
      clientY: 100
    });

    expect(window.requestAnimationFrame).toHaveBeenCalledOnce();
    act(() => frame?.(0));
    expect(viewport.scrollBy).toHaveBeenCalledWith({ behavior: 'auto', left: 20, top: 20 });

    dispatchCellPointerEvent(secondNameCell, 'pointerup', { pointerId: 1 });
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('marks only the active pointer sequence as text-selection suppressed', () => {
    const { container } = render(<Harness rows={makeRows(2)} />);
    const viewport = screen.getByTestId('scroll-viewport');
    const firstIdCell = getBodyCell(container, 0, '1');

    expect(viewport).not.toHaveAttribute('data-cell-range-dragging');
    dispatchCellPointerEvent(firstIdCell, 'pointerdown', { pointerId: 1 });
    expect(viewport).toHaveAttribute('data-cell-range-dragging', 'true');
    dispatchCellPointerEvent(firstIdCell, 'pointerup', { pointerId: 1 });
    expect(viewport).not.toHaveAttribute('data-cell-range-dragging');
  });

  it('marks the clicked data cell as active without treating checkbox controls as cells', async () => {
    const user = userEvent.setup();
    const { container } = render(<SelectableHarness rows={makeRows(2)} />);
    const dataCells = container.querySelectorAll('tbody td[data-cell-id]');
    const firstNameCell = Array.from(dataCells).find((cell) => cell.textContent === 'Item 1');

    if (!(firstNameCell instanceof HTMLElement)) {
      throw new Error('first name cell missing');
    }

    await user.click(firstNameCell);

    expect(firstNameCell).toHaveAttribute('data-cell-selected', 'true');
    expect(firstNameCell).toHaveAttribute(
      'data-cell-range-edge',
      'block-start inline-end block-end inline-start'
    );

    const firstRowCheckbox = screen.getAllByRole('checkbox', { name: '选择行' })[0];
    await user.click(firstRowCheckbox);

    expect(firstNameCell).toHaveAttribute('data-cell-selected', 'true');
    expect(
      Array.from(dataCells).filter((cell) => cell.getAttribute('data-cell-selected') === 'true')
    ).toHaveLength(1);
  });

  it('copies the active cell text on copy events', async () => {
    const user = userEvent.setup();
    render(<Harness rows={makeRows(2)} />);
    const firstNameCell = screen.getByText('Item 1').closest('td');

    if (!(firstNameCell instanceof HTMLElement)) {
      throw new Error('first name cell missing');
    }

    await user.click(firstNameCell);
    await waitFor(() => {
      expect(firstNameCell).toHaveAttribute('data-cell-selected', 'true');
    });
    document.getSelection()?.removeAllRanges();

    const { clipboardData, event } = createCopyEvent();
    document.dispatchEvent(event);

    expect(clipboardData.setData).toHaveBeenCalledWith('text/plain', 'Item 1');
    expect(event.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(firstNameCell).toHaveAttribute('data-cell-copy-flash', 'true');
    });
    const firstCopyFlashRun = firstNameCell.getAttribute('data-cell-copy-flash-run');
    expect(firstCopyFlashRun).toMatch(/^(a|b)$/);

    const { clipboardData: secondClipboardData, event: secondEvent } = createCopyEvent();
    document.dispatchEvent(secondEvent);

    expect(secondClipboardData.setData).toHaveBeenCalledWith('text/plain', 'Item 1');
    expect(secondEvent.defaultPrevented).toBe(true);
    await waitFor(() => {
      expect(firstNameCell).toHaveAttribute(
        'data-cell-copy-flash-run',
        firstCopyFlashRun === 'a' ? 'b' : 'a'
      );
    });
  });

  it('copies active cell text with normalized line breaks', async () => {
    const user = userEvent.setup();
    render(<Harness rows={makeRows(2)} />);
    const firstNameCell = screen.getByText('Item 1').closest('td');

    if (!(firstNameCell instanceof HTMLElement)) {
      throw new Error('first name cell missing');
    }

    Object.defineProperty(firstNameCell, 'innerText', {
      configurable: true,
      value: 'Line 1\r\nLine 2'
    });

    await user.click(firstNameCell);
    await waitFor(() => {
      expect(firstNameCell).toHaveAttribute('data-cell-selected', 'true');
    });
    document.getSelection()?.removeAllRanges();

    const { clipboardData, event } = createCopyEvent();
    document.dispatchEvent(event);

    expect(clipboardData.setData).toHaveBeenCalledWith('text/plain', '"Line 1\nLine 2"');
    expect(event.defaultPrevented).toBe(true);
  });

  it('copies money type cells without thousands separators', async () => {
    const user = userEvent.setup();
    render(<MoneyCopyHarness rows={[{ id: 1, amount: 1234.5 }]} />);
    const amountCell = screen.getByText('1,234.50').closest('td');

    if (!(amountCell instanceof HTMLElement)) {
      throw new Error('amount cell missing');
    }

    await user.click(amountCell);
    await waitFor(() => {
      expect(amountCell).toHaveAttribute('data-cell-selected', 'true');
    });
    document.getSelection()?.removeAllRanges();

    const { clipboardData, event } = createCopyEvent();
    document.dispatchEvent(event);

    expect(clipboardData.setData).toHaveBeenCalledWith('text/plain', '1234.5');
    expect(event.defaultPrevented).toBe(true);
  });

  it('does not override copy from editable controls', async () => {
    const user = userEvent.setup();
    render(<Harness rows={makeRows(2)} />);
    const firstNameCell = screen.getByText('Item 1').closest('td');

    if (!(firstNameCell instanceof HTMLElement)) {
      throw new Error('first name cell missing');
    }

    await user.click(firstNameCell);

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const { clipboardData, event } = createCopyEvent();
    input.dispatchEvent(event);

    expect(clipboardData.setData).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);
    input.remove();
  });

  it('does not override copy when the user has a text selection', async () => {
    const user = userEvent.setup();
    render(<Harness rows={makeRows(2)} />);
    const firstNameCell = screen.getByText('Item 1').closest('td');

    if (!(firstNameCell instanceof HTMLElement)) {
      throw new Error('first name cell missing');
    }

    await user.click(firstNameCell);

    const selectedText = document.createElement('span');
    selectedText.textContent = 'manual selection';
    document.body.appendChild(selectedText);

    const range = document.createRange();
    range.selectNodeContents(selectedText);
    document.getSelection()?.removeAllRanges();
    document.getSelection()?.addRange(range);

    const { clipboardData, event } = createCopyEvent();
    document.dispatchEvent(event);

    expect(clipboardData.setData).not.toHaveBeenCalled();
    expect(event.defaultPrevented).toBe(false);

    document.getSelection()?.removeAllRanges();
    selectedText.remove();
  });

  it('does not mark row-number or actions cells as active', async () => {
    const user = userEvent.setup();
    const { container } = render(<SpecialColumnsSelectionHarness rows={makeRows(2)} />);
    const firstRowCells = container.querySelectorAll<HTMLTableCellElement>(
      'tbody tr:first-child td[data-cell-id]'
    );
    const rowNumberCell = firstRowCells[0];
    const actionCell = firstRowCells[firstRowCells.length - 1];
    const nameCell = Array.from(firstRowCells).find((cell) => cell.textContent === 'Item 1');

    if (!rowNumberCell || !actionCell || !(nameCell instanceof HTMLElement)) {
      throw new Error('special columns selection fixture is incomplete');
    }

    await user.click(nameCell);
    expect(nameCell).toHaveAttribute('data-cell-selected', 'true');

    await user.click(rowNumberCell);
    expect(rowNumberCell).not.toHaveAttribute('data-cell-selected', 'true');
    expect(
      Array.from(container.querySelectorAll('tbody td[data-cell-id]')).filter(
        (cell) => cell.getAttribute('data-cell-selected') === 'true'
      )
    ).toHaveLength(0);

    await user.click(nameCell);
    expect(nameCell).toHaveAttribute('data-cell-selected', 'true');

    await user.click(actionCell);
    expect(actionCell).not.toHaveAttribute('data-cell-selected', 'true');
    expect(
      Array.from(container.querySelectorAll('tbody td[data-cell-id]')).filter(
        (cell) => cell.getAttribute('data-cell-selected') === 'true'
      )
    ).toHaveLength(0);
  });

  it('does not mark pinned cells as active', async () => {
    const user = userEvent.setup();
    const { container } = render(<WideHarness rows={makeWideRows(1, 2)} virtualization={false} />);
    const pinnedLeftCell = screen.getByText('L1').closest('td');
    const pinnedRightCell = screen.getByText('R1').closest('td');
    const centerCell = screen.getByText('R1C0').closest('td');

    if (
      !(pinnedLeftCell instanceof HTMLElement) ||
      !(pinnedRightCell instanceof HTMLElement) ||
      !(centerCell instanceof HTMLElement)
    ) {
      throw new Error('pinned cells selection fixture is incomplete');
    }

    await user.click(centerCell);
    expect(centerCell).toHaveAttribute('data-cell-selected', 'true');

    await user.click(pinnedLeftCell);
    expect(pinnedLeftCell).not.toHaveAttribute('data-cell-selected', 'true');
    expect(
      Array.from(container.querySelectorAll('tbody td[data-cell-id]')).filter(
        (cell) => cell.getAttribute('data-cell-selected') === 'true'
      )
    ).toHaveLength(0);

    await user.click(centerCell);
    expect(centerCell).toHaveAttribute('data-cell-selected', 'true');

    await user.click(pinnedRightCell);
    expect(pinnedRightCell).not.toHaveAttribute('data-cell-selected', 'true');
    expect(
      Array.from(container.querySelectorAll('tbody td[data-cell-id]')).filter(
        (cell) => cell.getAttribute('data-cell-selected') === 'true'
      )
    ).toHaveLength(0);
  });
});

describe('DataTable zebra striping', () => {
  it('marks alternating rows from their logical row index when zebra striping is enabled', () => {
    const { container } = render(<Harness rows={makeRows(4)} enableZebraStriping />);
    const rows = container.querySelectorAll<HTMLTableRowElement>('tbody tr[data-row-index]');

    expect(rows).toHaveLength(4);
    expect(rows[0]).not.toHaveAttribute('data-striped');
    expect(rows[1]).toHaveAttribute('data-striped', 'true');
    expect(rows[2]).not.toHaveAttribute('data-striped');
    expect(rows[3]).toHaveAttribute('data-striped', 'true');
  });

  it('does not mark alternating rows when zebra striping is disabled', () => {
    const { container } = render(<Harness rows={makeRows(4)} />);

    expect(container.querySelector('tbody tr[data-striped="true"]')).toBeNull();
  });

  it('keeps zebra parity tied to logical indexes in virtual mode', () => {
    const rows = makeRows(150);
    const { container } = render(<Harness rows={rows} enableZebraStriping />);
    const virtualRows = container.querySelectorAll<HTMLTableRowElement>(
      'tbody[data-virtual-enabled="true"] tr[data-row-index]'
    );

    expect(virtualRows.length).toBeGreaterThan(1);
    virtualRows.forEach((row) => {
      const rowIndex = Number(row.dataset.rowIndex);
      expect(row.hasAttribute('data-striped')).toBe(rowIndex % 2 === 1);
    });
  });
});

describe('DataTable body', () => {
  it('renders all rows in normal mode', () => {
    const rows = makeRows(10);
    render(<Harness rows={rows} />);
    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 10')).toBeInTheDocument();
  });

  it('renders data cells with explicit padding and transparent outline baseline', () => {
    const { container } = render(<Harness rows={makeRows(1)} />);
    const firstCell = container.querySelector('tbody td[data-cell-id]');

    expect(firstCell?.getAttribute('class')).toContain('px-[15px]');
    expect(firstCell?.getAttribute('class')).toContain('py-2');
    expect(firstCell?.getAttribute('class')).toContain('outline');
    expect(firstCell?.getAttribute('class')).toContain('outline-transparent');
    expect(firstCell?.getAttribute('class')).toContain('transition-[outline-color,box-shadow]');
    expect(firstCell?.getAttribute('class')).not.toContain('transition-[background-color');
  });

  it('renders empty message when no rows', () => {
    render(<Harness rows={[]} />);
    expect(screen.getByText('暂无数据')).toBeInTheDocument();
  });

  it('keeps a stable empty body while loading status is controlled externally', () => {
    const getStatusConfig = vi.fn(({ isLoading }) => {
      if (isLoading) return undefined;
      return { type: 'empty' as const, title: '无匹配数据' };
    });

    function LoadingHarness() {
      const table = useHarnessTable([], 10);
      return (
        <DataTable
          table={table}
          emptyMessage='加载中'
          isLoading
          getStatusConfig={getStatusConfig}
        />
      );
    }

    render(<LoadingHarness />);

    expect(getStatusConfig).toHaveBeenCalledWith(
      expect.objectContaining({ rows: expect.objectContaining({ length: 0 }), isLoading: true })
    );
    expect(screen.getByText('加载中')).toBeInTheDocument();
    expect(document.querySelector('tbody tr td')).not.toBeNull();
  });

  it('renders a loading skeleton when configured and the table has no rows', () => {
    const { container } = render(<LoadingSkeletonHarness />);

    expect(container.querySelector('[data-slot="data-table-skeleton"]')).not.toBeNull();
    expect(container.querySelectorAll('[data-slot="data-table-skeleton-filter"]')).toHaveLength(2);
    expect(container.querySelector('[data-slot="data-table-skeleton-view-options"]')).toBeNull();
    expect(screen.queryByText('暂无数据')).not.toBeInTheDocument();
  });

  it('keeps existing rows visible while loading when rows are already present', () => {
    const { container } = render(<LoadingSkeletonHarness rows={makeRows(1)} />);

    expect(container.querySelector('[data-slot="data-table-skeleton"]')).toBeNull();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });

  it('renders empty and error statuses without falling through to the plain empty body', () => {
    function StatusHarness({ type }: { type: 'empty' | 'error' }) {
      const table = useHarnessTable([], 10);
      return (
        <DataTable
          table={table}
          emptyMessage='普通空态'
          getStatusConfig={() => ({
            type,
            title: type === 'empty' ? '筛选无结果' : '接口异常',
            description: ''
          })}
        />
      );
    }

    const { rerender } = render(<StatusHarness type='empty' />);

    expect(screen.getByText('筛选无结果')).toBeInTheDocument();
    expect(screen.queryByText('普通空态')).not.toBeInTheDocument();
    expect(document.querySelector('tbody[data-component="data-table-body"] tr td')).not.toBeNull();

    rerender(<StatusHarness type='error' />);

    expect(screen.getByText('接口异常')).toBeInTheDocument();
    expect(screen.queryByText('普通空态')).not.toBeInTheDocument();
    expect(document.querySelector('tbody[data-component="data-table-body"] tr td')).not.toBeNull();
  });

  it('updates status when table filters change without explicit dependency props', async () => {
    const user = userEvent.setup();

    function FilterStatusHarness() {
      const table = useHarnessTable([], 10);

      return (
        <>
          <button type='button' onClick={() => table.getColumn('name')?.setFilterValue('alice')}>
            Filter name
          </button>
          <DataTable
            table={table}
            getStatusConfig={({ rows, hasFilters }) => {
              if (rows.length > 0) return undefined;

              return hasFilters
                ? { type: 'empty', title: '筛选无结果', description: '' }
                : { type: 'onboarding', title: '暂无数据', description: '' };
            }}
          />
        </>
      );
    }

    render(<FilterStatusHarness />);

    expect(screen.getByText('暂无数据')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Filter name' }));

    expect(screen.getByText('筛选无结果')).toBeInTheDocument();
    expect(screen.queryByText('暂无数据')).not.toBeInTheDocument();
  });

  it('exposes aria-sort on sortable table header cells', () => {
    const { container, rerender } = render(<SortableHeaderHarness sorting={[]} />);

    const getNameHeader = () => container.querySelector('th[data-column-id="name"]');

    expect(getNameHeader()).toHaveAttribute('aria-sort', 'none');

    rerender(<SortableHeaderHarness sorting={[{ id: 'name', desc: false }]} />);
    expect(getNameHeader()).toHaveAttribute('aria-sort', 'ascending');

    rerender(<SortableHeaderHarness sorting={[{ id: 'name', desc: true }]} />);
    expect(getNameHeader()).toHaveAttribute('aria-sort', 'descending');
  });

  it('keeps sortable table header background stable on hover', () => {
    render(<SortableHeaderHarness sorting={[]} />);

    const trigger = screen.getByText(OVERFLOW_COMPONENT_HEADER_LABEL).closest('button');

    expect(trigger).not.toHaveClass('hover:bg-accent');
    expect(trigger).toHaveClass('data-[state=open]:bg-accent');
    expect(trigger).toHaveClass('hover:[&_svg]:text-foreground');
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
    expect(container.querySelector('thead')).toHaveAttribute('data-component', 'data-table-header');

    headerCells.forEach((cell) => {
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
            kind: 'selection',
            label: '导出选中',
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
      const table = useHarnessTable(makeRows(5), 5, 42);
      return <DataTable table={table} />;
    }

    render(<HarnessWithServerTotal />);

    expect(screen.getByText('共 42 条数据')).toBeInTheDocument();
  });

  it('passes the table row count to status configuration', () => {
    const getStatusConfig = vi.fn(() => undefined);

    function HarnessWithServerTotal() {
      const table = useHarnessTable(makeRows(5), 5, 42);
      return <DataTable table={table} getStatusConfig={getStatusConfig} />;
    }

    render(<HarnessWithServerTotal />);

    expect(getStatusConfig).toHaveBeenCalledWith(expect.objectContaining({ totalCount: 42 }));
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

  it('uses a theme-visible unchecked border for select-column checkboxes', () => {
    render(<SelectableHarness rows={makeRows(2)} />);

    const firstRowCheckbox = screen.getAllByRole('checkbox', { name: '选择行' })[0];
    const visualBox = firstRowCheckbox?.firstElementChild;

    if (!(visualBox instanceof HTMLElement)) {
      throw new Error('first row select visual box missing');
    }

    expect(visualBox).toHaveClass('border-border');
    expect(visualBox).toHaveClass('border-2');
    expect(visualBox).toHaveClass('bg-background');
    expect(visualBox).not.toHaveClass('border-input');
  });

  it('exposes selected row and checkbox selection semantics separately', async () => {
    const user = userEvent.setup();
    const { container } = render(<SelectableHarness rows={makeRows(2)} />);

    const firstBodyRow = container.querySelector('tbody tr');
    const firstRowCheckbox = screen.getAllByRole('checkbox', { name: '选择行' })[0];

    expect(firstBodyRow).not.toHaveAttribute('aria-selected');
    expect(firstRowCheckbox).toHaveAttribute('aria-checked', 'false');

    await user.click(firstRowCheckbox);

    expect(firstBodyRow).toHaveAttribute('aria-selected', 'true');
    expect(firstRowCheckbox).toHaveAttribute('aria-checked', 'true');
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

  it('preserves table scroll position when opening the expand panel', async () => {
    const user = userEvent.setup();
    render(<ExpandHarness rows={makeRows(50)} />);

    const viewport = screen.getByTestId('scroll-viewport');
    viewport.scrollTop = 360;
    viewport.scrollLeft = 24;

    await user.click(screen.getByText('Item 2'));

    await waitFor(() => {
      expect(screen.getByTestId('expanded-row-key').textContent).toBe('2');
    });
    expect(screen.getByTestId('scroll-viewport')).toHaveProperty('scrollTop', 360);
    expect(screen.getByTestId('scroll-viewport')).toHaveProperty('scrollLeft', 24);
  });

  it('expands focused rows with Enter and Space', async () => {
    const user = userEvent.setup();
    const { container } = render(<ExpandHarness rows={makeRows(5)} />);

    const rows = container.querySelectorAll<HTMLTableRowElement>('tbody tr[data-row-index]');
    expect(rows[0]).toHaveAttribute('tabindex', '0');

    rows[0]?.focus();
    await user.keyboard('{Enter}');
    expect(screen.getByTestId('expanded-row-key').textContent).toBe('1');

    const updatedRows = container.querySelectorAll<HTMLTableRowElement>('tbody tr[data-row-index]');
    updatedRows[1]?.focus();
    await user.keyboard(' ');
    expect(screen.getByTestId('expanded-row-key').textContent).toBe('2');
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

  it('does not expand when pressing keys on a row action button', async () => {
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

    const actionButton = screen.getAllByRole('button', { name: '编辑' })[0];

    actionButton.focus();
    await user.keyboard('{Enter}');

    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('expanded-row-key').textContent).toBe('null');

    await user.keyboard(' ');

    expect(onEdit).toHaveBeenCalledTimes(2);
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
    const expandPanel = document.querySelector('[data-slot="data-table-expand-panel"]');
    const expandContent = document.querySelector('[data-slot="data-table-expand-panel-content"]');
    expect(expandPanel).toHaveClass('min-h-0', 'min-w-0');
    expect(expandContent).toHaveClass('flex', 'min-h-0', 'min-w-0', 'flex-1', 'overflow-hidden');
    expect(expandContent?.querySelector('[data-slot="tabs-content"]')).toHaveClass(
      'min-h-0',
      'flex-1',
      'overflow-hidden'
    );

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
