import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import type { Edge, Node, ReactFlowInstance, Viewport } from '@xyflow/react';
import { useOverlayLifecycle } from '@/components/ui/overlay-lifecycle';

const FLOW_DEFAULTS = {
  proOptions: { hideAttribution: true },
  panOnDrag: true,
  panOnScroll: true,
  zoomOnScroll: false,
  zoomOnDoubleClick: false
} as const;

interface CanvasOptions<NodeType extends Node, EdgeType extends Edge> {
  fullscreen?: boolean;
  minZoom?: number;
  maxZoom?: number;
  onInit?: (instance: ReactFlowInstance<NodeType, EdgeType>) => void;
}

/** Shared canvas behavior; node/edge types, layout and editing stay with the caller. */
export function useCanvas<NodeType extends Node = Node, EdgeType extends Edge = Edge>({
  fullscreen: enabled = false,
  minZoom = 0.25,
  maxZoom = 1.6,
  onInit
}: CanvasOptions<NodeType, EdgeType> = {}) {
  const [expanded, setExpanded] = useState(false);
  const [transitioning, setTransitioning] = useState(false);
  const instanceRef = useRef<ReactFlowInstance<NodeType, EdgeType> | null>(null);
  const surfaceRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const onInitRef = useRef(onInit);
  onInitRef.current = onInit;
  const mountedRef = useRef(true);
  const busyRef = useRef(false);
  const expandedRef = useRef(false);
  const requestedExpandedRef = useRef(false);
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const transitionRef = useRef<ViewTransition | null>(null);
  const pendingViewportRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const snapshotRef = useRef<{ viewport: Viewport; width: number; height: number } | null>(null);

  const onViewportTransition = useCallback((transition: Promise<boolean>) => {
    pendingViewportRef.current = transition.catch(() => false);
  }, []);
  const handleInit = useCallback((instance: ReactFlowInstance<NodeType, EdgeType>) => {
    instanceRef.current = instance;
    onInitRef.current?.(instance);
  }, []);
  const flowProps = useMemo(
    () => ({ ...FLOW_DEFAULTS, minZoom, maxZoom, ref: surfaceRef, onInit: handleInit }),
    [minZoom, maxZoom, handleInit]
  );

  // Called after the persistent content has moved and acquired its new dimensions.
  const restoreViewport = useCallback(() => {
    const snapshot = snapshotRef.current;
    const surface = surfaceRef.current;
    const instance = instanceRef.current;
    if (!snapshot || !surface || !instance) return;
    snapshotRef.current = null;
    onViewportTransition(
      instance.setViewport({
        ...snapshot.viewport,
        x: snapshot.viewport.x + (surface.clientWidth - snapshot.width) / 2,
        y: snapshot.viewport.y + (surface.clientHeight - snapshot.height) / 2
      })
    );
  }, [onViewportTransition]);

  const clearTransition = useCallback(() => {
    // Only the owner may clear a transition shared by the document.
    if (transitionRef.current) {
      document.documentElement.removeAttribute('data-canvas-view-transition');
      transitionRef.current = null;
    }
  }, []);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      transitionRef.current?.skipTransition();
      clearTransition();
    };
  }, [clearTransition]);

  const onExpandedChange = useCallback(
    async (requested: boolean) => {
      if (!enabledRef.current || !mountedRef.current) return;
      requestedExpandedRef.current = requested;
      if (busyRef.current) return;
      busyRef.current = true;
      try {
        while (
          mountedRef.current &&
          enabledRef.current &&
          requestedExpandedRef.current !== expandedRef.current
        ) {
          // A topology update can replace a pending zoom with a newer fitView.
          while (true) {
            const pending = pendingViewportRef.current;
            await pending;
            if (!mountedRef.current || !enabledRef.current) return;
            if (pending === pendingViewportRef.current) break;
          }
          const next = requestedExpandedRef.current;
          if (next === expandedRef.current) break;
          const surface = surfaceRef.current;
          const instance = instanceRef.current;
          snapshotRef.current =
            surface && instance
              ? {
                  viewport: instance.getViewport(),
                  width: surface.clientWidth,
                  height: surface.clientHeight
                }
              : null;
          const update = () => {
            if (!mountedRef.current || !enabledRef.current) return;
            expandedRef.current = next;
            flushSync(() => setExpanded(next));
          };
          const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
          if (reduceMotion || typeof document.startViewTransition !== 'function') {
            update();
            continue;
          }
          flushSync(() => setTransitioning(true));
          document.documentElement.setAttribute('data-canvas-view-transition', 'true');
          try {
            const transition = document.startViewTransition(update);
            transitionRef.current = transition;
            await transition.finished.catch(() => undefined);
          } catch {
            document.documentElement.removeAttribute('data-canvas-view-transition');
            update();
          } finally {
            clearTransition();
            if (mountedRef.current) setTransitioning(false);
          }
        }
      } finally {
        busyRef.current = false;
      }
    },
    [clearTransition]
  );

  const close = useCallback(() => {
    void onExpandedChange(false);
  }, [onExpandedChange]);
  useOverlayLifecycle(expanded, close);

  const fullscreen = useMemo(
    () =>
      enabled
        ? {
            expanded,
            transitioning,
            onExpandedChange,
            buttonRef,
            restoreViewport
          }
        : null,
    [enabled, expanded, transitioning, onExpandedChange, restoreViewport]
  );

  return { flowProps, fullscreen, onViewportTransition };
}

export type CanvasFullscreenState = NonNullable<ReturnType<typeof useCanvas>['fullscreen']>;
