import { describe, expect, it } from 'vitest';

import type { DataTableColumnFilterOptions } from '@/types/data-table';

import { resolveDataTableEnumLabel } from './data-table-column-rendering';

describe('resolveDataTableEnumLabel', () => {
  it('resolves labels from flat filter options', () => {
    const options: DataTableColumnFilterOptions = {
      filterOptions: [
        { label: 'Option A', value: 'a' },
        { label: 'Option B', value: 'b' }
      ]
    };

    expect(resolveDataTableEnumLabel('b', options)).toBe('Option B');
  });

  it('resolves labels from tree filter options', () => {
    const options: DataTableColumnFilterOptions = {
      filterOptions: {
        kind: 'tree',
        options: [
          { label: '总部', value: 'root', depth: 0 },
          { label: '研发部', value: 'research', depth: 1 }
        ]
      }
    };

    expect(resolveDataTableEnumLabel('research', options)).toBe('研发部');
  });

  it('returns undefined for unknown or empty values', () => {
    const options: DataTableColumnFilterOptions = {
      filterOptions: {
        kind: 'tree',
        options: [{ label: '总部', value: 'root', depth: 0 }]
      }
    };

    expect(resolveDataTableEnumLabel('missing', options)).toBeUndefined();
    expect(resolveDataTableEnumLabel(null, options)).toBeUndefined();
  });
});
