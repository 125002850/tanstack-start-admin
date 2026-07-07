import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type VisibilityState
} from '@tanstack/react-table';
import * as React from 'react';

import { createDataTableColumnDsl } from '@/components/ui/table/columns/data-table-column-factory';
import { DataTableColumnHeader } from '@/components/ui/table/columns/data-table-column-header';
import { DataTableViewOptions } from '@/components/ui/table/toolbar/data-table-view-options';

type TestRow = { id: number; name: string; code?: string; amount?: number };

const DATA: TestRow[] = [{ id: 1, name: 'Alice' }];

function ViewOptionsHarness({
  columns,
  iconOnly = false
}: {
  columns: ColumnDef<TestRow>[];
  iconOnly?: boolean;
}) {
  const table = useReactTable({
    data: DATA,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  return <DataTableViewOptions table={table} iconOnly={iconOnly} />;
}

function OrderedViewOptionsHarness({
  hasCustomOrder,
  onReset
}: {
  hasCustomOrder: boolean;
  onReset: () => void;
}) {
  const table = useReactTable({
    data: DATA,
    columns: [
      { accessorKey: 'id', header: 'ID' },
      { accessorKey: 'name', header: 'Name' }
    ],
    state: {
      columnOrder: ['name', 'id']
    },
    meta: {
      dataTableColumnOrder: {
        hasCustomOrder,
        reset: onReset
      }
    },
    getCoreRowModel: getCoreRowModel()
  });

  return <DataTableViewOptions table={table} />;
}

function ControlledOrderViewOptionsHarness({ columnOrder }: { columnOrder: string[] }) {
  const table = useReactTable({
    data: DATA,
    columns: [
      { accessorKey: 'id', header: 'ID' },
      { accessorKey: 'name', header: 'Name' }
    ],
    state: {
      columnOrder
    },
    getCoreRowModel: getCoreRowModel()
  });

  return <DataTableViewOptions table={table} />;
}

function InteractiveViewOptionsHarness() {
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [columnOrder, setColumnOrder] = React.useState<string[]>(['id', 'name']);
  const table = useReactTable({
    data: DATA,
    columns: [
      { accessorKey: 'id', header: 'ID' },
      { accessorKey: 'name', header: 'Name' }
    ],
    state: {
      columnVisibility,
      columnOrder
    },
    onColumnVisibilityChange: setColumnVisibility,
    onColumnOrderChange: setColumnOrder,
    getCoreRowModel: getCoreRowModel()
  });

  return (
    <>
      <DataTableViewOptions table={table} />
      <span data-testid='id-visible'>{String(table.getColumn('id')?.getIsVisible())}</span>
      <span data-testid='name-visible'>{String(table.getColumn('name')?.getIsVisible())}</span>
      <span data-testid='column-order'>{JSON.stringify(columnOrder)}</span>
    </>
  );
}

function DslTextViewOptionsHarness() {
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const columnDsl = React.useMemo(() => createDataTableColumnDsl<TestRow>(), []);
  const columns = React.useMemo<ColumnDef<TestRow>[]>(
    () => [columnDsl.field('id', '编号'), columnDsl.field('name', '姓名')],
    [columnDsl]
  );
  const table = useReactTable({
    data: DATA,
    columns,
    state: {
      columnVisibility
    },
    onColumnVisibilityChange: setColumnVisibility,
    getCoreRowModel: getCoreRowModel()
  });

  return <DataTableViewOptions table={table} />;
}

function PanelMetaViewOptionsHarness() {
  const columnDsl = React.useMemo(() => createDataTableColumnDsl<TestRow>(), []);
  const columns = React.useMemo<ColumnDef<TestRow>[]>(
    () => [
      columnDsl.field('id', '编号', { columnPanelReorder: false }),
      columnDsl.field('name', '姓名'),
      columnDsl.field('code', '编码'),
      columnDsl.field('amount', '金额', { columnPanelVisible: false })
    ],
    [columnDsl]
  );
  const table = useReactTable({
    data: DATA,
    columns,
    getCoreRowModel: getCoreRowModel()
  });

  return <DataTableViewOptions table={table} />;
}

function getCommandItemLabels() {
  return Array.from(document.body.querySelectorAll('[data-slot="command-item"]')).map((item) =>
    item.textContent?.trim()
  );
}

afterEach(cleanup);

beforeAll(() => {
  Object.defineProperty(window.HTMLElement.prototype, 'scrollIntoView', {
    configurable: true,
    value: vi.fn()
  });
});

describe('DataTableViewOptions', () => {
  it('renders the default trigger with visible text', () => {
    render(
      <ViewOptionsHarness
        columns={[
          { accessorKey: 'id', header: 'ID' },
          { accessorKey: 'name', header: 'Name' }
        ]}
      />
    );

    expect(screen.getByRole('button', { name: '切换表格列显示' })).toBeInTheDocument();
    expect(screen.getByText('显示列')).toBeInTheDocument();
  });

  it('renders an icon-only trigger without visible text when requested', () => {
    render(
      <ViewOptionsHarness
        iconOnly
        columns={[
          { accessorKey: 'id', header: 'ID' },
          { accessorKey: 'name', header: 'Name' }
        ]}
      />
    );

    const trigger = screen.getByRole('button', { name: '切换表格列显示' });
    expect(trigger).toHaveClass('w-8', 'p-0');
    expect(screen.queryByText('显示列')).toBeNull();
  });

  it('returns null when there are no hideable data columns', () => {
    render(
      <ViewOptionsHarness
        columns={[
          { accessorKey: 'id', header: 'ID', enableHiding: false },
          { accessorKey: 'name', header: 'Name', enableHiding: false }
        ]}
      />
    );

    expect(screen.queryByRole('button', { name: '切换表格列显示' })).toBeNull();
  });

  it('falls back to the rendered header title when meta.label is omitted', async () => {
    const user = userEvent.setup();

    render(
      <ViewOptionsHarness
        columns={[
          {
            accessorKey: 'id',
            header: ({ column }) => <DataTableColumnHeader column={column} title='编号' />
          },
          { accessorKey: 'name', header: '姓名' }
        ]}
      />
    );

    await user.click(screen.getByRole('button', { name: '切换表格列显示' }));

    expect(await screen.findByText('编号')).toBeInTheDocument();
    expect(screen.getByText('姓名')).toBeInTheDocument();
  });

  it('keeps columnDsl.field labels after the column is hidden', async () => {
    const user = userEvent.setup();

    render(<DslTextViewOptionsHarness />);

    await user.click(screen.getByRole('button', { name: '切换表格列显示' }));

    const nameItem = await screen.findByText('姓名');
    await user.click(nameItem);

    expect(screen.getByText('姓名')).toBeInTheDocument();
    expect(screen.queryByText('name')).toBeNull();
  });

  it('honors column panel visibility and reorder metadata', async () => {
    const user = userEvent.setup();

    render(<PanelMetaViewOptionsHarness />);

    await user.click(screen.getByRole('button', { name: '切换表格列显示' }));

    expect(await screen.findByText('编号')).toBeInTheDocument();
    expect(screen.getByText('姓名')).toBeInTheDocument();
    expect(screen.getByText('编码')).toBeInTheDocument();
    expect(screen.queryByText('金额')).toBeNull();
    expect(screen.queryByRole('button', { name: '拖拽调整 编号 列顺序' })).toBeNull();
    expect(screen.getByRole('button', { name: '拖拽调整 姓名 列顺序' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '拖拽调整 编码 列顺序' })).toBeInTheDocument();
  });

  it('renders columns in table order and keeps reset order at the bottom', async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();

    render(<OrderedViewOptionsHarness hasCustomOrder onReset={onReset} />);

    await user.click(screen.getByRole('button', { name: '切换表格列显示' }));

    const itemLabels = Array.from(document.body.querySelectorAll('[data-slot="command-item"]')).map(
      (item) => item.textContent?.trim()
    );
    expect(itemLabels).toEqual(['Name', 'ID', '重置顺序']);

    await user.click(screen.getByText('重置顺序'));

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it('updates the open menu when column order changes', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<ControlledOrderViewOptionsHarness columnOrder={['id', 'name']} />);

    await user.click(screen.getByRole('button', { name: '切换表格列显示' }));

    expect(getCommandItemLabels()).toEqual(['ID', 'Name']);

    rerender(<ControlledOrderViewOptionsHarness columnOrder={['name', 'id']} />);

    expect(getCommandItemLabels()).toEqual(['Name', 'ID']);
  });

  it('keeps the reset order action outside the scrollable column group', async () => {
    const user = userEvent.setup();

    render(<OrderedViewOptionsHarness hasCustomOrder onReset={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '切换表格列显示' }));

    const commandList = document.body.querySelector('[data-slot="command-list"]');
    const commandGroups = Array.from(
      document.body.querySelectorAll<HTMLElement>('[data-slot="command-group"]')
    );

    expect(commandList).toHaveClass('max-h-none', 'overflow-visible');
    expect(commandGroups[0]).toHaveClass('max-h-64', 'overflow-y-auto');
    expect(commandGroups[0]).toHaveTextContent('Name');
    expect(commandGroups[0]).not.toHaveTextContent('重置顺序');
    expect(commandGroups[1]).toHaveTextContent('重置顺序');
  });

  it('disables reset order when the table is already in its initial order', async () => {
    const user = userEvent.setup();

    render(<OrderedViewOptionsHarness hasCustomOrder={false} onReset={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: '切换表格列显示' }));

    expect(screen.getByText('重置顺序').closest('[data-slot="command-item"]')).toHaveAttribute(
      'data-disabled',
      'true'
    );
  });

  it('shows hover-only drag handles without changing the row toggle behavior', async () => {
    const user = userEvent.setup();

    render(<InteractiveViewOptionsHarness />);

    await user.click(screen.getByRole('button', { name: '切换表格列显示' }));

    const handle = screen.getByRole('button', { name: '拖拽调整 Name 列顺序' });
    expect(handle).toHaveClass(
      'opacity-0',
      'group-hover/view-option:opacity-100',
      'group-focus-within/view-option:opacity-100'
    );

    await user.click(handle);

    expect(screen.getByTestId('name-visible').textContent).toBe('true');

    const nameItem = screen.getByText('Name').closest('[data-slot="command-item"]');
    if (!nameItem) throw new Error('Name command item not found');

    await user.click(nameItem);

    expect(screen.getByTestId('name-visible').textContent).toBe('false');

    await user.click(nameItem);

    expect(screen.getByTestId('name-visible').textContent).toBe('true');
  });

  it('does not toggle the item that receives pointerup after a drag starts', async () => {
    const user = userEvent.setup();

    render(<InteractiveViewOptionsHarness />);

    await user.click(screen.getByRole('button', { name: '切换表格列显示' }));

    const handle = screen.getByRole('button', { name: '拖拽调整 Name 列顺序' });
    const idItem = screen.getByText('ID').closest('[data-slot="command-item"]');
    if (!idItem) throw new Error('ID command item not found');

    fireEvent.mouseDown(handle, { button: 0, clientX: 4, clientY: 4 });
    fireEvent.mouseMove(document, { buttons: 1, clientX: 4, clientY: 24 });
    fireEvent.pointerUp(idItem, { clientX: 4, clientY: 24 });
    fireEvent.mouseUp(document, { clientX: 4, clientY: 24 });

    expect(screen.getByTestId('id-visible').textContent).toBe('true');
  });
});
