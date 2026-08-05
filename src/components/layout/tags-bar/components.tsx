import type { DraggableSyntheticListeners } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import * as React from 'react';
import { Icons } from '@/components/icons';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu';
import type { WorkspaceTabId } from '@/features/workspace-tabs/types';
import { cn } from '@/lib/utils';
import { getPlaceholderClassName, getTagButtonClassName } from './helper';
import type { OverlayMetrics } from './types';

// 右键菜单动作在多个标签组件之间共享，因此先收敛成一组能力接口。
interface TagActionCallbacks {
  refresh: (id: WorkspaceTabId) => void;
  close: (id: WorkspaceTabId) => Promise<void> | void;
  closeOther: (id: WorkspaceTabId) => Promise<void> | void;
  closeAll: () => Promise<void> | void;
}

interface TagContextMenuProps extends TagActionCallbacks {
  children: React.ReactElement;
  id: WorkspaceTabId;
  closable: boolean;
}

// 所有标签都包一层统一的上下文菜单，避免 pinned / sortable 两套实现各管一份菜单逻辑。
function TagContextMenu(props: TagContextMenuProps) {
  const { children, id, closable, refresh, close, closeOther, closeAll } = props;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>
      <ContextMenuContent className='w-48'>
        <ContextMenuItem onClick={() => refresh(id)}>刷新页面</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => void close(id)} disabled={!closable}>
          关闭标签
        </ContextMenuItem>
        <ContextMenuItem onClick={() => void closeOther(id)}>关闭其他标签</ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={() => void closeAll()}>关闭所有标签</ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}

interface TagContentProps {
  title: string;
  dirty: boolean;
  closable: boolean;
  isActive: boolean;
}

// TagContent 只负责"标签内部内容"，不关心它是按钮、占位还是 overlay。
// 这样可以让真实标签、placeholder、overlay 共享同一套标题 / 脏状态 / 关闭图标渲染。
function TagContent(props: TagContentProps) {
  const { title, dirty, closable, isActive } = props;

  return (
    <>
      <span className='max-w-[120px] truncate'>{title}</span>
      {dirty && (
        <span
          className='size-1.5 shrink-0 rounded-full bg-yellow-400'
          aria-label={`${title} has unsaved changes`}
        />
      )}
      {closable ? (
        <span
          aria-hidden='true'
          className={cn(
            'ml-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm opacity-40',
            isActive ? 'visible' : 'invisible'
          )}
        >
          <Icons.close className='size-3' />
        </span>
      ) : null}
    </>
  );
}

interface InteractiveTagButtonProps {
  id: WorkspaceTabId;
  title: string;
  dirty: boolean;
  closable: boolean;
  isActive: boolean;
  onActivate: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>) => void;
  onClose: (event: React.MouseEvent) => void;
  onClosePointerDown: (event: React.SyntheticEvent) => void;
  tabRef?: (node: HTMLButtonElement | null) => void;
  listeners?: DraggableSyntheticListeners;
  dataPinned?: 'home';
}

// 真正可交互的标签按钮。
// 标签标题同时承担导航与拖拽激活；Sensor 的移动阈值负责区分点击和排序。
// 关闭操作仍使用独立原生按钮，避免嵌套交互元素。
function InteractiveTagButton(props: InteractiveTagButtonProps) {
  const {
    id,
    title,
    dirty,
    closable,
    isActive,
    onActivate,
    onKeyDown,
    onClose,
    onClosePointerDown,
    tabRef,
    listeners,
    dataPinned
  } = props;

  return (
    <div
      data-slot='workspace-tag-shell'
      data-tab-id={id}
      data-pinned={dataPinned}
      className={getTagButtonClassName(isActive)}
    >
      <button
        ref={tabRef}
        data-slot='workspace-tag'
        data-tab-id={id}
        data-pinned={dataPinned}
        role='tab'
        aria-selected={isActive}
        tabIndex={isActive ? 0 : -1}
        {...listeners}
        onClick={onActivate}
        onKeyDown={onKeyDown}
        className={cn(
          'inline-flex h-full min-w-0 items-center gap-1 rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
          closable ? 'pl-2.5 pr-0.5' : 'px-2.5',
          listeners ? 'cursor-grab active:cursor-grabbing' : undefined
        )}
      >
        <TagContent title={title} dirty={dirty} closable={false} isActive={isActive} />
      </button>
      {closable ? (
        <button
          type='button'
          data-slot='workspace-tag-close'
          aria-label={`关闭：${title}`}
          onClick={onClose}
          onMouseDown={onClosePointerDown}
          onPointerDown={onClosePointerDown}
          onTouchStart={onClosePointerDown}
          className={cn(
            'mr-0.5 flex size-6 shrink-0 items-center justify-center rounded-sm transition-[color,opacity]',
            'hover:text-foreground hover:opacity-100',
            'focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            isActive
              ? 'opacity-50'
              : 'pointer-events-none opacity-0 group-hover:pointer-events-auto group-hover:opacity-50 group-focus-within:pointer-events-auto group-focus-within:opacity-50'
          )}
        >
          {/* 原生按钮与 tab 为兄弟节点，避免嵌套交互元素，同时阻断拖拽激活。 */}
          <Icons.close className='size-3' />
        </button>
      ) : null}
    </div>
  );
}

interface PlaceholderTagProps {
  id: WorkspaceTabId;
  title: string;
  dirty: boolean;
  closable: boolean;
  isActive: boolean;
  metrics: OverlayMetrics | null;
}

