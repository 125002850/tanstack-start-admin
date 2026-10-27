import { describe, expect, it } from 'vitest';
import { createDataTableColumnDsl } from './data-table-column-factory';

const dsl = createDataTableColumnDsl<{ category: string | null }>();

describe('nullable search column options', () => {
  it('keeps the NULL search option separate from current-page candidates', () => {
    const choices = [{ value: 'A', label: '分类 A' }];
    const column = dsl.field('category', '分类', {
      filter: 'multiSelect',
      filterOptions: choices,
      filterEmptyOption: { label: '未设置' }
    });
    expect(column.meta?.emptyOption).toEqual({ label: '未设置' });
    expect(column.meta?.localFilter?.options).toEqual(choices);
    expect(
      dsl.field('category', '分类', { filter: 'multiSelect' }).meta?.emptyOption
    ).toBeUndefined();
  });

  it('rejects unsupported filter variants and enum contracts', () => {
    expect(() => dsl.field('category', '分类', { filter: 'text', filterEmptyOption: {} })).toThrow(
      'select, multiSelect or remoteSelect'
    );
    expect(() =>
      dsl.field('category', '分类', {
        filter: 'select',
        filterEmptyOption: {},
        dsl: { filterNodeType: 'enum' }
      })
    ).toThrow('text.IS_NULL');
  });

  it('removes a stale NULL option when server filtering is disabled', () => {
    expect(
      dsl.field('category', '分类', { filter: false, meta: { emptyOption: {} } }).meta?.emptyOption
    ).toBeUndefined();
  });
});
