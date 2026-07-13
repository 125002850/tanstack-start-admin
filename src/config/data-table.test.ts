import { describe, expect, it } from 'vitest';

import { dataTableColumnSizes } from './data-table';

describe('dataTableColumnSizes', () => {
  it('provides stable semantic column width presets', () => {
    expect(dataTableColumnSizes).toEqual({
      xs: 90,
      sm: 110,
      md: 150,
      lg: 180,
      xl: 220,
      xxl: 240
    });
  });
});
