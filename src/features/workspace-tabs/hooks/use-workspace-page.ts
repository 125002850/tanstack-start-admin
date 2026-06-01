import { useContext, createContext } from 'react';
import type { UseWorkspacePageResult } from '../types';

/**
 * Context injected by ActivityHost (WorkspaceViewport).
 * Each rendered page is wrapped in a Provider that carries the full
 * lifecycle channel — { tabId, updateLifecycle } — so the page receives
 * its owning tabId and a store-backed updater without coupling to the
 * router pathname.
 */
export const WorkspacePageContext = createContext<UseWorkspacePageResult | null>(null);

/**
 * Provides the page lifecycle channel for a page instance hosted by ActivityHost.
 *
 * Reads { tabId, updateLifecycle } from WorkspacePageContext, which is injected
 * by the viewport. This guarantees lifecycle updates always target the correct
 * tab — even when the page is rendered hidden (keep-alive) or in a
 * multi-instance scenario where the current router pathname would be wrong.
 */
export function useWorkspacePage(): UseWorkspacePageResult {
  const ctx = useContext(WorkspacePageContext);
  if (!ctx) {
    return { tabId: '', updateLifecycle: () => {} };
  }
  return ctx;
}
