import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { DictionaryItemRecord } from '../api/types';
import { DictionaryItemSheet } from './dictionary-item-sheet';

const ITEM: DictionaryItemRecord = {
  id: 11,
  dictTypeCode: 'color',
  dictItemCode: 'red',
  dictItemName: '红色',
  status: 'enable',
  sort: 10,
  remark: 'warm',
  createBy: 1,
  createTime: '2026-06-08 10:05:00',
  updateBy: 1,
  updateTime: '2026-06-08 10:05:00'
};

describe('DictionaryItemSheet', () => {
  it('resets form values after closing and reopening the same item', () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const onOpenChange = vi.fn();

    const { rerender } = render(
      <DictionaryItemSheet
        key='open-initial'
        open
        onOpenChange={onOpenChange}
        dictTypeCode='color'
        item={ITEM}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByRole('textbox', { name: /字典项名称/ }), {
      target: { value: '临时名称' }
    });
    expect(screen.getByRole('textbox', { name: /字典项名称/ })).toHaveValue('临时名称');

    rerender(
      <DictionaryItemSheet
        key='closed'
        open={false}
        onOpenChange={onOpenChange}
        dictTypeCode='color'
        item={ITEM}
        onSubmit={onSubmit}
      />
    );

    rerender(
      <DictionaryItemSheet
        key='open-reopened'
        open
        onOpenChange={onOpenChange}
        dictTypeCode='color'
        item={ITEM}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByRole('textbox', { name: /字典项名称/ })).toHaveValue('红色');
    expect(screen.getByRole('textbox', { name: /字典项编码/ })).toHaveValue('red');
  });
});
