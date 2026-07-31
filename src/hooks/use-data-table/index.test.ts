import { describe, expect, it } from 'vitest';

import { buildDataTableDslRequest, makeApiFilters, useDataTable, useDslDataTable } from './index';

describe('DataTable hooks public entry', () => {
  it('exports local and DSL table APIs from one directory entry', () => {
    expect(useDataTable).toBeTypeOf('function');
    expect(useDslDataTable).toBeTypeOf('function');
    expect(makeApiFilters).toBeTypeOf('function');
    expect(buildDataTableDslRequest).toBeTypeOf('function');
  });
});
