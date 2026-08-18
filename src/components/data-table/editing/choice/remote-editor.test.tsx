import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  choiceTestColumnDsl,
  createChoiceTestWrapper,
  EditableChoiceTestTable,
  getChoiceTestCell,
  installChoiceTestDomMocks
} from '@/test/fixtures/data-table-choice-test-harness';
import type { DataTableRemoteOptionPage } from '../types';

describe('DataTable remote choice editor', () => {
  afterEach(cleanup);

  beforeEach(() => {
    installChoiceTestDomMocks();
  });

  it('batches label resolution and supports search pagination', async () => {
    const user = userEvent.setup();
    const resolveOptions = vi.fn(
      async ({ values }: { values: readonly number[]; signal: AbortSignal }) =>
        values.map((value) => ({ value, label: value === 42 ? '张三' : '李四' }))
    );
    const loadOptions = vi.fn(
      async ({
        keyword,
        pageNo
      }: {
        keyword: string;
        pageNo: number;
        pageSize: number;
        signal: AbortSignal;
      }): Promise<DataTableRemoteOptionPage<number>> => ({
        items:
          pageNo === 1
            ? [{ value: 42, label: keyword ? `张三-${keyword}` : '张三' }]
            : [{ value: 43, label: '李四' }],
        total: 2
      })
    );
    const remoteColumns = [
      choiceTestColumnDsl.editableField('ownerId', '负责人', {
        type: 'remoteSelect',
        remoteOptions: {
          loadOptions: ({ keyword, pageNo, pageSize, signal }) =>
            loadOptions({ keyword, pageNo, pageSize, signal }),
          resolveOptions: ({ values, signal }) =>
            resolveOptions({ values: values as readonly number[], signal }),
          debounceMs: 0,
          pageSize: 1
        },
        edit: { selectionMode: 'single' }
      })
    ];
    render(<EditableChoiceTestTable columns={remoteColumns} />, {
      wrapper: createChoiceTestWrapper()
    });

    expect(screen.getAllByLabelText('正在解析负责人')).toHaveLength(2);
    await waitFor(() => {
      expect(getChoiceTestCell('ownerId')).toHaveTextContent('张三');
      expect(getChoiceTestCell('ownerId', 1)).toHaveTextContent('李四');
    });
    expect(resolveOptions).toHaveBeenCalledTimes(1);
    expect(resolveOptions.mock.calls[0]?.[0].values).toEqual([42, 43]);

    await user.dblClick(getChoiceTestCell('ownerId'));
    const search = await screen.findByPlaceholderText('搜索负责人');
    await waitFor(() => expect(loadOptions).toHaveBeenCalled());
    await user.type(search, 'bo');
    await waitFor(() => {
      expect(loadOptions).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: 'bo', pageNo: 1, pageSize: 1 })
      );
    });

    const optionList = document.querySelector<HTMLElement>('[data-slot="command-list"]');
    expect(optionList).not.toBeNull();
    Object.defineProperties(optionList!, {
      clientHeight: { configurable: true, value: 120 },
      scrollHeight: { configurable: true, value: 300 },
      scrollTop: { configurable: true, value: 140, writable: true }
    });
    fireEvent.wheel(optionList!, { deltaY: 200 });
    fireEvent.scroll(optionList!);
    await waitFor(() => {
      expect(loadOptions).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: 'bo', pageNo: 2, pageSize: 1 })
      );
    });
    expect(await screen.findByRole('option', { name: '李四' })).toBeInTheDocument();
  });

  it('falls back to raw values and distinguishes option loading errors', async () => {
    const user = userEvent.setup();
    const remoteColumns = [
      choiceTestColumnDsl.editableField('ownerId', '负责人', {
        type: 'remoteSelect',
        remoteOptions: {
          loadOptions: async () => {
            throw new Error('load failed');
          },
          resolveOptions: async () => {
            throw new Error('resolve failed');
          },
          debounceMs: 0
        },
        edit: { selectionMode: 'single' }
      })
    ];
    render(<EditableChoiceTestTable columns={remoteColumns} />, {
      wrapper: createChoiceTestWrapper()
    });

    await waitFor(() => {
      expect(getChoiceTestCell('ownerId')).toHaveTextContent('42');
      expect(getChoiceTestCell('ownerId', 1)).toHaveTextContent('43');
    });

    await user.dblClick(getChoiceTestCell('ownerId'));
    expect(await screen.findByText('选项加载失败')).toBeInTheDocument();
  });

  it('keeps multiple selections while search pages change', async () => {
    const user = userEvent.setup();
    const loadOptions = vi.fn(
      async ({
        keyword,
        pageNo
      }: {
        keyword: string;
        pageNo: number;
        pageSize: number;
        signal: AbortSignal;
      }): Promise<DataTableRemoteOptionPage<number>> => ({
        items:
          pageNo === 1
            ? [{ value: 42, label: keyword ? `张三-${keyword}` : '张三' }]
            : [
                { value: 42, label: '重复张三' },
                { value: 43, label: '李四' }
              ],
        total: 2
      })
    );
    const remoteColumns = [
      choiceTestColumnDsl.editableField('ownerIds', '负责人', {
        type: 'remoteSelect',
        remoteOptions: {
          loadOptions: ({ keyword, pageNo, pageSize, signal }) =>
            loadOptions({ keyword, pageNo, pageSize, signal }),
          resolveOptions: async ({ values }) =>
            values.map((value) => ({
              value,
              label: value === 42 ? '张三' : '李四'
            })),
          debounceMs: 0,
          pageSize: 1
        },
        edit: { selectionMode: 'multiple' }
      })
    ];
    render(<EditableChoiceTestTable columns={remoteColumns} />, {
      wrapper: createChoiceTestWrapper()
    });

    await waitFor(() => expect(getChoiceTestCell('ownerIds')).toHaveTextContent('张三'));
    await user.dblClick(getChoiceTestCell('ownerIds'));
    const search = await screen.findByPlaceholderText('搜索负责人');
    await user.type(search, 'li');
    await waitFor(() => {
      expect(loadOptions).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: 'li', pageNo: 1 })
      );
    });
    expect(screen.queryByRole('option', { name: '李四' })).not.toBeInTheDocument();
    const optionList = document.querySelector<HTMLElement>('[data-slot="command-list"]');
    expect(optionList).not.toBeNull();
    Object.defineProperties(optionList!, {
      clientHeight: { configurable: true, value: 120 },
      scrollHeight: { configurable: true, value: 300 },
      scrollTop: { configurable: true, value: 140, writable: true }
    });
    fireEvent.wheel(optionList!, { deltaY: 200 });
    fireEvent.scroll(optionList!);
    let liSiOption: HTMLElement | undefined;
    await waitFor(() => {
      liSiOption = screen.getAllByText('李四').find((element) => element.closest('[cmdk-item]'));
      expect(liSiOption).toBeDefined();
    });
    if (!liSiOption) throw new Error('remote option missing');
    await user.click(liSiOption);
    await user.keyboard('{Tab}');

    await waitFor(() => expect(getChoiceTestCell('ownerIds')).toHaveTextContent('张三、李四'));
    expect(loadOptions.mock.calls.some(([request]) => request.pageNo === 2)).toBe(true);
  });
});
