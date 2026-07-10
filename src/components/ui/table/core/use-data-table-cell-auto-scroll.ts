import { useCallback, useEffect, useRef, type RefObject } from 'react';

type DataTableCellClientRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

type DataTableCellPointerPosition = {
  clientX: number;
  clientY: number;
};

type DataTableCellAutoScrollPointer = DataTableCellPointerPosition & {
  cellSize: number;
};

type DataTableCellAutoScrollDelta = {
  left: number;
  top: number;
};

export type DataTableRtlScrollType = 'negative' | 'reverse';

const EDGE_THRESHOLD_RATIO = 0.75;
const EDGE_THRESHOLD_MIN_PX = 24;
const EDGE_THRESHOLD_MAX_PX = 56;
const MAX_SPEED_RATIO = 0.5;
const MAX_SPEED_MIN_PX = 12;
const MAX_SPEED_MAX_PX = 32;
const MIN_SPEED_RATIO = 0.2;
const MIN_SPEED_MIN_PX = 3;

export function resolveDataTableCellAutoScrollMetrics(cellSize: number) {
  const safeCellSize = Number.isFinite(cellSize) && cellSize > 0 ? cellSize : 40;
  const edgeThreshold = Math.max(
    EDGE_THRESHOLD_MIN_PX,
    Math.min(safeCellSize * EDGE_THRESHOLD_RATIO, EDGE_THRESHOLD_MAX_PX)
  );
  const maxSpeed = Math.max(
    MAX_SPEED_MIN_PX,
    Math.min(safeCellSize * MAX_SPEED_RATIO, MAX_SPEED_MAX_PX)
  );
  const minSpeed = Math.max(MIN_SPEED_MIN_PX, maxSpeed * MIN_SPEED_RATIO);
  return { edgeThreshold, minSpeed, maxSpeed };
}

export function intersectDataTableCellClientRects(
  rects: readonly DataTableCellClientRect[]
): DataTableCellClientRect | null {
  const first = rects[0];
  if (!first) return null;

  const intersection = rects.slice(1).reduce(
    (current, rect) => ({
      left: Math.max(current.left, rect.left),
      top: Math.max(current.top, rect.top),
      right: Math.min(current.right, rect.right),
      bottom: Math.min(current.bottom, rect.bottom)
    }),
    {
      left: first.left,
      top: first.top,
      right: first.right,
      bottom: first.bottom
    }
  );

  return intersection.right > intersection.left && intersection.bottom > intersection.top
    ? intersection
    : null;
}

function resolveAxisAutoScrollDelta(
  pointer: number,
  start: number,
  end: number,
  edgeThreshold: number,
  minSpeed: number,
  maxSpeed: number
) {
  const startDepth = start + edgeThreshold - pointer;
  if (startDepth > 0) {
    const ratio = Math.min(1, startDepth / edgeThreshold);
    return -(minSpeed + (maxSpeed - minSpeed) * ratio);
  }

  const endDepth = pointer - (end - edgeThreshold);
  if (endDepth > 0) {
    const ratio = Math.min(1, endDepth / edgeThreshold);
    return minSpeed + (maxSpeed - minSpeed) * ratio;
  }

  return 0;
}

export function getDataTableCellAutoScrollDelta(
  pointer: DataTableCellPointerPosition,
  rect: DataTableCellClientRect,
  cellSize: number
): DataTableCellAutoScrollDelta {
  const { edgeThreshold, minSpeed, maxSpeed } = resolveDataTableCellAutoScrollMetrics(cellSize);
  return {
    left: resolveAxisAutoScrollDelta(
      pointer.clientX,
      rect.left,
      rect.right,
      edgeThreshold,
      minSpeed,
      maxSpeed
    ),
    top: resolveAxisAutoScrollDelta(
      pointer.clientY,
      rect.top,
      rect.bottom,
      edgeThreshold,
      minSpeed,
      maxSpeed
    )
  };
}

export function normalizeDataTableCellScrollLeft(
  scrollLeft: number,
  maxScrollLeft: number,
  direction: 'ltr' | 'rtl',
  rtlScrollType: DataTableRtlScrollType
) {
  if (direction === 'ltr') return scrollLeft;
  return rtlScrollType === 'negative' ? Math.abs(scrollLeft) : maxScrollLeft - scrollLeft;
}

function isClippingElement(element: HTMLElement) {
  const style = getComputedStyle(element);
  const clippingValues = new Set(['auto', 'scroll', 'hidden', 'clip']);
  return clippingValues.has(style.overflowX) || clippingValues.has(style.overflowY);
}

function getVisualViewportRect(): DataTableCellClientRect | null {
  const viewport = window.visualViewport;
  if (!viewport) return null;
  return {
    left: viewport.offsetLeft,
    top: viewport.offsetTop,
    right: viewport.offsetLeft + viewport.width,
    bottom: viewport.offsetTop + viewport.height
  };
}

