import { useNodesState, type Edge } from '@xyflow/react';
import * as React from 'react';

import {
  createPredicateCondition,
  createConditionClientId,
  getConditionMetrics,
  isConditionFieldSelectable,
  CONDITION_OPERATOR_LABELS,
  type ConditionNode,
  type PredicateCondition
} from '../model/condition-model';
import {
  appendConditionChild,
  appendConditionSibling,
  getConditionTopologySignature,
  indexConditionTree,
  removeConditionNode,
  updateConditionNode
} from '../lib/condition-tree';
import {
  getConditionCanvasPath,
  layoutConditionCanvas,
  projectConditionCanvas,
  ROUTING_CANVAS_START_NODE_ID,
  type ConditionCanvasLayoutNode
} from './condition-canvas-layout';
import type { RoutingCanvasPaletteProps } from './condition-canvas-controls';
import type { ConditionCanvasProps, RoutingCanvasNode } from './condition-canvas-types';
import {
  areRoutingCanvasNodeDataEqual,
  areRoutingCanvasNodesEqual,
  findRoutingCanvasNodeError,
  getRoutingCanvasAddDisabledReason,
  getRoutingCanvasTargetLabel,
  isRoutingCanvasTextEditingTarget,
  resolveRoutingCanvasTarget
} from './condition-canvas-utils';

interface RoutingCanvasTopologyCache {
  readonly signature: string;
  readonly projection: ReturnType<typeof projectConditionCanvas>;
  readonly layoutNodes: readonly ConditionCanvasLayoutNode[];
}

