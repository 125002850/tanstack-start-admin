import { useContext, createContext, useMemo } from 'react';
import type { UseWorkspacePageResult } from '../types';

type WorkspacePageLifecycleChannel = Omit<UseWorkspacePageResult, 'active'>;

const fallbackLifecycleChannel: WorkspacePageLifecycleChannel = {
  tabId: '',
  updateLifecycle: () => {}
};

/** Context channels injected by ActivityHost (WorkspaceViewport). */
export const WorkspacePageLifecycleContext = createContext<WorkspacePageLifecycleChannel | null>(
  null
);
export const WorkspacePageActiveContext = createContext(true);

/**
 * Stable lifecycle channel for pages that do not render from workspace visibility.
 * Keeping this separate from `active` prevents an entire page from re-rendering
 * whenever its workspace tab is hidden or restored.
 */
export function useWorkspacePageLifecycle(): WorkspacePageLifecycleChannel {
  return useContext(WorkspacePageLifecycleContext) ?? fallbackLifecycleChannel;
}

/**
 * Provides the page lifecycle channel for a page instance hosted by ActivityHost.
 *
 * Reads the stable lifecycle channel plus the independently changing activity
 * channel. Consumers that do not render from `active` should use
 * useWorkspacePageLifecycle() to avoid visibility-only re-renders.
 */
export function useWorkspacePage(): UseWorkspacePageResult {
  const lifecycle = useWorkspacePageLifecycle();
  const active = useContext(WorkspacePageActiveContext);

  return useMemo(() => ({ active, ...lifecycle }), [active, lifecycle]);
}
