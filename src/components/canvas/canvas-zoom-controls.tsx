import { Icons } from '@/components/icons';
import { CanvasToolbarButton } from './canvas-toolbar';

interface CanvasZoomControlsProps {
  zoom: number;
  minZoom: number;
  maxZoom: number;
  onZoom: (factor: number) => void;
  onReset: () => void;
  resetLabel?: string;
}

export function CanvasZoomControls({
  zoom,
  minZoom,
  maxZoom,
  onZoom,
  onReset,
  resetLabel = '适配画布'
}: CanvasZoomControlsProps) {
  return (
    <div role='group' aria-label='画布缩放' className='flex shrink-0 items-center gap-1'>
      <CanvasToolbarButton
        label='缩小画布'
        disabled={zoom <= minZoom}
        onClick={() => onZoom(1 / 1.2)}
      >
        <Icons.zoomOut className='size-4' />
      </CanvasToolbarButton>
      <span aria-label='当前缩放比例' className='min-w-12 text-center text-xs tabular-nums'>
        {Math.round(zoom * 100)}%
      </span>
      <CanvasToolbarButton label='放大画布' disabled={zoom >= maxZoom} onClick={() => onZoom(1.2)}>
        <Icons.zoomIn className='size-4' />
      </CanvasToolbarButton>
      <CanvasToolbarButton label={resetLabel} onClick={onReset}>
        <Icons.zoomToFit className='size-4' />
      </CanvasToolbarButton>
    </div>
  );
}
