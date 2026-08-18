import {
  virtualizerMocks,
  envRecord,
  makeRows,
  makeWideRows,
  mockNavigator,
  useHarnessTable,
  ColumnResizeMeasureHarness,
  ControlsHarness,
  ExpandHarness,
  GroupedHeaderHarness,
  Harness,
  HeaderDragOverlayHarness,
  LoadingSkeletonHarness,
  OverflowComponentHeaderHarness,
  OverflowHeaderHarness,
  SelectableHarness,
  SelectedRowModelCounterHarness,
  ServerSelectableHarness,
  SizedHarness,
  SortableHeaderHarness,
  WideHarness,
  useOverflowComponentHeaderHarnessTable,
  OVERFLOW_HEADER_LABEL,
  OVERFLOW_COMPONENT_HEADER_LABEL,
  type TestRow
} from './data-table.test-utils';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createPortal } from 'react-dom';
import { DATA_TABLE_DEFAULT_EXPAND_TABLE_SIZING } from '@/lib/data-table/expand-split';
import { DataTable } from '@/components/data-table/core/data-table';

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

  it('renders normal rows on the 48px baseline with vertically centered cells', () => {
    const { container } = render(<Harness rows={makeRows(1)} />);
    const firstRow = container.querySelector<HTMLTableRowElement>('tbody tr[data-row-index="0"]');
    const firstCell = container.querySelector('tbody td[data-cell-id]');

    expect(firstRow?.style.height).toBe('48px');
    expect(firstCell?.getAttribute('class')).toContain('px-[15px]');
    expect(firstCell?.getAttribute('class')).toContain('py-0');
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
    expect(container.querySelector<HTMLTableRowElement>('tbody tr')?.style.height).toBe('48px');
    expect(screen.queryByText('暂无数据')).not.toBeInTheDocument();
  });

  it('keeps existing rows visible while loading when rows are already present', () => {
    const { container } = render(<LoadingSkeletonHarness rows={makeRows(1)} />);

    expect(container.querySelector('[data-slot="data-table-skeleton"]')).toBeNull();
    expect(screen.getByText('Item 1')).toBeInTheDocument();
  });

  it('hides pagination for embedded tables while preserving a visible selection action bar', () => {
    function EmbeddedHarness() {
      const table = useHarnessTable(makeRows(2), 2);
      return (
        <DataTable
          table={table}
          showPagination={false}
          selectedRowCount={1}
          actionBar={<div>批量操作</div>}
        />
      );
    }

    render(<EmbeddedHarness />);

    expect(screen.queryByText('每页条数')).not.toBeInTheDocument();
    expect(screen.getByText('批量操作')).toBeInTheDocument();
  });

  it('keeps the loading skeleton pagination consistent with showPagination', () => {
    function EmbeddedLoadingHarness() {
      const table = useHarnessTable([], 10);
      return <DataTable table={table} showPagination={false} isLoading loadingSkeleton={{}} />;
    }

    const { container } = render(<EmbeddedLoadingHarness />);

    expect(container.querySelector('[data-slot="data-table-skeleton"]')).not.toBeNull();
    expect(container.querySelector('[data-slot="data-table-skeleton-pagination"]')).toBeNull();
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

  it('keeps sortable headers and exposes sorting recovery while an error status is visible', async () => {
    const user = userEvent.setup();

    function ErrorStatusHarness() {
      const table = useOverflowComponentHeaderHarnessTable([], 10);
      return (
        <DataTable
          table={table}
          getStatusConfig={() => ({
            type: 'error',
            title: '排序请求失败',
            description: '后端不支持当前排序字段。'
          })}
        />
      );
    }

    render(<ErrorStatusHarness />);

    const sortButton = screen.getByRole('button', {
      name: new RegExp(`^${OVERFLOW_COMPONENT_HEADER_LABEL}：`)
    });
    const initialSortActionLabel = sortButton.getAttribute('aria-label');
    expect(sortButton).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '清除排序并重试' })).not.toBeInTheDocument();

    await user.click(sortButton);

    expect(screen.getByText('排序请求失败')).toBeInTheDocument();
    expect(sortButton).not.toHaveAccessibleName(initialSortActionLabel ?? '');

    await user.click(screen.getByRole('button', { name: '清除排序并重试' }));

    expect(sortButton).toHaveAccessibleName(initialSortActionLabel ?? '');
    expect(screen.queryByRole('button', { name: '清除排序并重试' })).not.toBeInTheDocument();
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
    expect(trigger).not.toHaveClass('data-[state=open]:bg-accent');
    expect(trigger).toHaveClass('focus-visible:ring-1');
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
        zIndex: '22'
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

  it('hides the column view options button when explicitly disabled', () => {
    render(
      <ControlsHarness
        toolbar={<div data-testid='table-toolbar'>toolbar</div>}
        showViewOptions={false}
      />
    );

    expect(screen.getByTestId('table-toolbar')).toBeInTheDocument();
    expect(screen.queryByTestId('view-options-button')).not.toBeInTheDocument();
    expect(document.querySelector('[data-slot="separator"]')).toBeNull();
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
    expect(secondVirtualRow?.style.top).toBe('48px');
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
    expect(secondVirtualRow?.style.transform).toBe('translateY(48px)');
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
    expect((virtualRows[0] as HTMLTableRowElement).style.height).toBe('48px');
  });

  it('allows a taller virtual table to override the standard row height', () => {
    const rows = makeRows(200);
    const { container } = render(
      <Harness
        rows={rows}
        virtualization={{
          enabled: true,
          rowCountThreshold: 10,
          estimateRowHeight: 56,
          overscan: 0
        }}
      />
    );

    const firstVirtualRow = container.querySelector<HTMLTableRowElement>(
      'tbody[data-virtual-enabled="true"] tr[data-index]'
    );
    expect(firstVirtualRow?.style.height).toBe('56px');
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
    const tableViewportHost = document.querySelector('[data-table-resize-overlay-root]');
    const expandPanel = document.querySelector('[data-slot="data-table-expand-panel"]');
    const expandContent = document.querySelector('[data-slot="data-table-expand-panel-content"]');
    expect(tableViewportHost).toHaveClass('absolute', 'inset-0');
    expect(expandPanel).toHaveClass('min-h-0', 'min-w-0');
    expect(expandContent).toHaveClass('flex', 'min-h-0', 'min-w-0', 'flex-1', 'overflow-hidden');
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(document.querySelector('[data-slot="data-table-expand-panel"]')).not.toBeNull();

    await user.click(screen.getByRole('button', { name: '关闭详情面板' }));

    expect(screen.getByTestId('expanded-row-key').textContent).toBe('null');
    expect(document.querySelector('[data-slot="data-table-expand-panel"]')).toBeNull();
  });

  it('uses tabs when more than one expand view is available', async () => {
    const user = userEvent.setup();
    render(
      <ExpandHarness
        rows={makeRows(2)}
        expandConfigOverride={{
          rowKey: 'id',
          tabs: [
            {
              id: 'summary',
              label: '概览',
              render: (row) => <div>{`summary:${row.name}`}</div>
            },
            {
              id: 'history',
              label: '历史',
              render: (row) => <div>{`history:${row.name}`}</div>
            }
          ]
        }}
      />
    );

    await user.click(screen.getByText('Item 1'));

    expect(screen.getAllByRole('tab')).toHaveLength(2);
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
