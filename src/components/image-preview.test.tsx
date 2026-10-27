import { StrictMode, useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { stubImagePreviewBrowser } from '@/test/fixtures/image-preview-browser';
import { ImagePreview, type ImagePreviewItem } from './image-preview';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { OverlayLifecycleProvider, type OverlayLifecycleRegistrar } from './ui/overlay-lifecycle';

const createUrl = vi.fn();
const revokeUrl = vi.fn();

beforeEach(() => {
  stubImagePreviewBrowser();
  createUrl.mockImplementation(() => `blob:preview-${createUrl.mock.calls.length}`);
  vi.stubGlobal(
    'URL',
    class extends URL {
      static createObjectURL = createUrl;
      static revokeObjectURL = revokeUrl;
    }
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function Preview({ images, start = 0 }: { images: readonly ImagePreviewItem[]; start?: number }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(start);
  return (
    <>
      <button onClick={() => setOpen(true)}>查看图片</button>
      <ImagePreview
        images={images}
        open={open}
        onOpenChange={setOpen}
        index={index}
        onIndexChange={setIndex}
      />
    </>
  );
}

it('关闭时不读取图片，URL 自动探测尺寸，切换和关闭不释放调用方 URL', async () => {
  const user = userEvent.setup();
  const images: ImagePreviewItem[] = [
    { id: 'first', src: '/first.png', alt: '第一张' },
    { id: 'second', src: '/second.png', alt: '第二张', width: 800, height: 600 }
  ];
  render(<Preview images={images} />);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const opener = screen.getByRole('button', { name: '查看图片' });
  await user.click(opener);
  const preview = await screen.findByRole('dialog', { name: '图片预览' });
  expect(await within(preview).findByRole('img', { name: '第一张' })).toHaveAttribute(
    'src',
    '/first.png'
  );
  expect(within(preview).getByRole('img', { name: '第一张' })).toHaveAttribute(
    'referrerpolicy',
    'no-referrer'
  );
  await user.click(within(preview).getByRole('button', { name: '下一张图片' }));
  expect(await within(preview).findByRole('img', { name: '第二张' })).toHaveAttribute(
    'src',
    '/second.png'
  );
  await user.keyboard('{Escape}');
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  await waitFor(() => expect(opener).toHaveFocus());
  expect(createUrl).not.toHaveBeenCalled();
  expect(revokeUrl).not.toHaveBeenCalled();
});

it('只读取当前 Blob，快速切图取消旧请求，忽略迟到结果并在卸载时释放 URL', async () => {
  const user = userEvent.setup();
  let resolveFirst!: (blob: Blob) => void;
  const first = vi.fn(
    (_signal: AbortSignal) => new Promise<Blob>((resolve) => (resolveFirst = resolve))
  );
  const second = vi.fn(async () => new Blob(['second'], { type: 'image/png' }));
  const images: ImagePreviewItem[] = [
    { id: 'first', load: first, alt: '第一张' },
    { id: 'second', load: second, alt: '第二张' }
  ];
  const { unmount } = render(<Preview images={images} />);
  expect(first).not.toHaveBeenCalled();
  expect(second).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: '查看图片' }));
  await waitFor(() => expect(first).toHaveBeenCalledOnce());
  expect(second).not.toHaveBeenCalled();
  const signal: AbortSignal = first.mock.calls[0][0];
  await user.click(screen.getByRole('button', { name: '下一张图片' }));
  await screen.findByRole('img', { name: '第二张' });
  expect(signal.aborted).toBe(true);
  resolveFirst(new Blob(['late']));
  await waitFor(() => expect(createUrl).toHaveBeenCalledOnce());
  unmount();
  expect(revokeUrl).toHaveBeenCalledExactlyOnceWith('blob:preview-1');
});

it('读取与解码失败均可重试，错误和文件名按纯文本展示', async () => {
  const user = userEvent.setup();
  const load = vi
    .fn()
    .mockRejectedValueOnce(new Error('<img src=x onerror=alert(1)>'))
    .mockResolvedValue(new Blob(['image'], { type: 'image/png' }));
  const images: ImagePreviewItem[] = [{ id: 'image', load, alt: '<script>图片</script>' }];
  render(<Preview images={images} />);
  await user.click(screen.getByRole('button', { name: '查看图片' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('<img src=x onerror=alert(1)>');
  expect(document.querySelector('img[src="x"]')).toBeNull();
  await user.click(screen.getByRole('button', { name: '重试' }));
  const image = await screen.findByRole('img', { name: '<script>图片</script>' });
  fireEvent.error(image);
  expect(await screen.findByRole('alert')).toHaveTextContent('此图片暂时无法预览');
  await user.click(screen.getByRole('button', { name: '重试' }));
  await waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument());
  expect(load).toHaveBeenCalledTimes(3);
  expect(document.querySelector('script')).toBeNull();
});

it('嵌套 Dialog 中 Escape 只关闭预览，焦点返回原按钮', async () => {
  const user = userEvent.setup();
  const images: ImagePreviewItem[] = [{ id: 'image', src: '/image.png', alt: '图片' }];
  render(
    <Dialog open>
      <DialogContent aria-describedby={undefined}>
        <DialogTitle>外层详情</DialogTitle>
        <Preview images={images} />
      </DialogContent>
    </Dialog>
  );
  const opener = await screen.findByRole('button', { name: '查看图片' });
  await user.click(opener);
  await screen.findByRole('img', { name: '图片' });
  await user.keyboard('{Escape}');
  await waitFor(() =>
    expect(screen.queryByRole('dialog', { name: '图片预览' })).not.toBeInTheDocument()
  );
  expect(screen.getByRole('dialog', { name: '外层详情' })).toBeVisible();
  await waitFor(() => expect(opener).toHaveFocus());
});

it('StrictMode 与页面失活清理会取消请求，不在关闭后重新创建预览', async () => {
  const user = userEvent.setup();
  const load = vi.fn((_signal: AbortSignal) => new Promise<Blob>(() => {}));
  const images: ImagePreviewItem[] = [{ id: 'image', load }];
  let dismiss: (() => void) | undefined;
  const registerOverlay: OverlayLifecycleRegistrar = (close) => {
    dismiss = close;
    return () => {
      dismiss = undefined;
    };
  };
  render(
    <StrictMode>
      <OverlayLifecycleProvider registerOverlay={registerOverlay}>
        <Preview images={images} />
      </OverlayLifecycleProvider>
    </StrictMode>
  );
  await user.click(screen.getByRole('button', { name: '查看图片' }));
  await waitFor(() => expect(load).toHaveBeenCalledOnce());
  const signal = load.mock.calls[0][0];
  expect(dismiss).toBeTypeOf('function');
  act(() => dismiss?.());
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(signal.aborted).toBe(true);
  expect(createUrl).not.toHaveBeenCalled();
  expect(document.querySelector('[data-slot="image-preview-viewer"]')).toBeNull();
});

it('支持初始已知尺寸、外部 index 更新以及边界索引，空图片组不创建浮层', async () => {
  const images: ImagePreviewItem[] = [
    { id: 'first', src: '/first.png', alt: '第一张', width: 800, height: 600 },
    { id: 'second', src: '/second.png', alt: '第二张', width: 1200, height: 900 }
  ];
  const onOpenChange = vi.fn();
  const { rerender } = render(
    <ImagePreview open images={images} index={-1} onOpenChange={onOpenChange} />
  );
  await screen.findByRole('img', { name: '第一张' });
  expect(screen.getByRole('button', { name: '上一张图片' })).toBeDisabled();
  rerender(<ImagePreview open images={images} index={99} onOpenChange={onOpenChange} />);
  await screen.findByRole('img', { name: '第二张' });
  expect(screen.getByRole('button', { name: '下一张图片' })).toBeDisabled();
  rerender(<ImagePreview open images={[]} onOpenChange={onOpenChange} />);
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  expect(onOpenChange).not.toHaveBeenCalled();
});
