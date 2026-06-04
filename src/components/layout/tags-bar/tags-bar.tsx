import {
  type Announcements,
  type CollisionDetection,
  DndContext,
  DragOverlay,
  MouseSensor,
  TouchSensor,
  getFirstCollision,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
  type DragCancelEvent,
  type DragEndEvent,
  type DragStartEvent
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy
} from '@dnd-kit/sortable';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { ScrollArea } from '@/components/ui/scroll-area';
import { isWorkspaceTabsEnabled } from '@/config/workspace-tabs';
import { useWorkspaceTags } from '@/features/workspace-tabs/hooks/use-workspace-tags';
import type { WorkspaceTabId } from '@/features/workspace-tabs/types';
import { PinnedHomeTag, OverlayTag, SortableTagItem } from './components';
import {
  HOME_ID,
  LONG_PRESS_DELAY_MS,
  LONG_PRESS_TOLERANCE_PX,
  LONG_PRESS_TOUCH_TOLERANCE_PX,
  dropAnimation
} from './constant';
import {
  getNonHomeVisualOrder,
  getPositionLabel,
  reconcileVisualOrder
} from './helper';
import type { OverlayMetrics, TagVisualState } from './types';
import { cn } from '@/lib/utils';

/**
 * Workspace 顶部标签栏。
 *
 * 这个组件负责三类事情：
 * 1. 从 workspace store 读取真实标签状态；
 * 2. 维护拖拽中的临时视觉顺序与 overlay / placeholder 状态；
 * 3. 协调滚动、边缘 fade、键盘导航、点击抑制等交互细节。
 *
 * 拆分后仍把“跨模块的编排逻辑”留在这里，避免子组件反向依赖过多上下文。
 */
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
  const suppressClickRef = React.useRef(false);
  const suppressClickResetTimerRef = React.useRef<number | null>(null);
  const pendingOpenedOrderRef = React.useRef<WorkspaceTabId[] | null>(null);
  const dragInvalidatedRef = React.useRef(false);
  const lastOverIdRef = React.useRef<WorkspaceTabId | null>(null);
  const [visualOrder, setVisualOrder] = React.useState<WorkspaceTabId[]>(() =>
    reconcileVisualOrder(openedOrder, openedOrder)
  );
  const [showLeftFade, setShowLeftFade] = React.useState(false);
  const [showRightFade, setShowRightFade] = React.useState(false);
  const [activeDragId, setActiveDragId] = React.useState<WorkspaceTabId | null>(null);
  const [dragSnapshot, setDragSnapshot] = React.useState<TagVisualState | null>(null);
  const [overlayMetrics, setOverlayMetrics] = React.useState<OverlayMetrics | null>(null);
  const [overlayMounted, setOverlayMounted] = React.useState(false);

  // nonHomeVisualOrder 是所有排序逻辑的真实参与集合：首页标签固定排除在外。
  const nonHomeVisualOrder = React.useMemo(
    () => getNonHomeVisualOrder(visualOrder),
    [visualOrder]
  );

  // overlay 需要 portal 到 body，先等客户端挂载完成，避免 SSR / hydration 读取 document。
  React.useLayoutEffect(() => {
    setOverlayMounted(true);
  }, []);

  // 根据当前滚动位置判断是否显示左右 fade，给用户提供“还能横向滚动”的视觉提示。
  const updateEdgeFades = React.useCallback(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
    const hasOverflow = maxScrollLeft > 1;

    setShowLeftFade(hasOverflow && viewport.scrollLeft > 1);
    setShowRightFade(hasOverflow && viewport.scrollLeft < maxScrollLeft - 1);
  }, []);

  // 每个标签按钮的 DOM 节点都会登记到 Map 中，后续用于聚焦与 scrollIntoView。
  const registerTabRef = React.useCallback((id: WorkspaceTabId, node: HTMLButtonElement | null) => {
    if (node) {
      tabsRef.current.set(id, node);
      return;
    }

    tabsRef.current.delete(id);
  }, []);

  // active tab 切换后，确保它始终滚动到可视区域内。
  const scrollToTab = React.useCallback((id: WorkspaceTabId) => {
    const tabEl = tabsRef.current.get(id);
    if (!tabEl) return;

    requestAnimationFrame(() => {
      if (typeof tabEl.scrollIntoView !== 'function') return;
      tabEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });
  }, []);

  // 拖拽过程中优先读取 dragSnapshot，避免标题或 dirty 状态在拖拽中途变化导致视觉抖动。
  const getTagVisualState = React.useCallback(
    (id: WorkspaceTabId): TagVisualState | null => {
      if (dragSnapshot?.id === id) {
        return dragSnapshot;
      }

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
    [activeId, dragSnapshot, lifecycleSnapshots, tabs]
  );

  // 无障碍播报、拖拽提示等只需要标题文本，因此单独做一个轻量 getter。
  const getTagTitle = React.useCallback(
    (id: WorkspaceTabId) => getTagVisualState(id)?.title ?? id,
    [getTagVisualState]
  );

  // dnd-kit 的位置播报使用 1-based 序号更符合用户认知。
  const getNonHomePosition = React.useCallback((order: WorkspaceTabId[], id: WorkspaceTabId) => {
    const position = order.indexOf(id);
    return position >= 0 ? position + 1 : 1;
  }, []);

  // suppress click 是为了修掉“拖拽结束后 mouseup 立刻触发 click”的副作用。
  // timer 只维持一个事件循环，让真正的后续点击仍然可用。
  const clearSuppressClickTimer = React.useCallback(() => {
    if (suppressClickResetTimerRef.current !== null) {
      window.clearTimeout(suppressClickResetTimerRef.current);
      suppressClickResetTimerRef.current = null;
    }
  }, []);

  const armSuppressClick = React.useCallback(() => {
    suppressClickRef.current = true;
    clearSuppressClickTimer();
    suppressClickResetTimerRef.current = window.setTimeout(() => {
      suppressClickRef.current = false;
      suppressClickResetTimerRef.current = null;
    }, 0);
  }, [clearSuppressClickTimer]);

  const consumeSuppressedClick = React.useCallback(
    (event: React.MouseEvent) => {
      if (!suppressClickRef.current) return false;

      event.preventDefault();
      event.stopPropagation();
      suppressClickRef.current = false;
      clearSuppressClickTimer();
      return true;
    },
    [clearSuppressClickTimer]
  );

  // 关闭按钮会出现在可拖拽标签内部；阻断 pointerDown 后，长按关闭按钮不会误触发拖拽。
  const stopClosePointerDown = React.useCallback((event: React.SyntheticEvent) => {
    event.stopPropagation();
  }, []);

  // 所有拖拽态都集中在这里复位，避免 onDragEnd / onDragCancel / 失效路径各写一份。
  const clearDragState = React.useCallback(() => {
    setActiveDragId(null);
    setDragSnapshot(null);
    setOverlayMetrics(null);
    pendingOpenedOrderRef.current = null;
    dragInvalidatedRef.current = false;
  }, []);

  React.useEffect(() => {
    if (!activeId) return;
    scrollToTab(activeId);
  }, [activeId, scrollToTab]);

  // 滚动 fade 依赖 viewport 尺寸与内容尺寸；ResizeObserver 能覆盖标签增删和宽度变化。
  React.useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    updateEdgeFades();

    const handleViewportChange = () => {
      updateEdgeFades();
    };

    viewport.addEventListener('scroll', handleViewportChange, { passive: true });

    if (typeof ResizeObserver !== 'undefined') {
      const resizeObserver = new ResizeObserver(handleViewportChange);
      resizeObserver.observe(viewport);

      const content = viewport.firstElementChild;
      if (content instanceof HTMLElement) {
        resizeObserver.observe(content);
      }

      return () => {
        viewport.removeEventListener('scroll', handleViewportChange);
        resizeObserver.disconnect();
      };
    }

    window.addEventListener('resize', handleViewportChange);

    return () => {
      viewport.removeEventListener('scroll', handleViewportChange);
      window.removeEventListener('resize', handleViewportChange);
    };
  }, [updateEdgeFades, visualOrder]);

  // 拖拽期间 openedOrder 仍可能因为外部动作变化。
  // 这里把最新 openedOrder 暂存下来，等 drag 结束时再一次性与 visualOrder 对齐。
  React.useEffect(() => {
    if (!activeDragId) {
      setVisualOrder((current) => reconcileVisualOrder(openedOrder, current));
      return;
    }

    pendingOpenedOrderRef.current = openedOrder;
    if (!openedOrder.includes(activeDragId)) {
      dragInvalidatedRef.current = true;
    }
  }, [activeDragId, openedOrder]);

  // 组件卸载时必须清掉 timer，避免异步回调在卸载后继续写 ref 状态。
  React.useEffect(() => {
    return () => {
      clearSuppressClickTimer();
    };
  }, [clearSuppressClickTimer]);

  const activate = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>, id: WorkspaceTabId) => {
      if (consumeSuppressedClick(event)) return;

      const tab = tabs[id];
      if (tab && id !== activeId) {
        openOrActivate(tab);
      }

      scrollToTab(id);
    },
    [activeId, consumeSuppressedClick, openOrActivate, scrollToTab, tabs]
  );

  // 键盘导航只在 visualOrder 上工作，这样拖拽中的临时顺序也能被正确感知。
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

  // 关闭按钮需要阻断事件冒泡，否则点击关闭会先触发标签激活。
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

  // 触摸与鼠标分别设置 activationConstraint，统一维持“长按才拖拽”的交互模型。
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

  /**
   * 自定义 collision detection。
   *
   * 关键目标：
   * 1. active 自己不参与普通 droppable 集合，避免一激活就把自己当成可落点；
   * 2. 若指针仍在 active 自身区域内，需要主动清空 lastOver，防止“拖回原位却回不去”；
   * 3. 当瞬时没有命中任何目标时，允许沿用上一次 lastOver，让边缘拖动更稳定。
   */
  const collisionDetection: CollisionDetection = React.useCallback((args) => {
    const droppableContainers = args.droppableContainers.filter(
      (container) => container.id !== args.active.id
    );
    const nextArgs = { ...args, droppableContainers };
    const activeContainerArgs = {
      ...args,
      droppableContainers: args.droppableContainers.filter(
        (container) => container.id === args.active.id
      )
    };
    const pointerCollisions = pointerWithin(nextArgs);
    const collisions = pointerCollisions.length > 0 ? pointerCollisions : rectIntersection(nextArgs);
    const overId = getFirstCollision(collisions, 'id');
    const activePointerCollisions = pointerWithin(activeContainerArgs);
    const activeCollisions =
      activePointerCollisions.length > 0
        ? activePointerCollisions
        : rectIntersection(activeContainerArgs);
    const isOverActiveContainer = getFirstCollision(activeCollisions, 'id') === args.active.id;

    if (overId != null) {
      // 一旦命中真实目标，就把它记成最近的 over，供后续空窗帧兜底。
      lastOverIdRef.current = String(overId);
      return [{ id: overId }];
    }

    if (isOverActiveContainer) {
      // 回到源标签区域时必须清掉 lastOver，否则 drop 后会错误保留上一次交换目标。
      lastOverIdRef.current = null;
      return [];
    }

    if (lastOverIdRef.current) {
      return [{ id: lastOverIdRef.current }];
    }

    return [];
  }, []);

  // 所有播报都基于 nonHomeVisualOrder，避免把固定首页标签纳入排序描述。
  const announcements: Announcements = React.useMemo(
    () => ({
      onDragStart({ active }) {
        const id = String(active.id);
        const position = getNonHomePosition(nonHomeVisualOrder, id);
        const total = nonHomeVisualOrder.length;
        return `已拿起标签「${getTagTitle(id)}」，当前位置 ${getPositionLabel(position, total)}。`;
      },
      onDragOver({ active, over }) {
        if (!over) return;

        const activeId = String(active.id);
        const overId = String(over.id);
        const position = getNonHomePosition(nonHomeVisualOrder, overId);
        const total = nonHomeVisualOrder.length;
        return `标签「${getTagTitle(activeId)}」移动到 ${getPositionLabel(position, total)}。`;
      },
      onDragEnd({ active, over }) {
        if (dragInvalidatedRef.current) {
          return '拖动已作废，标签集合发生变化，已恢复到最新顺序。';
        }

        const activeId = String(active.id);
        if (!over) {
          return `标签「${getTagTitle(activeId)}」拖动结束，顺序未更改。`;
        }

        const overId = String(over.id);
        const from = nonHomeVisualOrder.indexOf(activeId);
        const to = nonHomeVisualOrder.indexOf(overId);
        const nextOrder =
          from >= 0 && to >= 0 ? arrayMove(nonHomeVisualOrder, from, to) : nonHomeVisualOrder;
        const position = getNonHomePosition(nextOrder, activeId);
        const total = nextOrder.length;

        return `标签「${getTagTitle(activeId)}」已放到 ${getPositionLabel(position, total)}。`;
      },
      onDragCancel({ active }) {
        return `标签「${getTagTitle(String(active.id))}」拖动已取消，顺序未更改。`;
      }
    }),
    [getNonHomePosition, getTagTitle, nonHomeVisualOrder]
  );

  // drag start 时把渲染所需信息拍平为快照，并记录当前真实按钮尺寸供 overlay / placeholder 使用。
  const onDragStart = React.useCallback(
    (event: DragStartEvent) => {
      const id = String(event.active.id);
      const tab = tabs[id];
      const activeTab = tabsRef.current.get(id);

      setActiveDragId(id);
      setDragSnapshot({
        id,
        title: tab?.title ?? id,
        closable: tab?.closable ?? true,
        dirty: Boolean(lifecycleSnapshots[id]?.dirty),
        isActive: id === activeId
      });
      setOverlayMetrics(
        activeTab
          ? {
              width: activeTab.getBoundingClientRect().width,
              height: activeTab.getBoundingClientRect().height
            }
          : null
      );
      pendingOpenedOrderRef.current = null;
      dragInvalidatedRef.current = false;
      lastOverIdRef.current = null;
      // 拖拽激活后立刻抑制一次 click，避免松手时把标签错误激活。
      armSuppressClick();
    },
    [activeId, armSuppressClick, lifecycleSnapshots, tabs]
  );

  // drag end 只负责“把临时视觉顺序结算回 visualOrder”。
  // 真正的 openedOrder 仍由外部 store 统一管理，这里不直接写业务 store。
  const onDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const nextOpenedOrder = pendingOpenedOrderRef.current ?? openedOrder;

      if (dragInvalidatedRef.current) {
        // 拖拽期间如果标签集合已变化，直接回退到最新 openedOrder，避免基于旧集合结算。
        setVisualOrder(reconcileVisualOrder(nextOpenedOrder, nextOpenedOrder));
        lastOverIdRef.current = null;
        clearDragState();
        return;
      }

      if (!activeDragId || !event.over) {
        setVisualOrder((current) => reconcileVisualOrder(nextOpenedOrder, current));
        lastOverIdRef.current = null;
        clearDragState();
        return;
      }

      const from = nonHomeVisualOrder.indexOf(activeDragId);
      const to = nonHomeVisualOrder.indexOf(String(event.over.id));

      if (from < 0 || to < 0) {
        setVisualOrder((current) => reconcileVisualOrder(nextOpenedOrder, current));
        lastOverIdRef.current = null;
        clearDragState();
        return;
      }

      const nextNonHomeIds = arrayMove(nonHomeVisualOrder, from, to);
      setVisualOrder(reconcileVisualOrder(nextOpenedOrder, [HOME_ID, ...nextNonHomeIds]));
      lastOverIdRef.current = null;
      clearDragState();
    },
    [activeDragId, clearDragState, nonHomeVisualOrder, openedOrder]
  );

  // cancel 与 end 的区别只在于“绝不结算位移”，其余清理逻辑保持一致。
  const onDragCancel = React.useCallback(
    (_event: DragCancelEvent) => {
      const nextOpenedOrder = pendingOpenedOrderRef.current ?? openedOrder;
      setVisualOrder((current) => reconcileVisualOrder(nextOpenedOrder, current));
      lastOverIdRef.current = null;
      clearDragState();
    },
    [clearDragState, openedOrder]
  );

  if (!isWorkspaceTabsEnabled()) return null;

  // 首页标签是否存在取决于当前 openedOrder；不存在时不渲染 pinned 区域。
  const homeState = visualOrder.includes(HOME_ID) ? getTagVisualState(HOME_ID) : null;

  return (
    <div
      className={cn(
        'relative flex-1 min-w-0',
        showLeftFade &&
          'before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:z-10 before:w-6 before:bg-linear-to-r before:from-background before:to-transparent',
        showRightFade &&
          'after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:z-10 after:w-6 after:bg-linear-to-l after:from-background after:to-transparent'
      )}
    >
      <ScrollArea
        className='min-w-0 [&>[data-slot=scroll-area-scrollbar]]:hidden'
        viewportRef={viewportRef}
        viewportProps={{
          // 这里把真正滚动节点下沉到 viewport，便于 edge fades 直接读取 scrollWidth / clientWidth。
          className:
            'min-w-0 overflow-x-auto overflow-y-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden'
        }}
      >
        <DndContext
          accessibility={{ announcements }}
          collisionDetection={collisionDetection}
          sensors={sensors}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={onDragCancel}
        >
          <div
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
                    placeholderMetrics={activeDragId === id ? overlayMetrics : null}
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

          {/* overlay 必须 portal 到 body，避免被 tags bar 容器的 overflow 裁剪。 */}
          {overlayMounted && globalThis.document?.body
            ? ReactDOM.createPortal(
                <DragOverlay dropAnimation={dropAnimation}>
                  {dragSnapshot ? (
                    <OverlayTag
                      title={dragSnapshot.title}
                      dirty={dragSnapshot.dirty}
                      closable={dragSnapshot.closable}
                      isActive={dragSnapshot.isActive}
                      metrics={overlayMetrics}
                    />
                  ) : null}
                </DragOverlay>,
                globalThis.document.body
              )
            : null}
        </DndContext>
      </ScrollArea>
    </div>
  );
}
