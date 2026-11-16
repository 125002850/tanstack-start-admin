import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { InlineEdit } from './inline-edit';

afterEach(cleanup);

it('点击进入原位文本编辑，不全选，草稿输入后 Enter 保存并恢复入口焦点', async () => {
  const user = userEvent.setup();
  const draft = vi.fn();
  function Editor() {
    const [value, setValue] = useState('原流程');
    return <InlineEdit label='标题' value={value} onValueChange={setValue} onDraftChange={draft} />;
  }
  render(<Editor />);
  await user.click(screen.getByRole('button', { name: '修改标题' }));
  const editor = screen.getByRole('textbox', { name: '标题' });
  expect(editor).toHaveFocus();
  expect(editor).toHaveAttribute('contenteditable', 'true');
  expect(window.getSelection()?.isCollapsed).toBe(true);
  await user.clear(editor);
  await user.type(editor, ' 新流程 ');
  expect(draft).toHaveBeenLastCalledWith(' 新流程 ');
  await user.keyboard('{Enter}');
  expect(screen.getByRole('button', { name: '修改标题' })).toHaveTextContent('新流程');
  expect(screen.getByRole('button', { name: '修改标题' })).toHaveFocus();
  expect(draft).toHaveBeenLastCalledWith(null);
});

it('中文输入中的 Enter 不提交，Escape 丢弃本次草稿', async () => {
  const user = userEvent.setup();
  const changed = vi.fn();
  render(<InlineEdit label='标题' value='原流程' onValueChange={changed} />);
  await user.click(screen.getByRole('button', { name: '修改标题' }));
  const editor = screen.getByRole('textbox', { name: '标题' });
  await user.clear(editor);
  await user.type(editor, '输入中');
  fireEvent.keyDown(editor, { key: 'Enter', isComposing: true });
  expect(changed).not.toHaveBeenCalled();
  expect(editor).toHaveFocus();
  await user.keyboard('{Escape}');
  expect(changed).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: '修改标题' })).toHaveTextContent('原流程');
});

it('校验错误与文本关联，修改后清除错误，长度超限不保存', async () => {
  const user = userEvent.setup();
  const changed = vi.fn();
  render(
    <InlineEdit
      label='标题'
      value='原流程'
      onValueChange={changed}
      validate={(value) => (!value ? '标题不能为空' : undefined)}
      maxLength={4}
    />
  );
  await user.click(screen.getByRole('button', { name: '修改标题' }));
  const editor = screen.getByRole('textbox', { name: '标题' });
  await user.clear(editor);
  await user.keyboard('{Enter}');
  expect(editor).toHaveAccessibleDescription('标题不能为空');
  await user.type(editor, '超过四个字符');
  expect(editor).toHaveAttribute('aria-invalid', 'false');
  await user.keyboard('{Enter}');
  expect(editor).toHaveAccessibleDescription('标题不能超过 4 个字符。');
  expect(changed).not.toHaveBeenCalled();
  await user.clear(editor);
  await user.type(editor, '新标题');
  await user.tab();
  expect(changed).toHaveBeenCalledExactlyOnceWith('新标题');
});

it('外部值切换时丢弃旧草稿，禁用时不进入编辑', async () => {
  const user = userEvent.setup();
  const changed = vi.fn();
  const draft = vi.fn();
  const view = render(
    <InlineEdit label='标题' value='一版标题' onValueChange={changed} onDraftChange={draft} />
  );
  await user.click(screen.getByRole('button', { name: '修改标题' }));
  await user.type(screen.getByRole('textbox', { name: '标题' }), '未保存');
  view.rerender(
    <InlineEdit
      label='标题'
      value='二版标题'
      onValueChange={changed}
      onDraftChange={draft}
      disabled
    />
  );
  expect(screen.queryByRole('textbox', { name: '标题' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '修改标题' })).toHaveTextContent('二版标题');
  expect(screen.getByRole('button', { name: '修改标题' })).toBeDisabled();
  expect(changed).not.toHaveBeenCalled();
  expect(draft).toHaveBeenLastCalledWith(null);
});
