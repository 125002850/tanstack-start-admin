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

it.each([false, true])('ignores scrolls on the other axis (horizontal: %s)', (horizontal) => {
  vi.useFakeTimers();
  const element = document.createElement('div');
  const instance = new Virtualizer<HTMLDivElement, HTMLDivElement>({
    count: 100,
    horizontal,
    getScrollElement: () => element,
    estimateSize: () => 48,
    scrollToFn: () => {},
    observeElementRect: () => {},
    observeElementOffset
  });
  instance.scrollElement = element;
  instance.targetWindow = window;
  const callback = vi.fn();
  const stop = observeActiveElementOffset(instance, callback);
  const currentAxis = horizontal ? 'scrollLeft' : 'scrollTop';
  const otherAxis = horizontal ? 'scrollTop' : 'scrollLeft';

  element[otherAxis] = 300;
  element.dispatchEvent(new Event('scroll'));
  vi.advanceTimersByTime(200);
  expect(callback).not.toHaveBeenCalled();

  element[currentAxis] = 100;
  element.dispatchEvent(new Event('scroll'));
  element[otherAxis] = 600;
  element.dispatchEvent(new Event('scroll'));
  expect(callback).toHaveBeenCalledExactlyOnceWith(100, true);
  vi.advanceTimersByTime(200);
  expect(callback.mock.calls).toEqual([
    [100, true],
    [100, false]
  ]);
  stop?.();
});

it('finishes stale scrolling state when Activity restores a subscription', () => {
  const element = document.createElement('div');
  const instance = new Virtualizer<HTMLDivElement, HTMLDivElement>({
    count: 100,
    getScrollElement: () => element,
    estimateSize: () => 48,
    scrollToFn: () => {},
    observeElementRect: () => {},
    observeElementOffset
  });
  instance.scrollElement = element;
  instance.targetWindow = window;
  instance.scrollOffset = 2400;
  instance.isScrolling = true;
  const callback = vi.fn();
  const stop = observeActiveElementOffset(instance, callback);
  expect(callback).toHaveBeenCalledExactlyOnceWith(2400, false);
  stop?.();
});
