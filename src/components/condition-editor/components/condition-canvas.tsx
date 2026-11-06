import {
  Background,
  BackgroundVariant,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  type Edge
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { CanvasFullscreen } from '@/components/canvas/canvas-fullscreen';
import { useCanvas } from '@/components/canvas/use-canvas';
import { CanvasMiniMap } from '@/components/canvas/canvas-minimap';

import {
  ROUTING_CANVAS_DEFAULT_VIEW_OPTIONS,
  ROUTING_CANVAS_MAX_ZOOM,
  ROUTING_CANVAS_MIN_ZOOM,
  RoutingCanvasPalettePopover,
  RoutingCanvasViewportControls
} from './condition-canvas-controls';
import { ROUTING_CANVAS_START_NODE_ID } from './condition-canvas-layout';
import { ROUTING_CANVAS_NODE_TYPES } from './condition-canvas-nodes';
import { RoutingCanvasOverlayProvider } from './routing-canvas-overlay-context';
import type { ConditionCanvasProps, RoutingCanvasNode } from './condition-canvas-types';
import { useConditionCanvasController } from './use-condition-canvas-controller';
import './condition-canvas.css';

export function ConditionCanvas(props: ConditionCanvasProps) {
  return (
    <ReactFlowProvider>
      <RoutingCanvasOverlayProvider>
        <ConditionCanvasInner {...props} />
      </RoutingCanvasOverlayProvider>
    </ReactFlowProvider>
  );
}

function ConditionCanvasInner(props: ConditionCanvasProps) {
  const { canRedo, canUndo, disabled, onRedo, onUndo, ruleName } = props;
  const { flowProps, fullscreen, onViewportTransition } = useCanvas<RoutingCanvasNode, Edge>({
    fullscreen: true,
    minZoom: ROUTING_CANVAS_MIN_ZOOM,
    maxZoom: ROUTING_CANVAS_MAX_ZOOM
  });
  const expanded = fullscreen?.expanded ?? false;
  const {
    edges,
    handleHistoryShortcut,
    layoutRevision,
    nodes,
    onNodesChange,
    paletteProps,
    selectNode
  } = useConditionCanvasController(props);

  return (
    <CanvasFullscreen
      fullscreen={fullscreen}
      title={`放大编辑：${ruleName || '未命名规则'}`}
      description='编辑当前规则的命中条件；关闭后保留条件修改。'
    >
      <div className='routing-canvas-container' data-expanded={expanded ? 'true' : undefined}>
        <div
          aria-label='条件画布'
          className='routing-canvas-shell'
          data-expanded={expanded ? 'true' : undefined}
          data-node-drag-enabled={!disabled}
          data-pan-enabled='true'
          data-slot='routing-condition-canvas'
          onKeyDownCapture={handleHistoryShortcut}
        >
          <div className='routing-canvas'>
            <ReactFlow<RoutingCanvasNode, Edge>
              {...flowProps}
              aria-label='规则条件节点'
              defaultEdgeOptions={{ type: 'smoothstep' }}
              deleteKeyCode={null}
              edges={edges}
              elementsSelectable={false}
              fitView
              fitViewOptions={ROUTING_CANVAS_DEFAULT_VIEW_OPTIONS}
              multiSelectionKeyCode={null}
              nodeTypes={ROUTING_CANVAS_NODE_TYPES}
              nodes={nodes}
              nodesConnectable={false}
              nodesDraggable={!disabled}
              nodesFocusable
              onNodeClick={(_event, node) => selectNode(node.id)}
              onNodesChange={onNodesChange}
              onPaneClick={() => selectNode(ROUTING_CANVAS_START_NODE_ID)}
              preventScrolling
              selectionKeyCode={null}
            >
              <CanvasMiniMap />
              <Background
                color='var(--border)'
                gap={18}
                size={1.2}
                variant={BackgroundVariant.Dots}
              />
              <Panel className='routing-canvas-controls nopan' position='top-left'>
                <RoutingCanvasViewportControls
                  canRedo={canRedo}
                  canUndo={canUndo}
                  disabled={disabled}
                  expanded={expanded}
                  expandButtonRef={fullscreen?.buttonRef}
                  layoutRevision={layoutRevision}
                  onExpandedChange={fullscreen!.onExpandedChange}
                  onRedo={onRedo}
                  onUndo={onUndo}
                  onViewportTransition={onViewportTransition}
                >
                  <RoutingCanvasPalettePopover {...paletteProps} />
                </RoutingCanvasViewportControls>
              </Panel>
            </ReactFlow>
          </div>
        </div>
      </div>
    </CanvasFullscreen>
  );
}
