import {
  useCallback,
  useMemo,
  useRef,
  type MouseEvent as ReactMouseEvent,
  type TouchEvent as ReactTouchEvent
} from 'react';
import type { Header } from '@tanstack/react-table';

import { clampWidth, calculateOverlayLeft } from '@/lib/data-table-column-resize-overlay';

interface DataTableColumnResizeHandleProps<TData> {
  header: Header<TData, unknown>;
}

interface ResizeOverlayHost {
  overlayRoot: HTMLElement;
  scrollViewport: HTMLElement;
  headerCell: HTMLTableCellElement;
}

interface ResizePreviewSession {
  startX: number;
  startWidth: number;
  minSize: number;
  maxSize: number;
}

/**
 * 从当前 handle 反查 overlay 预览所需的宿主节点。
 * 这里依赖 DataTable 提供的稳定 data 属性，而不是写死具体 DOM 结构层级。
 */
function findResizeOverlayHost(target: HTMLElement): ResizeOverlayHost | null {
  const overlayRoot = target.closest('[data-table-resize-overlay-root]') as HTMLElement | null;
  const scrollViewport = overlayRoot?.querySelector(
    '[data-slot="scroll-area-viewport"]'
  ) as HTMLElement | null;
  const headerCell = target.closest('th') as HTMLTableCellElement | null;

  if (!overlayRoot || !scrollViewport || !headerCell) {
    return null;
  }

  return {
    overlayRoot,
    scrollViewport,
    headerCell
  };
}

/**
 * 解析列宽边界和 overlay 的水平起点。
 * 这些值在一次拖拽会话里是稳定的，适合在拖拽开始时一次性计算。
 */
function createResizePreviewSession<TData>({
  header,
  host,
  startX,
  startWidth
}: {
  header: Header<TData, unknown>;
  host: ResizeOverlayHost;
  startX: number;
  startWidth: number;
}): ResizePreviewSession & { columnLeft: number } {
  const columnDef = header.column.columnDef;

  return {
    startX,
    startWidth,
    minSize: columnDef.minSize ?? 80,
    maxSize: columnDef.maxSize ?? Number.MAX_SAFE_INTEGER,
    columnLeft: calculateOverlayLeft({
      columnLeft: host.headerCell.getBoundingClientRect().left,
      rootLeft: host.overlayRoot.getBoundingClientRect().left,
      scrollLeft: host.scrollViewport.scrollLeft
    })
  };
}

/**
 * 解析 overlay 的主题色。
 * 主题变量既可能是完整的 `oklch(...) / hsl(...)`，也可能只是原始 HSL 分量，
 * 这里统一转换成可直接写入内联样式的边线和背景色。
 */
function resolveOverlayThemeStyles() {
  const primaryValue = getComputedStyle(document.documentElement)
    .getPropertyValue('--primary')
    .trim();
  const functionMatch = primaryValue.match(/^(oklch|hsl)\((.+)\)$/);

  if (functionMatch) {
    const colorFunction = functionMatch[1];
    const colorComponents = functionMatch[2];

    return {
      borderRight: `2px solid ${colorFunction}(${colorComponents} / 0.6)`,
      background: `${colorFunction}(${colorComponents} / 0.05)`
    };
  }

  if (primaryValue) {
    return {
      borderRight: `2px solid hsl(${primaryValue} / 0.6)`,
      background: `hsl(${primaryValue} / 0.05)`
    };
  }

  return {
    borderRight: '2px solid rgba(0,0,0,0.15)',
    background: 'rgba(0,0,0,0.04)'
  };
}

/**
 * 创建拖拽中的列宽预览 overlay。
 * 它只负责视觉反馈，不接管事件，因此 pointer-events 始终为 none。
 */
function createResizePreviewOverlay({
  overlayRoot,
  columnLeft,
  startWidth
}: {
  overlayRoot: HTMLElement;
  columnLeft: number;
  startWidth: number;
}) {
  const overlay = document.createElement('div');
  const themeStyles = resolveOverlayThemeStyles();

  overlay.style.position = 'absolute';
  overlay.style.top = '0';
  overlay.style.left = `${columnLeft}px`;
  overlay.style.zIndex = '20';
  overlay.style.height = '100%';
  overlay.style.width = `${startWidth}px`;
  overlay.style.pointerEvents = 'none';
  overlay.style.willChange = 'width';
  overlay.style.borderRight = themeStyles.borderRight;
  overlay.style.background = themeStyles.background;

  overlayRoot.appendChild(overlay);

  return overlay;
}

/**
 * 根据拖拽位移更新 overlay 宽度预览。
 * 这里先对 delta 做一次夹紧，避免用户拖出 min/max 之后再反向拖动时出现“死区”。
 */
function updateResizePreviewWidth({
  overlay,
  rawDeltaX,
  session
}: {
  overlay: HTMLDivElement;
  rawDeltaX: number;
  session: ResizePreviewSession;
}) {
  const deltaX = Math.min(
    Math.max(rawDeltaX, session.minSize - session.startWidth),
    session.maxSize - session.startWidth
  );
  const previewWidth = clampWidth(
    session.startWidth,
    deltaX,
    session.minSize,
    session.maxSize
  );

  requestAnimationFrame(() => {
    if (overlay.isConnected) {
      overlay.style.width = `${previewWidth}px`;
    }
  });
}

