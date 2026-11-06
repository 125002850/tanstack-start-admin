import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { DisabledTooltip } from './disabled-tooltip';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from './dialog';
import { OverlayLifecycleProvider } from './overlay-lifecycle';

afterEach(cleanup);

const REASON = '已产生历史版本，内容形式不可更改。';

it('keeps the tooltip inside its dialog and dismisses it before the dialog', async () => {
  const user = userEvent.setup();
  render(
    <Dialog defaultOpen>
      <DialogContent>
        <DialogTitle>配置</DialogTitle>
        <DialogDescription>修改配置</DialogDescription>
        <button>上一项</button>
        <DisabledTooltip disabled reason={REASON}>
          <button disabled>内容形式</button>
        </DisabledTooltip>
      </DialogContent>
    </Dialog>
  );
  const dialog = screen.getByRole('dialog', { name: '配置' });
  await user.tab();
  expect(within(dialog).getByRole('group', { name: REASON })).toHaveFocus();
  expect(await within(dialog).findByRole('tooltip')).toHaveTextContent(REASON);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  expect(dialog).toBeVisible();
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('closes an open tooltip when the host deactivates its overlays', async () => {
  const user = userEvent.setup();
  const closeCallbacks = new Set<() => void>();
  render(
    <OverlayLifecycleProvider
      registerOverlay={(close) => {
        closeCallbacks.add(close);
        return () => {
          closeCallbacks.delete(close);
        };
      }}
    >
      <DisabledTooltip disabled reason={REASON}>
        <button disabled>内容形式</button>
      </DisabledTooltip>
    </OverlayLifecycleProvider>
  );
  await user.tab();
  expect(await screen.findByRole('tooltip')).toHaveTextContent(REASON);
  act(() => closeCallbacks.forEach((close) => close()));
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  expect(closeCallbacks.size).toBe(0);
});

it('shows the reason on hover without enabling the disabled control', async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  render(
    <DisabledTooltip disabled reason={REASON}>
      <button disabled onClick={onClick}>
        内容形式
      </button>
    </DisabledTooltip>
  );

  expect(screen.queryByText(REASON)).not.toBeInTheDocument();
  const trigger = screen.getByRole('group', { name: REASON });
  await user.hover(trigger);
  expect(await screen.findByRole('tooltip')).toHaveTextContent(REASON);
  await user.click(trigger);
  expect(screen.getByRole('button', { name: '内容形式' })).toBeDisabled();
  expect(onClick).not.toHaveBeenCalled();
});

it('makes the reason keyboard accessible and closes it with Escape or blur', async () => {
  const user = userEvent.setup();
  render(
    <>
      <DisabledTooltip disabled reason={REASON}>
        <button disabled>内容形式</button>
      </DisabledTooltip>
      <button>下一项</button>
    </>
  );

  const trigger = screen.getByRole('group', { name: REASON });
  await user.tab();
  expect(trigger).toHaveFocus();
  expect(await screen.findByRole('tooltip')).toHaveTextContent(REASON);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  await user.tab();
  expect(screen.getByRole('button', { name: '下一项' })).toHaveFocus();
  await user.tab({ shift: true });
  expect(await screen.findByRole('tooltip')).toHaveTextContent(REASON);
  await user.tab();
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

it.each([
  { disabled: false, reason: REASON },
  { disabled: true, reason: undefined },
  { disabled: true, reason: '   ' }
])('omits the tooltip and extra tab stop for %j', async ({ disabled, reason }) => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  render(
    <>
      <DisabledTooltip disabled={disabled} reason={reason}>
        <button disabled={disabled} onClick={onClick}>
          内容形式
        </button>
      </DisabledTooltip>
      <button>下一项</button>
    </>
  );

  const button = screen.getByRole('button', { name: '内容形式' });
  await user.hover(button.parentElement!);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  await user.tab();
  if (disabled) {
    expect(screen.getByRole('button', { name: '下一项' })).toHaveFocus();
  } else {
    expect(button).toHaveFocus();
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledOnce();
    await user.tab();
    expect(screen.getByRole('button', { name: '下一项' })).toHaveFocus();
  }
});

it.each(['disabled', 'reason'] as const)(
  'closes an open tooltip when %s changes without remounting the control',
  async (change) => {
    const user = userEvent.setup();
    const view = (disabled: boolean, reason?: string) => (
      <DisabledTooltip disabled={disabled} reason={reason}>
        <input aria-label='内容形式' defaultValue='模板正文' disabled={disabled} />
      </DisabledTooltip>
    );
    const { rerender } = render(view(false, REASON));
    const input = screen.getByRole('textbox', { name: '内容形式' });
    await user.clear(input);
    await user.type(input, '修改后的值');
    rerender(view(true, REASON));
    await user.hover(screen.getByRole('group', { name: REASON }));
    expect(await screen.findByRole('tooltip')).toHaveTextContent(REASON);

    rerender(view(change !== 'disabled', change === 'reason' ? undefined : REASON));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    expect(screen.queryByRole('group')).not.toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: '内容形式' })).toBe(input);
    expect(input).toHaveValue('修改后的值');

    rerender(view(true, REASON));
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  }
);
