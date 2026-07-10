import { describe, expect, it } from 'vitest';

import type { DataTableDslCondition } from '@/hooks/use-dsl-data-table.dsl';

import { dslConditionNumbers, dslConditionValues } from './table';

describe('IAM table DSL multi-value adapters', () => {
  const condition: DataTableDslCondition = {
    nodeType: 'compose',
    logic: 'AND',
    children: [
      { nodeType: 'text', field: 'deptId', op: 'IN', values: ['1', '2'] },
      { nodeType: 'text', field: 'status', op: 'IN', values: ['ENABLED', 'DISABLED'] }
    ]
  };

  it('reads all selected values from an IN condition', () => {
    expect(dslConditionValues(condition, 'status')).toEqual(['ENABLED', 'DISABLED']);
  });

  it('normalizes numeric multi-select values', () => {
    expect(dslConditionNumbers(condition, 'deptId')).toEqual([1, 2]);
  });
});
