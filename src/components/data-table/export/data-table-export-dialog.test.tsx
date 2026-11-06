import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { DataTableExportDialog } from './data-table-export-dialog';

afterEach(cleanup);

it('explains unavailable package export on hover while keeping range errors visible', async () => {
  const user = userEvent.setup();
  const onConfirmRange = vi.fn();
  const onOpenChange = vi.fn();
  render(
    <DataTableExportDialog
      open
      total={100}
      labels={{ packageUnavailableText: '当前列表仅支持 CSV 导出。' }}
      onOpenChange={onOpenChange}
      onConfirmRange={onConfirmRange}
    />
  );
  const dialog = screen.getByRole('dialog', { name: '选择导出方式' });
  expect(screen.getByRole('button', { name: '打包导出' })).toBeDisabled();
  expect(screen.queryByText('当前列表仅支持 CSV 导出。')).not.toBeInTheDocument();
  await user.hover(screen.getByRole('group', { name: '当前列表仅支持 CSV 导出。' }));
  expect(await within(dialog).findByRole('tooltip')).toHaveTextContent('当前列表仅支持 CSV 导出。');
  await user.keyboard('{Escape}');
  expect(dialog).toBeVisible();
  expect(onOpenChange).not.toHaveBeenCalled();

  fireEvent.change(screen.getByRole('spinbutton', { name: '起始序号' }), {
    target: { value: '101' }
  });
  expect(screen.getByRole('alert')).toHaveTextContent('起止序号不能超过当前结果总数 100。');
  expect(screen.getByRole('button', { name: '确认导出' })).toBeDisabled();
  expect(onConfirmRange).not.toHaveBeenCalled();
});

it('keeps package export clickable without a disabled reason', async () => {
  const user = userEvent.setup();
  const onPackageExport = vi.fn();
  render(
    <DataTableExportDialog
      open
      total={100}
      onOpenChange={vi.fn()}
      onPackageExport={onPackageExport}
    />
  );
  await user.click(screen.getByRole('button', { name: '打包导出' }));
  expect(onPackageExport).toHaveBeenCalledOnce();
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
