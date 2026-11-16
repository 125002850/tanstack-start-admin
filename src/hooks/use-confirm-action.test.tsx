import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';

import { toast } from 'sonner';
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

import { useConfirmAction } from '@/hooks/use-confirm-action';

function ConfirmActionHarness({ onRun }: { onRun: (count: number) => void | Promise<void> }) {
  const { withConfirm, confirmDialog } = useConfirmAction<[number]>();

  const handleDelete = React.useMemo(
    () =>
      withConfirm({
        title: (count) => `确认删除 ${count} 条记录？`,
        description: '此操作不可撤销。',
        confirmText: '删除',
        cancelText: '取消',
        run: onRun
      }),
    [onRun, withConfirm]
  );

  return (
    <>
      {confirmDialog}
      <button type='button' onClick={() => handleDelete(3)}>
        打开确认
      </button>
    </>
  );
}

afterEach(cleanup);

describe('useConfirmAction', () => {
  it('opens a confirmation dialog and only runs after confirm', async () => {
    const onRun = vi.fn();

    render(<ConfirmActionHarness onRun={onRun} />);

    fireEvent.click(screen.getByRole('button', { name: '打开确认' }));

    expect(onRun).not.toHaveBeenCalled();
    expect(await screen.findByText('确认删除 3 条记录？')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '删除' }));

    await waitFor(() => {
      expect(onRun).toHaveBeenCalledWith(3);
    });
  });

  it('does not run the action when cancelled', async () => {
    const onRun = vi.fn();

    render(<ConfirmActionHarness onRun={onRun} />);

    fireEvent.click(screen.getByRole('button', { name: '打开确认' }));
    expect(await screen.findByText('确认删除 3 条记录？')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '取消' }));

    await waitFor(() => {
      expect(screen.queryByText('确认删除 3 条记录？')).not.toBeInTheDocument();
    });
    expect(onRun).not.toHaveBeenCalled();
  });
});

it('retains confirmation on rejection and allows a retry without exposing raw errors', async () => {
  const run = vi
    .fn()
    .mockRejectedValueOnce(new Error('private details'))
    .mockResolvedValueOnce(undefined);
  render(<ConfirmActionHarness onRun={run} />);
  fireEvent.click(screen.getByRole('button', { name: '打开确认' }));
  fireEvent.click(await screen.findByRole('button', { name: '删除' }));
  await waitFor(() =>
    expect(screen.getByRole('alert')).toHaveTextContent('请求未能完成，请稍后重试。')
  );
  expect(screen.getByRole('alert')).not.toHaveTextContent('private details');
  expect(toast.error).not.toHaveBeenCalled();
  expect(screen.getByText('确认删除 3 条记录？')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '删除' }));
  await waitFor(() => expect(screen.queryByText('确认删除 3 条记录？')).not.toBeInTheDocument());
  expect(run).toHaveBeenCalledTimes(2);
});

it('blocks repeated confirmation and closing while the operation is pending', async () => {
  let finish!: () => void;
  const run = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      })
  );
  render(<ConfirmActionHarness onRun={run} />);
  fireEvent.click(screen.getByRole('button', { name: '打开确认' }));
  const confirm = await screen.findByRole('button', { name: '删除' });
  fireEvent.click(confirm);
  fireEvent.click(confirm);
  fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
  expect(run).toHaveBeenCalledOnce();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  finish();
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
});
