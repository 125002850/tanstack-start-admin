import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors
} from '@dnd-kit/core';
import { arrayMove, horizontalListSortingStrategy, SortableContext } from '@dnd-kit/sortable';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { isWorkspaceTabsEnabled } from '@/config/workspace-tabs';
import { useWorkspaceTags } from '@/features/workspace-tabs/hooks/use-workspace-tags';
import type { WorkspaceTabId } from '@/features/workspace-tabs/types';
import { cn } from '@/lib/utils';
import { OverlayTag, PinnedHomeTag, SortableTagItem } from './components';
import {
  dropAnimation,
  HOME_ID,
  LONG_PRESS_DELAY_MS,
  LONG_PRESS_TOLERANCE_PX,
  LONG_PRESS_TOUCH_TOLERANCE_PX
} from './constant';
import { reconcileVisualOrder } from './helper';
import type { OverlayMetrics } from './types';

type TagVisualState = {
  id: WorkspaceTabId;
  title: string;
  closable: boolean;
  dirty: boolean;
  isActive: boolean;
};

type ScrollHintState = {
  canScrollLeft: boolean;
  canScrollRight: boolean;
};

export default function TagsBar() {
  const {
    tabs,
    activeId,
    openedOrder,
    lifecycleSnapshots,
    openOrActivate,
    close,
    closeOther,
    closeAll,
    refresh
  } = useWorkspaceTags();
  const tabsRef = React.useRef<Map<string, HTMLButtonElement>>(new Map());
  const viewportRef = React.useRef<HTMLDivElement | null>(null);
  const contentRef = React.useRef<HTMLDivElement | null>(null);
  const suppressClickRef = React.useRef(false);
  const suppressClickTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [visualOrder, setVisualOrder] = React.useState<WorkspaceTabId[]>(() =>
    reconcileVisualOrder(openedOrder, openedOrder)
  );

  const [dragState, setDragState] = React.useState<{
    activeId: WorkspaceTabId | null;
    snapshot: TagVisualState | null;
    overlayMetrics: OverlayMetrics | null;
  }>({ activeId: null, snapshot: null, overlayMetrics: null });

  const [overlayMounted, setOverlayMounted] = React.useState(false);
  const [scrollHints, setScrollHints] = React.useState<ScrollHintState>({
    canScrollLeft: false,
    canScrollRight: false
  });

  React.useLayoutEffect(() => {
    setOverlayMounted(true);
  }, []);

  React.useEffect(() => {
    if (dragState.activeId) return;
    setVisualOrder((current) => reconcileVisualOrder(openedOrder, current));
  }, [dragState.activeId, openedOrder]);

  React.useEffect(() => {
    return () => {
      if (suppressClickTimerRef.current !== null) {
        clearTimeout(suppressClickTimerRef.current);
      }
    };
  }, []);

  const updateScrollHints = React.useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const next: ScrollHintState = {
      canScrollLeft: viewport.scrollLeft > 1,
      canScrollRight: maxScrollLeft - viewport.scrollLeft > 1
    };

    setScrollHints((current) => {
      if (
        current.canScrollLeft === next.canScrollLeft &&
        current.canScrollRight === next.canScrollRight
      ) {
        return current;
      }
      return next;
    });
  }, []);

  React.useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const content = contentRef.current;
    if (!viewport) return;

    // 滚动条被隐藏后，边缘提示需要由 scroll/resize/内容宽度变化主动维护。
    const handleMeasure = () => {
      updateScrollHints();
    };

    handleMeasure();
    viewport.addEventListener('scroll', handleMeasure, { passive: true });
    window.addEventListener('resize', handleMeasure);

    const resizeObserver =
      typeof ResizeObserver === 'undefined'
        ? null
        : new ResizeObserver(() => {
            handleMeasure();
          });

    resizeObserver?.observe(viewport);
    if (content) {
      resizeObserver?.observe(content);
    }

    return () => {
      viewport.removeEventListener('scroll', handleMeasure);
      window.removeEventListener('resize', handleMeasure);
      resizeObserver?.disconnect();
    };
  }, [updateScrollHints]);

  const sensors = useSensors(
    useSensor(MouseSensor, {
      activationConstraint: {
        delay: LONG_PRESS_DELAY_MS,
        tolerance: LONG_PRESS_TOLERANCE_PX
      }
    }),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: LONG_PRESS_DELAY_MS,
        tolerance: LONG_PRESS_TOUCH_TOLERANCE_PX
      }
    })
  );

  const registerTabRef = React.useCallback((id: WorkspaceTabId, node: HTMLButtonElement | null) => {
    if (node) {
      tabsRef.current.set(id, node);
      return;
    }
    tabsRef.current.delete(id);
  }, []);

  const scrollToTab = React.useCallback((id: WorkspaceTabId) => {
    const tabEl = tabsRef.current.get(id);
    if (!tabEl) return;
    requestAnimationFrame(() => {
      if (typeof tabEl.scrollIntoView !== 'function') return;
      tabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });
  }, []);

  React.useEffect(() => {
    if (!activeId) return;
    scrollToTab(activeId);
  }, [activeId, scrollToTab]);

  const getTagVisualState = React.useCallback(
    (id: WorkspaceTabId): TagVisualState | null => {
      if (dragState.snapshot?.id === id) return dragState.snapshot;
      const tab = tabs[id];
      if (!tab) return null;
      return {
        id,
        title: tab.title,
        closable: tab.closable,
        dirty: Boolean(lifecycleSnapshots[id]?.dirty),
        isActive: id === activeId
      };
    },
    [activeId, dragState.snapshot, lifecycleSnapshots, tabs]
  );

  const armSuppressClick = React.useCallback(() => {
    suppressClickRef.current = true;
    if (suppressClickTimerRef.current !== null) {
      clearTimeout(suppressClickTimerRef.current);
    }
    suppressClickTimerRef.current = setTimeout(() => {
      suppressClickRef.current = false;
      suppressClickTimerRef.current = null;
    }, 0);
  }, []);

  const activate = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>, id: WorkspaceTabId) => {
      event.stopPropagation();
      if (suppressClickRef.current) {
        event.preventDefault();
        suppressClickRef.current = false;
        if (suppressClickTimerRef.current !== null) {
          clearTimeout(suppressClickTimerRef.current);
          suppressClickTimerRef.current = null;
        }
        return;
      }
      const tab = tabs[id];
      if (tab && id !== activeId) {
        openOrActivate(tab);
      }
      scrollToTab(id);
    },
    [activeId, openOrActivate, scrollToTab, tabs]
  );

  const handleDragStart = React.useCallback(
    (event: DragStartEvent) => {
      const id = event.active.id as WorkspaceTabId;
      const tab = tabs[id];
      const activeTab = tabsRef.current.get(id);

      setDragState({
        activeId: id,
        snapshot: {
          id,
          title: tab?.title ?? id,
          closable: tab?.closable ?? true,
          dirty: Boolean(lifecycleSnapshots[id]?.dirty),
          isActive: id === activeId
        },
        overlayMetrics: activeTab
          ? { width: activeTab.getBoundingClientRect().width, height: activeTab.getBoundingClientRect().height }
          : null
      });
      armSuppressClick();
    },
    [activeId, armSuppressClick, lifecycleSnapshots, tabs]
  );

  const handleDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;
      const activeId = dragState.activeId;

      setDragState({ activeId: null, snapshot: null, overlayMetrics: null });

      if (!activeId || !over || active.id === over.id) return;

      setVisualOrder((prev) => {
        const nonHome = prev.filter((id) => id !== HOME_ID);
        const oldIndex = nonHome.indexOf(activeId);
        const newIndex = nonHome.indexOf(over.id as WorkspaceTabId);
        if (oldIndex === -1 || newIndex === -1) return prev;
        const next = arrayMove(nonHome, oldIndex, newIndex);
        return [HOME_ID, ...next];
      });
    },
    [dragState.activeId]
  );

  const handleDragCancel = React.useCallback(() => {
    setDragState({ activeId: null, snapshot: null, overlayMetrics: null });
  }, []);

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLButtonElement>, id: WorkspaceTabId) => {
      const ids = visualOrder;
      const idx = ids.indexOf(id);
      let next: string | undefined;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          next = ids[Math.max(0, idx - 1)];
          break;
        case 'ArrowRight':
          event.preventDefault();
          next = ids[Math.min(ids.length - 1, idx + 1)];
          break;
        case 'Enter':
          event.preventDefault();
          if (tabs[id] && id !== activeId) {
            openOrActivate(tabs[id]);
          }
          scrollToTab(id);
          return;
        case 'Delete':
          event.preventDefault();
          void close(id);
          return;
        default:
          return;
      }

      if (next && next !== id) {
        const button = tabsRef.current.get(next);
        button?.focus();
        scrollToTab(next);
      }
    },
    [activeId, close, openOrActivate, scrollToTab, tabs, visualOrder]
  );

  const handleClose = React.useCallback(
    (event: React.MouseEvent, id: WorkspaceTabId) => {
      event.stopPropagation();
      void close(id);
    },
    [close]
  );

  const handleCloseKeyDown = React.useCallback(
    (event: React.KeyboardEvent, id: WorkspaceTabId) => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      event.stopPropagation();
      void close(id);
    },
    [close]
  );

  const stopClosePointerDown = React.useCallback((event: React.SyntheticEvent) => {
    event.stopPropagation();
  }, []);

  const nonHomeVisualOrder = React.useMemo(
    () => visualOrder.filter((id) => id !== HOME_ID),
    [visualOrder]
  );

  const homeState = React.useMemo(
    () => (visualOrder.includes(HOME_ID) ? getTagVisualState(HOME_ID) : null),
    [getTagVisualState, visualOrder]
  );

  if (!isWorkspaceTabsEnabled()) return null;

  return (
    <div className='relative flex-1 min-w-0'>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div data-slot='scroll-area' className='relative min-w-0'>
          <div
            data-slot='workspace-tabs-overflow-left'
            data-visible={scrollHints.canScrollLeft ? 'true' : 'false'}
            aria-hidden='true'
            className={cn(
              'pointer-events-none absolute inset-y-0 left-0 z-10 w-10 transition-opacity duration-200',
              scrollHints.canScrollLeft ? 'opacity-100' : 'opacity-0'
            )}
          >
            <div
              data-slot='workspace-tabs-overflow-left-surface'
              className='absolute inset-y-0 left-0 right-2 bg-gradient-to-r from-background via-background/80 to-transparent'
            />
          </div>
          <div
            data-slot='workspace-tabs-overflow-right'
            data-visible={scrollHints.canScrollRight ? 'true' : 'false'}
            aria-hidden='true'
            className={cn(
              'pointer-events-none absolute inset-y-0 right-0 z-10 w-10 transition-opacity duration-200',
              scrollHints.canScrollRight ? 'opacity-100' : 'opacity-0'
            )}
          >
            <div
              data-slot='workspace-tabs-overflow-right-surface'
              className='absolute inset-y-0 left-2 right-0 bg-gradient-to-l from-background via-background/80 to-transparent'
            />
          </div>
          <div
            ref={viewportRef}
            data-slot='scroll-area-viewport'
            className='focus-visible:ring-ring/50 size-full rounded-[inherit] min-w-0 overflow-x-auto overflow-y-hidden transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
          >
            <div
              ref={contentRef}
              data-slot='workspace-tags-bar'
              className='flex min-w-max items-center gap-px pr-2 py-px'
              role='tablist'
              aria-label='Workspace tabs'
            >
              {homeState ? (
                <PinnedHomeTag
                  id={HOME_ID}
                  title={homeState.title}
                  dirty={homeState.dirty}
                  closable={homeState.closable}
                  isActive={homeState.isActive}
                  registerTabRef={registerTabRef}
                  activate={activate}
                  handleKeyDown={handleKeyDown}
                  handleClose={handleClose}
                  handleCloseKeyDown={handleCloseKeyDown}
                  handleClosePointerDown={stopClosePointerDown}
                  refresh={refresh}
                  close={close}
                  closeOther={closeOther}
                  closeAll={closeAll}
                />
              ) : null}

              <SortableContext items={nonHomeVisualOrder} strategy={horizontalListSortingStrategy}>
                {nonHomeVisualOrder.map((id) => {
                  const tagState = getTagVisualState(id);
                  if (!tagState) return null;

                  return (
                    <SortableTagItem
                      key={id}
                      id={id}
                      title={tagState.title}
                      dirty={tagState.dirty}
                      closable={tagState.closable}
                      isActive={tagState.isActive}
                      placeholderMetrics={dragState.activeId === id ? dragState.overlayMetrics : null}
                      registerTabRef={registerTabRef}
                      activate={activate}
                      handleKeyDown={handleKeyDown}
                      handleClose={handleClose}
                      handleCloseKeyDown={handleCloseKeyDown}
                      handleClosePointerDown={stopClosePointerDown}
                      refresh={refresh}
                      close={close}
                      closeOther={closeOther}
                      closeAll={closeAll}
                    />
                  );
                })}
              </SortableContext>
            </div>
          </div>
        </div>

        {overlayMounted && typeof document !== 'undefined'
          ? ReactDOM.createPortal(
              <DragOverlay dropAnimation={dropAnimation}>
                {dragState.snapshot ? (
                  <OverlayTag
                    title={dragState.snapshot.title}
                    dirty={dragState.snapshot.dirty}
                    closable={dragState.snapshot.closable}
                    isActive={dragState.snapshot.isActive}
                    metrics={dragState.overlayMetrics}
                  />
                ) : null}
              </DragOverlay>,
              document.body
            )
          : null}
      </DndContext>
    </div>
  );
}
