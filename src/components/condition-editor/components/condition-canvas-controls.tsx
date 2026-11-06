import { useReactFlow } from '@xyflow/react';
import * as React from 'react';

import { CanvasExpandButton } from '@/components/canvas/canvas-expand-button';
import { CanvasToolbar, CanvasToolbarButton } from '@/components/canvas/canvas-toolbar';
import { CanvasViewportControls } from '@/components/canvas/canvas-viewport-controls';
import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { ButtonGroup } from '@/components/ui/button-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useOverlayPortalContainer } from '@/components/ui/use-overlay-portal-container';

import { useRoutingCanvasOverlayOpen } from './routing-canvas-overlay-context';

export const ROUTING_CANVAS_FIT_VIEW_OPTIONS = { padding: 0.18 } as const;
export const ROUTING_CANVAS_INITIAL_ZOOM = 0.8;
export const ROUTING_CANVAS_MIN_ZOOM = 0.25;
export const ROUTING_CANVAS_MAX_ZOOM = 1.6;
export const ROUTING_CANVAS_DEFAULT_VIEW_OPTIONS = {
  ...ROUTING_CANVAS_FIT_VIEW_OPTIONS,
  minZoom: ROUTING_CANVAS_INITIAL_ZOOM,
  maxZoom: ROUTING_CANVAS_INITIAL_ZOOM
} as const;

interface RoutingCanvasViewportControlsProps {
  readonly children?: React.ReactNode;
  readonly canRedo: boolean;
  readonly canUndo: boolean;
  readonly disabled: boolean;
  readonly expanded: boolean;
  readonly expandButtonRef?: React.Ref<HTMLButtonElement>;
  readonly layoutRevision: number;
  readonly onExpandedChange: (expanded: boolean) => void;
  readonly onRedo: () => void;
  readonly onUndo: () => void;
  readonly onViewportTransition: (transition: Promise<boolean>) => void;
}

export function RoutingCanvasViewportControls({
  children,
  canRedo,
  canUndo,
  disabled,
  expanded,
  expandButtonRef,
  layoutRevision,
  onExpandedChange,
  onRedo,
  onUndo,
  onViewportTransition
}: RoutingCanvasViewportControlsProps) {
  const { fitView } = useReactFlow();
  const initialLayoutRevisionRef = React.useRef(layoutRevision);

  React.useEffect(() => {
    // React Flow's fitView prop handles the initial viewport. A second animated fit on mount
    // keeps changing the target snapshot while the canvas hero transition is running.
    if (layoutRevision === initialLayoutRevisionRef.current) return;
    onViewportTransition(fitView({ ...ROUTING_CANVAS_FIT_VIEW_OPTIONS, duration: 180 }));
  }, [fitView, layoutRevision, onViewportTransition]);

  return (
    <CanvasToolbar>
      <CanvasToolbarButton
        label='撤销条件修改'
        tooltip='撤销条件修改（Ctrl/Cmd + Z）'
        disabled={disabled || !canUndo}
        onClick={onUndo}
      >
        <Icons.undo className='size-4' />
      </CanvasToolbarButton>
      <CanvasToolbarButton
        label='恢复条件修改'
        tooltip='恢复条件修改（Ctrl/Cmd + Shift + Z）'
        disabled={disabled || !canRedo}
        onClick={onRedo}
      >
        <Icons.redo className='size-4' />
      </CanvasToolbarButton>
      <CanvasViewportControls
        minZoom={ROUTING_CANVAS_MIN_ZOOM}
        maxZoom={ROUTING_CANVAS_MAX_ZOOM}
        fitViewOptions={ROUTING_CANVAS_FIT_VIEW_OPTIONS}
        onViewportTransition={onViewportTransition}
      />
      <CanvasExpandButton
        expanded={expanded}
        onExpandedChange={onExpandedChange}
        ref={expandButtonRef}
        expandLabel='放大编辑画布'
        collapseLabel='退出放大编辑'
      />
      {children}
    </CanvasToolbar>
  );
}

export interface RoutingCanvasPaletteProps {
  readonly conditionDisabledReason?: string;
  readonly groupDisabledReason?: string;
  readonly onAddCondition: () => void;
  readonly onAddGroup: (logic: 'AND' | 'OR') => void;
  readonly targetLabel: string;
}

export function RoutingCanvasPalettePopover(props: RoutingCanvasPaletteProps) {
  const overlay = useRoutingCanvasOverlayOpen('palette');
  const { container, setTriggerNode, triggerRef } = useOverlayPortalContainer<HTMLButtonElement>(
    '[data-slot="canvas-content"]'
  );
  return (
    <Popover onOpenChange={overlay.onOpenChange} open={overlay.open}>
      <PopoverTrigger asChild>
        <CanvasToolbarButton label='添加节点' ref={setTriggerNode}>
          <Icons.add className='size-4' />
        </CanvasToolbarButton>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        aria-label='条件节点面板'
        className='w-72'
        container={container}
        finalFocus={triggerRef}
      >
        <RoutingCanvasPaletteContent
          {...props}
          onAddCondition={() => {
            props.onAddCondition();
            overlay.onOpenChange(false);
          }}
          onAddGroup={(logic) => {
            props.onAddGroup(logic);
            overlay.onOpenChange(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}

function RoutingCanvasPaletteContent({
  conditionDisabledReason,
  groupDisabledReason,
  onAddCondition,
  onAddGroup,
  targetLabel
}: RoutingCanvasPaletteProps) {
  return (
    <div className='flex min-h-0 flex-col gap-4'>
      <div className='flex flex-col gap-1'>
        <h4 className='text-sm font-semibold'>添加节点</h4>
        <p className='text-muted-foreground truncate text-xs' title={targetLabel}>
          添加到：{targetLabel}
        </p>
      </div>
      <div className='flex min-h-0 flex-col gap-2'>
        <p className='text-muted-foreground text-xs font-medium'>节点类型</p>
        <ButtonGroup aria-label='添加节点类型' className='w-full' orientation='vertical'>
          <Button
            className='justify-start'
            disabled={conditionDisabledReason !== undefined}
            onClick={onAddCondition}
            title={conditionDisabledReason ?? '添加命中条件'}
            type='button'
            variant='outline'
          >
            <Icons.circle className='size-4' data-icon='inline-start' />
            命中条件
          </Button>
          <Button
            className='justify-start'
            disabled={groupDisabledReason !== undefined}
            onClick={() => onAddGroup('AND')}
            title={groupDisabledReason ?? '添加且条件组'}
            type='button'
            variant='outline'
          >
            且 AND
          </Button>
          <Button
            className='justify-start'
            disabled={groupDisabledReason !== undefined}
            onClick={() => onAddGroup('OR')}
            title={groupDisabledReason ?? '添加或条件组'}
            type='button'
            variant='outline'
          >
            或 OR
          </Button>
        </ButtonGroup>
      </div>
    </div>
  );
}
