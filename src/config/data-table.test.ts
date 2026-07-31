import { describe, expect, it } from 'vitest';

import {
  DATA_TABLE_DATE_DISPLAY_FORMAT,
  DATA_TABLE_DATE_TIME_DISPLAY_FORMAT,
  dataTableColumnSizes
} from './data-table';

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

describe('DataTable temporal display formats', () => {
  it('keeps date and dateTime display formats stable', () => {
    expect(DATA_TABLE_DATE_DISPLAY_FORMAT).toBe('YYYY-MM-DD');
    expect(DATA_TABLE_DATE_TIME_DISPLAY_FORMAT).toBe('YYYY-MM-DD HH:mm:ss');
  });
});
