import { act, within, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DictionaryItemRecord } from '../api/types';
import { DictionaryItemSheet } from './dictionary-item-sheet';

const ITEM: DictionaryItemRecord = {
  id: 11,
  dictTypeCode: 'color',
  dictItemCode: 'red',
  dictItemName: '红色',
  status: 'enable',
  sortOrder: 10,
  remark: 'warm',
  createById: 1,
  createByName: 'system',
  createTime: '2026-06-08 10:05:00',
  updateById: 1,
  updateByName: 'system',
  updateTime: '2026-06-08 10:05:00'
};

afterEach(cleanup);

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

  it('preserves an empty remark when editing clears the existing value', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <DictionaryItemSheet
        open
        onOpenChange={vi.fn()}
        dictTypeCode='color'
        item={ITEM}
        onSubmit={onSubmit}
      />
    );

    fireEvent.change(screen.getByRole('textbox', { name: /备注/ }), {
      target: { value: '' }
    });
    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(onSubmit.mock.calls[0]?.[0]).toHaveProperty('remark', '');
    expect(onSubmit.mock.calls[0]?.[0]).toHaveProperty('sortOrder', 10);
    expect(onSubmit.mock.calls[0]?.[0]).not.toHaveProperty('sort');
  });
});

it('keeps a rejected edit open and sends an empty remark on retry', async () => {
  const onSubmit = vi
    .fn()
    .mockRejectedValueOnce(new Error('save failed'))
    .mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  render(
    <DictionaryItemSheet
      open
      onOpenChange={onOpenChange}
      dictTypeCode='color'
      item={ITEM}
      onSubmit={onSubmit}
    />
  );
  fireEvent.change(screen.getByRole('textbox', { name: /备注/ }), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
  await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
  await waitFor(() => expect(screen.getByRole('button', { name: '保存修改' })).toBeEnabled());
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ remark: '' }));
  fireEvent.click(screen.getByRole('button', { name: '保存修改' }));
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
});

it('waits for deletion, retains the editor on failure and permits retry', async () => {
  let reject!: (error: Error) => void;
  const onDelete = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<void>((_, fail) => {
          reject = fail;
        })
    )
    .mockResolvedValue(undefined);
  const onOpenChange = vi.fn();
  render(
    <DictionaryItemSheet
      open
      onOpenChange={onOpenChange}
      dictTypeCode='color'
      item={ITEM}
      onSubmit={vi.fn()}
      onDelete={onDelete}
    />
  );
  fireEvent.click(screen.getByRole('button', { name: '删除' }));
  const dialog = screen.getByRole('alertdialog');
  const confirm = within(dialog).getByRole('button', { name: '删除' });
  fireEvent.click(confirm);
  expect(confirm).toBeDisabled();
  expect(confirm).toHaveAttribute('aria-busy', 'true');
  expect(within(dialog).getByRole('button', { name: '取消' })).toBeDisabled();
  fireEvent.click(confirm);
  fireEvent.keyDown(dialog, { key: 'Escape' });
  expect(onDelete).toHaveBeenCalledTimes(1);
  expect(onOpenChange).not.toHaveBeenCalled();
  await act(async () => reject(new Error('delete failed')));
  expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  expect(onOpenChange).not.toHaveBeenCalled();
  fireEvent.click(confirm);
  await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  expect(onDelete).toHaveBeenCalledTimes(2);
});
