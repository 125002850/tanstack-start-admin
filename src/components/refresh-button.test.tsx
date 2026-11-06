import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { RefreshButton } from './refresh-button';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('RefreshButton', () => {
  it('shows a tooltip and spins until the refresh finishes, ignoring repeated clicks', async () => {
    let complete!: () => void;
    const onRefresh = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          complete = resolve;
        })
    );
    const user = userEvent.setup();
    render(<RefreshButton label='刷新字段' onRefresh={onRefresh} />);
    const button = screen.getByRole('button', { name: '刷新字段' });
    expect(button.textContent).toBe('');
    await user.hover(button);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('刷新字段');
    await user.unhover(button);

    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('svg')).toHaveClass('animate-spin');

    await act(async () => complete());
    await waitFor(() => expect(button).toBeEnabled());
    expect(button).toHaveAttribute('aria-busy', 'false');
    expect(button.querySelector('svg')).not.toHaveClass('animate-spin');
  });

  it('keeps fast refresh feedback visible for 400ms', async () => {
    vi.useFakeTimers();
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<RefreshButton onRefresh={onRefresh} />);
    const button = screen.getByRole('button', { name: '刷新' });
    fireEvent.click(button);

    await act(async () => vi.advanceTimersByTimeAsync(399));
    expect(onRefresh).toHaveBeenCalledOnce();
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button.querySelector('svg')).toHaveClass('animate-spin');

    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('aria-busy', 'false');
    expect(button.querySelector('svg')).not.toHaveClass('animate-spin');
  });

  it('waits for a slow request and stops without another feedback delay', async () => {
    vi.useFakeTimers();
    let complete!: () => void;
    render(
      <RefreshButton
        onRefresh={() =>
          new Promise<void>((resolve) => {
            complete = resolve;
          })
        }
      />
    );
    const button = screen.getByRole('button', { name: '刷新' });
    fireEvent.click(button);
    await act(async () => vi.advanceTimersByTimeAsync(1000));
    expect(button).toHaveAttribute('aria-busy', 'true');
    expect(button).toBeDisabled();

    await act(async () => complete());
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('aria-busy', 'false');
  });

  it.each(['rejected promise', 'synchronous exception'])(
    'recovers from a %s without an unhandled rejection and allows retry',
    async (failure) => {
      const error = new Error('refresh failed');
      const onRefresh = vi.fn<() => Promise<unknown>>(() => {
        if (failure === 'synchronous exception') throw error;
        return Promise.reject(error);
      });
      const user = userEvent.setup();
      render(<RefreshButton onRefresh={onRefresh} />);
      const button = screen.getByRole('button', { name: '刷新' });

      await user.click(button);
      await waitFor(() => expect(button).toBeEnabled());
      expect(button).toHaveAttribute('aria-busy', 'false');
      expect(button.querySelector('svg')).not.toHaveClass('animate-spin');

      onRefresh.mockResolvedValue(undefined);
      await user.click(button);
      expect(onRefresh).toHaveBeenCalledTimes(2);
      await waitFor(() => expect(button).toBeEnabled());
    }
  );

  it('supports a text label and preserves an external disabled constraint', async () => {
    const onRefresh = vi.fn().mockResolvedValue(undefined);
    render(<RefreshButton disabled label='刷新预览' onRefresh={onRefresh} size='sm' />);
    const button = screen.getByRole('button', { name: '刷新预览' });
    expect(button).toHaveTextContent('刷新预览');
    expect(button).toHaveAttribute('type', 'button');
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(onRefresh).not.toHaveBeenCalled();
  });
});
