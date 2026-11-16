import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { DataTableDslCondition } from '@/hooks/use-data-table';
import type { DataTableAdvancedSearchField } from './types';
import { DataTableAdvancedSearch } from './data-table-advanced-search';

const fields: DataTableAdvancedSearchField[] = [
  {
    columnId: 'status',
    field: 'status',
    label: '状态',
    conditionType: 'enum',
    operators: ['EQ', 'NE', 'IN', 'NOT_IN'],
    dateMode: 'dateTime',
    options: [
      { value: 'enable', label: '启用' },
      { value: 'disable', label: '停用' }
    ]
  },
  {
    columnId: 'channel',
    field: 'deliveryChannel',
    label: '发送渠道',
    conditionType: 'enum',
    operators: ['EQ', 'NE', 'IN', 'NOT_IN'],
    dateMode: 'dateTime',
    options: [
      { value: 'email', label: '邮件' },
      { value: 'sms', label: '短信' }
    ]
  }
];

function renderSearch(condition: DataTableDslCondition) {
  const apply = vi.fn();
  function Harness() {
    const table = useReactTable({
      data: [],
      columns: [],
      getCoreRowModel: getCoreRowModel(),
      meta: {
        dataTableAdvancedSearch: {
          sceneCode: 'test.page',
          fields,
          condition,
          conditionCount: 1,
          summary: '测试条件',
          applyCondition: apply,
          clearAll: vi.fn(),
          schemes: [],
          dirty: false,
          loadingSchemes: false,
          mutatingScheme: false,
          applyScheme: vi.fn(),
          saveAs: vi.fn().mockResolvedValue(undefined),
          overwriteSelected: vi.fn().mockResolvedValue(undefined),
          renameSelected: vi.fn().mockResolvedValue(undefined),
          deleteSelected: vi.fn().mockResolvedValue(undefined),
          setSelectedAsDefault: vi.fn().mockResolvedValue(undefined)
        }
      }
    });
    return <DataTableAdvancedSearch table={table} />;
  }
  render(<Harness />);
  return apply;
}

afterEach(cleanup);
beforeEach(() => {
  Element.prototype.scrollIntoView ??= vi.fn();
});

describe('高级搜索选择器', () => {
  it('按字段名称或后端标识搜索，切换字段清除旧值且输入搜索不提交', async () => {
    const user = userEvent.setup();
    const apply = renderSearch({ nodeType: 'enum', field: 'status', op: 'EQ', value: 'enable' });
    await user.click(screen.getByRole('button', { name: '高级搜索 1' }));
    await user.click(screen.getByRole('button', { name: '查询字段' }));
    const search = screen.getByPlaceholderText('搜索字段名称或标识');
    await user.type(search, '不存在');
    expect(screen.getByText('未找到匹配项')).toBeVisible();
    await user.clear(search);
    await user.type(search, '发送');
    expect(screen.getByRole('option', { name: '发送渠道' })).toBeVisible();
    expect(screen.queryByRole('option', { name: '状态' })).not.toBeInTheDocument();
    await user.clear(search);
    await user.type(search, 'deliveryChannel');
    await user.click(screen.getByRole('option', { name: '发送渠道' }));
    await waitFor(() => expect(screen.getByRole('button', { name: '查询字段' })).toHaveFocus());
    const value = screen.getByRole('button', { name: '发送渠道条件值' });
    expect(value).toHaveTextContent('选择发送渠道');
    expect(apply).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '应用' }));
    expect(apply).not.toHaveBeenCalled();
    await user.click(value);
    await user.type(screen.getByPlaceholderText('搜索发送渠道'), 'mail');
    await user.click(screen.getByRole('option', { name: '邮件' }));
    await user.click(screen.getByRole('button', { name: '应用' }));
    expect(apply).toHaveBeenCalledWith({
      nodeType: 'compose',
      logic: 'AND',
      children: [{ nodeType: 'enum', field: 'deliveryChannel', op: 'EQ', value: 'email' }]
    });
  });

  it('重选当前字段保留原值，必选字段不提供清除入口', async () => {
    const user = userEvent.setup();
    const condition = { nodeType: 'enum', field: 'status', op: 'EQ', value: 'enable' } as const;
    const apply = renderSearch(condition);
    await user.click(screen.getByRole('button', { name: '高级搜索 1' }));
    await user.click(screen.getByRole('button', { name: '查询字段' }));
    expect(screen.queryByRole('option', { name: '清除选择' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: '状态' }));
    await user.click(screen.getByRole('button', { name: '应用' }));
    expect(apply).toHaveBeenCalledWith({
      nodeType: 'compose',
      logic: 'AND',
      children: [condition]
    });
  });

  it.each(['EQ', 'NE'] as const)('%s 的枚举值支持搜索并保持标量，Escape 只关闭内层', async (op) => {
    const user = userEvent.setup();
    const apply = renderSearch({ nodeType: 'enum', field: 'status', op, value: 'enable' });
    await user.click(screen.getByRole('button', { name: '高级搜索 1' }));
    const trigger = screen.getByRole('button', { name: '状态条件值' });
    await user.click(trigger);
    await user.type(screen.getByPlaceholderText('搜索状态'), '停');
    expect(screen.queryByRole('option', { name: '启用' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: '停用' }));
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.click(trigger);
    expect(screen.getByPlaceholderText('搜索状态')).toHaveValue('');
    await user.keyboard('{Escape}');
    expect(screen.getByTestId('data-table-advanced-search-popover')).toBeVisible();
    expect(apply).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: '应用' }));
    expect(apply).toHaveBeenCalledWith({
      nodeType: 'compose',
      logic: 'AND',
      children: [{ nodeType: 'enum', field: 'status', op, value: 'disable' }]
    });
  });

  it.each(['IN', 'NOT_IN'] as const)('%s 保留可搜索多选及全部已选值', async (op) => {
    const user = userEvent.setup();
    const apply = renderSearch({ nodeType: 'enum', field: 'status', op, values: ['enable'] });
    await user.click(screen.getByRole('button', { name: '高级搜索 1' }));
    await user.click(screen.getByRole('button', { name: '状态多选值' }));
    await user.type(screen.getByPlaceholderText('搜索状态'), '停');
    await user.click(screen.getByRole('option', { name: '停用' }));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: '应用' }));
    expect(apply).toHaveBeenCalledWith({
      nodeType: 'compose',
      logic: 'AND',
      children: [{ nodeType: 'enum', field: 'status', op, values: ['enable', 'disable'] }]
    });
  });
});
