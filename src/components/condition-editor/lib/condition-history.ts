import type { ConditionNode } from '../model/condition-model';

export const CONDITION_HISTORY_LIMIT = 50;
export const CONDITION_HISTORY_COALESCE_MS = 500;

export interface ConditionHistory {
  readonly past: readonly ConditionNode[];
  readonly future: readonly ConditionNode[];
  readonly coalesceKey?: string;
  readonly coalesceAt?: number;
}

export const EMPTY_CONDITION_HISTORY: ConditionHistory = {
  past: [],
  future: []
};

export function recordConditionChange(
  history: ConditionHistory,
  previous: ConditionNode,
  coalesceKey: string | undefined,
  now: number
): ConditionHistory {
  const coalescesWithPrevious =
    coalesceKey !== undefined &&
    history.coalesceKey === coalesceKey &&
    history.coalesceAt !== undefined &&
    now - history.coalesceAt <= CONDITION_HISTORY_COALESCE_MS;

  return {
    past: coalescesWithPrevious
      ? history.past
      : [...history.past, previous].slice(-CONDITION_HISTORY_LIMIT),
    future: [],
    ...(coalesceKey === undefined ? {} : { coalesceKey, coalesceAt: now })
  };
}

export function undoConditionChange(
  history: ConditionHistory,
  current: ConditionNode
):
  | {
      readonly condition: ConditionNode;
      readonly history: ConditionHistory;
    }
  | undefined {
  const condition = history.past.at(-1);
  if (condition === undefined) return undefined;

  return {
    condition,
    history: {
      past: history.past.slice(0, -1),
      future: [...history.future, current].slice(-CONDITION_HISTORY_LIMIT)
    }
  };
}

export function redoConditionChange(
  history: ConditionHistory,
  current: ConditionNode
):
  | {
      readonly condition: ConditionNode;
      readonly history: ConditionHistory;
    }
  | undefined {
  const condition = history.future.at(-1);
  if (condition === undefined) return undefined;

  return {
    condition,
    history: {
      past: [...history.past, current].slice(-CONDITION_HISTORY_LIMIT),
      future: history.future.slice(0, -1)
    }
  };
}
