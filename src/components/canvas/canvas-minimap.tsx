import { MiniMap, useOnViewportChange, useViewport } from '@xyflow/react';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Keep the overview out of the way until the viewport actually moves. */
export function CanvasMiniMap() {
  const [moving, setMoving] = useState(false);
  const viewport = useViewport();
  const previousViewport = useRef(viewport);
  useEffect(() => {
    previousViewport.current = viewport;
  }, [viewport]);
  useOnViewportChange({
    // The first wheel pan emits only onStart, after its viewport has already changed.
    // Comparing positions also keeps an ordinary pane click from flashing the minimap.
    onStart: useCallback((next) => {
      const previous = previousViewport.current;
      if (next.x !== previous.x || next.y !== previous.y || next.zoom !== previous.zoom) {
        setMoving(true);
      }
    }, []),
    onChange: useCallback(() => setMoving(true), []),
    onEnd: useCallback(() => setMoving(false), [])
  });

  if (!moving) return null;

  return (
    <MiniMap
      ariaLabel='画布导航缩略图'
      position='bottom-right'
      className='pointer-events-none overflow-hidden rounded-md border shadow-sm'
      style={{ width: 160, height: 100 }}
      bgColor='var(--background)'
      nodeColor='var(--muted-foreground)'
      nodeStrokeColor='var(--border)'
      maskColor='var(--canvas-minimap-mask, color-mix(in oklab, var(--background) 72%, transparent))'
    />
  );
}
