import { act, cleanup, renderHook } from '@testing-library/react';
import type { ReactFlowInstance } from '@xyflow/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useCanvas } from './use-canvas';

afterEach(cleanup);

function deferred() {
  let resolve!: (value: boolean) => void;
  const promise = new Promise<boolean>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('useCanvas', () => {
  it('allows configuration without fullscreen and keeps props and callbacks stable', () => {
    const { result, rerender } = renderHook(() =>
      useCanvas({ fullscreen: false, minZoom: 0.3, maxZoom: 2 })
    );
    const props = result.current.flowProps;
    const transition = result.current.onViewportTransition;
    expect(result.current.fullscreen).toBeNull();
    expect(props).toMatchObject({
      minZoom: 0.3,
      maxZoom: 2,
      proOptions: { hideAttribution: true }
    });
    rerender();
    expect(result.current.flowProps).toBe(props);
    expect(result.current.onViewportTransition).toBe(transition);
  });

  it('waits for the newest viewport animation, including rejected animations', async () => {
    const { result } = renderHook(() => useCanvas({ fullscreen: true }));
    const zoom = deferred();
    const fit = deferred();
    let switching!: Promise<void>;
    act(() => {
      result.current.onViewportTransition(zoom.promise);
      switching = result.current.fullscreen!.onExpandedChange(true);
      result.current.onViewportTransition(fit.promise);
    });
    await act(async () => {
      zoom.resolve(true);
      await zoom.promise;
    });
    expect(result.current.fullscreen!.expanded).toBe(false);
    await act(async () => {
      fit.resolve(true);
      await switching;
    });
    expect(result.current.fullscreen!.expanded).toBe(true);
    await act(async () => {
      result.current.onViewportTransition(Promise.reject(new Error('cancelled')));
      await result.current.fullscreen!.onExpandedChange(false);
    });
    expect(result.current.fullscreen!.expanded).toBe(false);
  });

  it('retains zoom and graph center in both directions using the latest fullscreen viewport', async () => {
    const { result } = renderHook(() => useCanvas({ fullscreen: true }));
    let viewport = { x: 20, y: -40, zoom: 0.8 };
    let size = { width: 600, height: 320 };
    const surface = document.createElement('div');
    Object.defineProperties(surface, {
      clientWidth: { get: () => size.width },
      clientHeight: { get: () => size.height }
    });
    const setViewport = vi.fn(async (next) => {
      viewport = next;
      return true;
    });
    act(() => {
      result.current.flowProps.ref.current = surface;
      result.current.flowProps.onInit({
        getViewport: () => viewport,
        setViewport
      } as unknown as ReactFlowInstance);
    });
    await act(async () => {
      await result.current.fullscreen!.onExpandedChange(true);
    });
    size = { width: 1200, height: 800 };
    act(() => result.current.fullscreen!.restoreViewport());
    expect(viewport).toEqual({ x: 320, y: 200, zoom: 0.8 });
    viewport = { x: 400, y: 100, zoom: 1.2 };
    await act(async () => {
      await result.current.fullscreen!.onExpandedChange(false);
    });
    size = { width: 600, height: 320 };
    act(() => result.current.fullscreen!.restoreViewport());
    expect(viewport).toEqual({ x: 100, y: -140, zoom: 1.2 });
  });

  it('coalesces repeated requests and cancels a pending switch after unmount', async () => {
    const { result, unmount } = renderHook(() => useCanvas({ fullscreen: true }));
    const zoom = deferred();
    let switching!: Promise<void>;
    act(() => {
      result.current.onViewportTransition(zoom.promise);
      switching = result.current.fullscreen!.onExpandedChange(true);
      void result.current.fullscreen!.onExpandedChange(true);
      void result.current.fullscreen!.onExpandedChange(false);
    });
    await act(async () => {
      zoom.resolve(true);
      await switching;
    });
    expect(result.current.fullscreen!.expanded).toBe(false);
    const second = deferred();
    act(() => {
      result.current.onViewportTransition(second.promise);
      switching = result.current.fullscreen!.onExpandedChange(true);
    });
    unmount();
    second.resolve(true);
    await switching;
    expect(document.documentElement).not.toHaveAttribute('data-canvas-view-transition');
  });
});
