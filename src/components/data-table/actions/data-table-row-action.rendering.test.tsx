import * as React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataTableRowActions } from './data-table-row-action';
import { DataTableActionTooltip } from './data-table-action-tooltip';
import { DataTable } from '@/components/data-table/core/data-table';
import { createDataTableColumnDsl } from '@/components/data-table/columns/data-table-column-factory';
import { useDataTable } from '@/hooks/use-data-table';
import type { DataTableRowAction } from './types';

vi.mock('./data-table-action-tooltip', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./data-table-action-tooltip')>();
  return { ...actual, DataTableActionTooltip: vi.fn(actual.DataTableActionTooltip) };
});

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    viewportRef
  }: {
    children: React.ReactNode;
    viewportRef: React.Ref<HTMLDivElement>;
  }) => <div ref={viewportRef}>{children}</div>
}));

type TestRow = { id: number; name: string };
const ROW: TestRow = { id: 1, name: 'Alice' };
const ROWS = [ROW];
const columns = [createDataTableColumnDsl<TestRow>().field('name', '名称')];

function TableHarness({ actions }: { actions: DataTableRowAction<TestRow>[] }) {
  const { table } = useDataTable({
    tableId: 'row-actions-rendering-test',
    data: ROWS,
    columns,
    rowActions: actions,
    showSelectColumn: true,
    columnOrderStorage: false,
    columnResizeStorage: false,
    sortingStorage: false
  });
  return <DataTable table={table} virtualization={false} showPagination={false} />;
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('row action rendering', () => {
  it('skips unchanged button and tooltip rendering when the parent updates', () => {
    const actions: DataTableRowAction<TestRow>[] = [{ label: '执行', icon: null }];
    const { rerender } = render(<DataTableRowActions row={ROW} actions={actions} />);
    const count = vi.mocked(DataTableActionTooltip).mock.calls.length;
    expect(count).toBeGreaterThan(0);
    for (let update = 0; update < 3; update++) {
      rerender(<DataTableRowActions row={ROW} actions={actions} />);
    }
    expect(DataTableActionTooltip).toHaveBeenCalledTimes(count);
  });

  it('keeps business buttons reusable across table selection updates', () => {
    const actions: DataTableRowAction<TestRow>[] = [{ label: '编辑', icon: null }];
    render(<TableHarness actions={actions} />);
    expect(screen.getByRole('button', { name: '编辑' })).toBeInTheDocument();
    const count = vi.mocked(DataTableActionTooltip).mock.calls.length;
    const checkbox = screen.getByRole('checkbox', { name: '选择行' });
    fireEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    fireEvent.click(checkbox);
    expect(checkbox).not.toBeChecked();
    expect(DataTableActionTooltip).toHaveBeenCalledTimes(count);
  });

  it('updates dynamic visibility, labels and disabled reasons even with stable row and actions', () => {
    const state = { hidden: false, disabled: false, label: '发布', reason: '' };
    const actions: DataTableRowAction<TestRow>[] = [
      {
        id: 'publish',
        icon: null,
        label: '发布',
        getLabel: () => state.label,
        hidden: () => state.hidden,
        disabled: () => state.disabled,
        disabledReason: () => state.reason
      }
    ];
    const { rerender } = render(<DataTableRowActions row={ROW} actions={actions} />);
    expect(screen.getByRole('button', { name: '发布' })).toBeEnabled();
    Object.assign(state, { disabled: true, label: '等待审核', reason: '审批中' });
    rerender(<DataTableRowActions row={ROW} actions={actions} />);
    const button = screen.getByRole('button', { name: '等待审核' });
    expect(button).toBeDisabled();
    expect(button.parentElement).toHaveAttribute('aria-label', '等待审核：审批中');
    state.hidden = true;
    rerender(<DataTableRowActions row={ROW} actions={actions} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    Object.assign(state, { hidden: false, disabled: false });
    rerender(<DataTableRowActions row={ROW} actions={actions} />);
    expect(screen.getByRole('button', { name: '等待审核' })).toBeEnabled();
  });

  it('uses refreshed row data and replacement callbacks after the button has been reused', () => {
    const onClick = vi.fn();
    const actions: DataTableRowAction<TestRow>[] = [{ label: '执行', icon: null, onClick }];
    const { rerender } = render(<DataTableRowActions row={ROW} actions={actions} />);
    rerender(<DataTableRowActions row={ROW} actions={actions} />);
    const updatedRow = { ...ROW, name: 'Bob' };
    rerender(<DataTableRowActions row={updatedRow} actions={actions} />);
    fireEvent.click(screen.getByRole('button', { name: '执行' }));
    expect(onClick).toHaveBeenCalledExactlyOnceWith(updatedRow);
    const replacement = vi.fn();
    rerender(
      <DataTableRowActions row={updatedRow} actions={[{ ...actions[0], onClick: replacement }]} />
    );
    fireEvent.click(screen.getByRole('button', { name: '执行' }));
    expect(replacement).toHaveBeenCalledExactlyOnceWith(updatedRow);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
