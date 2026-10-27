import { vi } from 'vitest';

/** jsdom 不解码图片；只补齐尺寸探测，PhotoSwipe 与实际 DOM 仍使用真实实现。 */
export function stubImagePreviewBrowser() {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: true }))
  );
  vi.stubGlobal(
    'Image',
    class extends EventTarget {
      naturalWidth = 1600;
      naturalHeight = 1200;
      set src(value: string) {
        if (value) queueMicrotask(() => this.dispatchEvent(new Event('load')));
      }
    }
  );
}
