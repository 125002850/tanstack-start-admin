import type { ConditionIssue } from '../model/condition-model';
import type { ConditionNode, ConditionField } from '../model/condition-model';
import { getConditionAddDisabledReason, indexConditionTree } from '../lib/condition-tree';
import type { ConditionCanvasLayoutNode } from './condition-canvas-layout';
import type { RoutingCanvasNode, RoutingCanvasNodeData } from './condition-canvas-types';

export function areRoutingCanvasNodeDataEqual(
  current: RoutingCanvasNodeData,
  next: RoutingCanvasNodeData
): boolean {
  // Bound handlers only retain a node id and read the latest tree through refs in the controller.
  if (
    current.kind !== next.kind ||
    current.active !== next.active ||
    current.disabled !== next.disabled ||
    current.error !== next.error
  ) {
    return false;
  }
  if (current.kind === 'START' || next.kind === 'START') return true;
  if (current.kind === 'GROUP' && next.kind === 'GROUP') {
    return (
      current.condition.logic === next.condition.logic &&
      current.root === next.root &&
      current.addDisabledReason === next.addDisabledReason &&
      (current.onRemove === undefined) === (next.onRemove === undefined)
    );
  }
  if (current.kind === 'CONDITION' && next.kind === 'CONDITION') {
    return (
      current.catalog === next.catalog &&
      current.condition === next.condition &&
      current.addDisabledReason === next.addDisabledReason
    );
  }
  return false;
}

export function areRoutingCanvasNodesEqual(
  current: RoutingCanvasNode,
  next: RoutingCanvasNode
): boolean {
  return (
    current.id === next.id &&
    current.type === next.type &&
    current.data === next.data &&
    current.ariaLabel === next.ariaLabel &&
    current.draggable === next.draggable &&
    current.position.x === next.position.x &&
    current.position.y === next.position.y
  );
}

export function resolveRoutingCanvasTarget(
  condition: Exclude<ConditionNode, { type: 'ALWAYS' }>,
  treeIndex: ReturnType<typeof indexConditionTree>,
  parentById: ReadonlyMap<string, string | null>,
  selectedNodeId: string,
  startNodeId: string
): string {
  if (selectedNodeId === startNodeId) return condition.clientId;
  const selected = treeIndex.get(selectedNodeId)?.node;
  if (selected?.type === 'GROUP') return selected.clientId;
  const parentId = parentById.get(selectedNodeId);
  return parentId === undefined || parentId === null || parentId === startNodeId
    ? condition.clientId
    : parentId;
}

export function getRoutingCanvasAddDisabledReason(
  input: Parameters<typeof getConditionAddDisabledReason>[0] & {
    readonly catalog: readonly ConditionField[];
  }
): string | undefined {
  if (input.disabled) return '当前规则只读。';
  if (input.catalog.length === 0) return '当前没有可用的条件字段。';
  return getConditionAddDisabledReason(input);
}

export function findRoutingCanvasNodeError(
  issues: readonly ConditionIssue[],
  pathPrefix: string,
  node: ConditionCanvasLayoutNode
): string | undefined {
  const nodePath = `${pathPrefix}${node.path.map((index) => `.children.${index}`).join('')}`;
  if (node.kind === 'GROUP') {
    return issues.find((issue) => issue.path === nodePath || issue.path === `${nodePath}.children`)
      ?.message;
  }
  return issues.find((issue) => issue.path.startsWith(nodePath))?.message;
}

export function getRoutingCanvasTargetLabel(condition: ConditionNode | undefined): string {
  if (condition?.type === 'GROUP') return `${condition.logic === 'AND' ? '且' : '或'}条件组`;
  return '根条件所在组';
}

export function isRoutingCanvasTextEditingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.isContentEditable ||
    target.closest('input, textarea, [contenteditable="true"], [role="textbox"]') !== null
  );
}