export function useConditionCanvasController({
  canRedo,
  canUndo,
  catalog,
  condition,
  disabled,
  issuePathPrefix,
  issues,
  onChange,
  onRedo,
  onRequestRemoval,
  onUndo
}: ConditionCanvasProps) {
  const [selectedNodeId, setSelectedNodeId] = React.useState(condition.clientId);
  const treeIndex = React.useMemo(() => indexConditionTree(condition), [condition]);
  const topologySignature = React.useMemo(
    () => getConditionTopologySignature(condition),
    [condition]
  );
  const topologyCacheRef = React.useRef<RoutingCanvasTopologyCache>(null);
  // Projection and Dagre positions depend on tree shape only; literal edits keep this snapshot.
  if (topologyCacheRef.current?.signature !== topologySignature) {
    const projection = projectConditionCanvas(condition);
    topologyCacheRef.current = {
      signature: topologySignature,
      projection,
      layoutNodes: layoutConditionCanvas(projection)
    };
  }
  const { layoutNodes, projection } = topologyCacheRef.current;
  const metrics = React.useMemo(() => getConditionMetrics(condition), [condition]);
  const selectableCatalog = React.useMemo(
    () => catalog.filter(isConditionFieldSelectable),
    [catalog]
  );
  const conditionRef = React.useRef(condition);
  const catalogRef = React.useRef(catalog);
  const treeIndexRef = React.useRef(treeIndex);
  const projectionRef = React.useRef(projection);
  const onChangeRef = React.useRef(onChange);
  const onRequestRemovalRef = React.useRef(onRequestRemoval);
  conditionRef.current = condition;
  catalogRef.current = catalog;
  treeIndexRef.current = treeIndex;
  projectionRef.current = projection;
  onChangeRef.current = onChange;
  onRequestRemovalRef.current = onRequestRemoval;

  React.useEffect(() => {
    if (selectedNodeId !== ROUTING_CANVAS_START_NODE_ID && !treeIndex.has(selectedNodeId)) {
      setSelectedNodeId(condition.clientId);
    }
  }, [condition.clientId, selectedNodeId, treeIndex]);

  const activePath = React.useMemo(
    () => getConditionCanvasPath(projection.parentById, selectedNodeId),
    [projection.parentById, selectedNodeId]
  );
  const selectedTargetId = resolveRoutingCanvasTarget(
    condition,
    treeIndex,
    projection.parentById,
    selectedNodeId,
    ROUTING_CANVAS_START_NODE_ID
  );

  const addToTarget = React.useCallback((targetId: string, child: ConditionNode) => {
    const currentCondition = conditionRef.current;
    const target = treeIndexRef.current.get(targetId)?.node;
    if (target?.type === 'GROUP') {
      onChangeRef.current(appendConditionChild(currentCondition, targetId, child));
    } else {
      onChangeRef.current(
        appendConditionSibling(currentCondition, targetId, child, (children) => ({
          clientId: createConditionClientId('condition'),
          type: 'GROUP',
          logic: 'AND',
          children
        }))
      );
    }
    setSelectedNodeId(child.clientId);
  }, []);

  const addCondition = React.useCallback(
    (targetId: string) => {
      addToTarget(
        targetId,
        createPredicateCondition(catalogRef.current.find(isConditionFieldSelectable) ?? '')
      );
    },
    [addToTarget]
  );
  const addConditionNearNode = React.useCallback(
    (nodeId: string) => {
      addCondition(
        resolveRoutingCanvasTarget(
          conditionRef.current,
          treeIndexRef.current,
          projectionRef.current.parentById,
          nodeId,
          ROUTING_CANVAS_START_NODE_ID
        )
      );
    },
    [addCondition]
  );

  const addGroup = React.useCallback(
    (targetId: string, logic: 'AND' | 'OR') => {
      addToTarget(targetId, {
        clientId: createConditionClientId('condition'),
        type: 'GROUP',
        logic,
        children: [
          createPredicateCondition(catalogRef.current.find(isConditionFieldSelectable) ?? '')
        ]
      });
    },
    [addToTarget]
  );

  const removeNode = React.useCallback((nodeId: string) => {
    const parentId = projectionRef.current.parentById.get(nodeId);
    onChangeRef.current(removeConditionNode(conditionRef.current, nodeId));
    setSelectedNodeId(
      parentId === undefined || parentId === null || parentId === ROUTING_CANVAS_START_NODE_ID
        ? ROUTING_CANVAS_START_NODE_ID
        : parentId
    );
  }, []);
  const changeGroupLogic = React.useCallback((nodeId: string, logic: 'AND' | 'OR') => {
    onChangeRef.current(
      updateConditionNode(conditionRef.current, nodeId, (node) =>
        node.type === 'GROUP' ? { ...node, logic } : node
      )
    );
  }, []);
  const changePredicate = React.useCallback(
    (nodeId: string, next: PredicateCondition, coalesceKey?: string) => {
      onChangeRef.current(
        updateConditionNode(conditionRef.current, nodeId, () => next),
        coalesceKey === undefined ? undefined : `${nodeId}:${coalesceKey}`
      );
    },
    []
  );
  const requestNodeRemoval = React.useCallback(
    (nodeId: string, kind: 'GROUP' | 'CONDITION') => {
      onRequestRemovalRef.current({
        title: kind === 'GROUP' ? '删除条件组？' : '删除条件？',
        description:
          kind === 'GROUP'
            ? '该条件组及其全部子条件将从当前规则中删除。'
            : '该条件将从当前规则中删除。',
        confirmLabel: kind === 'GROUP' ? '删除条件组' : '删除条件',
        onConfirm: () => removeNode(nodeId)
      });
    },
    [removeNode]
  );

  const layoutedNodes = React.useMemo<RoutingCanvasNode[]>(
    () =>
      layoutNodes.map((layoutNode) => {
        const active = activePath.has(layoutNode.id);
        if (layoutNode.kind === 'START') {
          return {
            id: layoutNode.id,
            type: 'start',
            position: layoutNode.position,
            draggable: false,
            selectable: false,
            focusable: true,
            ariaLabel: '开始命中',
            style: { width: 150 },
            data: {
              kind: 'START',
              active,
              disabled,
              onSelect: () => setSelectedNodeId(ROUTING_CANVAS_START_NODE_ID)
            }
          };
        }

        const current = treeIndex.get(layoutNode.id)?.node;
        if (layoutNode.kind === 'GROUP' && current?.type === 'GROUP') {
          const addDisabledReason = getRoutingCanvasAddDisabledReason({
            catalog: selectableCatalog,
            disabled,
            kind: 'CONDITION',
            metrics,
            targetId: layoutNode.id,
            treeIndex
          });
          return {
            id: layoutNode.id,
            type: 'logic',
            position: layoutNode.position,
            dragHandle: '.routing-canvas-node-drag-handle',
            draggable: !disabled,
            selectable: false,
            focusable: true,
            ariaLabel: `条件组 ${current.logic}`,
            style: { width: 184 },
            data: {
              kind: 'GROUP',
              active,
              addDisabledReason,
              condition: current,
              disabled,
              error: findRoutingCanvasNodeError(issues, issuePathPrefix, layoutNode),
              root: layoutNode.parentId === ROUTING_CANVAS_START_NODE_ID,
              onAddCondition: () => addCondition(layoutNode.id),
              onLogicChange: (logic) => changeGroupLogic(layoutNode.id, logic),
              onRemove:
                layoutNode.parentId === ROUTING_CANVAS_START_NODE_ID
                  ? undefined
                  : () => requestNodeRemoval(layoutNode.id, 'GROUP'),
              onSelect: () => setSelectedNodeId(layoutNode.id)
            }
          };
        }

        if (current?.type !== 'CONDITION') {
          throw new Error(`Unsupported routing canvas node: ${layoutNode.id}`);
        }
        const targetId = resolveRoutingCanvasTarget(
          condition,
          treeIndex,
          projection.parentById,
          layoutNode.id,
          ROUTING_CANVAS_START_NODE_ID
        );
        const addDisabledReason = getRoutingCanvasAddDisabledReason({
          catalog: selectableCatalog,
          disabled,
          kind: 'CONDITION',
          metrics,
          targetId,
          treeIndex
        });
        return {
          id: layoutNode.id,
          type: 'condition',
          position: layoutNode.position,
          dragHandle: '.routing-canvas-node-drag-handle',
          draggable: !disabled,
          selectable: false,
          focusable: true,
          ariaLabel: `条件 ${current.field} ${CONDITION_OPERATOR_LABELS[current.operator]}`,
          style: { width: 328 },
          data: {
            kind: 'CONDITION',
            active,
            addDisabledReason,
            catalog,
            condition: current,
            disabled,
            error: findRoutingCanvasNodeError(issues, issuePathPrefix, layoutNode),
            onAddCondition: () => addConditionNearNode(layoutNode.id),
            onChange: (next, coalesceKey) => changePredicate(layoutNode.id, next, coalesceKey),
            onRemove: () => requestNodeRemoval(layoutNode.id, 'CONDITION'),
            onSelect: () => setSelectedNodeId(layoutNode.id)
          }
        };
      }),
    [
      activePath,
      addCondition,
      addConditionNearNode,
      catalog,
      changeGroupLogic,
      changePredicate,
      condition,
      disabled,
      issuePathPrefix,
      issues,
      layoutNodes,
      metrics,
      projection.parentById,
      requestNodeRemoval,
      selectableCatalog,
      treeIndex
    ]
  );
  const [nodes, setNodes, onNodesChange] = useNodesState<RoutingCanvasNode>(layoutedNodes);
  const [layoutRevision, setLayoutRevision] = React.useState(0);
  const previousTopologySignature = React.useRef(topologySignature);

  React.useEffect(() => {
    const topologyChanged = previousTopologySignature.current !== topologySignature;
    setNodes((currentNodes) => {
      const currentNodesById = new Map(currentNodes.map((node) => [node.id, node]));
      const nextNodes = layoutedNodes.map((layoutedNode) => {
        const currentNode = currentNodesById.get(layoutedNode.id);
        if (currentNode === undefined) return layoutedNode;
        const nextNode = {
          ...currentNode,
          ...layoutedNode,
          measured: currentNode.measured,
          position: topologyChanged ? layoutedNode.position : currentNode.position,
          data: areRoutingCanvasNodeDataEqual(currentNode.data, layoutedNode.data)
            ? currentNode.data
            : layoutedNode.data
        };
        return areRoutingCanvasNodesEqual(currentNode, nextNode) ? currentNode : nextNode;
      });
      return nextNodes.length === currentNodes.length &&
        nextNodes.every((node, index) => node === currentNodes[index])
        ? currentNodes
        : nextNodes;
    });
    if (topologyChanged) setLayoutRevision((revision) => revision + 1);
    previousTopologySignature.current = topologySignature;
  }, [layoutedNodes, setNodes, topologySignature]);

  const edges = React.useMemo<Edge[]>(
    () =>
      projection.edges.map((edge) => {
        const active = activePath.has(edge.source) && activePath.has(edge.target);
        return {
          ...edge,
          type: 'smoothstep',
          focusable: false,
          selectable: false,
          className: active ? 'routing-canvas-edge-active' : undefined
        };
      }),
    [activePath, projection.edges]
  );
  const conditionDisabledReason = getRoutingCanvasAddDisabledReason({
    catalog: selectableCatalog,
    disabled,
    kind: 'CONDITION',
    metrics,
    targetId: selectedTargetId,
    treeIndex
  });
  const groupDisabledReason = getRoutingCanvasAddDisabledReason({
    catalog: selectableCatalog,
    disabled,
    kind: 'GROUP',
    metrics,
    targetId: selectedTargetId,
    treeIndex
  });
  const targetLabel = getRoutingCanvasTargetLabel(treeIndex.get(selectedTargetId)?.node);
  const paletteProps: RoutingCanvasPaletteProps = {
    conditionDisabledReason,
    groupDisabledReason,
    onAddCondition: () => addCondition(selectedTargetId),
    onAddGroup: (logic) => addGroup(selectedTargetId, logic),
    targetLabel
  };
  const handleHistoryShortcut = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (
        disabled ||
        event.altKey ||
        (!event.ctrlKey && !event.metaKey) ||
        event.key.toLowerCase() !== 'z' ||
        isRoutingCanvasTextEditingTarget(event.target)
      ) {
        return;
      }
      if (event.shiftKey) {
        if (!canRedo) return;
        event.preventDefault();
        onRedo();
        return;
      }
      if (!canUndo) return;
      event.preventDefault();
      onUndo();
    },
    [canRedo, canUndo, disabled, onRedo, onUndo]
  );

  return {
    edges,
    handleHistoryShortcut,
    layoutRevision,
    nodes,
    onNodesChange,
    paletteProps,
    selectNode: setSelectedNodeId
  } as const;
}
