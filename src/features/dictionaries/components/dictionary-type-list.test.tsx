import type { Table } from '@tanstack/react-table';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import type { DictionaryTypeRecord } from '../api/types';
import { DictionaryTypeList } from './dictionary-type-list';

afterEach(cleanup);

it('keeps selected state separate from tooltip state and shows the full name and code', async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  const table = { getColumn: () => undefined } as unknown as Table<DictionaryTypeRecord>;
  render(
    <DictionaryTypeList
      table={table}
      types={[
        { id: 1, dictTypeName: '完整字典名称', dictTypeCode: 'example_code', status: 'enable' }
      ]}
      selectedTypeCode='example_code'
      onSelect={onSelect}
      onAddType={vi.fn()}
    />
  );
  const button = screen.getByRole('button', { name: /完整字典名称/ });
  expect(button).toHaveAttribute('aria-pressed', 'true');
  expect(button).toHaveAttribute('data-state', 'closed');
  Object.defineProperties(screen.getByText('example_code'), {
    clientWidth: { value: 80 },
    scrollWidth: { value: 160 }
  });
  await user.hover(button);
  const tooltip = await screen.findByRole('tooltip');
  expect(tooltip).toHaveTextContent('完整字典名称');
  expect(tooltip).toHaveTextContent('example_code');
  await user.click(button);
  expect(onSelect).toHaveBeenCalledWith('example_code');
  expect(button).toHaveAttribute('data-state', 'closed');
  expect(button).toHaveAttribute('aria-pressed', 'true');
});
