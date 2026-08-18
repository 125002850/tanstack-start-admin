import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  choiceTestColumnDsl as columnDsl,
  createChoiceTestWrapper as createWrapper,
  EditableChoiceTestTable as EditableTable,
  getChoiceTestCell as getCell,
  installChoiceTestDomMocks,
  STATIC_CHOICE_TEST_COLUMNS as STATIC_COLUMNS
} from '@/test/fixtures/data-table-choice-test-harness';

describe('DataTableEditableChoiceCell', () => {
  afterEach(cleanup);

  beforeEach(() => {
    installChoiceTestDomMocks();
  });

  it('selects on single click and exposes one edit-ready surface after cancellation', async () => {
    const user = userEvent.setup();
    render(<EditableTable />, { wrapper: createWrapper() });

    const statusCell = getCell('status');
    expect(
      document.querySelectorAll('[data-slot="data-table-choice-editor-ready-trigger"]')
    ).toHaveLength(0);
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
    expect(
      document.querySelectorAll('[data-slot="data-table-choice-editor-ready-trigger"]')
    ).toHaveLength(1);
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
      document.querySelectorAll('[data-slot="data-table-choice-editor-ready-trigger"]')
    ).toHaveLength(0);
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
});
