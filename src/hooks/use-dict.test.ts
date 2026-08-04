import { describe, expect, it } from 'vitest';

import { buildDictBatch, normalizeDictTypes } from './use-dict';

describe('dictionary batch translation', () => {
  it('deduplicates and sorts dictionary types for a stable query key', () => {
    expect(normalizeDictTypes(['YES_NO', ' ENABLE_STATUS ', 'YES_NO', ''])).toEqual([
      'ENABLE_STATUS',
      'YES_NO'
    ]);
  });

  it('keeps disabled labels for display but removes them from selectable options', () => {
    const batch = buildDictBatch([
      {
        dictTypeCode: 'ORDER_STATUS',
        items: [
          { code: 'OLD', name: '历史状态', status: 'disable', sortOrder: 2 },
          { code: 'NEW', name: '新建', status: 'enable', sortOrder: 1 }
        ]
      }
    ]);
    const dictionary = batch.byType.get('ORDER_STATUS');

    expect(dictionary?.codeMap.get('OLD')).toBe('历史状态');
    expect(dictionary?.options).toEqual([{ value: 'NEW', label: '新建' }]);
  });
});
