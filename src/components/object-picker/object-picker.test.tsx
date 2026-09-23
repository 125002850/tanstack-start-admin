import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ObjectPicker, type ObjectPickerProps } from './index';

type Partner = { id: string; name: string; number: string; detail: { enabled: boolean } };
const first: Partner = {
  id: 'internal-a',
  name: '甲公司',
  number: 'P001',
  detail: { enabled: true }
};
const second: Partner = {
  id: 'internal-b',
  name: '乙公司',
  number: 'P002',
  detail: { enabled: false }
};
const getKey = (item: Partner) => item.id;
const getLabel = (item: Partner) => item.name;
const getCode = (item: Partner) => item.number;
const base: ObjectPickerProps<Partner> = {
  title: '选择伙伴',
  selectedItems: [],
  getKey,
  getLabel,
  getCode,
  onSelectionChange: () => {},
  renderTable: () => null,
  onConfirm: () => {},
  onClose: () => {}
};

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: true }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('ObjectPicker', () => {
  it('用独立 key 跨页选取原始对象，本页取消不清除其他页，确认返回完整对象', async () => {
    const confirm = vi.fn();
    function Harness() {
      const [items, setItems] = useState<Partner[]>([]);
      const [page, setPage] = useState(0);
      const current = page === 0 ? first : second;
      return (
        <ObjectPicker
          {...base}
          selectedItems={items}
          onSelectionChange={setItems}
          onConfirm={confirm}
          renderTable={({ rowSelection, onRowSelectionChange, disabled }) => (
            <>
              <button onClick={() => setPage(1 - page)}>翻页</button>
              <button
                disabled={disabled}
                onClick={() =>
                  onRowSelectionChange(
                    (previous) => ({ ...previous, [current.id]: !previous[current.id] }),
                    [current]
                  )
                }
              >
                {rowSelection[current.id] ? '取消本页' : '选中本页'}
              </button>
            </>
          )}
        />
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '选中本页' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '取消本页' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: '翻页' }));
    fireEvent.click(screen.getByRole('button', { name: '选中本页' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '取消本页' })).toBeEnabled());
    expect(screen.getByText('已选 2 项')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '取消本页' }));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '确认选择（1）' })).toBeEnabled()
    );
    fireEvent.click(screen.getByRole('button', { name: '确认选择（1）' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith([first]));
    expect(confirm.mock.calls[0][0][0]).toBe(first);
  });

  it('自定义内容仍按名称和编码搜索，删除返回原对象和增删差量', async () => {
    const change = vi.fn();
    render(
      <ObjectPicker
        {...base}
        selectedItems={[first, second]}
        onSelectionChange={change}
        renderSelectedItem={(item) => <span>自定义：{item.detail.enabled ? '启用' : '停用'}</span>}
      />
    );
    const input = screen.getByRole('textbox', { name: '搜索已选名称或编码' });
    fireEvent.change(input, { target: { value: ' p002 ' } });
    expect(screen.getByText('自定义：停用')).toBeInTheDocument();
    expect(screen.queryByText('自定义：启用')).not.toBeInTheDocument();
    fireEvent.change(input, { target: { value: '甲公司' } });
    fireEvent.click(screen.getByRole('button', { name: '移除 甲公司（P001）' }));
    await waitFor(() =>
      expect(change).toHaveBeenCalledWith([second], { added: [], removed: [first] })
    );
    // 受控名单由调用方确认更新，组件不会提前删除对象。
    expect(screen.getByRole('button', { name: '移除 甲公司（P001）' })).toBeInTheDocument();
  });

  it('异步操作期间禁用确认与关闭，失败保留原名单并允许重试', async () => {
    let reject!: (reason: Error) => void;
    const change = vi.fn(
      () =>
        new Promise<void>((_resolve, rejectPromise) => {
          reject = rejectPromise;
        })
    );
    render(<ObjectPicker {...base} selectedItems={[first]} onSelectionChange={change} />);
    fireEvent.click(screen.getByRole('button', { name: '移除 甲公司（P001）' }));
    expect(screen.getByRole('button', { name: '确认选择（1）' })).toBeDisabled();
    expect(screen.getByRole('button', { name: '取消' })).toBeDisabled();
    await act(async () => {
      reject(new Error('删除失败'));
    });
    expect(screen.getByRole('alert')).toHaveTextContent('删除失败');
    expect(screen.getByRole('button', { name: '移除 甲公司（P001）' })).toBeEnabled();
    expect(change).toHaveBeenCalledTimes(1);
  });

  it('取消不触发确认，空名单可确认，加载失败禁止确认', async () => {
    const close = vi.fn();
    const confirm = vi.fn();
    const { rerender } = render(<ObjectPicker {...base} onClose={close} onConfirm={confirm} />);
    fireEvent.click(screen.getByRole('button', { name: '取消' }));
    expect(close).toHaveBeenCalledOnce();
    expect(confirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '确认选择（0）' }));
    await waitFor(() => expect(confirm).toHaveBeenCalledWith([]));
    rerender(<ObjectPicker {...base} selectedStatus={{ error: '读取失败' }} />);
    expect(screen.getByRole('button', { name: '确认选择（0）' })).toBeDisabled();
  });
});
