import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  getDataTableCellAutoScrollDelta,
  intersectDataTableCellClientRects,
  normalizeDataTableCellScrollLeft,
  resolveDataTableCellAutoScrollMetrics,
  useDataTableCellAutoScroll
} from './use-data-table-cell-auto-scroll';

const originalRequestAnimationFrame = window.requestAnimationFrame;
const originalCancelAnimationFrame = window.cancelAnimationFrame;

afterEach(() => {
  window.requestAnimationFrame = originalRequestAnimationFrame;
  window.cancelAnimationFrame = originalCancelAnimationFrame;
});

describe('DataTable cell auto scroll', () => {
  it('derives clamped edge and speed metrics from the focus cell size', () => {
    expect(resolveDataTableCellAutoScrollMetrics(10)).toEqual({
      edgeThreshold: 24,
      minSpeed: 3,
      maxSpeed: 12
    });
    expect(resolveDataTableCellAutoScrollMetrics(100)).toEqual({
      edgeThreshold: 56,
      minSpeed: 6.4,
      maxSpeed: 32
    });
  });

  it('intersects the viewport with clipping ancestor and visual viewport rects', () => {
    expect(
      intersectDataTableCellClientRects([
        { left: 0, top: 0, right: 500, bottom: 400 },
        { left: 20, top: 10, right: 450, bottom: 350 },
        { left: 0, top: 30, right: 420, bottom: 360 }
      ])
    ).toEqual({ left: 20, top: 30, right: 420, bottom: 350 });
  });

  it('reads non-enumerable DOMRect boundary getters explicitly', () => {
    expect(
      intersectDataTableCellClientRects([
        new DOMRect(0, 0, 500, 400),
        { left: 20, top: 10, right: 450, bottom: 350 }
      ])
    ).toEqual({ left: 20, top: 10, right: 450, bottom: 350 });
  });

  it('calculates bounded diagonal deltas only inside edge hot zones', () => {
    const rect = { left: 0, top: 0, right: 200, bottom: 100 };

    expect(getDataTableCellAutoScrollDelta({ clientX: 100, clientY: 50 }, rect, 40)).toEqual({
      left: 0,
      top: 0
    });
    expect(getDataTableCellAutoScrollDelta({ clientX: 0, clientY: 100 }, rect, 40)).toEqual({
      left: -20,
      top: 20
    });
  });

  it('normalizes LTR and both common RTL scrollLeft representations', () => {
    expect(normalizeDataTableCellScrollLeft(30, 100, 'ltr', 'negative')).toBe(30);
    expect(normalizeDataTableCellScrollLeft(-30, 100, 'rtl', 'negative')).toBe(30);
    expect(normalizeDataTableCellScrollLeft(70, 100, 'rtl', 'reverse')).toBe(30);
  });

  it('drives one RAF loop and cancels it on stop and unmount', () => {
    let frame: FrameRequestCallback | null = null;
    const requestAnimationFrame = vi.fn((callback: FrameRequestCallback) => {
      frame = callback;
      return 9;
    });
    const cancelAnimationFrame = vi.fn();
    window.requestAnimationFrame = requestAnimationFrame;
    window.cancelAnimationFrame = cancelAnimationFrame;

    const viewport = document.createElement('div');
    Object.defineProperties(viewport, {
      clientWidth: { value: 200 },
      clientHeight: { value: 100 },
      scrollWidth: { value: 500 },
      scrollHeight: { value: 400 }
    });
    Object.defineProperty(viewport, 'scrollLeft', { value: 100, writable: true });
    Object.defineProperty(viewport, 'scrollTop', { value: 100, writable: true });
    viewport.getBoundingClientRect = () =>
      ({ left: 0, top: 0, right: 200, bottom: 100, width: 200, height: 100 }) as DOMRect;
    viewport.scrollBy = vi.fn();
    document.body.appendChild(viewport);

    const viewportRef = { current: viewport };
    const onScrollFrame = vi.fn();
    const { result, unmount } = renderHook(() =>
      useDataTableCellAutoScroll({ viewportRef, onScrollFrame })
    );

    act(() => result.current.updatePointer({ clientX: 200, clientY: 100, cellSize: 40 }));
    expect(requestAnimationFrame).toHaveBeenCalledOnce();

    act(() => frame?.(0));
    expect(viewport.scrollBy).toHaveBeenCalledWith({ behavior: 'auto', left: 20, top: 20 });
    expect(onScrollFrame).toHaveBeenCalledWith({ clientX: 200, clientY: 100 });

    act(() => result.current.stop());
    expect(cancelAnimationFrame).toHaveBeenCalled();
    unmount();
    viewport.remove();
  });
});