export function DataTableColumnResizeHandle<TData>({
  header
}: DataTableColumnResizeHandleProps<TData>) {
  const resizeHandler = useMemo(() => header.getResizeHandler(), [header]);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  /**
   * 移除当前拖拽预览 overlay。
   * 这个 helper 只处理 DOM 清理，不负责恢复 body 样式或解绑 document 事件。
   */
  const removeOverlay = useCallback(() => {
    overlayRef.current?.remove();
    overlayRef.current = null;
  }, []);

  /**
   * 基于起始宽度和宿主节点信息，创建一次拖拽预览会话。
   * 如果当前环境不支持 overlay 预览，就返回 null 让调用方回退到 TanStack 原生 resize。
   */
  const beginPreviewSession = useCallback(
    ({
      target,
      startX,
      startWidth
    }: {
      target: HTMLElement;
      startX: number;
      startWidth: number;
    }) => {
      const host = findResizeOverlayHost(target);

      if (!host) {
        return null;
      }

      const session = createResizePreviewSession({
        header,
        host,
        startX,
        startWidth
      });

      overlayRef.current = createResizePreviewOverlay({
        overlayRoot: host.overlayRoot,
        columnLeft: session.columnLeft,
        startWidth: session.startWidth
      });

      return session;
    },
    [header]
  );

  /**
   * 鼠标拖拽分支：
   * 1. 进入拖拽前锁定 body 的 user-select / cursor
   * 2. 创建 overlay 预览
   * 3. 调用 TanStack 原生 resize handler，维持现有 column sizing 状态流
   * 4. 通过 document 级事件驱动预览宽度和结束清理
   */
  const handleMouseDown = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();

      const prevUserSelect = document.body.style.userSelect;
      const prevCursor = document.body.style.cursor;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';

      const session = beginPreviewSession({
        target: event.currentTarget,
        startX: event.clientX,
        startWidth: header.getSize()
      });

      if (!session) {
        resizeHandler(event);
        return;
      }

      resizeHandler(event);

      const restoreBodyStyles = () => {
        document.body.style.userSelect = prevUserSelect;
        document.body.style.cursor = prevCursor;
      };

      const moveHandler = (moveEvent: MouseEvent) => {
        if (!overlayRef.current) {
          return;
        }

        updateResizePreviewWidth({
          overlay: overlayRef.current,
          rawDeltaX: moveEvent.clientX - session.startX,
          session
        });
      };

      const cleanup = () => {
        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('mouseup', upHandler);
        document.removeEventListener('keydown', keyHandler);
        restoreBodyStyles();
        removeOverlay();
      };

      const upHandler = () => {
        cleanup();
      };

      const keyHandler = (keyboardEvent: KeyboardEvent) => {
        if (keyboardEvent.key !== 'Escape') {
          return;
        }

        cleanup();

        // Escape 的语义是“取消本次拖拽”，因此这里显式恢复拖拽前的列宽。
        const table = header.getContext().table;
        table.setColumnSizing((old) => ({
          ...old,
          [header.column.id]: session.startWidth
        }));
      };

      document.addEventListener('mousemove', moveHandler);
      document.addEventListener('mouseup', upHandler);
      document.addEventListener('keydown', keyHandler);
    },
    [beginPreviewSession, header, removeOverlay, resizeHandler]
  );

  /**
   * 触摸拖拽分支：
   * 保持现有行为不变，只做结构整理。
   * 注意这里沿用原实现的 startWidth 计算方式：减去 handle 宽度的一半，
   * 以维持当前触摸视觉对齐效果。
   */
  const handleTouchStart = useCallback(
    (event: ReactTouchEvent<HTMLDivElement>) => {
      event.stopPropagation();

      const touch = event.touches[0];
      if (!touch) {
        return;
      }

      const prevUserSelect = document.body.style.userSelect;
      const handleElement = event.currentTarget;
      const startWidth = header.getSize() - handleElement.offsetWidth / 2;
      const session = beginPreviewSession({
        target: handleElement,
        startX: touch.clientX,
        startWidth
      });

      if (!session) {
        resizeHandler(event);
        return;
      }

      resizeHandler(event);

      const moveHandler = (moveEvent: TouchEvent) => {
        if (!overlayRef.current) {
          return;
        }

        const currentTouch = moveEvent.touches[0];
        if (!currentTouch) {
          return;
        }

        updateResizePreviewWidth({
          overlay: overlayRef.current,
          rawDeltaX: currentTouch.clientX - session.startX,
          session
        });
      };

      const cleanup = () => {
        document.removeEventListener('touchmove', moveHandler);
        document.removeEventListener('touchend', cleanup);
        document.removeEventListener('touchcancel', cleanup);
        document.body.style.userSelect = prevUserSelect;
        removeOverlay();
      };

      document.addEventListener('touchmove', moveHandler);
      document.addEventListener('touchend', cleanup);
      document.addEventListener('touchcancel', cleanup);
    },
    [beginPreviewSession, header, removeOverlay, resizeHandler]
  );

  if (!header.column.getCanResize()) {
    return null;
  }

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- 该 handle 只承载鼠标/触摸拖拽；TanStack Table 当前不提供键盘列宽调整模型
    <div
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className='absolute top-0 right-0 h-full w-6 cursor-col-resize select-none touch-none z-10
        before:absolute before:inset-y-0 before:left-1/1 before:-translate-x-px before:w-px
        hover:before:bg-border
        data-[resizing=true]:before:bg-primary/30'
      data-resizing={header.column.getIsResizing()}
    />
  );
}
