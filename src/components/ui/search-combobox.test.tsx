import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { SearchCombobox } from './search-combobox';

type Item = { id: string; label: string };

describe('SearchCombobox', () => {
  it('uses the shared input border and a transparent trigger background', () => {
    render(
      <SearchCombobox<Item>
        items={[]}
        open={false}
        inputValue=''
        triggerLabel='客户'
        placeholder='请选择客户'
        searchPlaceholder='搜索客户'
        emptyText='暂无客户'
        onOpenChange={vi.fn()}
        onInputValueChange={vi.fn()}
        onValueChange={vi.fn()}
        itemToStringLabel={(item) => item?.label ?? ''}
        itemToStringValue={(item) => item?.id ?? ''}
        isItemEqualToValue={(item, value) => item?.id === value?.id}
        getItemKey={(item) => item.id}
        renderItem={(item) => item.label}
      />
    );

    expect(screen.getByRole('combobox', { name: '客户' })).toHaveClass(
      'border-input',
      'bg-transparent'
    );
  });
});
