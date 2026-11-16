import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ApiErrorDetailsDialog } from './api-error-details-dialog';
import { apiErrorDetailsStore } from '@/lib/api/error-notification';
import { copyTextToClipboard } from '@/lib/browser/copy-text-to-clipboard';

vi.mock('@/lib/browser/copy-text-to-clipboard', () => ({ copyTextToClipboard: vi.fn() }));

afterEach(() => {
  cleanup();
  apiErrorDetailsStore.setState({ error: null });
});

it('shows safe error details, copies their code and message, and clears them on close', async () => {
  const error = {
    code: 3010004,
    summary: '流程配置校验未通过',
    message: '请填写条件左值（config.subprocess.graph.nodes[21].config.conditionTree.leftValue）'
  };
  apiErrorDetailsStore.setState({ error });
  vi.mocked(copyTextToClipboard).mockResolvedValue(true);
  const user = userEvent.setup();
  render(<ApiErrorDetailsDialog />);

  const dialog = screen.getByRole('dialog', { name: error.summary });
  expect(dialog).toHaveTextContent('错误码：3010004');
  expect(dialog).toHaveTextContent(error.message);
  await user.click(screen.getByRole('button', { name: '复制详情' }));
  expect(copyTextToClipboard).toHaveBeenCalledWith(`错误码：3010004\n${error.message}`, {
    container: dialog
  });
  await user.click(screen.getByRole('button', { name: /^关闭$/ }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(apiErrorDetailsStore.getState().error).toBeNull();
});

it('allows closing details with Escape', async () => {
  apiErrorDetailsStore.setState({
    error: { code: 3003999, summary: '操作失败，请查看详情。', message: '业务校验未通过。' }
  });
  render(<ApiErrorDetailsDialog />);
  await userEvent.setup().keyboard('{Escape}');
  expect(apiErrorDetailsStore.getState().error).toBeNull();
});
