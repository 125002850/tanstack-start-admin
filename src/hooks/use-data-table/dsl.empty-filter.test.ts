// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import type { ColumnDef } from '@tanstack/react-table';
import { DATA_TABLE_EMPTY_FILTER_VALUE } from '@/lib/data-table/empty-filter';
import {
  buildDataTableDslRequest,
  buildDataTableDslQuickConditions,
  restoreDataTableColumnFilters,
  type DataTableDslCondition
} from './dsl';

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

describe('empty choice filters', () => {
  const empty = { nodeType: 'text', field: 'categoryCode', op: 'IS_NULL' };
  function requestFor(
    value: unknown,
    variant: 'select' | 'multiSelect' = 'multiSelect',
    query: NonNullable<ColumnDef<DictionaryTypeRow>['meta']>['query'] = {},
    enabled = true
  ) {
    return buildDataTableDslRequest({
      columns: [
        {
          accessorKey: 'dictTypeCode',
          meta: {
            variant,
            emptyOption: enabled ? {} : undefined,
            query: { filterField: 'categoryCode', ...query }
          }
        },
        columns[1]
      ],
      pagination: { pageIndex: 0, pageSize: 20 },
      sorting: [],
      columnFilters: [{ id: 'dictTypeCode', value }]
    }).condition;
  }

  it.each(['select', 'multiSelect'] as const)(
    'serializes %s empty selection as IS_NULL',
    (variant) => {
      expect(requestFor([DATA_TABLE_EMPTY_FILTER_VALUE], variant)).toEqual({
        nodeType: 'compose',
        logic: 'AND',
        children: [empty]
      });
    }
  );

  it('combines ordinary choices with NULL using OR and strips the marker before serialization', () => {
    const serializeFilter = vi.fn((value: unknown) =>
      (value as string[]).map((item) => item.toUpperCase())
    );
    expect(
      requestFor(['a', DATA_TABLE_EMPTY_FILTER_VALUE, 'b'], 'multiSelect', { serializeFilter })
    ).toEqual({
      nodeType: 'compose',
      logic: 'AND',
      children: [
        {
          nodeType: 'compose',
          logic: 'OR',
          children: [
            { nodeType: 'text', field: 'categoryCode', op: 'IN', values: ['A', 'B'] },
            empty
          ]
        }
      ]
    });
    expect(serializeFilter).toHaveBeenCalledExactlyOnceWith(['a', 'b'], expect.anything());
    serializeFilter.mockClear();
    requestFor([DATA_TABLE_EMPTY_FILTER_VALUE], 'multiSelect', { serializeFilter });
    expect(serializeFilter).not.toHaveBeenCalled();
  });

  it.each([undefined, null, [], [''], ['   ']].map((value) => ({ value })))(
    'keeps a cleared filter unrestricted: %j',
    ({ value }) => {
      expect(requestFor(value)).toBeUndefined();
    }
  );

  it('preserves ordinary selection and does not interpret the marker when disabled', () => {
    expect(requestFor(['A'], 'select')).toEqual({
      nodeType: 'compose',
      logic: 'AND',
      children: [{ nodeType: 'text', field: 'categoryCode', op: 'EQ', value: 'A' }]
    });
    expect(requestFor(['A', 'B'])).toEqual({
      nodeType: 'compose',
      logic: 'AND',
      children: [{ nodeType: 'text', field: 'categoryCode', op: 'IN', values: ['A', 'B'] }]
    });
    expect(requestFor([DATA_TABLE_EMPTY_FILTER_VALUE], 'select', {}, false)).toEqual({
      nodeType: 'compose',
      logic: 'AND',
      children: [
        { nodeType: 'text', field: 'categoryCode', op: 'EQ', value: DATA_TABLE_EMPTY_FILTER_VALUE }
      ]
    });
  });

  it('composes a custom ordinary condition without leaking the UI marker', () => {
    const buildFilterCondition = vi.fn(
      (value: unknown): DataTableDslCondition => ({
        nodeType: 'text',
        field: 'categoryCode',
        op: 'IN',
        values: value as string[]
      })
    );
    expect(
      requestFor([DATA_TABLE_EMPTY_FILTER_VALUE, 'A'], 'multiSelect', { buildFilterCondition })
    ).toEqual({
      nodeType: 'compose',
      logic: 'AND',
      children: [
        {
          nodeType: 'compose',
          logic: 'OR',
          children: [{ nodeType: 'text', field: 'categoryCode', op: 'IN', values: ['A'] }, empty]
        }
      ]
    });
    expect(buildFilterCondition).toHaveBeenCalledExactlyOnceWith(['A']);
  });

  it('keeps other fields and base constraints outside the nullable field OR', () => {
    const baseCondition: DataTableDslCondition = {
      nodeType: 'text',
      field: 'tenant',
      op: 'EQ',
      value: 'T1'
    };
    expect(
      buildDataTableDslRequest({
        columns: [
          { accessorKey: 'dictTypeCode', meta: { variant: 'multiSelect', emptyOption: {} } },
          columns[1]
        ],
        pagination: { pageIndex: 0, pageSize: 20 },
        sorting: [],
        baseCondition,
        columnFilters: [
          { id: 'dictTypeCode', value: ['A', DATA_TABLE_EMPTY_FILTER_VALUE] },
          { id: 'dictTypeName', value: '分类' }
        ]
      }).condition
    ).toEqual({
      nodeType: 'compose',
      logic: 'AND',
      children: [
        baseCondition,
        {
          nodeType: 'compose',
          logic: 'OR',
          children: [
            { nodeType: 'text', field: 'dictTypeCode', op: 'IN', values: ['A'] },
            { nodeType: 'text', field: 'dictTypeCode', op: 'IS_NULL' }
          ]
        },
        { nodeType: 'text', field: 'dictTypeName', op: 'EQ', value: '分类' }
      ]
    });
  });

  it('uses a declared empty condition for relation absence instead of a synthetic field', () => {
    const emptyFilterCondition: DataTableDslCondition = {
      nodeType: 'text',
      field: 'relationCount',
      op: 'EQ',
      value: '0'
    };
    expect(
      requestFor([DATA_TABLE_EMPTY_FILTER_VALUE], 'multiSelect', { emptyFilterCondition })
    ).toEqual({
      nodeType: 'compose',
      logic: 'AND',
      children: [emptyFilterCondition]
    });
    expect(
      requestFor(['A', DATA_TABLE_EMPTY_FILTER_VALUE], 'multiSelect', { emptyFilterCondition })
    ).toEqual({
      nodeType: 'compose',
      logic: 'AND',
      children: [
        {
          nodeType: 'compose',
          logic: 'OR',
          children: [
            { nodeType: 'text', field: 'categoryCode', op: 'IN', values: ['A'] },
            emptyFilterCondition
          ]
        }
      ]
    });
  });
});

describe('nullable query scheme round trips', () => {
  it.each(['select', 'multiSelect'] as const)(
    'restores %s NULL choices without exposing the marker to the server',
    (variant) => {
      const nullableColumns: ColumnDef<DictionaryTypeRow>[] = [
        { accessorKey: 'dictTypeCode', meta: { variant, emptyOption: {} } }
      ];
      const filters = [
        {
          id: 'dictTypeCode',
          value:
            variant === 'select'
              ? [DATA_TABLE_EMPTY_FILTER_VALUE]
              : ['A', DATA_TABLE_EMPTY_FILTER_VALUE]
        }
      ];
      const quick = JSON.parse(
        JSON.stringify(buildDataTableDslQuickConditions(nullableColumns, filters))
      );
      expect(restoreDataTableColumnFilters(nullableColumns, quick)).toEqual(filters);
      expect(
        restoreDataTableColumnFilters([{ accessorKey: 'dictTypeCode', meta: { variant } }], quick)
      ).toBeUndefined();
    }
  );
});
