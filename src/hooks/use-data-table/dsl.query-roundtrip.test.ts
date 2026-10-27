// @vitest-environment node
import type { ColumnDef, ColumnFiltersState } from '@tanstack/react-table';
import { describe, expect, it } from 'vitest';
import { buildDataTableDslQuickConditions, restoreDataTableColumnFilters } from './dsl';

type Row = { createdAt: string };

describe('date quick-filter query schemes', () => {
  it.each(['date', 'dateRange'] as const)('round-trips %s half-open conditions', (variant) => {
    const columns: ColumnDef<Row>[] = [{ accessorKey: 'createdAt', meta: { variant } }];
    const start = new Date(2026, 9, 1).getTime();
    const filters: ColumnFiltersState = [
      { id: 'createdAt', value: variant === 'date' ? start : [start, start] }
    ];
    const quick = buildDataTableDslQuickConditions(columns, filters);
    expect(restoreDataTableColumnFilters(columns, JSON.parse(JSON.stringify(quick)))).toEqual(
      filters
    );
    expect(
      restoreDataTableColumnFilters(columns, [{ ...quick[0], filterValue: start + 86_400_000 }])
    ).toBeUndefined();
  });

  it.each(['date', 'dateRange'] as const)('restores legacy whole-day %s schemes', (variant) => {
    const columns: ColumnDef<Row>[] = [{ accessorKey: 'createdAt', meta: { variant } }];
    const start = new Date(2026, 9, 1).getTime();
    const end = new Date(2026, 9, 1, 23, 59, 59).getTime();
    expect(
      restoreDataTableColumnFilters(columns, [
        {
          columnId: 'createdAt',
          condition: {
            nodeType: 'dateTime',
            field: 'createdAt',
            op: 'BETWEEN',
            start: '2026-10-01 00:00:00',
            end: '2026-10-01 23:59:59'
          }
        }
      ])
    ).toEqual([{ id: 'createdAt', value: variant === 'date' ? start : [start, end] }]);
  });

  it('restores a legacy end-only date range', () => {
    const columns: ColumnDef<Row>[] = [
      { accessorKey: 'createdAt', meta: { variant: 'dateRange' } }
    ];
    expect(
      restoreDataTableColumnFilters(columns, [
        {
          columnId: 'createdAt',
          condition: {
            nodeType: 'dateTime',
            field: 'createdAt',
            op: 'LTE',
            value: '2026-10-01 23:59:59'
          }
        }
      ])
    ).toEqual([
      { id: 'createdAt', value: [undefined, new Date(2026, 9, 1, 23, 59, 59).getTime()] }
    ]);
  });

  it('rejects invalid legacy dates instead of dropping their constraints', () => {
    const columns: ColumnDef<Row>[] = [
      { accessorKey: 'createdAt', meta: { variant: 'dateRange' } }
    ];
    expect(
      restoreDataTableColumnFilters(columns, [
        {
          columnId: 'createdAt',
          condition: {
            nodeType: 'dateTime',
            field: 'createdAt',
            op: 'BETWEEN',
            start: 'invalid 00:00:00',
            end: 'invalid 23:59:59'
          }
        }
      ])
    ).toBeUndefined();
  });
});
