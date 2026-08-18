import { vi, beforeEach, afterEach } from 'vitest';
import { cleanup, fireEvent } from '@testing-library/react';
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
import { DataTableColumnHeader } from '@/components/data-table/columns/header/data-table-column-header';
import { DataTableHeaderDragOverlay } from '@/components/data-table/core/data-table-header';
import { useDataTable } from '@/hooks/use-data-table';
import type { DataTableAction, DataTableRowAction } from '@/components/data-table/actions/types';
import type { DataTableEditingController } from '@/components/data-table/editing/types';
import type { DataTableVirtualizationOptions } from '@/components/data-table/virtualization/types';
import * as React from 'react';

import { env } from '@/config';

const virtualizerMocksHoisted = vi.hoisted(() => ({
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

// Hoisted bindings cannot be exported directly; expose a plain alias instead.
export const virtualizerMocks = virtualizerMocksHoisted;

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
    virtualizerMocksHoisted.calls.push({ count, enabled, horizontal, overscan });
    const measure = vi.fn();
    virtualizerMocksHoisted.instances.push({ horizontal, measure });
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

export type TestRow = { id: number; name: string };
export type MoneyRow = { id: number; amount: number };
export type EditableRow = {
  id: number;
  name: string;
  status: 'DRAFT' | 'READY' | null;
};
export type EditableNumericRow = {
  id: number;
  rate: number | null;
};
export type KeyboardEditableRow = {
  id: number;
  requiredName: string;
  amount: number | null;
  effectiveDate: string | null;
  startsAt: string | null;
};
export type TestVirtualizationProp =
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

export const COLUMNS: ColumnDef<TestRow>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' }
];
const MONEY_COLUMN_DSL = createDataTableColumnDsl<MoneyRow>();
export const MONEY_COLUMNS: ColumnDef<MoneyRow>[] = [
  { accessorKey: 'id', header: 'ID' },
  MONEY_COLUMN_DSL.field('amount', 'Amount', { type: 'money' })
];
const EDITABLE_COLUMN_DSL = createDataTableColumnDsl<EditableRow>();
export const EDITABLE_COLUMNS = [
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
export const EDITABLE_NUMERIC_COLUMNS = [
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
export const KEYBOARD_EDITABLE_COLUMNS = [
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

export const FILTERABLE_COLUMNS: ColumnDef<TestRow>[] = [
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

export const SIZED_COLUMNS: ColumnDef<TestRow>[] = [
  { accessorKey: 'id', header: 'ID', size: 80 },
  { accessorKey: 'name', header: 'Name', size: 170 }
];

export const OVERFLOW_HEADER_LABEL = 'A very long customer name header';
export const OVERFLOW_HEADER_COLUMNS: ColumnDef<TestRow>[] = [
  { accessorKey: 'id', header: 'ID', size: 80 },
  { accessorKey: 'name', header: OVERFLOW_HEADER_LABEL, size: 80 }
];
export const OVERFLOW_COMPONENT_HEADER_LABEL = 'A very long sortable customer name header';
export const OVERFLOW_COMPONENT_HEADER_COLUMNS: ColumnDef<TestRow>[] = [
  { accessorKey: 'id', header: 'ID', size: 80 },
  {
    accessorKey: 'name',
    size: 80,
    header: ({ column }: { column: Column<TestRow, unknown> }) => (
      <DataTableColumnHeader column={column} title={OVERFLOW_COMPONENT_HEADER_LABEL} />
    )
  }
];

export type WideRow = { id: number; pinnedLeft: string; pinnedRight: string } & Record<
  `field${number}`,
  string
>;

export function makeWideColumns(count = 40): ColumnDef<WideRow>[] {
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

export function makeWideRows(rowCount: number, columnCount = 40): WideRow[] {
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

export function makeRows(count: number): TestRow[] {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));
}

export function createCopyEvent() {
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

export function createPasteEvent(text: string) {
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

export function getBodyCell(container: HTMLElement, rowIndex: number, text: string) {
  const cell = Array.from(
    container.querySelectorAll<HTMLTableCellElement>(`tbody tr:nth-child(${rowIndex + 1}) td`)
  ).find((candidate) => candidate.textContent === text);

  if (!cell) throw new Error(`cell ${rowIndex}:${text} missing`);
  return cell;
}

export function dispatchCellPointerEvent(
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

export function dragCellRange(source: HTMLElement, target: HTMLElement) {
  dispatchCellPointerEvent(source, 'pointerdown', { pointerId: 1, clientX: 10, clientY: 10 });
  dispatchCellPointerEvent(target, 'pointermove', { pointerId: 1, clientX: 40, clientY: 40 });
  dispatchCellPointerEvent(target, 'pointerup', { pointerId: 1, clientX: 40, clientY: 40 });
}

export function useHarnessTable(data: TestRow[], pageSize = 10, rowCount?: number) {
  return useReactTable({
    data,
    columns: COLUMNS,
    rowCount,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize, pageIndex: 0 } }
  });
}

export function useSizedHarnessTable(data: TestRow[], pageSize = 10) {
  return useReactTable({
    data,
    columns: SIZED_COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize, pageIndex: 0 } }
  });
}

export function useFilterableHarnessTable(data: TestRow[], pageSize = 10) {
  return useReactTable({
    data,
    columns: FILTERABLE_COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize, pageIndex: 0 } }
  });
}

export function useOverflowHeaderHarnessTable(data: TestRow[], pageSize = 10) {
  return useReactTable({
    data,
    columns: OVERFLOW_HEADER_COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize, pageIndex: 0 } }
  });
}

export function useOverflowComponentHeaderHarnessTable(data: TestRow[], pageSize = 10) {
  return useReactTable({
    data,
    columns: OVERFLOW_COMPONENT_HEADER_COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize, pageIndex: 0 } }
  });
}

