import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TagsBar from './tags-bar';
import { useWorkspacePageRegistryStore } from '@/features/workspace-tabs/utils/page-registry';
import { useWorkspaceTabStore } from '@/features/workspace-tabs/utils/store';

const headerSource = readFileSync(join(process.cwd(), 'src/components/layout/header.tsx'), 'utf8');

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
      openOrActivate: store.openOrActivate,
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
  openTab('/dashboard/users', 'Users');
  openTab('/dashboard/chat', 'Chat');
}

describe('TagsBar', () => {
  beforeEach(() => {
    resetStore();
    cleanup();
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
    expect(tab).toHaveClass('bg-card', 'text-card-foreground');
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
      '[scrollbar-width:none]',
      '[-ms-overflow-style:none]',
      '[&::-webkit-scrollbar]:hidden'
    );
    expect(scrollArea).toHaveClass('relative', 'min-w-0');
  });

  it('home tab has no close button', () => {
    openTab('/dashboard/overview', '仪表盘', { closable: false });
    render(<TagsBar />);

    expect(screen.queryByRole('button', { name: /Close 仪表盘/ })).not.toBeInTheDocument();
  });

  it('closable tabs show a close button', () => {
    openTab('/dashboard/chat', 'Chat');
    render(<TagsBar />);

    expect(screen.getByRole('button', { name: /Close Chat/ })).toBeInTheDocument();
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
    expect(ids).toEqual(['/dashboard/overview', '/dashboard/users', '/dashboard/chat']);
    expect(screen.getByRole('tab', { name: /仪表盘/ })).toHaveAttribute('data-pinned', 'home');
  });
});