// 正在拖拽的原位置占位。
// 它必须占住原来的宽高，否则列表会在拖拽激活瞬间塌缩。
function PlaceholderTag(props: PlaceholderTagProps) {
  const { id, title, dirty, closable, isActive, metrics } = props;

  return (
    <div
      data-slot='workspace-tag-placeholder'
      data-tab-id={id}
      aria-hidden='true'
      className={getPlaceholderClassName(isActive)}
      style={
        metrics
          ? {
              width: metrics.width,
              height: metrics.height
            }
          : undefined
      }
    >
      <TagContent title={title} dirty={dirty} closable={closable} isActive={isActive} />
    </div>
  );
}

interface OverlayTagProps {
  title: string;
  dirty: boolean;
  closable: boolean;
  isActive: boolean;
  metrics: OverlayMetrics | null;
}

// 拖拽时跟随指针移动的视觉副本。
// aria-hidden 是必须的，否则辅助技术会把 overlay 误读成新的标签节点。
export function OverlayTag(props: OverlayTagProps) {
  const { title, dirty, closable, isActive, metrics } = props;

  return (
    <div
      data-slot='workspace-tag-overlay'
      aria-hidden='true'
      className={cn(
        getTagButtonClassName(isActive),
        'pointer-events-none gap-1 px-2.5 scale-[1.02] shadow-lg ring-1 ring-border/70'
      )}
      style={
        metrics
          ? {
              width: metrics.width,
              height: metrics.height
            }
          : undefined
      }
    >
      <TagContent title={title} dirty={dirty} closable={closable} isActive={isActive} />
    </div>
  );
}

interface TagInteractionCallbacks {
  registerTabRef: (id: WorkspaceTabId, node: HTMLButtonElement | null) => void;
  activate: (event: React.MouseEvent<HTMLButtonElement>, id: WorkspaceTabId) => void;
  handleKeyDown: (event: React.KeyboardEvent<HTMLButtonElement>, id: WorkspaceTabId) => void;
  handleClose: (event: React.MouseEvent, id: WorkspaceTabId) => void;
  handleClosePointerDown: (event: React.SyntheticEvent) => void;
}

interface PinnedHomeTagProps extends TagInteractionCallbacks, TagActionCallbacks {
  id: WorkspaceTabId;
  title: string;
  dirty: boolean;
  closable: boolean;
  isActive: boolean;
}

// 首页标签不参与排序，因此不接 useSortable，只保留普通交互与上下文菜单。
export function PinnedHomeTag(props: PinnedHomeTagProps) {
  const {
    id,
    title,
    dirty,
    closable,
    isActive,
    registerTabRef,
    activate,
    handleKeyDown,
    handleClose,
    handleClosePointerDown,
    refresh,
    close,
    closeOther,
    closeAll
  } = props;

  return (
    <TagContextMenu
      id={id}
      closable={closable}
      refresh={refresh}
      close={close}
      closeOther={closeOther}
      closeAll={closeAll}
    >
      <div className='shrink-0'>
        <InteractiveTagButton
          id={id}
          title={title}
          dirty={dirty}
          closable={closable}
          isActive={isActive}
          dataPinned='home'
          tabRef={(node) => registerTabRef(id, node)}
          onActivate={(event) => activate(event, id)}
          onKeyDown={(event) => handleKeyDown(event, id)}
          onClose={(event) => handleClose(event, id)}
          onClosePointerDown={handleClosePointerDown}
        />
      </div>
    </TagContextMenu>
  );
}

interface SortableTagItemProps extends TagInteractionCallbacks, TagActionCallbacks {
  id: WorkspaceTabId;
  title: string;
  dirty: boolean;
  closable: boolean;
  isActive: boolean;
  placeholderMetrics: OverlayMetrics | null;
}

// 可拖拽的普通标签。
// useSortable 负责把 dnd-kit 的位移、过渡和激活状态映射到当前标签节点上。
export function SortableTagItem(props: SortableTagItemProps) {
  const {
    id,
    title,
    dirty,
    closable,
    isActive,
    placeholderMetrics,
    registerTabRef,
    activate,
    handleKeyDown,
    handleClose,
    handleClosePointerDown,
    refresh,
    close,
    closeOther,
    closeAll
  } = props;

  const { listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id });

  // transform / transition 完全由 dnd-kit 驱动，这里只做最薄的样式映射。
  const style = React.useMemo<React.CSSProperties>(
    () => ({
      transform: CSS.Transform.toString(transform),
      transition
    }),
    [transform, transition]
  );

  const setButtonRef = React.useCallback(
    (node: HTMLButtonElement | null) => {
      setActivatorNodeRef(node);
      registerTabRef(id, node);
    },
    [id, registerTabRef, setActivatorNodeRef]
  );

  return (
    <TagContextMenu
      id={id}
      closable={closable}
      refresh={refresh}
      close={close}
      closeOther={closeOther}
      closeAll={closeAll}
    >
      <div ref={setNodeRef} style={style} className='shrink-0'>
        {/* 拖拽激活后，原位置切换为 placeholder，真实内容转由 DragOverlay 承载。 */}
        {isDragging ? (
          <PlaceholderTag
            id={id}
            title={title}
            dirty={dirty}
            closable={closable}
            isActive={isActive}
            metrics={placeholderMetrics}
          />
        ) : (
          <InteractiveTagButton
            id={id}
            title={title}
            dirty={dirty}
            closable={closable}
            isActive={isActive}
            tabRef={setButtonRef}
            listeners={listeners}
            onActivate={(event) => activate(event, id)}
            onKeyDown={(event) => handleKeyDown(event, id)}
            onClose={(event) => handleClose(event, id)}
            onClosePointerDown={handleClosePointerDown}
          />
        )}
      </div>
    </TagContextMenu>
  );
}
