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

    registerWorkspaceOverlay('/a', closeA);
    registerWorkspaceOverlay('/a', closeB);

    expect(closeRegisteredWorkspaceOverlays('/a')).toBe(2);
    expect(closeA).toHaveBeenCalledTimes(1);
    expect(closeB).toHaveBeenCalledTimes(1);

    // 关闭后条目清空，重复调用无事发生
    expect(closeRegisteredWorkspaceOverlays('/a')).toBe(0);
    expect(closeA).toHaveBeenCalledTimes(1);
  });

  it('does not close an overlay after unregister', () => {
    const close = vi.fn();
    const unregister = registerWorkspaceOverlay('/a', close);

    unregister();

    expect(closeRegisteredWorkspaceOverlays('/a')).toBe(0);
    expect(close).not.toHaveBeenCalled();
  });

  it('keeps registrations isolated per tab', () => {
    const closeA = vi.fn();
    const closeB = vi.fn();

    registerWorkspaceOverlay('/a', closeA);
    registerWorkspaceOverlay('/b', closeB);

    closeRegisteredWorkspaceOverlays('/a');

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

    registerWorkspaceOverlay('/a', closeA);
    registerWorkspaceOverlay('/a', closeB);

    expect(closeRegisteredWorkspaceOverlays('/a')).toBe(2);
    expect(closeB).toHaveBeenCalledTimes(1);
    expect(consoleError).toHaveBeenCalled();
  });

  it('closes registered overlays before the empty-snapshot short-circuit', () => {
    const close = vi.fn();
    registerWorkspaceOverlay('/registered-only', close);

    const dismissResult = dismissWorkspacePageOverlays('/registered-only', null);

    expect(close).toHaveBeenCalledTimes(1);
    expect(dismissResult.hasPendingExit).toBe(false);
  });

  it('resets through the page overlay reset entry point', () => {
    const close = vi.fn();
    registerWorkspaceOverlay('/a', close);

    resetWorkspaceOverlayRegistry();

    expect(closeRegisteredWorkspaceOverlays('/a')).toBe(0);
    expect(close).not.toHaveBeenCalled();
  });
  it('releases an empty tab entry after the final unregister', () => {
    const unregister = registerWorkspaceOverlay('/a', vi.fn());
    const deleteEntry = vi.spyOn(Map.prototype, 'delete');
    unregister();
    expect(deleteEntry).toHaveBeenCalledWith('/a');
  });

  it('closes the initial snapshot even when a callback unregisters another overlay', () => {
    let unregisterB: () => void = vi.fn();
    const closeA = vi.fn(() => unregisterB());
    const closeB = vi.fn();
    registerWorkspaceOverlay('/a', closeA);
    unregisterB = registerWorkspaceOverlay('/a', closeB);

    expect(closeRegisteredWorkspaceOverlays('/a')).toBe(2);
    expect(closeA).toHaveBeenCalledOnce();
    expect(closeB).toHaveBeenCalledOnce();
  });

  it('preserves a replacement registration when old callbacks clean up reentrantly', () => {
    const replacement = vi.fn();
    let unregisterOld: () => void = vi.fn();
    unregisterOld = registerWorkspaceOverlay('/a', () => {
      registerWorkspaceOverlay('/a', replacement);
      unregisterOld();
    });

    expect(closeRegisteredWorkspaceOverlays('/a')).toBe(1);
    expect(replacement).not.toHaveBeenCalled();
    // Repeated cleanup from the previous generation cannot delete the replacement.
    unregisterOld();
    expect(closeRegisteredWorkspaceOverlays('/a')).toBe(1);
    expect(replacement).toHaveBeenCalledOnce();
  });
});
