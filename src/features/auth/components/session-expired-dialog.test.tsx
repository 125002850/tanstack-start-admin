import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { sessionExpiryStore } from '@/lib/api/sso/session-expiry';
import { SessionExpiredDialog } from './session-expired-dialog';
const confirm = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/sso/session', () => ({ confirmSessionExpired: () => confirm() }));
beforeEach(() => {
  sessionExpiryStore.setState({ expired: false, logoutUrl: null, redirecting: false });
  confirm.mockImplementation(() => sessionExpiryStore.setState({ redirecting: true }));
});
afterEach(cleanup);
it('shows one mandatory dialog and requires confirmation, even when expiry predates mount', async () => {
  const user = userEvent.setup();
  sessionExpiryStore.setState({ expired: true });
  render(<SessionExpiredDialog />);
  expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
  expect(confirm).not.toHaveBeenCalled();
  await user.keyboard('{Escape}');
  const overlay = document.querySelector('[data-slot="alert-dialog-overlay"]')!;
  fireEvent.pointerDown(overlay);
  fireEvent.click(overlay);
  expect(screen.getByRole('alertdialog')).toBeVisible();
  expect(screen.queryByRole('button', { name: '取消' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: '确认' }));
  expect(confirm).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('button', { name: '确认' })).toBeDisabled();
});
it('does not show during first entry and reacts to expiry after mounting', () => {
  render(<SessionExpiredDialog />);
  expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  act(() => sessionExpiryStore.setState({ expired: true }));
  expect(screen.getByRole('alertdialog')).toBeVisible();
});
