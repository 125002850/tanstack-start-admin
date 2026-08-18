import { describe, expect, it } from 'vitest';

import type { DataTableChoiceOption, DataTableChoiceValue } from './types';

import {
  getDataTableChoiceValues,
  isDataTableChoiceValue,
  mergeDataTableChoiceOptions,
  resolveDataTableChoiceLabels
} from './model';

describe('choice model', () => {
  it('normalizes scalar and multiple values while preserving choice order', () => {
    expect(getDataTableChoiceValues(null)).toEqual([]);
    expect(getDataTableChoiceValues('DRAFT')).toEqual(['DRAFT']);
    expect(getDataTableChoiceValues([2, 1, 2, null, Number.POSITIVE_INFINITY, {}])).toEqual([2, 1]);
    expect(isDataTableChoiceValue(Number.NaN)).toBe(false);
  });

  it('merges option sources by value with the first source taking precedence', () => {
    expect(
      mergeDataTableChoiceOptions(
        [{ value: 42, label: '已解析张三' }],
        [
          { value: 42, label: '搜索结果张三' },
          { value: 43, label: '李四' }
        ]
      )
    ).toEqual([
      { value: 42, label: '已解析张三' },
      { value: 43, label: '李四' }
    ]);
  });

  it('resolves labels by source priority and falls back to the raw value', () => {
    const remoteOptions = new Map<DataTableChoiceValue, DataTableChoiceOption>([
      [42, { value: 42, label: '远程张三' }]
    ]);
    const staticOptions = new Map<DataTableChoiceValue, DataTableChoiceOption>([
      [42, { value: 42, label: '静态张三' }],
      ['42', { value: '42', label: '字符串 42' }]
    ]);

    expect(resolveDataTableChoiceLabels([42, '42', 43], remoteOptions, staticOptions)).toEqual([
      '远程张三',
      '字符串 42',
      '43'
    ]);
  });
});
