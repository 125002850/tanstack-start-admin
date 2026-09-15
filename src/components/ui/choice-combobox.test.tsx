import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MultipleChoiceCombobox, SingleChoiceCombobox } from './choice-combobox';

const OPTIONS = [
  { value: 1, label: '管理员' },
  { value: 2, label: '审计员' },
  { value: 3, label: '访客' }
];

function SingleHarness({
  allowEmpty = true,
  searchMode = 'local'
}: {
  allowEmpty?: boolean;
  searchMode?: 'none' | 'local';
}) {
  const [value, setValue] = React.useState<number | null>(1);

  return (
    <SingleChoiceCombobox
      options={OPTIONS}
      value={value}
      searchMode={searchMode}
      allowEmpty={allowEmpty}
      triggerLabel='角色'
      placeholder='请选择角色'
      onValueChange={setValue}
    />
  );
}

function RequiredMultipleHarness() {
  const [value, setValue] = React.useState([1]);

  return (
    <MultipleChoiceCombobox
      options={OPTIONS}
      value={value}
      allowEmpty={false}
      triggerLabel='角色'
      placeholder='请选择角色'
      onValueChange={setValue}
    />
  );
}

describe('ChoiceCombobox', () => {
  afterEach(cleanup);

  beforeEach(() => {
    Element.prototype.hasPointerCapture ??= vi.fn(() => false);
    Element.prototype.setPointerCapture ??= vi.fn();
    Element.prototype.releasePointerCapture ??= vi.fn();
    Element.prototype.scrollIntoView ??= vi.fn();
  });

  it('groups options and shows truncated descriptions on row hover and keyboard navigation', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MultipleChoiceCombobox
        options={[
          { value: 'NONE', label: '不提及' },
          { value: 'EMPLOYEE', group: '请求传入', label: '员工名单', description: '完整员工说明' },
          { value: 'FIXED', group: '预设人员', label: '指定员工', description: '短说明' }
        ]}
        value={[]}
        onValueChange={onChange}
        triggerLabel='提及'
        placeholder='请选择'
      />
    );
    await user.click(screen.getByRole('button', { name: '提及' }));
    expect(screen.getByRole('group', { name: '请求传入' })).toBeInTheDocument();
    expect(screen.getByRole('group', { name: '预设人员' })).toBeInTheDocument();
    const description = screen.getByText('完整员工说明');
    Object.defineProperties(description, {
      clientWidth: { value: 80 },
      scrollWidth: { value: 160 }
    });
    const option = screen.getByRole('option', { name: /员工名单/ });
    await user.hover(option);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('完整员工说明');
    await user.click(option);
    expect(onChange).toHaveBeenCalledWith(['EMPLOYEE']);
    await user.hover(screen.getByRole('option', { name: /指定员工/ }));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await user.keyboard('{ArrowUp}');
    expect(await screen.findByRole('tooltip')).toHaveTextContent('完整员工说明');
    await user.type(screen.getByRole('combobox'), '指定');
    expect(screen.queryByRole('group', { name: '请求传入' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: '预设人员' })).toBeInTheDocument();
  });

  it('uses a scalar value and closes after a searchable single selection', async () => {
    const user = userEvent.setup();
    render(<SingleHarness />);

    const trigger = screen.getByRole('button', { name: '角色' });
    await user.click(trigger);
    await user.type(screen.getByPlaceholderText('搜索角色'), '审');
    await user.click(screen.getByText('审计员'));

    await waitFor(() => {
      expect(trigger).toHaveTextContent('审计员');
      expect(screen.queryByPlaceholderText('搜索角色')).not.toBeInTheDocument();
    });
  });

  it('renders an optional option description without adding it to the trigger label', async () => {
    const user = userEvent.setup();
    render(
      <SingleChoiceCombobox
        options={[
          { value: 1, label: '管理员', description: '系统角色' },
          { value: 2, label: '审计员' }
        ]}
        value={1}
        triggerLabel='角色'
        placeholder='请选择角色'
        onValueChange={() => undefined}
      />
    );

    const trigger = screen.getByRole('button', { name: '角色' });
    expect(trigger).toHaveTextContent('管理员');
    expect(trigger).not.toHaveTextContent('系统角色');

    await user.click(trigger);

    expect(screen.getByRole('option', { name: '管理员 系统角色' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '审计员' })).toBeInTheDocument();
  });

  it('keeps popover behavior when a consumer supplies the trigger structure', async () => {
    const user = userEvent.setup();
    render(
      <SingleChoiceCombobox
        options={OPTIONS}
        value={null}
        triggerLabel='角色'
        placeholder='请选择角色'
        onValueChange={() => undefined}
        renderTrigger={(props) => <button {...props}>自定义角色触发器</button>}
      />
    );

    const trigger = screen.getByRole('button', { name: '角色' });
    expect(trigger).toHaveTextContent('自定义角色触发器');
    await user.click(trigger);

    expect(screen.getByPlaceholderText('搜索角色')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '管理员' })).toBeInTheDocument();
  });

  it('places the single-selection clear action in the command footer', async () => {
    const user = userEvent.setup();
    render(<SingleHarness searchMode='none' />);

    const trigger = screen.getByRole('button', { name: '角色' });
    await user.click(trigger);

    expect(screen.queryByPlaceholderText('搜索角色')).not.toBeInTheDocument();
    await user.click(screen.getByText('清除选择'));

    await waitFor(() => {
      expect(trigger).toHaveTextContent('请选择角色');
    });
  });

  it('hides clear actions and prevents removing the final required value', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<SingleHarness allowEmpty={false} searchMode='none' />);

    await user.click(screen.getByRole('button', { name: '角色' }));
    expect(screen.queryByText('清除选择')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: '管理员' })).not.toHaveAttribute(
      'data-disabled',
      'true'
    );

    rerender(<RequiredMultipleHarness />);
    await user.click(screen.getByRole('button', { name: '角色' }));

    expect(screen.queryByText('清除选择')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: '管理员' })).toHaveAttribute('data-disabled', 'true');
  });

  it('loads the next remote page at the bottom without rendering a manual action', () => {
    const onLoadMore = vi.fn();
    render(
      <SingleChoiceCombobox
        options={OPTIONS}
        value={null}
        open
        searchMode='remote'
        triggerLabel='角色'
        placeholder='请选择角色'
        loadMore={{
          visible: true,
          label: '加载更多',
          onClick: onLoadMore
        }}
        onValueChange={() => undefined}
      />
    );

    const list = document.querySelector<HTMLElement>('[data-slot="command-list"]');
    expect(list).not.toBeNull();
    Object.defineProperties(list!, {
      clientHeight: { configurable: true, value: 120 },
      scrollHeight: { configurable: true, value: 300 },
      scrollTop: { configurable: true, value: 140, writable: true }
    });

    fireEvent.wheel(list!, { deltaY: 200 });
    fireEvent.scroll(list!);

    expect(onLoadMore).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: '加载更多' })).not.toBeInTheDocument();
  });
});
