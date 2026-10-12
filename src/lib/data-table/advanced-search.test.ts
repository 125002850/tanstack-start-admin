import { validateCombinedCondition } from '@/lib/data-table/advanced-search';
import type { ColumnDef } from '@tanstack/react-table';
import { describe, expect, it } from 'vitest';

import type { DataTableDslCondition } from '@/hooks/use-data-table/dsl';
import {
  normalizeAdvancedCondition,
  parseQuerySchemeContent,
  resolveAdvancedSearchFields
} from '@/lib/data-table/advanced-search';
import type { DataTableQueryScheme } from '@/components/data-table/advanced-search/types';

type Row = {
  name: string;
  amount: number;
  createdAt: string;
  maskedNo: string;
};

const columns: Array<ColumnDef<Row>> = [
  {
    accessorKey: 'name',
    meta: {
      label: '名称',
      variant: 'text',
      advancedSearch: { field: 'name', conditionType: 'text' }
    }
  },
  {
    accessorKey: 'amount',
    meta: {
      label: '金额',
      advancedSearch: { field: 'amount', conditionType: 'number' }
    }
  },
  {
    accessorKey: 'createdAt',
    meta: {
      label: '创建日期',
      variant: 'date',
      advancedSearch: { field: 'createdAt', conditionType: 'dateTime' }
    }
  },
  {
    accessorKey: 'maskedNo',
    meta: {
      label: '证件号码',
      advancedSearch: { field: 'certificateNo', conditionType: 'text' }
    }
  },
  { id: 'actions', header: '操作' }
];

describe('DataTable advanced search model', () => {
  it('uses backend types and operators, including fields without a table column', () => {
    const fields = resolveAdvancedSearchFields(
      columns,
      { name: { conditionType: 'number', operators: ['EQ', 'CONTAINS'] } },
      {
        name: {
          label: '后端名称',
          conditionType: 'text',
          operators: ['CONTAINS'],
          valueLabels: {}
        },
        status: {
          label: '状态',
          conditionType: 'enum',
          operators: ['EQ'],
          valueLabels: { open: '待处理' }
        }
      }
    );
    expect(fields).toEqual([
      expect.objectContaining({
        field: 'name',
        label: '名称',
        conditionType: 'text',
        operators: ['CONTAINS']
      }),
      expect.objectContaining({
        field: 'status',
        label: '状态',
        conditionType: 'enum',
        options: [{ value: 'open', label: '待处理' }]
      })
    ]);
    expect(fields.some((field) => field.field === 'amount')).toBe(false);
  });

  it('uses metadata limits when validating the combined request', () => {
    expect(
      validateCombinedCondition(
        { nodeType: 'text', field: 'name', op: 'IN', values: ['a', 'b'] },
        {
          maxDepth: 4,
          maxNodes: 20,
          maxInSize: 1,
          maxComplexityScore: 100
        }
      )
    ).toBe('单个条件最多允许 1 个值');
  });

  it('derives searchable fields independently from column visibility and excludes utility columns', () => {
    const fields = resolveAdvancedSearchFields(columns);

    expect(fields.map((field) => [field.columnId, field.field, field.conditionType])).toEqual([
      ['name', 'name', 'text'],
      ['amount', 'amount', 'number'],
      ['createdAt', 'createdAt', 'dateTime'],
      ['maskedNo', 'certificateNo', 'text']
    ]);
  });

  it('converts equal and not-equal calendar days to full-day DSL semantics', () => {
    const fields = resolveAdvancedSearchFields(columns);
    const equal = normalizeAdvancedCondition(
      { nodeType: 'dateTime', field: 'createdAt', op: 'EQ', value: '2026-08-10' },
      fields
    );
    const notEqual = normalizeAdvancedCondition(
      { nodeType: 'dateTime', field: 'createdAt', op: 'NE', value: '2026-08-10' },
      fields
    );

    expect(equal).toEqual({
      nodeType: 'dateTime',
      field: 'createdAt',
      op: 'BETWEEN',
      start: '2026-08-10 00:00:00',
      end: '2026-08-10 23:59:59'
    });
    expect(notEqual).toEqual({
      nodeType: 'compose',
      logic: 'OR',
      children: [
        { nodeType: 'dateTime', field: 'createdAt', op: 'LT', value: '2026-08-10 00:00:00' },
        { nodeType: 'dateTime', field: 'createdAt', op: 'GT', value: '2026-08-10 23:59:59' }
      ]
    });
  });

  it('preserves nested AND/OR groups and numeric ranges', () => {
    const condition: DataTableDslCondition = {
      nodeType: 'compose',
      logic: 'OR',
      children: [
        {
          nodeType: 'compose',
          logic: 'AND',
          children: [
            { nodeType: 'text', field: 'name', op: 'CONTAINS', value: '海运' },
            { nodeType: 'number', field: 'amount', op: 'BETWEEN', start: 100, end: 500 }
          ]
        },
        { nodeType: 'text', field: 'certificateNo', op: 'IS_NOT_NULL' }
      ]
    };

    expect(normalizeAdvancedCondition(condition, resolveAdvancedSearchFields(columns))).toEqual(
      condition
    );
  });

  it('rejects a saved scheme when a field or operator has become invalid', () => {
    const scheme: DataTableQueryScheme = {
      id: 1,
      sceneCode: 'test.page',
      schemeName: '旧方案',
      contentJson: JSON.stringify({
        schemaVersion: 1,
        quickConditions: [],
        advancedCondition: {
          nodeType: 'text',
          field: 'removedField',
          op: 'EQ',
          value: 'A'
        }
      }),
      schemaVersion: 1,
      defaultScheme: true,
      version: 0
    };

    expect(
      parseQuerySchemeContent(
        scheme,
        resolveAdvancedSearchFields(columns),
        columns as Array<ColumnDef<unknown>>
      )
    ).toBeUndefined();
  });
});

describe('advanced query boundaries', () => {
  it('validates the final tree including fixed customer and quick conditions', () => {
    const leaf: DataTableDslCondition = { nodeType: 'text', field: 'name', op: 'EQ', value: 'A' };
    expect(
      validateCombinedCondition({
        nodeType: 'compose',
        logic: 'AND',
        children: Array.from({ length: 20 }, () => leaf)
      })
    ).toContain('20');
    let nested: DataTableDslCondition = leaf;
    for (let i = 0; i < 4; i++) nested = { nodeType: 'compose', logic: 'AND', children: [nested] };
    expect(validateCombinedCondition(nested)).toContain('4');
  });
  it('rejects overlong IN values instead of silently truncating them', () => {
    expect(
      normalizeAdvancedCondition(
        {
          nodeType: 'text',
          field: 'name',
          op: 'IN',
          values: Array.from({ length: 1001 }, (_, i) => String(i))
        },
        resolveAdvancedSearchFields(columns)
      )
    ).toBeUndefined();
  });
});
