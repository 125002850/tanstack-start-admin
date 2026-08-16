import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  closeRegisteredWorkspaceOverlays,
  registerWorkspaceOverlay,
  resetWorkspaceOverlayRegistry
} from './workspace-overlay-registry';
import { dismissWorkspacePageOverlays, resetWorkspacePageOverlays } from './page-overlays';

describe('workspace overlay registry', () => {
  afterEach(() => {
    resetWorkspacePageOverlays();
    vi.restoreAllMocks();
  });

  it('closes registered overlays for a tab and reports the entry count', () => {
    const closeA = vi.fn();
    const closeB = vi.fn();

    registerWorkspaceOverlay('/dashboard/a', closeA);
    registerWorkspaceOverlay('/dashboard/a', closeB);

    expect(closeRegisteredWorkspaceOverlays('/dashboard/a')).toBe(2);
    expect(closeA).toHaveBeenCalledTimes(1);
    expect(closeB).toHaveBeenCalledTimes(1);

    // 关闭后条目清空，重复调用无事发生
    expect(closeRegisteredWorkspaceOverlays('/dashboard/a')).toBe(0);
    expect(closeA).toHaveBeenCalledTimes(1);
  });

  it('does not close an overlay after unregister', () => {
    const close = vi.fn();
    const unregister = registerWorkspaceOverlay('/dashboard/a', close);

    unregister();

    expect(closeRegisteredWorkspaceOverlays('/dashboard/a')).toBe(0);
    expect(close).not.toHaveBeenCalled();
  });

  it('keeps registrations isolated per tab', () => {
    const closeA = vi.fn();
    const closeB = vi.fn();

    registerWorkspaceOverlay('/dashboard/a', closeA);
    registerWorkspaceOverlay('/dashboard/b', closeB);

    closeRegisteredWorkspaceOverlays('/dashboard/a');

    expect(closeA).toHaveBeenCalledTimes(1);
    expect(closeB).not.toHaveBeenCalled();
  });

  it('treats an empty tab id as a no-op registration', () => {
    const close = vi.fn();
    const unregister = registerWorkspaceOverlay('', close);

    expect(closeRegisteredWorkspaceOverlays('')).toBe(0);
    expect(unregister()).toBeUndefined();
    expect(close).not.toHaveBeenCalled();
  });

  it('keeps closing remaining overlays when one close callback throws', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const closeA = vi.fn(() => {
      throw new Error('boom');
    });
    const closeB = vi.fn();

    registerWorkspaceOverlay('/dashboard/a', closeA);
    registerWorkspaceOverlay('/dashboard/a', closeB);

    expect(closeRegisteredWorkspaceOverlays('/dashboard/a')).toBe(2);
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();
  });

  it('closes registered overlays before the empty-snapshot short-circuit', () => {
    const close = vi.fn();
    registerWorkspaceOverlay('/dashboard/registered-only', close);

    const dismissResult = dismissWorkspacePageOverlays('/dashboard/registered-only', null);

    expect(close).toHaveBeenCalledTimes(1);
    expect(dismissResult.hasPendingExit).toBe(false);
  });

  it('resets through the page overlay reset entry point', () => {
    const close = vi.fn();
    registerWorkspaceOverlay('/dashboard/a', close);

    resetWorkspaceOverlayRegistry();

    expect(closeRegisteredWorkspaceOverlays('/dashboard/a')).toBe(0);
    expect(close).not.toHaveBeenCalled();
  });
});
