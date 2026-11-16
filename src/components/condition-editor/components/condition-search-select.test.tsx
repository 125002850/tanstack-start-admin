import * as React from 'react';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { getConditionElementCatalog, type ConditionField } from '../model/condition-model';
import { ConditionSearchSelect } from './condition-search-select';

afterEach(cleanup);

const FIELDS: readonly ConditionField[] = [
  {
    path: 'system.receivedAt',
    label: 'system.receivedAt',
    description: '消息接收时间',
    type: 'DATETIME',
    source: 'SYSTEM'
  },
  {
    path: 'options.mention.employeeNos',
    label: 'options.mention.employeeNos',
    description: '提及员工工号名单',
    type: 'STRING_ARRAY',
    source: 'OPTIONS'
  },
  {
    path: 'context.partnerCode',
    label: 'context.partnerCode',
    description: '合作伙伴编码',
    type: 'STRING',
    source: 'CONTEXT'
  },
  {
    path: 'payload.partnerCode',
    label: 'payload.partnerCode',
    description: '客户编码',
    type: 'STRING',
    source: 'PAYLOAD'
  },
  {
    path: 'payload.amount',
    label: 'payload.amount',
    description: '订单金额',
    type: 'NUMBER',
    source: 'PAYLOAD'
  },
  {
    path: 'meta.receivedAt',
    label: 'meta.receivedAt',
    description: '历史接收时间',
    type: 'DATETIME',
    source: 'LEGACY',
    selectable: false
  }
];
const props = {
  disabled: false,
  overlayId: 'field-picker',
  options: FIELDS,
  placeholder: '选择字段',
  searchPlaceholder: '搜索字段名称、路径或说明',
  triggerLabel: '条件字段'
};

describe('条件字段选择', () => {
  it('默认只显示来源分类，展开后展示字段、路径和类型', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(
      <ConditionSearchSelect {...props} value='context.partnerCode' onValueChange={changed} />
    );
    const trigger = screen.getByRole('button', { name: '条件字段' });
    await user.click(trigger);
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      '上下文',
      '业务数据',
      '执行选项',
      '系统字段'
    ]);
    expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: '上下文' }));
    const context = await screen.findByRole('menu', { name: '上下文' });
    expect(
      within(context).getByRole('menuitemradio', { name: '合作伙伴编码 context.partnerCode 文本' })
    ).toHaveAttribute('aria-checked', 'true');
    await user.click(screen.getByRole('menuitem', { name: '执行选项' }));
    const fields = await screen.findByRole('menu', { name: '执行选项' });
    const employees = within(fields).getByRole('menuitemradio', {
      name: '提及员工工号名单 options.mention.employeeNos 集合'
    });
    expect(within(employees).getByText('提及员工工号名单')).toBeVisible();
    expect(within(employees).getByText('options.mention.employeeNos')).toBeVisible();
    expect(within(employees).getByText('集合')).toBeVisible();
    fireEvent.click(employees);
    expect(changed).toHaveBeenCalledExactlyOnceWith('options.mention.employeeNos');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('跨组搜索名称和路径，并通过键盘选择后保留完整路径、关闭时重置搜索', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    function Harness() {
      const [value, setValue] = React.useState<string>();
      return (
        <ConditionSearchSelect
          {...props}
          value={value}
          onValueChange={(next) => {
            setValue(next);
            changed(next);
          }}
        />
      );
    }
    render(<Harness />);
    const trigger = screen.getByRole('button', { name: '条件字段' });
    await user.click(trigger);
    const search = await screen.findByRole('textbox', { name: props.searchPlaceholder });
    await user.type(search, '编码');
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(2);
    expect(screen.queryByRole('menuitem')).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: '业务数据' })).toBeVisible();
    expect(screen.getByRole('group', { name: '上下文' })).toBeVisible();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(changed).toHaveBeenCalledExactlyOnceWith('context.partnerCode');
    expect(trigger).toHaveTextContent('context.partnerCode');
    await waitFor(() => expect(trigger).toHaveFocus());
    await user.click(trigger);
    expect(await screen.findByRole('textbox', { name: props.searchPlaceholder })).toHaveValue('');
    await user.type(
      screen.getByRole('textbox', { name: props.searchPlaceholder }),
      'options.mention'
    );
    expect(screen.getAllByRole('menuitemradio')).toHaveLength(1);
    await user.click(screen.getByRole('menuitemradio', { name: /提及员工工号名单/ }));
    expect(trigger).toHaveTextContent('options.mention.employeeNos');
    expect(trigger).toHaveAttribute('title', 'options.mention.employeeNos');
  });

  it('集合子条件先显示上下文和当前项，仅展示适用字段', async () => {
    const user = userEvent.setup();
    render(
      <ConditionSearchSelect
        {...props}
        options={getConditionElementCatalog(FIELDS).toReversed()}
        value='$element'
        onValueChange={vi.fn()}
      />
    );
    await user.click(screen.getByRole('button', { name: '条件字段' }));
    expect(screen.getAllByRole('menuitem')[0]).toHaveTextContent('上下文');
    expect(screen.getAllByRole('menuitem')[1]).toHaveTextContent('当前项');
    expect(screen.queryByRole('menuitem', { name: '执行选项' })).not.toBeInTheDocument();
    expect(screen.queryByRole('menuitem', { name: '历史字段' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: '当前项' }));
    const fields = await screen.findByRole('menu', { name: '当前项' });
    expect(
      within(fields).getByRole('menuitemradio', { name: '当前集合项 $element 文本' })
    ).toHaveAttribute('aria-checked', 'true');
    await user.keyboard('{Escape}');
  });

  it('键盘进入二级菜单，弹窗内的 Escape 只关闭菜单并恢复焦点', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(
      <Dialog open onOpenChange={close}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>编辑条件</DialogTitle>
          <ConditionSearchSelect {...props} onValueChange={vi.fn()} />
        </DialogContent>
      </Dialog>
    );
    const dialog = screen.getByRole('dialog', { name: '编辑条件' });
    const trigger = within(dialog).getByRole('button', { name: '条件字段' });
    await user.click(trigger);
    await waitFor(() =>
      expect(screen.getByRole('textbox', { name: props.searchPlaceholder })).toHaveFocus()
    );
    await user.keyboard('{ArrowDown}{ArrowRight}');
    const fields = await screen.findByRole('menu', { name: '上下文' });
    expect(dialog).toContainElement(fields);
    expect(
      within(fields).getByRole('menuitemradio', { name: '合作伙伴编码 context.partnerCode 文本' })
    ).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(dialog).toBeVisible();
    expect(close).not.toHaveBeenCalled();
  });
});
