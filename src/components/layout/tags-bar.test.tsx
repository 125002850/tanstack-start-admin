import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import TagsBar from './tags-bar';
import { useWorkspaceTabStore } from '@/features/workspace-tabs/utils/store';

vi.mock('@dnd-kit/core', async () => {
  const actual = await vi.importActual<typeof import('@dnd-kit/core')>('@dnd-kit/core');

  return {
    ...actual,
    DragOverlay: ({
      children,
      className,
      dropAnimation
    }: {
      children?: ReactNode;
      className?: string;
      dropAnimation?: unknown;
    }) => (
      <div
        data-slot='mock-drag-overlay'
        data-has-drop-animation={dropAnimation == null ? 'false' : 'true'}
        className={className}
      >
        {children}
      </div>
    )
  };
});

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

vi.mock('@tanstack/react-router', () => ({
  useRouter: () => ({ navigate: vi.fn() }),
  useRouterState: () => ({})
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function resetStore() {
  useWorkspaceTabStore.setState({
    tabs: {},
    activeId: null,
    openedOrder: [],
    disabledKeepAliveIds: new Set(),
    pageDescriptors: {},
    lifecycleSnapshots: {}
  });
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

function getWorkspaceTagById(id: string) {
  return document.querySelector<HTMLElement>(`[data-slot="workspace-tag"][data-tab-id="${id}"]`);
}

function getVisualOrder() {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-slot="workspace-tag"]')).map((node) =>
    node.getAttribute('data-tab-id')
  );
}

function mockHorizontalTagRects() {
  const tags = Array.from(document.querySelectorAll<HTMLElement>('[data-slot="workspace-tag"]'));
  tags.forEach((tag, index) => {
    const left = index * 140;
    const rect = {
      x: left,
      y: 0,
      left,
      top: 0,
      right: left + 120,
      bottom: 28,
      width: 120,
      height: 28,
      toJSON: () => ({})
    };

    Object.defineProperty(tag, 'getBoundingClientRect', {
      configurable: true,
      value: () => rect
    });

    const wrapper = tag.parentElement;
    if (wrapper) {
      Object.defineProperty(wrapper, 'getBoundingClientRect', {
        configurable: true,
        value: () => rect
      });
    }
  });
}

function startDrag(tab: HTMLElement, nextPointerX = 180) {
  act(() => {
    fireEvent.mouseDown(tab, { button: 0, clientX: 80, clientY: 12 });
    vi.advanceTimersByTime(181);
    fireEvent.mouseMove(document, { clientX: nextPointerX, clientY: 12 });
  });
}

function finishDrag(pointerX = 180, flushTimers = true) {
  act(() => {
    fireEvent.mouseMove(document, { clientX: pointerX, clientY: 12 });
    fireEvent.mouseUp(document, { clientX: pointerX, clientY: 12 });
    if (flushTimers) {
      vi.runOnlyPendingTimers();
    }
  });
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

  it('marks active tab with aria-selected', () => {
    openTab('/dashboard/overview', '仪表盘', { closable: false });
    render(<TagsBar />);
    const tab = screen.getByRole('tab', { name: /仪表盘/ });
    expect(tab).toHaveAttribute('aria-selected', 'true');
    expect(tab).toHaveClass('bg-card', 'text-card-foreground');
  });

  it('uses ScrollArea viewport and hides the horizontal scrollbar on tags bar', () => {
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
    expect(scrollArea).toHaveClass('[&>[data-slot=scroll-area-scrollbar]]:hidden');
  });

  it('home tab has no close button', () => {
    openTab('/dashboard/overview', '仪表盘', { closable: false });
    render(<TagsBar />);
    expect(screen.queryByRole('button', { name: /Close 仪表盘/ })).not.toBeInTheDocument();
  });

  it('closable tab shows close button', () => {
    openTab('/dashboard/chat', 'Chat');
    render(<TagsBar />);
    expect(screen.getByRole('button', { name: /Close Chat/ })).toBeInTheDocument();
  });

  it('ArrowLeft and ArrowRight move focus', () => {
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

  it('Delete triggers close for closable tabs', () => {
    setupHomeAndChat();
    render(<TagsBar />);
    const tabs = screen.getAllByRole('tab');
    tabs[1]?.focus();
    fireEvent.keyDown(tabs[1]!, { key: 'Delete' });
    expect(useWorkspaceTabStore.getState().tabs['/dashboard/chat']).toBeUndefined();
  });

  it('Delete does not close home tab', () => {
    openTab('/dashboard/overview', '仪表盘', { closable: false });
    render(<TagsBar />);
    const tab = screen.getByRole('tab', { name: /仪表盘/ });
    tab.focus();
    fireEvent.keyDown(tab, { key: 'Delete' });
    expect(useWorkspaceTabStore.getState().tabs['/dashboard/overview']).toBeDefined();
  });

  it('shows dirty indicator when lifecycle marks tab as dirty', () => {
    openTab('/dashboard/chat', 'Chat');
    useWorkspaceTabStore.setState({
      lifecycleSnapshots: {
        '/dashboard/chat': { title: 'Chat', dirty: true }
      }
    });
    render(<TagsBar />);
    expect(screen.getByRole('tab', { name: /Chat/ })).toBeInTheDocument();
    expect(screen.getByLabelText(/Chat has unsaved changes/)).toBeInTheDocument();
  });

  it('marks the home tab as pinned and exposes stable data slots', () => {
    setupHomeAndChat();
    render(<TagsBar />);

    expect(screen.getByRole('tab', { name: /仪表盘/ })).toHaveAttribute('data-pinned', 'home');
    expect(screen.getByRole('tab', { name: /Chat/ })).toHaveAttribute('data-slot', 'workspace-tag');
    expect(screen.getByRole('tablist', { name: 'Workspace tabs' })).toHaveAttribute(
      'data-slot',
      'workspace-tags-bar'
    );
  });

  it('renders aria-hidden placeholder and overlay during a long-press drag', () => {
    vi.useFakeTimers();
    setupThreeTabs();
    render(<TagsBar />);
    mockHorizontalTagRects();

    startDrag(screen.getByRole('tab', { name: /Users/ }));

    expect(document.querySelector('[data-slot="workspace-tag-overlay"]')).toHaveAttribute(
      'aria-hidden',
      'true'
    );
    expect(document.querySelector('[data-slot="workspace-tag-placeholder"]')).toHaveAttribute(
      'aria-hidden',
      'true'
    );

    finishDrag();
  });

  it('does not displace the adjacent tag when drag activates before leaving the source tag', () => {
    vi.useFakeTimers();
    setupThreeTabs();
    render(<TagsBar />);
    mockHorizontalTagRects();

    const usersTab = screen.getByRole('tab', { name: /Users/ });
    const chatWrapper = getWorkspaceTagById('/dashboard/chat')?.parentElement as HTMLElement | null;

    expect(chatWrapper).not.toBeNull();

    act(() => {
      fireEvent.mouseDown(usersTab, { button: 0, clientX: 200, clientY: 12 });
      vi.advanceTimersByTime(181);
      fireEvent.mouseMove(document, { clientX: 200, clientY: 12 });
    });

    expect(document.querySelector('[data-slot="workspace-tag-placeholder"]')).toHaveAttribute(
      'data-tab-id',
      '/dashboard/users'
    );
    expect(chatWrapper?.style.transform ?? '').toBe('');

    finishDrag(200);
  });

  it('computes edge fades from the ScrollArea viewport metrics', () => {
    setupThreeTabs();
    render(<TagsBar />);

    const tablist = screen.getByRole('tablist', { name: 'Workspace tabs' });
    const viewport = tablist.closest('[data-slot="scroll-area-viewport"]') as HTMLDivElement | null;
    const shell = viewport?.closest('[data-slot="scroll-area"]')?.parentElement as HTMLElement | null;

    expect(viewport).not.toBeNull();
    expect(shell).not.toBeNull();

    let scrollLeft = 0;

    Object.defineProperties(viewport!, {
      scrollWidth: {
        configurable: true,
        get: () => 360
      },
      clientWidth: {
        configurable: true,
        get: () => 160
      },
      scrollLeft: {
        configurable: true,
        get: () => scrollLeft
      }
    });

    act(() => {
      fireEvent.scroll(viewport!);
    });
    expect(shell).not.toHaveClass('before:pointer-events-none');
    expect(shell).toHaveClass('after:pointer-events-none');

    scrollLeft = 96;
    act(() => {
      fireEvent.scroll(viewport!);
    });
    expect(shell).toHaveClass('before:pointer-events-none');
    expect(shell).toHaveClass('after:pointer-events-none');

    scrollLeft = 200;
    act(() => {
      fireEvent.scroll(viewport!);
    });
    expect(shell).toHaveClass('before:pointer-events-none');
    expect(shell).not.toHaveClass('after:pointer-events-none');
  });

  it('portals the drag overlay to document.body and keeps drop animation enabled', () => {
    vi.useFakeTimers();
    setupThreeTabs();
    render(<TagsBar />);
    mockHorizontalTagRects();

    startDrag(screen.getByRole('tab', { name: /Users/ }));

    const overlay = document.querySelector('[data-slot="mock-drag-overlay"]');

    expect(overlay).toBeInTheDocument();
    expect(overlay).toHaveAttribute('data-has-drop-animation', 'true');
    expect(overlay?.parentElement).toBe(document.body);

    finishDrag();
  });

  it('reorders non-home tabs after a completed drag', () => {
    vi.useFakeTimers();
    setupThreeTabs();
    render(<TagsBar />);
    mockHorizontalTagRects();

    startDrag(screen.getByRole('tab', { name: /Chat/ }), 145);
    finishDrag(145);

    expect(getVisualOrder()).toEqual([
      '/dashboard/overview',
      '/dashboard/chat',
      '/dashboard/users'
    ]);
  });

  it('restores the original order when dragging back to the source position before drop', () => {
    vi.useFakeTimers();
    setupThreeTabs();
    render(<TagsBar />);
    mockHorizontalTagRects();

    const chatTab = screen.getByRole('tab', { name: /Chat/ });

    act(() => {
      fireEvent.mouseDown(chatTab, { button: 0, clientX: 340, clientY: 12 });
      vi.advanceTimersByTime(181);
      fireEvent.mouseMove(document, { clientX: 200, clientY: 12 });
    });

    act(() => {
      fireEvent.mouseMove(document, { clientX: 340, clientY: 12 });
    });
    finishDrag(340);

    expect(getVisualOrder()).toEqual([
      '/dashboard/overview',
      '/dashboard/users',
      '/dashboard/chat'
    ]);
  });

  it('suppresses the immediate post-drag click', () => {
    vi.useFakeTimers();
    setupThreeTabs();
    openTab('/dashboard/overview', '仪表盘', { closable: false });
    render(<TagsBar />);
    mockHorizontalTagRects();

    startDrag(screen.getByRole('tab', { name: /Chat/ }), 240);
    finishDrag(240, false);

    expect(useWorkspaceTabStore.getState().activeId).toBe('/dashboard/overview');

    fireEvent.click(screen.getByRole('tab', { name: /Chat/ }));
    expect(useWorkspaceTabStore.getState().activeId).toBe('/dashboard/overview');
  });

  it('invalidates an in-flight drag when the active dragged tag disappears from openedOrder', async () => {
    vi.useFakeTimers();
    setupThreeTabs();
    render(<TagsBar />);
    mockHorizontalTagRects();

    startDrag(screen.getByRole('tab', { name: /Users/ }), 240);

    useWorkspaceTabStore.getState().close('/dashboard/users');
    finishDrag(240);

    expect(getWorkspaceTagById('/dashboard/users')).toBeNull();
    expect(getVisualOrder()).toEqual(['/dashboard/overview', '/dashboard/chat']);
  });
});