export function getDataTableCellEffectiveVisibleRect(viewport: HTMLElement) {
  const rects: DataTableCellClientRect[] = [viewport.getBoundingClientRect()];
  let ancestor = viewport.parentElement;
  while (ancestor && ancestor !== document.body) {
    if (isClippingElement(ancestor)) rects.push(ancestor.getBoundingClientRect());
    ancestor = ancestor.parentElement;
  }
  const visualViewportRect = getVisualViewportRect();
  if (visualViewportRect) rects.push(visualViewportRect);
  return intersectDataTableCellClientRects(rects);
}

function detectDataTableRtlScrollType(viewport: HTMLElement): DataTableRtlScrollType {
  if (viewport.scrollLeft < 0) return 'negative';
  const initial = viewport.scrollLeft;
  viewport.scrollLeft = 1;
  const type = viewport.scrollLeft === 0 ? 'negative' : 'reverse';
  viewport.scrollLeft = initial;
  return type;
}

function clampDataTableCellAutoScrollDelta(
  viewport: HTMLElement,
  delta: DataTableCellAutoScrollDelta
): DataTableCellAutoScrollDelta {
  const direction = getComputedStyle(viewport).direction === 'rtl' ? 'rtl' : 'ltr';
  const maxScrollLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);
  const maxScrollTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
  const rtlScrollType = direction === 'rtl' ? detectDataTableRtlScrollType(viewport) : 'negative';
  const normalizedLeft = normalizeDataTableCellScrollLeft(
    viewport.scrollLeft,
    maxScrollLeft,
    direction,
    rtlScrollType
  );
  const logicalLeftDelta = direction === 'rtl' ? -delta.left : delta.left;

  return {
    left:
      (logicalLeftDelta < 0 && normalizedLeft <= 0) ||
      (logicalLeftDelta > 0 && normalizedLeft >= maxScrollLeft)
        ? 0
        : delta.left,
    top:
      (delta.top < 0 && viewport.scrollTop <= 0) ||
      (delta.top > 0 && viewport.scrollTop >= maxScrollTop)
        ? 0
        : delta.top
  };
}

export function useDataTableCellAutoScroll({
  viewportRef,
  onScrollFrame
}: {
  viewportRef: RefObject<HTMLDivElement | null>;
  onScrollFrame: (pointer: DataTableCellPointerPosition) => void;
}) {
  const pointerRef = useRef<DataTableCellAutoScrollPointer | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const onScrollFrameRef = useRef(onScrollFrame);
  const runFrameRef = useRef<FrameRequestCallback>(() => undefined);
  onScrollFrameRef.current = onScrollFrame;

  const stop = useCallback(() => {
    pointerRef.current = null;
    if (animationFrameRef.current !== null) {
      window.cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  runFrameRef.current = () => {
    animationFrameRef.current = null;
    const pointer = pointerRef.current;
    const viewport = viewportRef.current;
    if (!pointer || !viewport) return;

    const visibleRect = getDataTableCellEffectiveVisibleRect(viewport);
    if (!visibleRect) {
      stop();
      return;
    }

    const delta = clampDataTableCellAutoScrollDelta(
      viewport,
      getDataTableCellAutoScrollDelta(pointer, visibleRect, pointer.cellSize)
    );
    if (delta.left === 0 && delta.top === 0) return;

    viewport.scrollBy({ behavior: 'auto', left: delta.left, top: delta.top });
    onScrollFrameRef.current({ clientX: pointer.clientX, clientY: pointer.clientY });
    animationFrameRef.current = window.requestAnimationFrame((time) => runFrameRef.current(time));
  };

  const updatePointer = useCallback(
    (pointer: DataTableCellAutoScrollPointer) => {
      pointerRef.current = pointer;
      const viewport = viewportRef.current;
      const visibleRect = viewport ? getDataTableCellEffectiveVisibleRect(viewport) : null;
      const delta = visibleRect
        ? clampDataTableCellAutoScrollDelta(
            viewport!,
            getDataTableCellAutoScrollDelta(pointer, visibleRect, pointer.cellSize)
          )
        : { left: 0, top: 0 };

      if (delta.left === 0 && delta.top === 0) {
        if (animationFrameRef.current !== null) {
          window.cancelAnimationFrame(animationFrameRef.current);
          animationFrameRef.current = null;
        }
        return;
      }
      if (animationFrameRef.current === null) {
        animationFrameRef.current = window.requestAnimationFrame((time) =>
          runFrameRef.current(time)
        );
      }
    },
    [viewportRef]
  );

  useEffect(() => stop, [stop]);

  return { stop, updatePointer };
}