export function Harness({
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

export function MoneyCopyHarness({ rows }: { rows: MoneyRow[] }) {
  const table = useReactTable({
    data: rows,
    columns: MONEY_COLUMNS,
    getCoreRowModel: getCoreRowModel()
  });

  return <DataTable table={table} />;
}

export function EditableSelectionHarness({
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

export function KeyboardSelectionHarness({
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

export function EditableNumericSelectionHarness({
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

export function SizedHarness({ rows }: { rows: TestRow[] }) {
  const table = useSizedHarnessTable(rows, rows.length);
  return <DataTable table={table} />;
}

export function LoadingSkeletonHarness({ rows = [] }: { rows?: TestRow[] }) {
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

export function OverflowHeaderHarness({ rows }: { rows: TestRow[] }) {
  const table = useOverflowHeaderHarnessTable(rows, rows.length);
  return <DataTable table={table} />;
}

export function OverflowComponentHeaderHarness({ rows }: { rows: TestRow[] }) {
  const table = useOverflowComponentHeaderHarnessTable(rows, rows.length);
  return <DataTable table={table} />;
}

export function SortableHeaderHarness({ sorting }: { sorting: SortingState }) {
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

export function HeaderDragOverlayHarness() {
  const table = useOverflowComponentHeaderHarnessTable([{ id: 1, name: 'Alice' }], 1);
  const header = table.getFlatHeaders().find((candidate) => candidate.column.id === 'name');

  if (!header) return null;

  return <DataTableHeaderDragOverlay header={header} width={160} />;
}

export function ControlsHarness({
  toolbar,
  actions,
  getSelectedRows,
  actionBar,
  showViewOptions
}: {
  toolbar?: React.ReactNode;
  actions?: DataTableAction<TestRow>[];
  getSelectedRows?: () => TestRow[];
  actionBar?: React.ReactNode;
  showViewOptions?: boolean;
}) {
  const table = useHarnessTable(makeRows(5), 5);

  return (
    <DataTable
      table={table}
      showViewOptions={showViewOptions}
      tableActions={actions}
      getSelectedRows={getSelectedRows}
      actionBar={actionBar}
    >
      {toolbar}
    </DataTable>
  );
}

export function ExpandHarness({
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

export function SelectableHarness({ rows }: { rows: TestRow[] }) {
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

export function SpecialColumnsSelectionHarness({ rows }: { rows: TestRow[] }) {
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

export function WideHarness({
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

export function GroupedHeaderHarness() {
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

export function ColumnResizeMeasureHarness() {
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

export function mockNavigator(userAgent: string, vendor: string) {
  Object.defineProperty(window.navigator, 'userAgent', {
    configurable: true,
    value: userAgent
  });
  Object.defineProperty(window.navigator, 'vendor', {
    configurable: true,
    value: vendor
  });
}

export function ServerSelectableHarness({
  rows,
  totalCount
}: {
  rows: TestRow[];
  totalCount: number;
}) {
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

export function SelectedRowModelCounterHarness({
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
export const envRecord = env as Record<string, unknown>;
const originalDataTableVirtualization = envRecord.dataTableVirtualization;

beforeEach(() => {
  virtualizerMocksHoisted.calls.length = 0;
  virtualizerMocksHoisted.instances.length = 0;
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
