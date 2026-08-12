import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TagsBar from './tags-bar';
import type { WorkspaceTab, WorkspaceTabId } from '@/features/workspace-tabs/types';
import type { WorkspacePageOverlaySnapshot } from '@/features/workspace-tabs/utils/page-overlays';
import { useWorkspacePageRegistryStore } from '@/features/workspace-tabs/utils/page-registry';
import { useWorkspaceTabStore } from '@/features/workspace-tabs/utils/store';

const headerSource = readFileSync(join(process.cwd(), 'src/components/layout/header.tsx'), 'utf8');
const tagInteractionMocks = vi.hoisted(() => ({
  captureActivePageOverlays:
    vi.fn<(nextTabId: WorkspaceTabId) => WorkspacePageOverlaySnapshot | null>(),
  openOrActivate:
    vi.fn<(tab: WorkspaceTab, snapshot?: WorkspacePageOverlaySnapshot | null) => void>()
}));

vi.mock('@/components/ui/context-menu', () => ({
  ContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  ContextMenuContent: () => null,
  ContextMenuItem: () => null,
  ContextMenuSeparator: () => null
}));

vi.mock('@/features/workspace-tabs/hooks/use-workspace-tags', () => ({
  useWorkspaceTags: () => {
    const store = useWorkspaceTabStore();
    return {
      tabs: store.tabs,
      activeId: store.activeId,
      openedOrder: store.openedOrder,
      lifecycleSnapshots: store.lifecycleSnapshots ?? {},
      captureActivePageOverlays: tagInteractionMocks.captureActivePageOverlays,
      openOrActivate: (tab: WorkspaceTab, snapshot?: WorkspacePageOverlaySnapshot | null) => {
        tagInteractionMocks.openOrActivate(tab, snapshot);
        store.openOrActivate(tab);
      },
      close: (id: string) => {
        const tab = store.tabs[id];
        if (!tab || tab.href === '/dashboard/overview') return;
        store.close(id);
      },
      closeOther: store.closeOther,
      closeAll: store.closeAll,
      refresh: (_id: string) => {},
      touch: store.touch,
      evictInactive: store.evictInactive
    };
  }
}));

vi.mock('@/components/icons', () => ({
  Icons: {
    close: () => <span data-testid='icon-close' />
  }
}));

afterEach(() => {
  cleanup();
});

function resetStore() {
  useWorkspaceTabStore.setState({
    tabs: {},
    activeId: null,
    openedOrder: [],
    disabledKeepAliveIds: new Set(),
    lifecycleSnapshots: {}
  });
  useWorkspacePageRegistryStore.getState().resetDescriptors();
}

function openTab(
  id: string,
  title: string,
  options?: {
    closable?: boolean;
    keepAlive?: boolean;
  }
) {
  useWorkspaceTabStore.getState().openOrActivate({
    id,
    href: id,
    title,
    closable: options?.closable ?? true,
    keepAlive: options?.keepAlive ?? false
  });
}

function setupHomeAndChat() {
  openTab('/dashboard/overview', '仪表盘', { closable: false });
  openTab('/dashboard/chat', 'Chat');
}

function setupThreeTabs() {
  openTab('/dashboard/overview', '仪表盘', { closable: false });
  openTab('/dashboard/system-management/dictionaries', 'Dictionaries');
  openTab('/dashboard/chat', 'Chat');
}

function setViewportMetrics(
  viewport: HTMLElement,
  metrics: { clientWidth: number; scrollWidth: number; scrollLeft: number }
) {
  Object.defineProperty(viewport, 'clientWidth', {
    configurable: true,
    value: metrics.clientWidth
  });
  Object.defineProperty(viewport, 'scrollWidth', {
    configurable: true,
    value: metrics.scrollWidth
  });
  Object.defineProperty(viewport, 'scrollLeft', {
    configurable: true,
    writable: true,
    value: metrics.scrollLeft
  });
}

