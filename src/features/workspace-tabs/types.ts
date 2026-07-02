// ─── V2 page lifecycle types ───

export type WorkspaceTabId = string;

export interface WorkspaceTab {
  id: WorkspaceTabId;
  href: string;
  title: string;
  closable: boolean;
  keepAlive: boolean;
  lastVisitedAt: number;
}

export interface WorkspaceTabSnapshot {
  tabs: WorkspaceTab[];
  activeId: WorkspaceTabId | null;
  openedOrder: WorkspaceTabId[];
}

export interface WorkspaceTabOpenInput {
  id: WorkspaceTabId;
  href: string;
  title: string;
  closable?: boolean;
  keepAlive?: boolean;
}

// ─── Boundary & lifecycle types ───

export interface WorkspacePageBoundaryProps {
  tabId?: string;
  initialTitle?: string;
  /**
   * @deprecated Prefer route metadata `workspace.keepAlive`.
   * Kept as a compatibility fallback for legacy or non-route callers.
   */
  keepAlive?: boolean;
  /**
   * @deprecated Prefer route metadata `workspace.closable`.
   * Kept as a compatibility fallback for legacy or non-route callers.
   */
  closable?: boolean;
  /**
   * Workspace-on tree registered into ActivityHost.
   * Business pages should pass the Screen component that owns PageContainer.
   */
  render: () => React.ReactNode;
  /**
   * Workspace-off direct route tree. Use this when render wraps the actual
   * route body in a workspace Screen shell, while disabled mode should render
   * the body directly.
   */
  renderWhenDisabled?: () => React.ReactNode;
  errorFallback?: React.ReactNode;
}

export interface WorkspacePageLifecyclePatch {
  title?: string;
  dirty?: boolean;
  closeGuard?: (context: {
    tabId: string;
    reason: 'close-current' | 'close-other' | 'close-all';
  }) => boolean | Promise<boolean>;
}

export interface UseWorkspacePageResult {
  active: boolean;
  tabId: string;
  updateLifecycle: (patch: WorkspacePageLifecyclePatch) => void;
}

export interface WorkspacePageLifecycle {
  title: string;
  dirty: boolean;
  closeGuard?: (context: {
    tabId: string;
    reason: 'close-current' | 'close-other' | 'close-all';
  }) => boolean | Promise<boolean>;
}

export interface WorkspacePageDescriptor {
  tabId: WorkspaceTabId;
  initialTitle: string;
  keepAlive: boolean;
  closable: boolean;
  render: () => React.ReactNode;
  errorFallback?: React.ReactNode;
}
