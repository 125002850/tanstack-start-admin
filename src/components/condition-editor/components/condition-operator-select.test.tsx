import { fireEvent, act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { OverlayLifecycleProvider } from '@/components/ui/overlay-lifecycle';
import { CONDITION_INPUT_OPERATORS } from '../lib/condition-operands';
import { ConditionOperatorSelect } from './condition-operator-select';

afterEach(cleanup);

const props = {
  disabled: false,
  operators: CONDITION_INPUT_OPERATORS,
  overlayId: 'test-operator',
  value: 'NUM_GT' as const
};

describe('二级操作符选择', () => {
  it('按类型展开子菜单，标记当前值并在选择后恢复焦点', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<ConditionOperatorSelect {...props} onValueChange={changed} />);
    const trigger = screen.getByRole('button', { name: '条件操作符' });
    await user.click(trigger);
    expect(screen.getAllByRole('menuitem').map((item) => item.textContent)).toEqual([
      '文本',
      '数字',
      '日期',
      '集合',
      '通用'
    ]);
    expect(screen.queryByRole('menuitemradio')).not.toBeInTheDocument();
    await user.click(screen.getByRole('menuitem', { name: '数字' }));
    const submenu = await screen.findByRole('menu', { name: '数字' });
    expect(within(submenu).getByRole('menuitemradio', { name: '大于' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    fireEvent.click(within(submenu).getByRole('menuitemradio', { name: '小于' }));
    expect(changed).toHaveBeenCalledExactlyOnceWith('NUM_LT');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('键盘通过类型进入子菜单并选择操作符', async () => {
    const user = userEvent.setup();
    const changed = vi.fn();
    render(<ConditionOperatorSelect {...props} onValueChange={changed} />);
    await user.click(screen.getByRole('button', { name: '条件操作符' }));
    await waitFor(() => expect(screen.getByRole('textbox', { name: '搜索操作符' })).toHaveFocus());
    await user.keyboard('{ArrowDown}{ArrowRight}');
    expect(await screen.findByRole('menuitemradio', { name: '等于' })).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(changed).toHaveBeenCalledExactlyOnceWith('EQ');
  });

  it('嵌套对话框内的菜单挂载到当前弹层，Escape 只关闭菜单', async () => {
    const user = userEvent.setup();
    const close = vi.fn();
    render(
      <Dialog open onOpenChange={close}>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>编辑条件</DialogTitle>
          <ConditionOperatorSelect {...props} onValueChange={vi.fn()} />
        </DialogContent>
      </Dialog>
    );
    const dialog = screen.getByRole('dialog', { name: '编辑条件' });
    const trigger = within(dialog).getByRole('button', { name: '条件操作符' });
    await user.click(trigger);
    await user.click(screen.getByRole('menuitem', { name: '数字' }));
    const submenu = await screen.findByRole('menu', { name: '数字' });
    expect(dialog).toContainElement(submenu);
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    expect(dialog).toBeVisible();
    expect(trigger).toHaveFocus();
    expect(close).not.toHaveBeenCalled();
  });

  it('宿主失活时关闭菜单，禁用和错误属性传到真实按钮', async () => {
    const user = userEvent.setup();
    let close: (() => void) | undefined;
    const view = render(
      <OverlayLifecycleProvider
        registerOverlay={(callback) => {
          close = callback;
          return () => {};
        }}
      >
        <ConditionOperatorSelect {...props} onValueChange={vi.fn()} />
      </OverlayLifecycleProvider>
    );
    await user.click(screen.getByRole('button', { name: '条件操作符' }));
    expect(close).toBeTypeOf('function');
    act(() => close!());
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    view.rerender(
      <ConditionOperatorSelect
        {...props}
        disabled
        aria-invalid
        aria-describedby='error'
        onValueChange={vi.fn()}
      />
    );
    const trigger = screen.getByRole('button', { name: '条件操作符' });
    expect(trigger).toBeDisabled();
    expect(trigger).toHaveAttribute('aria-invalid', 'true');
    expect(trigger).toHaveAttribute('aria-describedby', 'error');
  });
});
