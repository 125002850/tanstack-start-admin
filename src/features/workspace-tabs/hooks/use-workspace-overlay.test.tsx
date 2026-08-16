import { cleanup, render } from '@testing-library/react';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { closeRegisteredWorkspaceOverlays } from '../utils/workspace-overlay-registry';
import { resetWorkspacePageOverlays } from '../utils/page-overlays';
import { WorkspacePageLifecycleContext } from './use-workspace-page';
import { useWorkspaceOverlay } from './use-workspace-overlay';

function Probe({ open, close }: { open: boolean; close: () => void }) {
  useWorkspaceOverlay(open, close);
  return null;
}

const lifecycleChannel = { tabId: '/dashboard/a', updateLifecycle: () => {} };

function renderInWorkspace(ui: React.ReactNode) {
  return render(
    <WorkspacePageLifecycleContext.Provider value={lifecycleChannel}>
      {ui}
    </WorkspacePageLifecycleContext.Provider>
  );
}

describe('useWorkspaceOverlay', () => {
  afterEach(() => {
    cleanup();
    resetWorkspacePageOverlays();
  });

  it('registers while open and closes through the registry', () => {
    const close = vi.fn();

    renderInWorkspace(<Probe open close={close} />);

    expect(closeRegisteredWorkspaceOverlays('/dashboard/a')).toBe(1);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('unregisters when the overlay closes', () => {
    const close = vi.fn();
    const { rerender } = renderInWorkspace(<Probe open close={close} />);

    rerender(
      <WorkspacePageLifecycleContext.Provider value={lifecycleChannel}>
        <Probe open={false} close={close} />
      </WorkspacePageLifecycleContext.Provider>
    );

    expect(closeRegisteredWorkspaceOverlays('/dashboard/a')).toBe(0);
    expect(close).not.toHaveBeenCalled();
  });

  it('unregisters on unmount', () => {
    const close = vi.fn();
    const { unmount } = renderInWorkspace(<Probe open close={close} />);

    unmount();

    expect(closeRegisteredWorkspaceOverlays('/dashboard/a')).toBe(0);
  });

  it('no-ops outside a workspace page', () => {
    const close = vi.fn();

    render(<Probe open close={close} />);

    expect(closeRegisteredWorkspaceOverlays('')).toBe(0);
    expect(close).not.toHaveBeenCalled();
  });
});
