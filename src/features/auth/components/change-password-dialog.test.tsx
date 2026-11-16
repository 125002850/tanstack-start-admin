import { useState } from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChangePasswordDialog } from './change-password-dialog';

const { changePassword, notifySuccess } = vi.hoisted(() => ({
  changePassword: vi.fn(),
  notifySuccess: vi.fn()
}));

vi.mock('@/lib/api/clients/service', () => ({
  changeCurrentStaffPassword: changePassword
}));
vi.mock('sonner', () => ({ toast: { success: notifySuccess, error: vi.fn() } }));

function Harness() {
  const [open, setOpen] = useState(true);
  return (
    <>
      <button onClick={() => setOpen(true)}>重新打开</button>
      <ChangePasswordDialog open={open} onOpenChange={setOpen} />
    </>
  );
}

async function fillPasswords(user: ReturnType<typeof userEvent.setup>, repeat = ' new-secret ') {
  await user.type(screen.getByLabelText('当前密码'), ' old-secret ');
  await user.type(screen.getByLabelText('新密码'), ' new-secret ');
  await user.type(screen.getByLabelText('确认新密码'), repeat);
}

beforeEach(() => {
  vi.clearAllMocks();
  changePassword.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('change password dialog', () => {
  it('validates required fields and confirmation, then clears errors as values are corrected', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: '修改密码' }));
    expect(await screen.findByText('请输入当前密码')).toBeVisible();
    expect(changePassword).not.toHaveBeenCalled();
    await fillPasswords(user, 'different');
    expect(await screen.findByText('两次输入的新密码不一致')).toBeVisible();
    await user.clear(screen.getByLabelText('确认新密码'));
    await user.type(screen.getByLabelText('确认新密码'), ' new-secret ');
    await waitFor(() =>
      expect(screen.queryByText('两次输入的新密码不一致')).not.toBeInTheDocument()
    );
    await user.click(screen.getByRole('button', { name: '修改密码' }));
    await waitFor(() => expect(notifySuccess).toHaveBeenCalledWith('密码修改成功'));
    expect(changePassword).toHaveBeenCalledWith({
      oldPassword: ' old-secret ',
      newPassword: ' new-secret ',
      repeatPassword: ' new-secret '
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '重新打开' }));
    expect(screen.getByLabelText('当前密码')).toHaveValue('');
    expect(screen.getByLabelText('新密码')).toHaveValue('');
  });

  it('revalidates confirmation when the new password changes before submitting', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.type(screen.getByLabelText('新密码'), 'new-secret');
    expect(screen.queryByText('两次输入的新密码不一致')).not.toBeInTheDocument();
    const confirmation = screen.getByLabelText('确认新密码');
    await user.type(confirmation, 'new-secret');
    await user.type(screen.getByLabelText('新密码'), '-changed');
    expect(await screen.findByText('两次输入的新密码不一致')).toBeVisible();
    expect(confirmation).toHaveAttribute('aria-invalid', 'true');
    expect(confirmation).toHaveValue('new-secret');

    await user.clear(screen.getByLabelText('新密码'));
    await user.type(screen.getByLabelText('新密码'), 'new-secret');
    await waitFor(() =>
      expect(screen.queryByText('两次输入的新密码不一致')).not.toBeInTheDocument()
    );
    expect(confirmation).toHaveAttribute('aria-invalid', 'false');

    await user.type(screen.getByLabelText('新密码'), '-changed');
    expect(await screen.findByText('两次输入的新密码不一致')).toBeVisible();
    await user.type(confirmation, '-changed');
    await waitFor(() =>
      expect(screen.queryByText('两次输入的新密码不一致')).not.toBeInTheDocument()
    );
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('retains values and shows a safe inline error on rejection', async () => {
    const user = userEvent.setup();
    changePassword.mockRejectedValue({
      code: 3004008,
      causeBody: { code: 3004008, msg: '当前密码不正确，请重新输入' }
    });
    render(<Harness />);
    await fillPasswords(user);
    await user.click(screen.getByRole('button', { name: '修改密码' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('当前密码不正确，请重新输入');
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(screen.getByLabelText('新密码')).toHaveValue(' new-secret ');
    expect(notifySuccess).not.toHaveBeenCalled();
  });

  it('blocks repeated submits and closing while the request is pending', async () => {
    const user = userEvent.setup();
    let resolve: () => void = () => {};
    changePassword.mockReturnValue(
      new Promise<void>((done) => {
        resolve = done;
      })
    );
    render(<Harness />);
    await fillPasswords(user);
    await user.click(screen.getByRole('button', { name: '修改密码' }));
    expect(screen.getByRole('button', { name: '修改密码' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '显示当前密码' })).toBeDisabled();
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    expect(changePassword).toHaveBeenCalledTimes(1);
    await act(async () => resolve());
  });

  it('supports password visibility and clears values and visibility on cancellation', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await fillPasswords(user);
    expect(screen.getByLabelText('当前密码')).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: '显示当前密码' }));
    expect(screen.getByLabelText('当前密码')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('新密码')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('确认新密码')).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: '隐藏当前密码' }));
    expect(screen.getByLabelText('当前密码')).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: '显示新密码' }));
    await user.click(screen.getByRole('button', { name: '显示确认新密码' }));
    expect(screen.getByLabelText('新密码')).toHaveAttribute('type', 'text');
    expect(screen.getByLabelText('确认新密码')).toHaveAttribute('type', 'text');
    await user.click(screen.getByRole('button', { name: '取消' }));
    await user.click(screen.getByRole('button', { name: '重新打开' }));
    expect(screen.getByLabelText('当前密码')).toHaveValue('');
    expect(screen.getByLabelText('当前密码')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('新密码')).toHaveAttribute('type', 'password');
    expect(screen.getByLabelText('确认新密码')).toHaveAttribute('type', 'password');
    expect(changePassword).not.toHaveBeenCalled();
  });

  it('rejects using the current password as the new password', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    for (const name of ['当前密码', '新密码', '确认新密码']) {
      await user.type(screen.getByLabelText(name), 'same-password');
    }
    await user.click(screen.getByRole('button', { name: '修改密码' }));
    expect(await screen.findByText('新密码不能与当前密码相同')).toBeVisible();
    expect(changePassword).not.toHaveBeenCalled();
  });
});
