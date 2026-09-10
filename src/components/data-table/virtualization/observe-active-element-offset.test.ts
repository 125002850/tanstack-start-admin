import { afterEach, expect, it, vi } from 'vitest';
import { Virtualizer, observeElementOffset } from '@tanstack/react-virtual';
import { observeActiveElementOffset } from './observe-active-element-offset';

afterEach(() => vi.useRealTimers());

it('ignores a removed subscription debounce after a new observer records a different offset', () => {
  vi.useFakeTimers();
  const element = document.createElement('div');
  const instance = new Virtualizer<HTMLDivElement, HTMLDivElement>({
    count: 1,
    getScrollElement: () => element,
    estimateSize: () => 48,
    scrollToFn: () => {},
    observeElementRect: () => {},
    observeElementOffset
  });
  instance.scrollElement = element;
  instance.targetWindow = window;
  const oldCallback = vi.fn();
  const currentCallback = vi.fn();
  const stopOld = observeActiveElementOffset(instance, oldCallback);
  element.scrollTop = 100;
  element.dispatchEvent(new Event('scroll'));
  stopOld?.();
  const stopCurrent = observeActiveElementOffset(instance, currentCallback);
  element.scrollTop = 200;
  element.dispatchEvent(new Event('scroll'));
  vi.advanceTimersByTime(200);
  expect(oldCallback).toHaveBeenCalledExactlyOnceWith(100, true);
  expect(currentCallback).toHaveBeenLastCalledWith(200, false);
  stopCurrent?.();
});
