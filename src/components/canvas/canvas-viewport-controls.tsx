import { useReactFlow, useViewport, type FitViewOptions } from '@xyflow/react';
import { CanvasZoomControls } from './canvas-zoom-controls';

const DEFAULT_FIT_VIEW_OPTIONS = { padding: 0.18 };

interface CanvasViewportControlsProps {
  minZoom?: number;
  maxZoom?: number;
  fitViewOptions?: FitViewOptions;
  onViewportTransition?: (transition: Promise<boolean>) => void;
}

export function CanvasViewportControls({
  minZoom = 0.25,
  maxZoom = 1.6,
  fitViewOptions = DEFAULT_FIT_VIEW_OPTIONS,
  onViewportTransition
}: CanvasViewportControlsProps) {
  const { fitView, getViewport, setViewport } = useReactFlow();
  const { zoom } = useViewport();

  return (
    <CanvasZoomControls
      zoom={zoom}
      minZoom={minZoom}
      maxZoom={maxZoom}
      onZoom={(factor) => {
        const viewport = getViewport();
        const transition = setViewport(
          { ...viewport, zoom: Math.min(maxZoom, Math.max(minZoom, viewport.zoom * factor)) },
          { duration: 120, interpolate: 'linear' }
        );
        onViewportTransition?.(transition);
      }}
      onReset={() => {
        const transition = fitView({ minZoom, maxZoom, ...fitViewOptions, duration: 180 });
        onViewportTransition?.(transition);
      }}
    />
  );
}
