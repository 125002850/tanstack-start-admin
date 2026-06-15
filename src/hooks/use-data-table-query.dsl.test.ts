import { describe, expect, it, vi } from 'vitest';
import type { ColumnDef, ColumnFiltersState, PaginationState, SortingState } from '@tanstack/react-table';

import type { DataTableDslCondition } from './use-data-table-query.dsl';
import {
  buildDataTableDslRequest,
  isDataTableDslOperatorCompatibleWithVariant
} from './use-data-table-query.dsl';

type DictionaryTypeRow = {
  id: number;
  dictTypeCode: string;
  dictTypeName: string;
  createTime: string;
};

const columns: Array<ColumnDef<DictionaryTypeRow>> = [
  {
    accessorKey: 'dictTypeCode',
    header: '字典类型编码',
    enableColumnFilter: true,
    enableSorting: true,
    meta: { variant: 'text', label: '字典类型编码' }
  },
  {
    accessorKey: 'dictTypeName',
    header: '字典类型名称',
    enableColumnFilter: true,
    enableSorting: true,
    meta: { variant: 'text', label: '字典类型名称', query: { operator: 'EQ' } } as never
  },
  {
    accessorKey: 'createTime',
    header: '创建时间',
    enableColumnFilter: true,
    enableSorting: true,
    meta: { variant: 'dateRange', label: '创建时间' }
  }
];

