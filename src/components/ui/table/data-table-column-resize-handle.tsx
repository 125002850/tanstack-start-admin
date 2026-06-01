import { useCallback, useMemo, useRef } from 'react';
import type { Header } from '@tanstack/react-table';
import { clampWidth, calculateOverlayLeft } from '@/lib/data-table-column-resize-overlay';

interface DataTableColumnResizeHandleProps<TData> {
  header: Header<TData, unknown>;
}

export function DataTableColumnResizeHandle<TData>({
  header
}: DataTableColumnResizeHandleProps<TData>) {
  const resizeHandler = useMemo(() => header.getResizeHandler(), [header]);

  const overlayRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<{
    startX: number;
    startWidth: number;
    minSize: number;
    maxSize: number;
    columnLeft: number;
    overlayRoot: HTMLElement;
    scrollViewport: HTMLElement;
    prevUserSelect: string;
    prevCursor: string;
    moveHandler: (e: MouseEvent) => void;
    upHandler: (e: MouseEvent) => void;
    keyHandler: (e: KeyboardEvent) => void;
  } | null>(null);

  const handleMouseDown = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      // ── Save pre-drag body styles ──
      const prevUserSelect = document.body.style.userSelect;
      const prevCursor = document.body.style.cursor;
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';

      // ── Find overlay mount points via stable data attributes ──
      const overlayRoot = event.currentTarget.closest(
        '[data-table-resize-overlay-root]'
      ) as HTMLElement | null;
      const scrollViewport = overlayRoot?.querySelector(
        '[data-slot="scroll-area-viewport"]'
      ) as HTMLElement | null;

      if (!overlayRoot || !scrollViewport) {
        // No overlay-capable container — fall back to plain resize
        resizeHandler(event);
        return;
      }

      const th = event.currentTarget.closest('th') as HTMLTableCellElement | null;
      if (!th) {
        resizeHandler(event);
        return;
      }

      // ── Read column metrics ──
      const handleElem = event.currentTarget as HTMLElement;
      const handleWidth = handleElem.offsetWidth;
      const startX = event.clientX;
      const startWidth = header.getSize() - handleWidth / 2;
      const columnDef = header.column.columnDef;
      const minSize = columnDef.minSize ?? 80;
      const maxSize = columnDef.maxSize ?? Number.MAX_SAFE_INTEGER;
      const columnLeft = calculateOverlayLeft({
        columnLeft: th.getBoundingClientRect().left,
        rootLeft: overlayRoot.getBoundingClientRect().left,
        scrollLeft: scrollViewport.scrollLeft
      });
      // ── Create overlay div ──
      const overlay = document.createElement('div');
      overlay.style.position = 'absolute';
      overlay.style.top = '0';
      overlay.style.zIndex = '20';
      overlay.style.height = '100%';
      overlay.style.pointerEvents = 'none';
      overlay.style.willChange = 'width';
      overlay.style.left = `${columnLeft}px`;
      overlay.style.width = `${startWidth}px`;

      // Resolve --primary to a concrete color value with the right alpha.
      // Themes may store it as a full color function (oklch/hsl/rgb) or as
      // raw HSL components — we detect the format and mirror it.
      const primaryVal = getComputedStyle(document.documentElement)
        .getPropertyValue('--primary')
        .trim();
      const fnMatch = primaryVal.match(/^(oklch|hsl)\((.+)\)$/);
      if (fnMatch) {
        // Full color-function format: e.g. oklch(0.65 0.24 27)
        const fn = fnMatch[1];
        const components = fnMatch[2];
        overlay.style.borderRight = `2px solid ${fn}(${components} / 0.6)`;
        overlay.style.background = `${fn}(${components} / 0.05)`;
      } else if (primaryVal) {
        // Raw HSL component format: e.g. "210 100% 50%"
        overlay.style.borderRight = `2px solid hsl(${primaryVal} / 0.6)`;
        overlay.style.background = `hsl(${primaryVal} / 0.05)`;
      } else {
        overlay.style.borderRight = '2px solid rgba(0,0,0,0.15)';
        overlay.style.background = 'rgba(0,0,0,0.04)';
      }

      overlayRoot.appendChild(overlay);
      overlayRef.current = overlay;

      // ── Call TanStack resize handler (sets isResizingColumn) ──
      resizeHandler(event);

      // ── Register document-level handlers ──
      const moveHandler = (e: MouseEvent) => {
        if (!overlayRef.current) return;
        const rawDeltaX = e.clientX - startX;
        // Clamp rawDeltaX to the column's effective range so that excess
        // dragging past minSize/maxSize does not create a dead zone — when
        // the user reverses direction the preview responds immediately.
        const deltaX = Math.min(Math.max(rawDeltaX, minSize - startWidth), maxSize - startWidth);
        const previewWidth = clampWidth(startWidth, deltaX, minSize, maxSize);
        requestAnimationFrame(() => {
          if (overlayRef.current) {
            overlayRef.current.style.width = `${previewWidth}px`;
          }
        });
      };

      const upHandler = (_e: MouseEvent) => {
        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('mouseup', upHandler);
        document.removeEventListener('keydown', keyHandler);

        document.body.style.userSelect = prevUserSelect;
        document.body.style.cursor = prevCursor;

        overlayRef.current?.remove();
        overlayRef.current = null;
        dragStateRef.current = null;
      };

      const keyHandler = (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return;

        document.removeEventListener('mousemove', moveHandler);
        document.removeEventListener('mouseup', upHandler);
        document.removeEventListener('keydown', keyHandler);

        document.body.style.userSelect = prevUserSelect;
        document.body.style.cursor = prevCursor;

        overlayRef.current?.remove();
        overlayRef.current = null;

        // Restore column to pre-drag width via table.setColumnSizing
        const table = header.getContext().table;
        table.setColumnSizing((old) => ({
          ...old,
          [header.column.id]: startWidth
        }));

        dragStateRef.current = null;
      };

      document.addEventListener('mousemove', moveHandler);
      document.addEventListener('mouseup', upHandler);
      document.addEventListener('keydown', keyHandler);

      dragStateRef.current = {
        startX,
        startWidth,
        minSize,
        maxSize,
        columnLeft,
        overlayRoot,
        scrollViewport,
        prevUserSelect,
        prevCursor,
        moveHandler,
        upHandler,
        keyHandler
      };
    },
    [resizeHandler, header]
  );

  const handleTouchStart = useCallback(
    (event: React.TouchEvent) => {
      event.stopPropagation();
      const prevUserSelect = document.body.style.userSelect;

      const overlayRoot = event.currentTarget.closest(
        '[data-table-resize-overlay-root]'
      ) as HTMLElement | null;
      const scrollViewport = overlayRoot?.querySelector(
        '[data-slot="scroll-area-viewport"]'
      ) as HTMLElement | null;

      if (!overlayRoot || !scrollViewport) {
        resizeHandler(event);
        return;
      }

      const th = event.currentTarget.closest('th') as HTMLTableCellElement | null;
      if (!th) {
        resizeHandler(event);
        return;
      }

      const touch = event.touches[0];
      if (!touch) return;

      const handleElem = event.currentTarget as HTMLElement;
      const handleWidth = handleElem.offsetWidth;
      const startX = touch.clientX;
      const startWidth = header.getSize() - handleWidth / 2;
      const columnDef = header.column.columnDef;
      const minSize = columnDef.minSize ?? 80;
      const maxSize = columnDef.maxSize ?? Number.MAX_SAFE_INTEGER;
      const columnLeft = calculateOverlayLeft({
        columnLeft: th.getBoundingClientRect().left,
        rootLeft: overlayRoot.getBoundingClientRect().left,
        scrollLeft: scrollViewport.scrollLeft
      });

      const overlay = document.createElement('div');
      overlay.style.position = 'absolute';
      overlay.style.top = '0';
      overlay.style.zIndex = '20';
      overlay.style.height = '100%';
      overlay.style.pointerEvents = 'none';
      overlay.style.willChange = 'width';
      overlay.style.left = `${columnLeft}px`;
      overlay.style.width = `${startWidth}px`;

      // Resolve --primary to a concrete color value with the right alpha.
      // Themes may store it as a full color function (oklch/hsl/rgb) or as
      // raw HSL components — we detect the format and mirror it.
      const primaryVal = getComputedStyle(document.documentElement)
        .getPropertyValue('--primary')
        .trim();
      const fnMatch = primaryVal.match(/^(oklch|hsl)\((.+)\)$/);
      if (fnMatch) {
        // Full color-function format: e.g. oklch(0.65 0.24 27)
        const fn = fnMatch[1];
        const components = fnMatch[2];
        overlay.style.borderRight = `2px solid ${fn}(${components} / 0.6)`;
        overlay.style.background = `${fn}(${components} / 0.05)`;
      } else if (primaryVal) {
        // Raw HSL component format: e.g. "210 100% 50%"
        overlay.style.borderRight = `2px solid hsl(${primaryVal} / 0.6)`;
        overlay.style.background = `hsl(${primaryVal} / 0.05)`;
      } else {
        overlay.style.borderRight = '2px solid rgba(0,0,0,0.15)';
        overlay.style.background = 'rgba(0,0,0,0.04)';
      }

      overlayRoot.appendChild(overlay);
      overlayRef.current = overlay;

      resizeHandler(event);

      const moveHandler = (e: TouchEvent) => {
        if (!overlayRef.current) return;
        const t = e.touches[0];
        if (!t) return;
        const rawDeltaX = t.clientX - startX;
        // Same dead-zone elimination as the mouse handler
        const deltaX = Math.min(Math.max(rawDeltaX, minSize - startWidth), maxSize - startWidth);
        const previewWidth = clampWidth(startWidth, deltaX, minSize, maxSize);
        requestAnimationFrame(() => {
          if (overlayRef.current) {
            overlayRef.current.style.width = `${previewWidth}px`;
          }
        });
      };

      const cleanup = () => {
        document.removeEventListener('touchmove', moveHandler);
        document.removeEventListener('touchend', cleanup);
        document.removeEventListener('touchcancel', cleanup);

        document.body.style.userSelect = prevUserSelect;

        overlayRef.current?.remove();
        overlayRef.current = null;
        dragStateRef.current = null;
      };

      document.addEventListener('touchmove', moveHandler);
      document.addEventListener('touchend', cleanup);
      document.addEventListener('touchcancel', cleanup);
    },
    [resizeHandler, header]
  );

  if (!header.column.getCanResize()) return null;

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- resize handle is mouse/touch-only; TanStack Table does not support keyboard column resize
    <div
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className='absolute top-0 right-0 h-full w-8 cursor-col-resize select-none touch-none z-10
        before:absolute before:inset-y-0 before:left-1/2 before:-translate-x-px before:w-px
        hover:before:bg-border
        data-[resizing=true]:before:bg-primary/30'
      data-resizing={header.column.getIsResizing()}
    />
  );
}
