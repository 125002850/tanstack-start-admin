import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { DataTableRowActions } from '@/components/data-table/actions/data-table-row-action';
import type { DataTableRowAction } from '@/types/data-table';

type TestRow = {
  id: number;
  name: string;
};

const ROW: TestRow = {
  id: 1,
  name: 'Alice'
};

afterEach(cleanup);

describe('DataTableRowActions', () => {
  it('disables an asynchronous action until it finishes and prevents duplicate submissions', async () => {
    let finish!: () => void;
    const pending = new Promise<void>((resolve) => {
      finish = resolve;
    });
    const onClick = vi.fn(() => pending);
    render(<DataTableRowActions row={ROW} actions={[{ label: '执行', onClick }]} />);
    const button = screen.getByRole('button', { name: '执行' });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(screen.getByRole('button', { name: '执行' })).toBeDisabled();
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: '执行' }).parentElement).toHaveAttribute(
      'aria-label',
      '执行：正在处理，请稍候。'
    );
    await act(async () => {
      finish();
      await pending;
    });
    expect(screen.getByRole('button', { name: '执行' })).toBeEnabled();
  });

  it('keeps disabled inline actions visible and explains them on keyboard focus and hover', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <DataTableRowActions
        row={ROW}
        actions={[
          {
            label: '发布',
            disabled: true,
            disabledReason: (row) => `${row.name} 尚未通过校验`,
            onClick,
            confirmDelete: { title: '确认发布' }
          }
        ]}
      />
    );
    const button = screen.getByRole('button', { name: '发布' });
    expect(button).toBeDisabled();
    await user.tab();
    expect(button.parentElement).toHaveFocus();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Alice 尚未通过校验');
    await user.keyboard('{Enter} ');
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    await user.tab();
    await user.hover(button.parentElement!);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('Alice 尚未通过校验');
  });

  it('keeps disabled menu items keyboard reachable without executing or closing the menu', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    const Sheet = vi.fn(() => null);
    render(
      <DataTableRowActions
        row={ROW}
        maxVisible={0}
        actions={[
          {
            label: '编辑',
            disabled: true,
            disabledReason: '请先暂存',
            onClick,
            Sheet
          }
        ]}
      />
    );
    await user.click(screen.getByRole('button', { name: '更多操作' }));
    const item = await screen.findByRole('menuitem', { name: /编辑/ });
    expect(item).toHaveAttribute('aria-disabled', 'true');
    expect(item).toHaveTextContent('请先暂存');
    await user.keyboard('{ArrowDown}');
    expect(item).toHaveFocus();
    await user.keyboard('{Enter}');
    await user.click(item);
    expect(onClick).not.toHaveBeenCalled();
    expect(Sheet).not.toHaveBeenCalled();
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('opens a confirmation dialog before running delete actions', async () => {
    const onDelete = vi.fn();
    const actions: DataTableRowAction<TestRow>[] = [
      {
        label: '删除',
        icon: <span>delete</span>,
        confirmDelete: {
          title: '确认删除用户？',
          description: (row) => `确定要删除 ${row.name} 吗？`,
          confirmText: '确认删除',
          cancelText: '再想想'
        },
        onClick: onDelete
      }
    ];

    render(<DataTableRowActions row={ROW} actions={actions} />);

    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(await screen.findByText('确认删除用户？')).toBeInTheDocument();
    expect(screen.getByText('确定要删除 Alice 吗？')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '确认删除' }));

    await waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith(ROW);
    });
  });
});
