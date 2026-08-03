import { describe, expect, it } from 'vitest';

import * as publicEntry from './index';

describe('DataTable hooks public entry', () => {
  it('only exports the local and DSL hooks at runtime', () => {
    expect(Object.keys(publicEntry).toSorted()).toEqual(['useDataTable', 'useDslDataTable']);
    expect(publicEntry.useDataTable).toBeTypeOf('function');
    expect(publicEntry.useDslDataTable).toBeTypeOf('function');
  });
});
