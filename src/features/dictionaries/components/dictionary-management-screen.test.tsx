import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  DictionaryManagementScreen,
  type DictionaryItemRecord,
  type DictionaryTypeRecord
} from './dictionary-management-screen';

const DICTIONARY_TYPES: DictionaryTypeRecord[] = [
  {
    id: 1,
    dictTypeCode: 'color',
    dictTypeName: '颜色',
    status: 'ENABLED',
    createdBy: 'System',
    createdAt: '2026-06-08 10:00:00',
    updatedBy: 'System',
    updatedAt: '2026-06-08 10:00:00'
  },
  {
    id: 2,
    dictTypeCode: 'size',
    dictTypeName: '尺寸',
    status: 'DISABLED',
    createdBy: 'Admin',
    createdAt: '2026-06-08 11:00:00',
    updatedBy: 'Admin',
    updatedAt: '2026-06-08 11:00:00'
  }
];

const DICTIONARY_ITEMS: Record<string, DictionaryItemRecord[]> = {
  color: [
    {
      id: 11,
      dictTypeCode: 'color',
      dictItemCode: 'red',
      dictItemName: '红色',
      status: 'ENABLED',
      sort: 10,
      remark: 'warm',
      createdBy: 'System',
      createdAt: '2026-06-08 10:05:00',
      updatedBy: 'System',
      updatedAt: '2026-06-08 10:05:00'
    }
  ],
  size: [
    {
      id: 21,
      dictTypeCode: 'size',
      dictItemCode: 'l',
      dictItemName: '大',
      status: 'ENABLED',
      sort: 20,
      remark: 'Large',
      createdBy: 'Admin',
      createdAt: '2026-06-08 11:05:00',
      updatedBy: 'Admin',
      updatedAt: '2026-06-08 11:05:00'
    }
  ]
};

describe('DictionaryManagementScreen', () => {
  it('defaults to the first dictionary type and switches selection after filtering', () => {
    render(
      <DictionaryManagementScreen
        dictionaryTypes={DICTIONARY_TYPES}
        dictionaryItemsByType={DICTIONARY_ITEMS}
      />
    );

    expect(screen.getByRole('button', { name: /颜色 color/i })).toHaveAttribute(
      'data-state',
      'active'
    );
    expect(screen.getByText('编码：color')).toBeInTheDocument();
    expect(screen.getByText('红色')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: '搜索字典类型' }), {
      target: { value: 'size' }
    });

    expect(screen.queryByRole('button', { name: /颜色 color/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /尺寸 size/i })).toHaveAttribute(
      'data-state',
      'active'
    );
    expect(screen.getByText('编码：size')).toBeInTheDocument();
    expect(screen.getByText('大')).toBeInTheDocument();
  });
});
