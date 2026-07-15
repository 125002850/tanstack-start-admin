import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { getCoreRowModel, useReactTable, type ColumnDef } from '@tanstack/react-table';
import userEvent from '@testing-library/user-event';

import {
  DataTableActionsBar,
  type DataTableAction
} from '@/components/ui/table/actions/data-table-actions-bar';

type TestRow = { id: number; name: string };

const DATA: TestRow[] = [{ id: 1, name: 'Alice' }];
const COLUMNS: ColumnDef<TestRow>[] = [{ accessorKey: 'name', header: 'Name' }];

function ActionsBarHarness({
  actions,
  getSelectedRows
}: {
  actions: DataTableAction<TestRow>[];
  getSelectedRows?: () => TestRow[];
}) {
  const table = useReactTable({
    data: DATA,
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel()
  });

  return <DataTableActionsBar table={table} actions={actions} getSelectedRows={getSelectedRows} />;
}

afterEach(cleanup);

describe('DataTableActionsBar', () => {
  it('renders visible actions inside a single button group', async () => {
    const user = userEvent.setup();

    render(
      <ActionsBarHarness
        actions={[
          {
            label: '新增用户',
            callback: vi.fn()
          },
          {
            label: '更多操作',
            children: [
              {
                label: '导出全部',
                callback: vi.fn()
              }
            ]
          },
          {
            label: '隐藏操作',
            hidden: true,
            callback: vi.fn()
          }
        ]}
      />
    );

    const group = screen.getByRole('group', { name: '表格操作' });
    expect(group).toContainElement(screen.getByRole('button', { name: /新增用户/ }));
    expect(group).toContainElement(screen.getByRole('button', { name: /更多操作/ }));
    expect(screen.queryByRole('button', { name: '隐藏操作' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /更多操作/ }));

    expect(await screen.findByRole('menuitem', { name: '导出全部' })).toBeInTheDocument();
  });

  it('maps danger type to destructive button styling', () => {
    render(
      <ActionsBarHarness
        actions={[
          {
            label: '批量删除',
            type: 'danger',
            callback: vi.fn()
          }
        ]}
      />
    );

    expect(screen.getByRole('group', { name: '表格操作' })).toContainElement(
      screen.getByRole('button', { name: /批量删除/ })
    );
    expect(screen.getByRole('button', { name: /批量删除/ }).className).toContain('bg-destructive');
  });

  it('keeps variant as a compatibility fallback', () => {
    render(
      <ActionsBarHarness
        actions={[
          {
            label: '旧危险操作',
            variant: 'destructive',
            callback: vi.fn()
          }
        ]}
      />
    );

    expect(screen.getByRole('button', { name: /旧危险操作/ }).className).toContain(
      'bg-destructive'
    );
  });

  it('maps danger children to destructive dropdown items', async () => {
    const user = userEvent.setup();

    render(
      <ActionsBarHarness
        actions={[
          {
            label: '更多操作',
            children: [
              {
                label: '危险导出',
                type: 'danger',
                callback: vi.fn()
              }
            ]
          }
        ]}
      />
    );

    await user.click(screen.getByRole('button', { name: /更多操作/ }));

    expect(
      (await screen.findByRole('menuitem', { name: '危险导出' })).getAttribute('data-variant')
    ).toBe('destructive');
  });

  it('prefers explicit selected rows from the caller over deriving from table state', () => {
    render(
      <ActionsBarHarness
        actions={[
          {
            kind: 'selection',
            label: '导出选中',
            callback: vi.fn()
          }
        ]}
        getSelectedRows={() => DATA}
      />
    );

    expect(screen.getByRole('button', { name: /导出选中/ })).toBeInTheDocument();
  });

  it('hides selection actions until one row is selected', () => {
    const actions: DataTableAction<TestRow>[] = [
      {
        kind: 'selection',
        label: '批量维护',
        callback: vi.fn()
      }
    ];
    const { rerender } = render(<ActionsBarHarness actions={actions} getSelectedRows={() => []} />);

    expect(screen.queryByRole('button', { name: /批量维护/ })).not.toBeInTheDocument();

    rerender(<ActionsBarHarness actions={actions} getSelectedRows={() => DATA} />);

    expect(screen.getByRole('button', { name: /批量维护/ })).toBeInTheDocument();
  });

  it('orders selection actions after regular actions while preserving group order', () => {
    render(
      <ActionsBarHarness
        actions={[
          { kind: 'selection', label: '批量下载', callback: vi.fn() },
          { label: '新增', callback: vi.fn() },
          { kind: 'selection', label: '批量删除', callback: vi.fn() },
          { label: '导出', callback: vi.fn() }
        ]}
        getSelectedRows={() => DATA}
      />
    );

    expect(
      Array.from(
        screen.getByRole('group', { name: '表格操作' }).querySelectorAll('button'),
        (button) => button.textContent
      )
    ).toEqual(['新增', '导出', '批量下载', '批量删除']);
  });

  it('keeps regular dropdown items visible when selection items are hidden', async () => {
    const user = userEvent.setup();
    const actions: DataTableAction<TestRow>[] = [
      {
        label: '导出',
        children: [
          { kind: 'selection', label: '导出选中', callback: vi.fn() },
          { label: '导出全部', callback: vi.fn() }
        ]
      }
    ];
    const { rerender } = render(<ActionsBarHarness actions={actions} getSelectedRows={() => []} />);

    await user.click(screen.getByRole('button', { name: /导出/ }));

    expect(screen.queryByRole('menuitem', { name: '导出选中' })).not.toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '导出全部' })).toBeInTheDocument();

    rerender(<ActionsBarHarness actions={actions} getSelectedRows={() => DATA} />);

    expect(await screen.findByRole('menuitem', { name: '导出选中' })).toBeInTheDocument();
    expect(screen.getByRole('menuitem', { name: '导出全部' })).toBeInTheDocument();
  });
});
