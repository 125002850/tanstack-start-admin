import { expect, it } from 'vitest';
import { createInputCondition } from './condition-operands';
import {
  EMPTY_CONDITION_HISTORY,
  recordConditionChange,
  undoConditionChange,
  redoConditionChange
} from './condition-history';

it('连续输入合并一次撤销，重做恢复完整值，新分支清除旧重做记录', () => {
  const initial = createInputCondition('rule', 'amount', '1');
  const middle = createInputCondition('rule', 'amount', '10');
  const last = createInputCondition('rule', 'amount', '100');
  const first = recordConditionChange(EMPTY_CONDITION_HISTORY, initial, 'rule:right', 1000);
  const history = recordConditionChange(first, middle, 'rule:right', 1200);
  const undone = undoConditionChange(history, last)!;
  expect(undone.condition).toEqual(initial);
  expect(redoConditionChange(undone.history, initial)?.condition).toEqual(last);
  const branch = recordConditionChange(undone.history, initial, 'rule:left', 2000);
  expect(redoConditionChange(branch, middle)).toBeUndefined();
  expect(initial.rightValue).toBe('1');
});
