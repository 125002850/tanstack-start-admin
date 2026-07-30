import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MultiSelectCombobox, type MultiSelectComboboxOption } from './multi-select-combobox';

const OPTIONS: MultiSelectComboboxOption[] = [
  { value: '1', label: '流程配置' },
  { value: '2', label: '数据同步' },
  { value: '3', label: '数据商退款' }
];

function MultiSelectHarness({ initialValue = [] }: { initialValue?: string[] }) {
  const [value, setValue] = React.useState(initialValue);

  return (
    <MultiSelectCombobox
      triggerLabel='任务分类'
      placeholder='请选择任务分类'
      options={OPTIONS}
      value={value}
      onValueChange={setValue}
    />
  );
}

function NumericControlledHarness() {
  const [value, setValue] = React.useState<number[]>([2, 2]);
  const [open, setOpen] = React.useState(true);
  const [inputValue, setInputValue] = React.useState('远程');

  return (
    <MultiSelectCombobox
      triggerLabel='角色'
      placeholder='请选择角色'
      options={[
        { value: 1, label: '管理员' },
        { value: 1, label: '重复管理员' },
        { value: 2, label: '审计员' },
        { value: 3, label: '访客' }
      ]}
      value={value}
      open={open}
      inputValue={inputValue}
      maxSelected={2}
      isLoading
      loadMore={{
        visible: true,
        isLoading: true,
        label: '正在加载更多',
        onClick: () => undefined
      }}
      onOpenChange={setOpen}
      onInputValueChange={setInputValue}
      onValueChange={setValue}
    />
  );
}

describe('MultiSelectCombobox', () => {
  afterEach(cleanup);

  beforeEach(() => {
    Element.prototype.hasPointerCapture ??= vi.fn(() => false);
    Element.prototype.setPointerCapture ??= vi.fn();
    Element.prototype.releasePointerCapture ??= vi.fn();
    Element.prototype.scrollIntoView ??= vi.fn();
  });

  it('searches options and toggles selected values', async () => {
    const user = userEvent.setup();
    render(<MultiSelectHarness />);

    const trigger = screen.getByRole('button', { name: '任务分类' });
    await user.click(trigger);
    await user.type(screen.getByPlaceholderText('搜索任务分类'), '数据');

    expect(screen.getByText('数据商退款')).toBeInTheDocument();
    expect(screen.queryByText('流程配置')).not.toBeInTheDocument();

    await user.click(screen.getByText('数据商退款'));

    await waitFor(() => {
      expect(trigger).toHaveTextContent('数据商退款');
    });
  });

  it('renders selected labels and clears them from the command list', async () => {
    const user = userEvent.setup();
    render(<MultiSelectHarness initialValue={['1', '2']} />);

    const trigger = screen.getByRole('button', { name: '任务分类' });
    expect(trigger).toHaveTextContent('流程配置,数据同步');

    await user.click(trigger);
    await user.click(screen.getByText('清除选择'));

    await waitFor(() => {
      expect(trigger).toHaveTextContent('请选择任务分类');
    });
  });

  it('closes on Escape and restores focus to the trigger', async () => {
    const user = userEvent.setup();
    render(<MultiSelectHarness initialValue={['1']} />);

    const trigger = screen.getByRole('button', { name: '任务分类' });
    trigger.focus();
    await user.click(trigger);
    expect(screen.getByPlaceholderText('搜索任务分类')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByPlaceholderText('搜索任务分类')).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it('supports numeric values, controlled search, deduplication, max selection and loading', async () => {
    const user = userEvent.setup();
    render(<NumericControlledHarness />);

    const trigger = screen.getByRole('button', { name: '角色' });
    expect(trigger).toHaveTextContent('审计员');
    expect(screen.getByPlaceholderText('搜索角色')).toHaveValue('远程');
    expect(screen.queryByText('重复管理员')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '正在加载更多' })).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('正在加载更多');

    await user.clear(screen.getByPlaceholderText('搜索角色'));
    await user.click(screen.getByText('管理员'));

    await waitFor(() => {
      expect(trigger).toHaveTextContent('审计员,管理员');
    });
    expect(screen.getByText('访客').closest('[cmdk-item]')).toHaveAttribute(
      'data-disabled',
      'true'
    );
  });
});
