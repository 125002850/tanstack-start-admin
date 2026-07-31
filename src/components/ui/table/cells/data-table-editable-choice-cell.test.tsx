import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDataTableColumnDsl } from '@/components/ui/table/columns/data-table-column-factory';
import { DataTable } from '@/components/ui/table/core/data-table';
import { useDataTable } from '@/hooks/use-data-table';
import type {
  DataTableEditChangeEvent,
  DataTableEditSnapshot,
  DataTableRemoteOptionPage
} from '@/types/data-table';

type Row = {
  id: number;
  status: 'DRAFT' | 'READY' | null;
  roleIds: number[];
  ownerId: number | null;
  ownerIds: number[];
};

const columnDsl = createDataTableColumnDsl<Row>();
const STATIC_COLUMNS = [
  columnDsl.editableField('status', '状态', {
    type: 'enum',
    valueOptions: [
      { value: 'DRAFT', label: '草稿' },
      { value: 'READY', label: '就绪' }
    ],
    edit: { selectionMode: 'single', allowEmpty: false }
  }),
  columnDsl.editableField('roleIds', '角色', {
    type: 'select',
    valueOptions: [
      { value: 1, label: '管理员' },
      { value: 2, label: '审计员' },
      { value: 3, label: '访客' }
    ],
    edit: { selectionMode: 'multiple', maxSelected: 2 }
  })
];

const ROWS: Row[] = [
  { id: 1, status: 'DRAFT', roleIds: [1], ownerId: 42, ownerIds: [42] },
  { id: 2, status: null, roleIds: [99], ownerId: 43, ownerIds: [43] }
];

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 }
    }
  });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

function EditableTable({
  columns = STATIC_COLUMNS,
  onChange = () => undefined,
  onSnapshot
}: {
  columns?: typeof STATIC_COLUMNS;
  onChange?: (event: DataTableEditChangeEvent<Row>) => void;
  onSnapshot?: (snapshot: DataTableEditSnapshot<Row>) => void;
}) {
  const { table, editing } = useDataTable({
    tableId: 'editable-choice-test',
    columns,
    data: ROWS,
    rowId: 'id',
    editing: { onChange },
    showRowNumberColumn: false
  });

  return (
    <>
      <button type='button' onClick={() => onSnapshot?.(editing.getSnapshot())}>
        读取草稿
      </button>
      <DataTable table={table} virtualization={false} />
    </>
  );
}

function getCell(columnId: string, index = 0) {
  return document.querySelectorAll<HTMLTableCellElement>(`td[data-cell-column-id="${columnId}"]`)[
    index
  ]!;
}

