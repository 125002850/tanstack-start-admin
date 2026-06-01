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
  keepAlive?: boolean;
  closable?: boolean;
  render: () => React.ReactNode;
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