describe('TagsBar', () => {
  beforeEach(() => {
    resetStore();
    cleanup();
    tagInteractionMocks.captureActivePageOverlays.mockReset();
    tagInteractionMocks.captureActivePageOverlays.mockReturnValue(null);
    tagInteractionMocks.openOrActivate.mockReset();
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn()
    });
  });

  it('renders tabs in openedOrder', () => {
    setupHomeAndChat();
    render(<TagsBar />);

    expect(screen.getByRole('tab', { name: /仪表盘/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Chat/ })).toBeInTheDocument();
  });

  it('imports the explicit tags-bar directory entry from Header to avoid stale single-file resolution', () => {
    expect(headerSource).toContain("import TagsBar from './tags-bar/index';");
  });

  it('marks the active tab with aria-selected', () => {
    openTab('/dashboard/overview', '仪表盘', { closable: false });
    render(<TagsBar />);

    const tab = screen.getByRole('tab', { name: /仪表盘/ });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(tab.closest('[data-slot="workspace-tag-shell"]')).toHaveClass(
      'bg-card',
      'text-card-foreground'
    );
  });

  it('uses a native horizontal scroll viewport with hidden scrollbars', () => {
    openTab('/dashboard/overview', '仪表盘', { closable: false });
    render(<TagsBar />);

    const tablist = screen.getByRole('tablist', { name: 'Workspace tabs' });
    const viewport = tablist.closest('[data-slot="scroll-area-viewport"]');
    const scrollArea = tablist.closest('[data-slot="scroll-area"]');

    expect(viewport).toBeInTheDocument();
    expect(scrollArea).toBeInTheDocument();
    expect(viewport).toHaveClass(
      'overflow-x-auto',
      'overflow-y-hidden',
      'scroll-px-10',
      '[scrollbar-width:none]',
      '[-ms-overflow-style:none]',
      '[&::-webkit-scrollbar]:hidden'
    );
    expect(scrollArea).toHaveClass('relative', 'min-w-0');
  });

  it('scrolls the complete active tab shell into view', async () => {
    setupHomeAndChat();
    render(<TagsBar />);

    const activeTab = screen.getByRole('tab', { name: /Chat/ });
    const activeShell = activeTab.closest('[data-slot="workspace-tag-shell"]');
    const scrollIntoView = vi.mocked(HTMLElement.prototype.scrollIntoView);

    await waitFor(() => {
      expect(scrollIntoView).toHaveBeenCalledWith({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest'
      });
    });
    expect(scrollIntoView.mock.contexts.at(-1)).toBe(activeShell);
  });

  it('scrolls a newly opened active tab after its visual item is mounted', async () => {
    openTab('/dashboard/overview', '仪表盘', { closable: false });
    render(<TagsBar />);

    const scrollIntoView = vi.mocked(HTMLElement.prototype.scrollIntoView);
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());
    scrollIntoView.mockClear();

    act(() => {
      openTab('/dashboard/chat', 'Chat');
    });

    const newTab = await screen.findByRole('tab', { name: /Chat/ });
    const newTabShell = newTab.closest('[data-slot="workspace-tag-shell"]');
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalled());

    expect(scrollIntoView.mock.contexts.at(-1)).toBe(newTabShell);
  });

  it('shows theme-aware edge hints only when horizontal content is clipped', () => {
    setupThreeTabs();
    render(<TagsBar />);

    const tablist = screen.getByRole('tablist', { name: 'Workspace tabs' });
    const viewport = tablist.closest('[data-slot="scroll-area-viewport"]') as HTMLElement;
    const leftHint = document.querySelector(
      '[data-slot="workspace-tabs-overflow-left"]'
    ) as HTMLElement;
    const rightHint = document.querySelector(
      '[data-slot="workspace-tabs-overflow-right"]'
    ) as HTMLElement;
    const leftSurface = document.querySelector(
      '[data-slot="workspace-tabs-overflow-left-surface"]'
    ) as HTMLElement;
    const rightSurface = document.querySelector(
      '[data-slot="workspace-tabs-overflow-right-surface"]'
    ) as HTMLElement;

    act(() => {
      setViewportMetrics(viewport, { clientWidth: 240, scrollWidth: 520, scrollLeft: 0 });
      window.dispatchEvent(new Event('resize'));
    });

    expect(leftHint).toHaveAttribute('data-visible', 'false');
    expect(rightHint).toHaveAttribute('data-visible', 'true');
    expect(leftSurface).toHaveClass('bg-gradient-to-r', 'from-background', 'to-transparent');
    expect(rightSurface).toHaveClass('bg-gradient-to-l', 'from-background', 'to-transparent');

    act(() => {
      viewport.scrollLeft = 120;
      fireEvent.scroll(viewport);
    });

    expect(leftHint).toHaveAttribute('data-visible', 'true');
    expect(rightHint).toHaveAttribute('data-visible', 'true');

    act(() => {
      viewport.scrollLeft = 280;
      fireEvent.scroll(viewport);
    });

    expect(leftHint).toHaveAttribute('data-visible', 'true');
    expect(rightHint).toHaveAttribute('data-visible', 'false');
  });

  it('home tab has no close button', () => {
    openTab('/dashboard/overview', '仪表盘', { closable: false });
    render(<TagsBar />);

    expect(screen.queryByRole('button', { name: '关闭：仪表盘' })).not.toBeInTheDocument();
  });

  it('uses sibling native close buttons with an accessible 24px target', () => {
    openTab('/dashboard/system-management/dictionaries', 'Dictionaries');
    openTab('/dashboard/chat', 'Chat');
    render(<TagsBar />);

    const inactiveClose = screen.getByRole('button', { name: '关闭：Dictionaries' });
    const activeClose = screen.getByRole('button', { name: '关闭：Chat' });

    expect(inactiveClose).toHaveAttribute('type', 'button');
    expect(inactiveClose).toHaveClass('opacity-0', 'group-hover:opacity-50', 'size-6');
    expect(activeClose).toHaveClass('opacity-50', 'size-6');
    expect(activeClose.closest('[role="tab"]')).toBeNull();

    fireEvent.click(inactiveClose);
    expect(
      useWorkspaceTabStore.getState().tabs['/dashboard/system-management/dictionaries']
    ).toBeUndefined();
  });

  it('uses the tab surface as the drag activator without rendering a handle', () => {
    setupHomeAndChat();
    render(<TagsBar />);

    const chatTab = screen.getByRole('tab', { name: 'Chat' });
    const homeTab = screen.getByRole('tab', { name: '仪表盘' });

    expect(document.querySelector('[data-slot="workspace-tag-drag-handle"]')).toBeNull();
    expect(chatTab).toHaveClass('cursor-grab', 'active:cursor-grabbing');
    expect(homeTab).not.toHaveClass('cursor-grab');
  });

  it('ArrowLeft and ArrowRight move focus across opened tabs', () => {
    setupHomeAndChat();
    render(<TagsBar />);

    const tabs = screen.getAllByRole('tab');
    tabs[0]?.focus();
    fireEvent.keyDown(tabs[0]!, { key: 'ArrowRight' });
    expect(document.activeElement).toBe(tabs[1]);

    fireEvent.keyDown(tabs[1]!, { key: 'ArrowLeft' });
    expect(document.activeElement).toBe(tabs[0]);
  });

  it('Enter activates the focused tab', () => {
    setupHomeAndChat();
    render(<TagsBar />);

    const tabs = screen.getAllByRole('tab');
    const overview = tabs[0]!;
    overview.focus();
    fireEvent.keyDown(overview, { key: 'Enter' });

    expect(useWorkspaceTabStore.getState().activeId).toBe('/dashboard/overview');
  });

  it('captures active page overlays on pointerdown and passes the snapshot to activation', async () => {
    const user = userEvent.setup();
    setupHomeAndChat();
    const snapshot: WorkspacePageOverlaySnapshot = {
      tabId: '/dashboard/chat'
    };
    tagInteractionMocks.captureActivePageOverlays.mockReturnValue(snapshot);
    render(<TagsBar />);

    const overview = screen.getByRole('tab', { name: /仪表盘/ });
    await user.click(overview);

    expect(tagInteractionMocks.captureActivePageOverlays).toHaveBeenCalledWith(
      '/dashboard/overview'
    );
    expect(tagInteractionMocks.openOrActivate).toHaveBeenCalledWith(
      expect.objectContaining({ id: '/dashboard/overview' }),
      snapshot
    );
    expect(tagInteractionMocks.captureActivePageOverlays.mock.invocationCallOrder[0]).toBeLessThan(
      tagInteractionMocks.openOrActivate.mock.invocationCallOrder[0]!
    );
  });

  it('Delete closes closable tabs', () => {
    setupHomeAndChat();
    render(<TagsBar />);

    const tabs = screen.getAllByRole('tab');
    tabs[1]?.focus();
    fireEvent.keyDown(tabs[1]!, { key: 'Delete' });

    expect(useWorkspaceTabStore.getState().tabs['/dashboard/chat']).toBeUndefined();
  });

  it('Delete does not close the home tab', () => {
    openTab('/dashboard/overview', '仪表盘', { closable: false });
    render(<TagsBar />);

    const tab = screen.getByRole('tab', { name: /仪表盘/ });
    tab.focus();
    fireEvent.keyDown(tab, { key: 'Delete' });

    expect(useWorkspaceTabStore.getState().tabs['/dashboard/overview']).toBeDefined();
  });

  it('shows the dirty indicator when lifecycle marks a tab as dirty', () => {
    openTab('/dashboard/chat', 'Chat');
    useWorkspaceTabStore.setState({
      lifecycleSnapshots: {
        '/dashboard/chat': { title: 'Chat', dirty: true }
      }
    });
    render(<TagsBar />);

    expect(screen.getByLabelText(/Chat has unsaved changes/)).toBeInTheDocument();
  });

  it('keeps the home tab pinned first and preserves the store order for other tabs', () => {
    setupThreeTabs();
    render(<TagsBar />);

    const ids = screen.getAllByRole('tab').map((tab) => tab.getAttribute('data-tab-id'));
    expect(ids).toEqual([
      '/dashboard/overview',
      '/dashboard/system-management/dictionaries',
      '/dashboard/chat'
    ]);
    expect(screen.getByRole('tab', { name: /仪表盘/ })).toHaveAttribute('data-pinned', 'home');
  });
});
