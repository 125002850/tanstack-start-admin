import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

it('forwards field semantics and loads only near the scroll boundary', () => {
  const onClick = vi.fn();
  const props = {
    id: 'customer',
    'aria-required': true,
    triggerAppearance: 'button' as const,
    items: [{ id: '1', label: '客户一' }],
    open: true,
    inputValue: '',
    triggerLabel: '客户',
    placeholder: '请选择',
    searchPlaceholder: '搜索',
    emptyText: '暂无',
    onOpenChange: vi.fn(),
    onInputValueChange: vi.fn(),
    onValueChange: vi.fn(),
    itemToStringLabel: (item?: Item | null) => item?.label ?? '',
    itemToStringValue: (item?: Item | null) => item?.id ?? '',
    isItemEqualToValue: (a?: Item | null, b?: Item | null) => a?.id === b?.id,
    getItemKey: (item: Item) => item.id,
    renderItem: (item: Item) => item.label,
    loadMore: { visible: true, label: '加载更多', onClick }
  };
  const view = render(<SearchCombobox {...props} />);
  expect(screen.getByRole('combobox', { name: '客户' })).toHaveAttribute('id', 'customer');
  expect(screen.getByRole('combobox', { name: '客户' })).toHaveAttribute('aria-required', 'true');
  const list = screen.getByRole('listbox');
  Object.defineProperties(list, {
    scrollHeight: { value: 500 },
    clientHeight: { value: 200 },
    scrollTop: { value: 0, writable: true }
  });
  fireEvent.scroll(list);
  expect(onClick).not.toHaveBeenCalled();
  list.scrollTop = 280;
  fireEvent.scroll(list);
  expect(onClick).toHaveBeenCalledTimes(1);
  view.rerender(<SearchCombobox {...props} loadMore={{ ...props.loadMore, isLoading: true }} />);
  fireEvent.scroll(list);
  expect(onClick).toHaveBeenCalledTimes(1);
});

afterEach(cleanup);
