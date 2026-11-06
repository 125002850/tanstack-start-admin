import {
  createAlwaysCondition,
  getConditionMetrics,
  type ConditionNode,
  type GroupCondition
} from '../model/condition-model';
import { CONDITION_LIMITS } from '../model/condition-limits';

export interface ConditionTreeEntry {
  readonly node: ConditionNode;
  readonly parentId: string | null;
  readonly depth: number;
  readonly path: readonly number[];
}

export function indexConditionTree(
  condition: ConditionNode
): ReadonlyMap<string, ConditionTreeEntry> {
  const index = new Map<string, ConditionTreeEntry>();

  const visit = (
    node: ConditionNode,
    parentId: string | null,
    depth: number,
    path: readonly number[]
  ): void => {
    index.set(node.clientId, { node, parentId, depth, path });
    if (node.type !== 'GROUP') return;
    node.children.forEach((child, childIndex) => {
      visit(child, node.clientId, depth + 1, [...path, childIndex]);
    });
  };

  visit(condition, null, 1, []);
  return index;
}

export function getConditionAddDisabledReason(input: {
  readonly disabled: boolean;
  readonly kind: 'CONDITION' | 'GROUP';
  readonly metrics: ReturnType<typeof getConditionMetrics>;
  readonly targetId: string;
  readonly treeIndex: ReturnType<typeof indexConditionTree>;
}): string | undefined {
  if (input.disabled) return '当前规则只读。';
  const target = input.treeIndex.get(input.targetId);
  if (target === undefined) return '未找到目标条件组。';
  const wrappingRootPredicate = target.parentId === null && target.node.type !== 'GROUP';
  const addedNodes = input.kind === 'GROUP' ? 2 : 1;
  const totalAddedNodes = addedNodes + (wrappingRootPredicate ? 1 : 0);
  if (input.metrics.nodeCount + totalAddedNodes > CONDITION_LIMITS.conditionNodes) {
    return `单棵条件树最多支持 ${CONDITION_LIMITS.conditionNodes} 个节点。`;
  }
  if (
    target.node.type === 'GROUP' &&
    target.node.children.length >= CONDITION_LIMITS.groupChildren
  ) {
    return `单个条件组最多支持 ${CONDITION_LIMITS.groupChildren} 个直接子节点。`;
  }
  const nextMaxDepth = wrappingRootPredicate
    ? Math.max(input.metrics.maxDepth + 1, input.kind === 'GROUP' ? 3 : 2)
    : target.depth + (input.kind === 'GROUP' ? 2 : 1);
  if (nextMaxDepth > CONDITION_LIMITS.conditionDepth) {
    return `条件树最大深度为 ${CONDITION_LIMITS.conditionDepth} 层。`;
  }
  return undefined;
}

export function updateConditionNode(
  condition: ConditionNode,
  nodeId: string,
  update: (node: ConditionNode) => ConditionNode
): ConditionNode {
  if (condition.clientId === nodeId) return update(condition);
  if (condition.type !== 'GROUP') return condition;

  let changed = false;
  const children = condition.children.map((child) => {
    const next = updateConditionNode(child, nodeId, update);
    if (next !== child) changed = true;
    return next;
  });
  return changed ? { ...condition, children } : condition;
}

export function appendConditionChild(
  condition: ConditionNode,
  groupId: string,
  child: ConditionNode
): ConditionNode {
  return updateConditionNode(condition, groupId, (node) =>
    node.type === 'GROUP' ? { ...node, children: [...node.children, child] } : node
  );
}

export function appendConditionSibling(
  condition: ConditionNode,
  siblingId: string,
  child: ConditionNode,
  createRootGroup: (children: readonly ConditionNode[]) => GroupCondition
): ConditionNode {
  const entry = indexConditionTree(condition).get(siblingId);
  if (entry === undefined) return condition;
  if (entry.parentId === null) return createRootGroup([condition, child]);
  return appendConditionChild(condition, entry.parentId, child);
}

export function removeConditionNode(condition: ConditionNode, nodeId: string): ConditionNode {
  return removeRoutingNode(condition, nodeId) ?? createAlwaysCondition();
}

function removeRoutingNode(condition: ConditionNode, nodeId: string): ConditionNode | null {
  if (condition.clientId === nodeId) return null;
  if (condition.type !== 'GROUP') return condition;

  let changed = false;
  const children: ConditionNode[] = [];
  condition.children.forEach((child) => {
    if (child.clientId === nodeId) {
      changed = true;
      return;
    }
    const next = removeRoutingNode(child, nodeId);
    if (next !== child) changed = true;
    if (next !== null) children.push(next);
  });
  if (!changed) return condition;
  if (children.length === 0) return null;
  return { ...condition, children };
}

export function getConditionTopologySignature(condition: ConditionNode): string {
  if (condition.type !== 'GROUP') return `${condition.type}:${condition.clientId}`;
  return `GROUP:${condition.clientId}[${condition.children
    .map(getConditionTopologySignature)
    .join(',')}]`;
}
