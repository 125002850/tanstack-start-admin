import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Icons } from './icons';
import { Button } from './ui/button';
import { Dialog, DialogContent, DialogTitle } from './ui/dialog';
import { useOverlayLifecycle } from './ui/overlay-lifecycle';
import type { ImagePreviewController, ImagePreviewStatus } from './image-preview-runtime';
import './image-preview.css';

export type ImagePreviewItem = {
  /** 同一组图片中的稳定唯一标识。 */
  id: string;
  title?: string;
  alt?: string;
  width?: number;
  height?: number;
} & ({ src: string; load?: never } | { src?: never; load: (signal: AbortSignal) => Promise<Blob> });

export type ImagePreviewProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 用 useMemo 保持数组稳定；更换分组或鉴权上下文时传入新数组，重建预览会话。 */
  images: readonly ImagePreviewItem[];
  index?: number;
  onIndexChange?: (index: number) => void;
  title?: string;
  /** 由调用方提供下载、打开原始链接等工具栏操作。 */
  actions?: ReactNode;
  onCloseAutoFocus?: (event: Event) => void;
};

/** URL 与鉴权 Blob 共用的图片预览；只读取当前图片，不保留跨会话缓存。 */
export function ImagePreview({ open, index = 0, ...props }: ImagePreviewProps) {
  if (!open || props.images.length === 0) return null;
  const safeIndex = Math.max(
    0,
    Math.min(Number.isFinite(index) ? Math.trunc(index) : 0, props.images.length - 1)
  );
  return <ImagePreviewSession {...props} index={safeIndex} />;
}

function ImagePreviewSession({
  images,
  index,
  onIndexChange,
  onOpenChange,
  title = '图片预览',
  actions,
  onCloseAutoFocus
}: Omit<ImagePreviewProps, 'open' | 'index'> & { index: number }) {
  const [opener] = useState(() =>
    document.activeElement instanceof HTMLElement ? document.activeElement : null
  );
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [activeIndex, setActiveIndex] = useState(index);
  const [status, setStatus] = useState<ImagePreviewStatus>({ state: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const controller = useRef<ImagePreviewController | null>(null);
  const callbacks = useRef({ index, onIndexChange, onOpenChange });
  useLayoutEffect(() => {
    callbacks.current = { index, onIndexChange, onOpenChange };
  }, [index, onIndexChange, onOpenChange]);

  const close = useCallback(() => {
    controller.current?.destroy();
    callbacks.current.onOpenChange(false);
  }, []);
  useOverlayLifecycle(true, close);

  useEffect(() => {
    if (!container) return;
    let cancelled = false;
    let preview: ImagePreviewController | undefined;
    setStatus({ state: 'loading' });
    void import('./image-preview-runtime')
      .then(({ createImagePreview }) => {
        if (cancelled) return;
        preview = createImagePreview({
          container,
          images,
          index: callbacks.current.index,
          onStatusChange: setStatus,
          onIndexChange: (next) => {
            setActiveIndex(next);
            if (next !== callbacks.current.index) callbacks.current.onIndexChange?.(next);
          },
          onClose: () => callbacks.current.onOpenChange(false)
        });
        controller.current = preview;
      })
      .catch(() => {
        if (!cancelled) setStatus({ state: 'error', message: '图片预览加载失败，请重试。' });
      });
    return () => {
      cancelled = true;
      preview?.destroy();
      controller.current = null;
    };
  }, [attempt, container, images]);

  useEffect(() => {
    controller.current?.goTo(index);
  }, [index]);

  const image = images[activeIndex];
  const filename = image?.title || image?.alt || '图片';
  return (
    <Dialog open onOpenChange={(open) => !open && close()}>
      <DialogContent
        className='image-preview-dialog h-dvh w-screen max-w-none gap-0 rounded-none border-0 p-0 sm:max-w-none'
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          onCloseAutoFocus?.(event);
          if (event.defaultPrevented) return;
          event.preventDefault();
          if (opener?.isConnected) opener.focus({ preventScroll: true });
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing || event.altKey || event.ctrlKey || event.metaKey)
            return;
          if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
            event.preventDefault();
            event.stopPropagation();
            controller.current?.goTo(activeIndex + (event.key === 'ArrowLeft' ? -1 : 1));
          }
        }}
      >
        <DialogTitle className='sr-only'>{title}</DialogTitle>
        <div ref={setContainer} className='image-preview-host absolute inset-0' />
        <div className='bg-background/90 pointer-events-none absolute inset-x-0 top-0 flex min-w-0 items-center gap-3 p-4 pr-12'>
          <p className='min-w-0 flex-1 truncate text-sm' title={filename}>
            {filename}
          </p>
          {actions && (
            <div className='pointer-events-auto flex shrink-0 items-center gap-2'>{actions}</div>
          )}
          <Button
            variant='ghost'
            size='icon'
            className='pointer-events-auto'
            aria-label='缩放图片'
            disabled={status.state !== 'ready'}
            onClick={() => controller.current?.toggleZoom()}
          >
            <Icons.zoomIn aria-hidden className='size-4' />
          </Button>
        </div>
        {status.state !== 'ready' && (
          <div className='pointer-events-none absolute inset-0 flex items-center justify-center p-6'>
            <div
              role={status.state === 'error' ? 'alert' : 'status'}
              className='bg-background pointer-events-auto flex max-w-full flex-col items-center gap-3 rounded-lg border p-6 text-center text-sm wrap-anywhere'
            >
              <p>{status.state === 'error' ? status.message : '正在读取图片…'}</p>
              {status.state === 'error' && (
                <Button
                  variant='outline'
                  size='sm'
                  onClick={() => {
                    if (controller.current) controller.current.retry();
                    else setAttempt((value) => value + 1);
                  }}
                >
                  重试
                </Button>
              )}
            </div>
          </div>
        )}
        <div className='bg-background/90 absolute inset-x-0 bottom-0 flex items-center justify-center gap-3 p-4'>
          <Button
            variant='outline'
            size='icon'
            aria-label='上一张图片'
            disabled={activeIndex === 0}
            onClick={() => controller.current?.goTo(activeIndex - 1)}
          >
            <Icons.chevronLeft aria-hidden className='size-4' />
          </Button>
          <span aria-live='polite' className='text-muted-foreground text-sm tabular-nums'>
            {activeIndex + 1} / {images.length}
          </span>
          <Button
            variant='outline'
            size='icon'
            aria-label='下一张图片'
            disabled={activeIndex === images.length - 1}
            onClick={() => controller.current?.goTo(activeIndex + 1)}
          >
            <Icons.chevronRight aria-hidden className='size-4' />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
