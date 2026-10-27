import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { FilePreview } from './file-preview';
import { stubImagePreviewBrowser } from '@/test/fixtures/image-preview-browser';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

it('retains the full filename and only shows its tooltip when visually truncated', async () => {
  const user = userEvent.setup();
  const name = 'production-infrastructure-report-2026.pdf';
  const onRemove = vi.fn();
  render(
    <FilePreview files={[{ id: 'report', name, type: 'application/pdf' }]} onRemove={onRemove} />
  );
  const filename = screen.getByText(name);
  Object.defineProperties(filename, { clientWidth: { value: 100 }, scrollWidth: { value: 300 } });
  await user.hover(filename);
  expect(await screen.findByRole('tooltip')).toHaveTextContent(name);
  await user.click(screen.getByRole('button', { name: `Remove ${name}` }));
  expect(onRemove).toHaveBeenCalledWith('report');
});

it('点击缩略图预览同组可用图片，上传中不可打开，删除操作不触发预览', async () => {
  stubImagePreviewBrowser();
  const user = userEvent.setup();
  const onRemove = vi.fn();
  const files = [
    { id: 'first', name: '第一张.png', type: 'image/png', url: 'blob:caller-first' },
    {
      id: 'uploading',
      name: '上传中.png',
      type: 'image/png',
      url: 'blob:caller-uploading',
      isUploading: true
    },
    { id: 'pdf', name: '清单.pdf', type: 'application/pdf' },
    {
      id: 'second',
      name: '第二张.webp',
      type: 'application/octet-stream',
      url: 'blob:caller-second'
    }
  ];
  const { rerender } = render(<FilePreview files={files} onRemove={onRemove} />);
  expect(screen.getByRole('button', { name: '预览 上传中.png' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Remove 第一张.png' }));
  expect(onRemove).toHaveBeenCalledExactlyOnceWith('first');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const opener = screen.getByRole('button', { name: '预览 第二张.webp' });
  await user.click(opener);
  const preview = await screen.findByRole('dialog', { name: '图片预览' });
  expect(within(preview).getByText('2 / 2')).toBeVisible();
  expect(await within(preview).findByRole('img', { name: '第二张.webp' })).toHaveAttribute(
    'src',
    'blob:caller-second'
  );
  await user.keyboard('{ArrowLeft}');
  expect(await within(preview).findByRole('img', { name: '第一张.png' })).toHaveAttribute(
    'src',
    'blob:caller-first'
  );
  await user.keyboard('{Escape}');
  await waitFor(() => expect(opener).toHaveFocus());
  await user.click(opener);
  await screen.findByRole('dialog', { name: '图片预览' });
  rerender(
    <FilePreview files={files.filter((file) => file.id !== 'second')} onRemove={onRemove} />
  );
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  rerender(<FilePreview files={files} onRemove={onRemove} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