describe('use-data-table-query.dsl', () => {
  it('builds a paginated dsl request from pagination, sorting, and filters', () => {
    const request = buildDataTableDslRequest({
      columns,
      pagination: { pageIndex: 1, pageSize: 50 } satisfies PaginationState,
      sorting: [{ id: 'createTime', desc: true }] satisfies SortingState,
      columnFilters: [
        { id: 'dictTypeCode', value: ' payment ' },
        { id: 'dictTypeName', value: 'ENABLE' }
      ] satisfies ColumnFiltersState
    });

    expect(request.pageNo).toBe(2);
    expect(request.pageSize).toBe(50);
    expect(request.dslVersion).toBe(1);
    expect(request.sort).toEqual([{ field: 'createTime', direction: 'DESC' }]);
    expect(request.condition).toEqual({
      nodeType: 'compose',
      logic: 'AND',
      children: [
        {
          nodeType: 'text',
          field: 'dictTypeCode',
          op: 'CONTAINS',
          value: 'payment'
        },
        {
          nodeType: 'text',
          field: 'dictTypeName',
          op: 'EQ',
          value: 'ENABLE'
        }
      ]
    });
  });

  it('omits text and multi-select filters after empty normalization', () => {
    const request = buildDataTableDslRequest({
      columns: [
        ...columns,
        {
          accessorKey: 'id',
          header: '状态',
          enableColumnFilter: true,
          meta: { variant: 'multiSelect', label: '状态' }
        }
      ],
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [],
      columnFilters: [
        { id: 'dictTypeCode', value: '   ' },
        { id: 'id', value: ['', '  '] }
      ]
    });

    expect(request.condition).toBeUndefined();
  });

  it('serializes date ranges with explicit timezone offsets and partial bounds', () => {
    const selectedDate = new Date(2026, 5, 12);
    const fromDate = new Date(2026, 5, 10);
    const toDate = new Date(2026, 5, 14);

    const singleDateRequest = buildDataTableDslRequest({
      columns: [
        {
          accessorKey: 'createTime',
          header: '创建时间',
          enableColumnFilter: true,
          meta: { variant: 'date', label: '创建时间' }
        }
      ],
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [],
      columnFilters: [{ id: 'createTime', value: selectedDate.getTime() }]
    });

    const fromOnlyRequest = buildDataTableDslRequest({
      columns,
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [],
      columnFilters: [{ id: 'createTime', value: [fromDate.getTime(), undefined] }]
    });

    const rangeRequest = buildDataTableDslRequest({
      columns,
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [],
      columnFilters: [{ id: 'createTime', value: [fromDate.getTime(), toDate.getTime()] }]
    });

    const singleNode = (singleDateRequest.condition as Extract<DataTableDslCondition, { nodeType: 'compose' }>).children[0] as Extract<DataTableDslCondition, { nodeType: 'dateTime' }>;
    const fromOnlyNode = (fromOnlyRequest.condition as Extract<DataTableDslCondition, { nodeType: 'compose' }>).children[0] as Extract<DataTableDslCondition, { nodeType: 'dateTime' }>;
    const rangeNode = (rangeRequest.condition as Extract<DataTableDslCondition, { nodeType: 'compose' }>).children[0] as Extract<DataTableDslCondition, { nodeType: 'dateTime' }>;

    expect(singleNode.nodeType).toBe('dateTime');
    expect(singleNode.op).toBe('BETWEEN');
    expect(singleNode.start).toMatch(/([+-]\d{2}:\d{2}|Z)$/);
    expect(singleNode.end).toMatch(/([+-]\d{2}:\d{2}|Z)$/);

    const singleStart = new Date(singleNode.start!);
    const singleEnd = new Date(singleNode.end!);
    expect(singleStart.getFullYear()).toBe(selectedDate.getFullYear());
    expect(singleStart.getMonth()).toBe(selectedDate.getMonth());
    expect(singleStart.getDate()).toBe(selectedDate.getDate());
    expect(singleStart.getHours()).toBe(0);
    expect(singleStart.getMinutes()).toBe(0);
    expect(singleStart.getSeconds()).toBe(0);
    expect(singleEnd.getHours()).toBe(23);
    expect(singleEnd.getMinutes()).toBe(59);
    expect(singleEnd.getSeconds()).toBe(59);

    expect(fromOnlyNode).toMatchObject({
      nodeType: 'dateTime',
      field: 'createTime',
      op: 'GTE'
    });
    expect(rangeNode).toMatchObject({
      nodeType: 'dateTime',
      field: 'createTime',
      op: 'BETWEEN'
    });
  });

  it('merges baseCondition with table filters under an AND compose node', () => {
    const baseCondition: DataTableDslCondition = {
      nodeType: 'text',
      field: 'dictTypeCode',
      op: 'EQ',
      value: 'system'
    };

    const request = buildDataTableDslRequest({
      columns,
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [],
      columnFilters: [{ id: 'dictTypeName', value: '支付' }],
      baseCondition
    });

    expect(request.condition).toEqual({
      nodeType: 'compose',
      logic: 'AND',
      children: [
        baseCondition,
        {
          nodeType: 'text',
          field: 'dictTypeName',
          op: 'EQ',
          value: '支付'
        }
      ]
    });
  });

  it('warns and skips accessorFn columns without explicit ids', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const request = buildDataTableDslRequest({
      columns: [
        {
          accessorFn: (row: DictionaryTypeRow) => row.dictTypeCode,
          header: '编码',
          enableColumnFilter: true,
          enableSorting: true,
          meta: { variant: 'text', label: '编码' }
        }
      ],
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [{ id: 'dictTypeCode', desc: false }],
      columnFilters: [{ id: 'dictTypeCode', value: 'payment' }]
    });

    expect(request.condition).toBeUndefined();
    expect(request.sort).toBeUndefined();
    expect(warn).toHaveBeenCalled();
  });

  it('falls back to the default operator when the override is incompatible', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const request = buildDataTableDslRequest({
      columns: [
        {
          accessorKey: 'dictTypeCode',
          header: '编码',
          enableColumnFilter: true,
          meta: { variant: 'text', label: '编码', query: { operator: 'BETWEEN' } } as never
        }
      ],
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [],
      columnFilters: [{ id: 'dictTypeCode', value: 'payment' }]
    });

    expect(request.condition).toEqual({
      nodeType: 'compose',
      logic: 'AND',
      children: [
        {
          nodeType: 'text',
          field: 'dictTypeCode',
          op: 'CONTAINS',
          value: 'payment'
        }
      ]
    });
    expect(warn).toHaveBeenCalled();
  });

  it('declares operator compatibility by filter variant', () => {
    expect(isDataTableDslOperatorCompatibleWithVariant('text', 'CONTAINS')).toBe(true);
    expect(isDataTableDslOperatorCompatibleWithVariant('dateRange', 'BETWEEN')).toBe(true);
    expect(isDataTableDslOperatorCompatibleWithVariant('text', 'BETWEEN')).toBe(false);
    expect(isDataTableDslOperatorCompatibleWithVariant('multiSelect', 'EQ')).toBe(false);
  });
});