describe('DataTableEditableChoiceCell', () => {
  afterEach(cleanup);

  beforeEach(() => {
    Element.prototype.hasPointerCapture ??= vi.fn(() => false);
    Element.prototype.setPointerCapture ??= vi.fn();
    Element.prototype.releasePointerCapture ??= vi.fn();
    Element.prototype.scrollIntoView ??= vi.fn();
  });

  it('selects on single click and exposes one edit-ready surface after cancellation', async () => {
    const user = userEvent.setup();
    render(<EditableTable />, { wrapper: createWrapper() });

    const statusCell = getCell('status');
    await user.click(statusCell);

    expect(statusCell).toHaveAttribute('data-cell-interaction-state', 'selected');
    expect(statusCell).not.toHaveAttribute('data-cell-edit-ready');
    expect(statusCell).not.toHaveAttribute('data-cell-editing');
    expect(screen.queryByRole('option', { name: '就绪' })).not.toBeInTheDocument();

    await user.dblClick(statusCell);
    expect(statusCell).toHaveAttribute('data-cell-interaction-state', 'editing');
    expect(await screen.findByRole('option', { name: '就绪' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    expect(statusCell).toHaveAttribute('data-cell-interaction-state', 'edit-ready');
    expect(statusCell).toHaveAttribute('data-cell-edit-ready', 'true');
    const readyTrigger = statusCell.querySelector<HTMLButtonElement>(
      '[data-slot="data-table-choice-editor-ready-trigger"]'
    );
    expect(readyTrigger).toHaveAttribute('aria-expanded', 'false');
    expect(readyTrigger).toHaveTextContent('草稿');
    expect(readyTrigger).toHaveClass('border-2', 'ring-[3px]', 'ring-primary/25');
    expect(screen.queryByRole('option', { name: '就绪' })).not.toBeInTheDocument();

    await user.click(readyTrigger!);

    expect(statusCell).not.toHaveAttribute('data-cell-edit-ready');
    expect(statusCell).toHaveAttribute('data-cell-editing', 'true');
    expect(await screen.findByRole('option', { name: '就绪' })).toBeInTheDocument();

    await user.keyboard('{Escape}');
    const secondStatusCell = getCell('status', 1);
    await user.click(secondStatusCell);

    expect(statusCell).not.toHaveAttribute('data-cell-interaction-state');
    expect(statusCell).not.toHaveAttribute('data-cell-edit-ready');
    expect(secondStatusCell).toHaveAttribute('data-cell-interaction-state', 'selected');
    expect(
      document.querySelectorAll(
        'td[data-cell-interaction-state="selected"], td[data-cell-interaction-state="edit-ready"], td[data-cell-interaction-state="editing"]'
      )
    ).toHaveLength(1);
  });

  it('edits enum values by double click and cancels with Escape', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EditableTable onChange={onChange} />, { wrapper: createWrapper() });

    const statusCell = getCell('status');
    expect(statusCell).toHaveAttribute('data-cell-editable', 'true');
    expect(statusCell).toHaveTextContent('草稿');

    await user.dblClick(statusCell);
    expect(statusCell).toHaveAttribute('data-cell-editing', 'true');
    expect(statusCell.querySelector('[data-slot="data-table-choice-editor"]')).toHaveClass(
      'absolute',
      'inset-0',
      'bg-background'
    );
    expect(statusCell.querySelector('[data-slot="choice-combobox-trigger"]')).toHaveClass(
      'h-full',
      'rounded-[2px]',
      'border-2',
      'border-primary',
      'bg-background',
      'shadow-none',
      'ring-[3px]',
      'ring-primary/25'
    );
    expect(screen.queryByPlaceholderText('搜索状态')).not.toBeInTheDocument();
    expect(screen.queryByText('清除选择')).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: '就绪' }));

    await waitFor(() => expect(statusCell).toHaveTextContent('就绪'));
    expect(statusCell).not.toHaveAttribute('data-cell-editing');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'selection',
        changes: [
          {
            rowId: '1',
            field: 'status',
            previousValue: 'DRAFT',
            value: 'READY'
          }
        ]
      })
    );

    await user.dblClick(statusCell);
    await screen.findByRole('option', { name: '就绪' });
    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('option', { name: '就绪' })).not.toBeInTheDocument();
    });
    expect(statusCell).toHaveTextContent('就绪');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('clears a single value from the shared command footer when empty values are allowed', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const clearableColumns = [
      columnDsl.editableField('status', '状态', {
        type: 'enum',
        valueOptions: [
          { value: 'DRAFT', label: '草稿' },
          { value: 'READY', label: '就绪' }
        ],
        edit: { selectionMode: 'single', allowEmpty: true }
      }),
      STATIC_COLUMNS[1]
    ];
    render(<EditableTable columns={clearableColumns} onChange={onChange} />, {
      wrapper: createWrapper()
    });

    const statusCell = getCell('status');
    await user.dblClick(statusCell);
    await user.click(await screen.findByText('清除选择'));

    await waitFor(() => expect(statusCell).toHaveTextContent('-'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'selection',
        changes: [
          {
            rowId: '1',
            field: 'status',
            previousValue: 'DRAFT',
            value: null
          }
        ]
      })
    );
  });

  it('keeps multiple value order, enforces maxSelected, and commits on Tab', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSnapshot = vi.fn();
    render(<EditableTable onChange={onChange} onSnapshot={onSnapshot} />, {
      wrapper: createWrapper()
    });

    const roleCell = getCell('roleIds');
    expect(roleCell).toHaveTextContent('管理员');
    expect(getCell('roleIds', 1)).toHaveTextContent('99');

    await user.dblClick(roleCell);
    expect(roleCell).toHaveAttribute('data-cell-editing', 'true');
    expect(roleCell.querySelector('[aria-label="编辑角色"]')).toHaveClass(
      'h-full',
      'rounded-[2px]',
      'border-primary',
      'bg-background',
      'shadow-none',
      'ring-[3px]',
      'ring-primary/25'
    );
    await screen.findByRole('button', { name: '编辑角色' });
    await user.click(screen.getByText('审计员'));
    const visitorItem = screen.getByText('访客').closest('[cmdk-item]');
    expect(visitorItem).toHaveAttribute('data-disabled', 'true');

    await user.keyboard('{Tab}');
    await waitFor(() => expect(roleCell).toHaveTextContent('管理员、审计员'));
    const nextStatusCell = getCell('status', 1);
    expect(nextStatusCell).toHaveFocus();
    expect(nextStatusCell).toHaveAttribute('data-cell-interaction-state', 'selected');
    expect(nextStatusCell).not.toHaveAttribute('data-cell-edit-ready');
    expect(roleCell).not.toHaveAttribute('data-cell-edit-ready');
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        reason: 'tab',
        changes: [
          {
            rowId: '1',
            field: 'roleIds',
            previousValue: [1],
            value: [1, 2]
          }
        ]
      })
    );

    await user.click(screen.getByRole('button', { name: '读取草稿' }));
    expect(onSnapshot).toHaveBeenCalledWith(
      expect.objectContaining({
        changedRows: [
          expect.objectContaining({
            id: 1,
            roleIds: [1, 2]
          })
        ]
      })
    );
    expect(screen.queryByRole('button', { name: '编辑角色' })).not.toBeInTheDocument();
  });

  it('finishes the latest multiple draft before an external button reads the snapshot', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const onSnapshot = vi.fn();
    render(<EditableTable onChange={onChange} onSnapshot={onSnapshot} />, {
      wrapper: createWrapper()
    });

    await user.dblClick(getCell('roleIds'));
    await screen.findByRole('button', { name: '编辑角色' });
    await user.click(screen.getByText('审计员'));
    await user.click(screen.getByRole('button', { name: '读取草稿' }));

    const roleCell = getCell('roleIds');
    expect(roleCell).toHaveAttribute('data-cell-interaction-state', 'edit-ready');
    expect(roleCell).toHaveAttribute('data-cell-edit-ready', 'true');
    expect(
      roleCell.querySelector('[data-slot="data-table-choice-editor-ready-trigger"]')
    ).toHaveAttribute('aria-label', '准备编辑角色');
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ reason: 'blur' }));
    expect(onSnapshot).toHaveBeenLastCalledWith(
      expect.objectContaining({
        changedRows: [
          expect.objectContaining({
            id: 1,
            roleIds: [1, 2]
          })
        ]
      })
    );
  });

  it('batches remote label resolution and supports remote search pagination', async () => {
    const user = userEvent.setup();
    const resolveOptions = vi.fn(
      async ({ values }: { values: readonly number[]; signal: AbortSignal }) =>
        values.map((value) => ({ value, label: value === 42 ? '张三' : '李四' }))
    );
    const loadOptions = vi.fn(
      async ({
        keyword,
        pageNo
      }: {
        keyword: string;
        pageNo: number;
        pageSize: number;
        signal: AbortSignal;
      }): Promise<DataTableRemoteOptionPage<number>> => ({
        items:
          pageNo === 1
            ? [{ value: 42, label: keyword ? `张三-${keyword}` : '张三' }]
            : [{ value: 43, label: '李四' }],
        total: 2
      })
    );
    const remoteColumns = [
      columnDsl.editableField('ownerId', '负责人', {
        type: 'remoteSelect',
        remoteOptions: {
          loadOptions: ({ keyword, pageNo, pageSize, signal }) =>
            loadOptions({ keyword, pageNo, pageSize, signal }),
          resolveOptions: ({ values, signal }) =>
            resolveOptions({ values: values as readonly number[], signal }),
          debounceMs: 0,
          pageSize: 1
        },
        edit: { selectionMode: 'single' }
      })
    ];
    render(<EditableTable columns={remoteColumns} />, { wrapper: createWrapper() });

    expect(screen.getAllByLabelText('正在解析负责人')).toHaveLength(2);
    await waitFor(() => {
      expect(getCell('ownerId')).toHaveTextContent('张三');
      expect(getCell('ownerId', 1)).toHaveTextContent('李四');
    });
    expect(resolveOptions).toHaveBeenCalledTimes(1);
    expect(resolveOptions.mock.calls[0]?.[0].values).toEqual([42, 43]);

    await user.dblClick(getCell('ownerId'));
    const search = await screen.findByPlaceholderText('搜索负责人');
    await waitFor(() => expect(loadOptions).toHaveBeenCalled());
    await user.type(search, 'bo');
    await waitFor(() => {
      expect(loadOptions).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: 'bo', pageNo: 1, pageSize: 1 })
      );
    });

    const optionList = document.querySelector<HTMLElement>('[data-slot="command-list"]');
    expect(optionList).not.toBeNull();
    Object.defineProperties(optionList!, {
      clientHeight: { configurable: true, value: 120 },
      scrollHeight: { configurable: true, value: 300 },
      scrollTop: { configurable: true, value: 140, writable: true }
    });
    fireEvent.wheel(optionList!, { deltaY: 200 });
    fireEvent.scroll(optionList!);
    await waitFor(() => {
      expect(loadOptions).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: 'bo', pageNo: 2, pageSize: 1 })
      );
    });
    expect((await screen.findAllByText('李四')).length).toBeGreaterThan(1);
  });

  it('falls back to raw remote values and distinguishes option loading errors', async () => {
    const user = userEvent.setup();
    const remoteColumns = [
      columnDsl.editableField('ownerId', '负责人', {
        type: 'remoteSelect',
        remoteOptions: {
          loadOptions: async () => {
            throw new Error('load failed');
          },
          resolveOptions: async () => {
            throw new Error('resolve failed');
          },
          debounceMs: 0
        },
        edit: { selectionMode: 'single' }
      })
    ];
    render(<EditableTable columns={remoteColumns} />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(getCell('ownerId')).toHaveTextContent('42');
      expect(getCell('ownerId', 1)).toHaveTextContent('43');
    });

    await user.dblClick(getCell('ownerId'));
    expect(await screen.findByText('选项加载失败')).toBeInTheDocument();
  });

  it('keeps remote multiple selections while search pages change', async () => {
    const user = userEvent.setup();
    const loadOptions = vi.fn(
      async ({
        keyword,
        pageNo
      }: {
        keyword: string;
        pageNo: number;
        pageSize: number;
        signal: AbortSignal;
      }): Promise<DataTableRemoteOptionPage<number>> => ({
        items:
          pageNo === 1
            ? [{ value: 42, label: keyword ? `张三-${keyword}` : '张三' }]
            : [
                { value: 42, label: '重复张三' },
                { value: 43, label: '李四' }
              ],
        total: 2
      })
    );
    const remoteColumns = [
      columnDsl.editableField('ownerIds', '负责人', {
        type: 'remoteSelect',
        remoteOptions: {
          loadOptions: ({ keyword, pageNo, pageSize, signal }) =>
            loadOptions({ keyword, pageNo, pageSize, signal }),
          resolveOptions: async ({ values }) =>
            values.map((value) => ({
              value,
              label: value === 42 ? '张三' : '李四'
            })),
          debounceMs: 0,
          pageSize: 1
        },
        edit: { selectionMode: 'multiple' }
      })
    ];
    render(<EditableTable columns={remoteColumns} />, { wrapper: createWrapper() });

    await waitFor(() => expect(getCell('ownerIds')).toHaveTextContent('张三'));
    await user.dblClick(getCell('ownerIds'));
    const search = await screen.findByPlaceholderText('搜索负责人');
    await user.type(search, 'li');
    await waitFor(() => {
      expect(loadOptions).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: 'li', pageNo: 1 })
      );
    });
    expect(screen.queryByRole('option', { name: '李四' })).not.toBeInTheDocument();
    const optionList = document.querySelector<HTMLElement>('[data-slot="command-list"]');
    expect(optionList).not.toBeNull();
    Object.defineProperties(optionList!, {
      clientHeight: { configurable: true, value: 120 },
      scrollHeight: { configurable: true, value: 300 },
      scrollTop: { configurable: true, value: 140, writable: true }
    });
    fireEvent.wheel(optionList!, { deltaY: 200 });
    fireEvent.scroll(optionList!);
    let liSiOption: HTMLElement | undefined;
    await waitFor(() => {
      liSiOption = screen.getAllByText('李四').find((element) => element.closest('[cmdk-item]'));
      expect(liSiOption).toBeDefined();
    });
    if (!liSiOption) throw new Error('remote option missing');
    await user.click(liSiOption);
    await user.keyboard('{Tab}');

    await waitFor(() => expect(getCell('ownerIds')).toHaveTextContent('张三、李四'));
    const calls = loadOptions.mock.calls;
    expect(calls.some(([request]) => request.pageNo === 2)).toBe(true);
  });
});
