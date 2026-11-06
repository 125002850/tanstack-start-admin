import type { Node } from '@xyflow/react';

import type { ConditionIssue } from '../model/condition-model';
import type {
  ConditionNode,
  ConditionField,
  GroupCondition,
  PredicateCondition
} from '../model/condition-model';

export interface RoutingCanvasRemovalConfirmation {
  readonly title: string;
  readonly description: string;
  readonly confirmLabel: string;
  readonly onConfirm: () => void;
}

export interface ConditionCanvasProps {
  readonly ruleName: string;
  readonly canRedo: boolean;
  readonly canUndo: boolean;
  readonly catalog: readonly ConditionField[];
  readonly condition: Exclude<ConditionNode, { type: 'ALWAYS' }>;
  readonly disabled: boolean;
  readonly issuePathPrefix: string;
  readonly issues: readonly ConditionIssue[];
  readonly onChange: (condition: ConditionNode, coalesceKey?: string) => void;
  readonly onRedo: () => void;
  readonly onRequestRemoval: (confirmation: RoutingCanvasRemovalConfirmation) => void;
  readonly onUndo: () => void;
}

export type RoutingCanvasCommonData = {
  readonly active: boolean;
  readonly disabled: boolean;
  readonly error?: string;
  readonly onSelect: () => void;
};

export type RoutingCanvasStartData = RoutingCanvasCommonData & {
  readonly kind: 'START';
};

export type RoutingCanvasGroupData = RoutingCanvasCommonData & {
  readonly kind: 'GROUP';
  readonly condition: GroupCondition;
  readonly root: boolean;
  readonly addDisabledReason?: string;
  readonly onAddCondition: () => void;
  readonly onLogicChange: (logic: 'AND' | 'OR') => void;
  readonly onRemove?: () => void;
};

export type RoutingCanvasConditionData = RoutingCanvasCommonData & {
  readonly kind: 'CONDITION';
  readonly catalog: readonly ConditionField[];
  readonly condition: PredicateCondition;
  readonly addDisabledReason?: string;
  readonly onAddCondition: () => void;
  readonly onChange: (condition: PredicateCondition, coalesceKey?: string) => void;
  readonly onRemove: () => void;
};

export type RoutingCanvasNodeData =
  | RoutingCanvasStartData
  | RoutingCanvasGroupData
  | RoutingCanvasConditionData;

export type RoutingCanvasNode = Node<RoutingCanvasNodeData, 'start' | 'logic' | 'condition'>;
