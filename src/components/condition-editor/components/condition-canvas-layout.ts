import { graphlib, layout as layoutGraph } from '@dagrejs/dagre';

import type { ConditionNode } from '../model/condition-model';

export const ROUTING_CANVAS_START_NODE_ID = 'routing-canvas-start';

export interface ConditionCanvasProjectedNode {
  readonly id: string;
  readonly kind: 'START' | 'GROUP' | 'CONDITION';
  readonly parentId: string | null;
  readonly depth: number;
  readonly path: readonly number[];
}

export interface ConditionCanvasProjectedEdge {
  readonly id: string;
  readonly source: string;
  readonly target: string;
}

export interface ConditionCanvasLayoutNode extends ConditionCanvasProjectedNode {
  readonly position: { readonly x: number; readonly y: number };
}

export interface ConditionCanvasProjection {
  readonly nodes: readonly ConditionCanvasProjectedNode[];
  readonly edges: readonly ConditionCanvasProjectedEdge[];
  readonly parentById: ReadonlyMap<string, string | null>;
}

const NODE_SIZE = {
  START: { width: 150, height: 44 },
  GROUP: { width: 184, height: 72 },
  CONDITION: { width: 328, height: 190 }
} as const;

export function projectConditionCanvas(condition: ConditionNode): ConditionCanvasProjection {
  const nodes: ConditionCanvasProjectedNode[] = [
    {
      id: ROUTING_CANVAS_START_NODE_ID,
      kind: 'START',
      parentId: null,
      depth: 0,
      path: []
    }
  ];
  const edges: ConditionCanvasProjectedEdge[] = [];
  const parentById = new Map<string, string | null>([[ROUTING_CANVAS_START_NODE_ID, null]]);

  const visit = (
    node: ConditionNode,
    parentId: string,
    depth: number,
    path: readonly number[]
  ): void => {
    nodes.push({
      id: node.clientId,
      kind: node.type === 'GROUP' ? 'GROUP' : 'CONDITION',
      parentId,
      depth,
      path
    });
    parentById.set(node.clientId, parentId);
    edges.push({
      id: `edge-${parentId}-${node.clientId}`,
      source: parentId,
      target: node.clientId
    });

    if (node.type !== 'GROUP') return;
    node.children.forEach((child, childIndex) => {
      visit(child, node.clientId, depth + 1, [...path, childIndex]);
    });
  };

  visit(condition, ROUTING_CANVAS_START_NODE_ID, 1, []);
  return { nodes, edges, parentById };
}

export function layoutConditionCanvas(
  projection: ConditionCanvasProjection
): readonly ConditionCanvasLayoutNode[] {
  const graph = new graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  graph.setGraph({ rankdir: 'TB', nodesep: 48, ranksep: 76, marginx: 32, marginy: 28 });

  projection.nodes.forEach((node) => graph.setNode(node.id, { ...NODE_SIZE[node.kind] }));
  projection.edges.forEach((edge) => graph.setEdge(edge.source, edge.target));
  layoutGraph(graph);

  return projection.nodes.map((node) => {
    const position = graph.node(node.id) as { readonly x: number; readonly y: number };
    const size = NODE_SIZE[node.kind];
    return {
      ...node,
      position: { x: position.x - size.width / 2, y: position.y - size.height / 2 }
    };
  });
}

export function getConditionCanvasPath(
  parentById: ReadonlyMap<string, string | null>,
  nodeId: string
): ReadonlySet<string> {
  const path = new Set<string>();
  let current: string | null | undefined = nodeId;
  while (current !== null && current !== undefined) {
    path.add(current);
    current = parentById.get(current);
  }
  return path;
}
