import { describe, expect, it } from 'vitest';

import { staffTableQueryOptions } from './staff-management-page';

describe('staff table query adapter', () => {
  it('maps department and status multi-select conditions to plural API fields', () => {
    const queryOptions = staffTableQueryOptions({
      pageNo: 1,
      pageSize: 20,
      condition: {
        nodeType: 'compose',
        logic: 'AND',
        children: [
          { nodeType: 'text', field: 'deptId', op: 'IN', values: ['10', '20'] },
          { nodeType: 'text', field: 'status', op: 'IN', values: ['ENABLED', 'DISABLED'] }
        ]
      }
    });

    expect(queryOptions.queryKey.at(-1)).toMatchObject({
      deptIds: [10, 20],
      statuses: ['ENABLED', 'DISABLED']
    });
  });
});
