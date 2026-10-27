import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { WorkspaceDirtyConfirmState } from '../hooks/use-workspace-dirty-guard';
import { WorkspaceDirtyGuardDialog } from './workspace-dirty-guard-dialog';

afterEach(cleanup);

describe('WorkspaceDirtyGuardDialog', () => {
  it('renders navigation discard copy and confirms', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <WorkspaceDirtyGuardDialog
        confirmState={{ kind: 'navigate' }}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText('离开当前页面？')).toBeInTheDocument();
    expect(screen.getByText('放弃更改并离开')).toBeInTheDocument();

    await user.click(screen.getByText('放弃更改并离开'));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('renders close discard copy and cancels', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const onCancel = vi.fn();

    render(
      <WorkspaceDirtyGuardDialog
        confirmState={{ kind: 'close', reason: 'close-all' }}
        onCancel={onCancel}
        onConfirm={onConfirm}
      />
    );

    expect(screen.getByText('关闭页面？')).toBeInTheDocument();
    expect(screen.getByText('放弃更改并关闭')).toBeInTheDocument();

    await user.click(screen.getByText('取消'));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('does not render when there is no pending confirmation', () => {
    render(
      <WorkspaceDirtyGuardDialog confirmState={null} onCancel={vi.fn()} onConfirm={vi.fn()} />
    );

    expect(screen.queryByTestId('workspace-dirty-guard-dialog')).not.toBeInTheDocument();
  });

  it('exposes the pending kind as a typed state', () => {
    const navigateState: WorkspaceDirtyConfirmState = { kind: 'navigate' };
    const closeState: WorkspaceDirtyConfirmState = { kind: 'close', reason: 'close-current' };

    expect(navigateState.kind).toBe('navigate');
    expect(closeState.kind).toBe('close');
  });
});
