import { describe, expect, it, vi } from 'vitest';
import type {
  ColumnDef,
  ColumnFiltersState,
  PaginationState,
  SortingState
} from '@tanstack/react-table';

import type { DataTableDslCondition } from './use-dsl-data-table.dsl';
import {
  DATA_TABLE_DSL_SUPPORTED_FILTER_VARIANTS,
  buildDataTableDslRequest,
  isDataTableDslFilterVariantSupported,
  isDataTableDslOperatorCompatibleWithVariant
} from './use-dsl-data-table.dsl';

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
    meta: { variant: 'text', label: '字典类型名称', query: { operator: 'EQ' } }
  },
  {
    accessorKey: 'createTime',
    header: '创建时间',
    enableColumnFilter: true,
    enableSorting: true,
    meta: { variant: 'dateRange', label: '创建时间' }
  }
];

describe('use-dsl-data-table.dsl', () => {
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

  it('uses request default sort without requiring a matching table column', () => {
    const request = buildDataTableDslRequest({
      columns,
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [],
      columnFilters: [],
      defaultRequestSort: [{ field: 'id', direction: 'ASC' }]
    });

    expect(request.sort).toEqual([{ field: 'id', direction: 'ASC' }]);
  });

  it('omits sort when request default sort is empty', () => {
    const request = buildDataTableDslRequest({
      columns,
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [],
      columnFilters: [],
      defaultRequestSort: []
    });

    expect(request.sort).toBeUndefined();
  });

  it('prefers valid table sorting over request default sort', () => {
    const request = buildDataTableDslRequest({
      columns,
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [{ id: 'createTime', desc: true }],
      columnFilters: [],
      defaultRequestSort: [{ field: 'id', direction: 'ASC' }]
    });

    expect(request.sort).toEqual([{ field: 'createTime', direction: 'DESC' }]);
  });

  it('uses dsl filter field, sort field, and serializeFilter during request serialization', () => {
    const request = buildDataTableDslRequest({
      columns: [
        {
          accessorKey: 'dictTypeCode',
          header: '编码',
          enableColumnFilter: true,
          enableSorting: true,
          meta: {
            variant: 'text',
            label: '编码',
            query: {
              filterField: 'customer_code',
              sortField: 'customer_code_sort',
              operator: 'EQ',
              serializeFilter: (value) => String(value).trim().toUpperCase()
            }
          }
        }
      ],
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [{ id: 'dictTypeCode', desc: false }],
      columnFilters: [{ id: 'dictTypeCode', value: ' pay ' }]
    });

    expect(request.sort).toEqual([{ field: 'customer_code_sort', direction: 'ASC' }]);
    expect(request.condition).toEqual({
      nodeType: 'compose',
      logic: 'AND',
      children: [
        {
          nodeType: 'text',
          field: 'customer_code',
          op: 'EQ',
          value: 'PAY'
        }
      ]
    });
  });

  it('expands semicolon-separated CONTAINS text values into an inner OR compose node', () => {
    const request = buildDataTableDslRequest({
      columns: [
        {
          accessorKey: 'staffCode',
          header: '员工编码',
          enableColumnFilter: true,
          meta: { variant: 'text', label: '员工编码' }
        },
        {
          accessorKey: 'staffName',
          header: '员工姓名',
          enableColumnFilter: true,
          meta: { variant: 'text', label: '员工姓名', query: { operator: 'EQ' } }
        }
      ],
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [],
      columnFilters: [
        { id: 'staffCode', value: ' 1 ; ; 2 ; ' },
        { id: 'staffName', value: 'Alice;Bob' }
      ]
    });

    expect(request.condition).toEqual({
      nodeType: 'compose',
      logic: 'AND',
      children: [
        {
          nodeType: 'compose',
          logic: 'OR',
          children: [
            {
              nodeType: 'text',
              field: 'staffCode',
              op: 'CONTAINS',
              value: '1'
            },
            {
              nodeType: 'text',
              field: 'staffCode',
              op: 'CONTAINS',
              value: '2'
            }
          ]
        },
        {
          nodeType: 'text',
          field: 'staffName',
          op: 'EQ',
          value: 'Alice;Bob'
        }
      ]
    });
  });

  it('keeps CONTAINS text filters as single text nodes when semicolon parsing finds one value', () => {
    const request = buildDataTableDslRequest({
      columns,
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [],
      columnFilters: [{ id: 'dictTypeCode', value: ' payment ; ; ' }]
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
  });

  it('truncates semicolon-separated CONTAINS text values at 50 items and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const request = buildDataTableDslRequest({
      columns: [
        {
          accessorKey: 'staffCode',
          header: '员工编码',
          enableColumnFilter: true,
          meta: { variant: 'text', label: '员工编码' }
        }
      ],
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [],
      columnFilters: [
        {
          id: 'staffCode',
          value: Array.from({ length: 55 }, (_, index) => String(index + 1)).join(';')
        }
      ]
    });

    const condition = request.condition as Extract<DataTableDslCondition, { nodeType: 'compose' }>;
    const orNode = condition.children[0] as Extract<DataTableDslCondition, { nodeType: 'compose' }>;

    expect(orNode.children).toHaveLength(50);
    expect(orNode.children[0]).toMatchObject({ field: 'staffCode', value: '1' });
    expect(orNode.children[49]).toMatchObject({ field: 'staffCode', value: '50' });
    expect(warn).toHaveBeenCalledWith(
      '[useDslDataTable.dsl] Truncating semicolon-separated text filter values.',
      {
        field: 'staffCode',
        count: 55,
        max: 50
      }
    );

    warn.mockRestore();
  });

  it('keeps select filters containing semicolons as single text nodes', () => {
    const request = buildDataTableDslRequest({
      columns: [
        {
          accessorKey: 'dictTypeCode',
          header: '字典类型编码',
          enableColumnFilter: true,
          meta: { variant: 'select', label: '字典类型编码' }
        }
      ],
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [],
      columnFilters: [{ id: 'dictTypeCode', value: 'payment;refund' }]
    });

    expect(request.condition).toEqual({
      nodeType: 'compose',
      logic: 'AND',
      children: [
        {
          nodeType: 'text',
          field: 'dictTypeCode',
          op: 'EQ',
          value: 'payment;refund'
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

    const singleNode = (
      singleDateRequest.condition as Extract<DataTableDslCondition, { nodeType: 'compose' }>
    ).children[0] as Extract<DataTableDslCondition, { nodeType: 'dateTime' }>;
    const fromOnlyNode = (
      fromOnlyRequest.condition as Extract<DataTableDslCondition, { nodeType: 'compose' }>
    ).children[0] as Extract<DataTableDslCondition, { nodeType: 'dateTime' }>;
    const rangeNode = (
      rangeRequest.condition as Extract<DataTableDslCondition, { nodeType: 'compose' }>
    ).children[0] as Extract<DataTableDslCondition, { nodeType: 'dateTime' }>;

    expect(singleNode.nodeType).toBe('dateTime');
    expect(singleNode.op).toBe('BETWEEN');
    expect(singleNode.start).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);
    expect(singleNode.end).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/);

    expect(singleNode.start).toBe('2026-06-12 00:00:00');
    expect(singleNode.end).toBe('2026-06-12 23:59:59');

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

  it('warns with the new helper prefix and skips accessorFn columns without explicit ids', () => {
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
    expect(warn.mock.calls[0]?.[0]).toContain('[useDslDataTable.dsl]');
  });

  it('falls back to the default operator when the override is incompatible', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const request = buildDataTableDslRequest({
      columns: [
        {
          accessorKey: 'dictTypeCode',
          header: '编码',
          enableColumnFilter: true,
          meta: { variant: 'text', label: '编码', query: { operator: 'BETWEEN' } }
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

  it('declares the filter variants supported by automatic DSL serialization', () => {
    expect(DATA_TABLE_DSL_SUPPORTED_FILTER_VARIANTS).toEqual([
      'text',
      'select',
      'multiSelect',
      'date',
      'dateRange'
    ]);

    expect(isDataTableDslFilterVariantSupported('text')).toBe(true);
    expect(isDataTableDslFilterVariantSupported('dateRange')).toBe(true);
    expect(isDataTableDslFilterVariantSupported('number')).toBe(false);
    expect(isDataTableDslFilterVariantSupported('range')).toBe(false);
    expect(isDataTableDslFilterVariantSupported('boolean')).toBe(false);
  });

  it('does not serialize numeric or boolean UI-only filter variants into DSL conditions', () => {
    const request = buildDataTableDslRequest({
      columns: [
        {
          accessorKey: 'id',
          header: 'ID',
          enableColumnFilter: true,
          meta: { variant: 'number', label: 'ID' }
        },
        {
          accessorKey: 'dictTypeCode',
          header: '范围',
          enableColumnFilter: true,
          meta: { variant: 'range', label: '范围', range: [0, 100] }
        },
        {
          accessorKey: 'dictTypeName',
          header: '启用状态',
          enableColumnFilter: true,
          meta: { variant: 'boolean', label: '启用状态' }
        }
      ],
      pagination: { pageIndex: 0, pageSize: 10 },
      sorting: [],
      columnFilters: [
        { id: 'id', value: 42 },
        { id: 'dictTypeCode', value: [10, 20] },
        { id: 'dictTypeName', value: true }
      ]
    });

    expect(request.condition).toBeUndefined();
  });
});
