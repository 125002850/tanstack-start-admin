import PhotoSwipe, { type SlideData } from 'photoswipe';
import type { ImagePreviewItem } from './image-preview';
import 'photoswipe/style.css';

export type ImagePreviewStatus =
  | { state: 'loading' | 'ready' }
  | { state: 'error'; message: string };

export type ImagePreviewController = {
  goTo: (index: number) => void;
  toggleZoom: () => void;
  retry: () => void;
  destroy: () => void;
};

type PreviewOptions = {
  container: HTMLElement;
  images: readonly ImagePreviewItem[];
  index: number;
  onIndexChange: (index: number) => void;
  onStatusChange: (status: ImagePreviewStatus) => void;
  onClose: () => void;
};

const unreadImage = (): SlideData => ({ type: 'html', html: '' });
const decodeErrorMessage = '此图片暂时无法预览，请下载后查看。';

/** PhotoSwipe 只管理图片与手势；外层 Dialog 管理模态、焦点和 Escape。 */
export function createImagePreview(options: PreviewOptions): ImagePreviewController {
  const dataSource = options.images.map(unreadImage);
  const pswp = new PhotoSwipe({
    appendToEl: options.container,
    dataSource,
    index: options.index,
    loop: false,
    preload: [0, 0],
    arrowPrev: false,
    arrowNext: false,
    zoom: false,
    close: false,
    counter: false,
    escKey: false,
    arrowKeys: false,
    trapFocus: false,
    returnFocus: false,
    showHideAnimationType: 'none',
    imageClickAction: 'zoom',
    tapAction: false,
    wheelToZoom: true,
    bgOpacity: 1,
    padding: { top: 72, bottom: 72, left: 16, right: 16 },
    getViewportSizeFn: () => ({
      x: options.container.clientWidth || window.innerWidth,
      y: options.container.clientHeight || window.innerHeight
    })
  });
  let disposed = false;
  let refreshing = false;
  let active: { index: number; abort: AbortController; url?: string } | undefined;

  function refresh(index: number) {
    // refreshSlideContent 也会同步派发 change，不将内容刷新误判为用户切图。
    refreshing = true;
    try {
      pswp.refreshSlideContent(index);
    } finally {
      refreshing = false;
    }
  }

  function releaseActive() {
    active?.abort.abort();
    if (active?.url) URL.revokeObjectURL(active.url);
    active = undefined;
  }

  function loadCurrent(force = false) {
    if (disposed || pswp.isDestroying) return;
    const index = pswp.currIndex;
    if (active?.index === index && !force) return;
    const previousIndex = active?.index;
    releaseActive();
    if (previousIndex !== undefined) {
      dataSource[previousIndex] = unreadImage();
      refresh(previousIndex);
    }
    const request = { index, abort: new AbortController(), url: undefined as string | undefined };
    active = request;
    const { signal } = request.abort;
    options.onStatusChange({ state: 'loading' });
    void (async () => {
      try {
        const image = options.images[index];
        let src = image.src;
        if (image.load) {
          const blob = await image.load(signal);
          if (signal.aborted) return;
          src = URL.createObjectURL(blob);
          request.url = src;
        }
        if (!src) throw new Error('图片地址为空');
        const dimensions =
          validDimension(image.width) && validDimension(image.height)
            ? { width: image.width, height: image.height }
            : await readDimensions(src, signal);
        if (signal.aborted) return;
        dataSource[index] = { src, ...dimensions, alt: image.alt || image.title || '图片' };
        options.onStatusChange({ state: 'ready' });
        // 使用公开 API 重建 slide，让 PhotoSwipe 按真实宽高计算缩放与平移边界。
        refresh(index);
      } catch (error) {
        if (signal.aborted) return;
        if (request.url) URL.revokeObjectURL(request.url);
        request.url = undefined;
        options.onStatusChange({
          state: 'error',
          message:
            error instanceof ImageDecodeError
              ? decodeErrorMessage
              : `图片加载失败：${error instanceof Error ? error.message : '读取失败'}`
        });
      }
    })();
  }

  pswp.on('change', () => {
    if (refreshing) return;
    options.onIndexChange(pswp.currIndex);
    loadCurrent();
  });
  pswp.on('afterInit', () => {
    pswp.element?.removeAttribute('role');
    pswp.element?.setAttribute('data-slot', 'image-preview-viewer');
  });
  pswp.on('contentLoadImage', ({ content }) => {
    content.element?.setAttribute('referrerpolicy', 'no-referrer');
  });
  pswp.on('loadError', ({ content }) => {
    if (!disposed && content.index === pswp.currIndex)
      options.onStatusChange({ state: 'error', message: decodeErrorMessage });
  });
  // 邻图 slide 仅放空 HTML；即使 PhotoSwipe 创建相邻 slide，也不发起图片读取。
  pswp.on('close', () => {
    releaseActive();
    if (!disposed) options.onClose();
  });
  pswp.init();
  // Dialog 的尺寸可能在 PhotoSwipe 绑定 window resize 前改变，或独立于窗口变化。
  const resizeObserver = new ResizeObserver(() => {
    if (!disposed && !pswp.isDestroying) pswp.updateSize(true);
  });
  resizeObserver.observe(options.container);

  return {
    goTo: (index) => {
      if (!disposed) pswp.goTo(Math.max(0, Math.min(Math.trunc(index), options.images.length - 1)));
    },
    toggleZoom: () => pswp.toggleZoom(),
    retry: () => loadCurrent(true),
    destroy: () => {
      if (disposed) return;
      disposed = true;
      resizeObserver.disconnect();
      releaseActive();
      pswp.destroy();
    }
  };
}

function validDimension(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value) && value > 0;
}

class ImageDecodeError extends Error {}

function readDimensions(src: string, signal: AbortSignal) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    image.referrerPolicy = 'no-referrer';
    const cleanup = () => {
      image.removeEventListener('load', loaded);
      image.removeEventListener('error', failed);
      signal.removeEventListener('abort', abort);
    };
    const abort = () => {
      cleanup();
      image.src = '';
      reject(new DOMException('图片读取已取消', 'AbortError'));
    };
    const loaded = () => {
      cleanup();
      if (image.naturalWidth > 0 && image.naturalHeight > 0)
        resolve({ width: image.naturalWidth, height: image.naturalHeight });
      else reject(new ImageDecodeError());
    };
    const failed = () => {
      cleanup();
      reject(new ImageDecodeError());
    };
    image.addEventListener('load', loaded, { once: true });
    image.addEventListener('error', failed, { once: true });
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    else image.src = src;
  });
}
