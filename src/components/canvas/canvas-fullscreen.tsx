import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { CanvasFullscreenState } from './use-canvas';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import './canvas-fullscreen.css';

/** Presentation only: useCanvas owns configuration, transitions and viewport synchronization. */
export function CanvasFullscreen({
  fullscreen,
  title,
  description,
  className,
  children
}: {
  fullscreen: CanvasFullscreenState | null;
  title: ReactNode;
  description: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  if (!fullscreen) return children;
  return (
    <FullscreenContent
      fullscreen={fullscreen}
      title={title}
      description={description}
      className={className}
    >
      {children}
    </FullscreenContent>
  );
}

function FullscreenContent({
  fullscreen,
  title,
  description,
  className,
  children
}: {
  fullscreen: CanvasFullscreenState;
  title: ReactNode;
  description: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  const { expanded, transitioning, buttonRef, onExpandedChange, restoreViewport } = fullscreen;
  const inlineRef = useRef<HTMLDivElement>(null);
  const targetRef = useRef<HTMLDivElement | null>(null);
  const [host] = useState(() => {
    const element = document.createElement('div');
    element.className = 'canvas-fullscreen-content';
    element.dataset.slot = 'canvas-content';
    return element;
  });
  const [ready, setReady] = useState(false);
  const inlineHeightRef = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    if (!ready || expanded) return;
    const measure = () => {
      inlineHeightRef.current = host.offsetHeight;
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(host);
    return () => observer.disconnect();
  }, [expanded, host, ready]);
  const move = useCallback(
    (destination: HTMLElement) => {
      if (host.parentElement === destination) return false;
      moveCanvasContent(host, destination);
      setReady(true);
      return true;
    },
    [host]
  );

  useLayoutEffect(() => {
    host.dataset.expanded = String(expanded);
    host.dataset.transitioning = String(transitioning);
    const destination = expanded ? targetRef.current : inlineRef.current;
    if (destination && move(destination)) {
      restoreViewport();
    }
  }, [expanded, host, move, restoreViewport, transitioning]);
  // Move before Dialog's hideOthers/focus effects run. Moving in a later state update
  // would leave the existing renderer marked aria-hidden by the new modal.
  const attachDialog = useCallback(
    (node: HTMLDivElement | null) => {
      targetRef.current = node;
      const destination = node ?? inlineRef.current;
      if (destination && move(destination)) {
        queueMicrotask(restoreViewport);
      }
    },
    [move, restoreViewport]
  );

  return (
    <>
      <div
        ref={inlineRef}
        className={className}
        style={expanded ? { height: inlineHeightRef.current } : undefined}
      />
      <Dialog open={expanded} onOpenChange={onExpandedChange}>
        <DialogContent
          className='canvas-fullscreen-dialog flex h-[calc(100dvh-2rem)] max-h-none w-[calc(100vw-2rem)] max-w-none flex-col gap-3 p-4 sm:max-w-none data-[state=closed]:animate-none data-[state=open]:animate-none'
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            buttonRef.current?.focus({ preventScroll: true });
          }}
          onEscapeKeyDown={(event) => {
            // Base UI popups manage Escape independently of Radix's dialog stack.
            if (
              event.target instanceof Element &&
              event.target.closest('[data-slot="combobox-content"]')
            ) {
              event.preventDefault();
            }
          }}
          onPointerDownOutside={(event) => {
            if (event.target instanceof Node && host.contains(event.target)) event.preventDefault();
          }}
          onFocusOutside={(event) => {
            if (event.target instanceof Node && host.contains(event.target)) event.preventDefault();
          }}
        >
          <DialogHeader className='shrink-0 pr-10'>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          <div ref={attachDialog} className='flex min-h-0 flex-1 flex-col' />
        </DialogContent>
      </Dialog>
      {ready ? createPortal(children, host) : null}
    </>
  );
}

function moveCanvasContent(host: HTMLElement, destination: HTMLElement) {
  // Moving a persistent portal keeps React state. appendChild (Chrome 109) restarts
  // CSS animations, so restore their clocks too, including paused route playback.
  const animations = (host.getAnimations?.({ subtree: true }) ?? []).flatMap((animation) => {
    if (!(animation instanceof CSSAnimation) || !(animation.effect instanceof KeyframeEffect))
      return [];
    const target = animation.effect.target;
    return target ? [{ target, name: animation.animationName, time: animation.currentTime }] : [];
  });
  destination.appendChild(host);
  for (const { target, name, time } of animations) {
    const animation = target
      .getAnimations()
      .find((item) => item instanceof CSSAnimation && item.animationName === name);
    if (animation && time !== null) animation.currentTime = time;
  }
}
