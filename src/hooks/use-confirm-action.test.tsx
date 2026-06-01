import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import * as React from 'react';

import { useConfirmAction } from '@/hooks/use-confirm-action';

function ConfirmActionHarness({
  onRun
}: {
  onRun: (count: number) => void | Promise<void>;
}) {
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
