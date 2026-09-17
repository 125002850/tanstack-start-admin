import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { OverflowTooltip } from './overflow-tooltip';

afterEach(cleanup);

function measure(text: HTMLElement, width: number, scrollWidth: number) {
  Object.defineProperties(text, {
    clientWidth: { configurable: true, value: width },
    scrollWidth: { configurable: true, value: scrollWidth }
  });
}

it.each(['名称', '编码'])(
  'shows both fields when only %s overflows and remeasures on hover',
  async (field) => {
    const user = userEvent.setup();
    render(
      <OverflowTooltip
        content={
          <div>
            <strong>完整名称</strong>
            <div>完整编码</div>
          </div>
        }
      >
        <button>
          <span data-overflow-tooltip-text>名称</span>
          <span data-overflow-tooltip-text>编码</span>
        </button>
      </OverflowTooltip>
    );
    for (const text of ['名称', '编码'])
      measure(screen.getByText(text), 100, text === field ? 160 : 100);
    const trigger = screen.getByRole('button');
    await user.hover(trigger);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('完整名称完整编码');
    await user.unhover(trigger);
    fireEvent.pointerMove(document.body, { clientX: 500, clientY: 500 });
    measure(screen.getByText(field), 180, 160);
    await user.hover(trigger);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  }
);

it('preserves the existing button focus, ref and click without adding tab stops', async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  const ref = { current: null as HTMLButtonElement | null };
  render(
    <>
      <OverflowTooltip content='完整名称'>
        <button ref={ref} onClick={onClick}>
          <span data-overflow-tooltip-text>名称</span>
        </button>
      </OverflowTooltip>
      <button>下一项</button>
    </>
  );
  measure(screen.getByText('名称'), 80, 160);
  await user.tab();
  expect(ref.current).toHaveFocus();
  expect(await screen.findByRole('tooltip')).toHaveTextContent('完整名称');
  await user.keyboard('{Enter}');
  expect(onClick).toHaveBeenCalledOnce();
  await user.tab();
  expect(screen.getByRole('button', { name: '下一项' })).toHaveFocus();
});

it('closes an active tooltip when disabled and does not restore stale content', async () => {
  const user = userEvent.setup();
  const view = (disabled: boolean) => (
    <OverflowTooltip content='完整名称' disabled={disabled}>
      <button>
        <span data-overflow-tooltip-text>名称</span>
      </button>
    </OverflowTooltip>
  );
  const { rerender } = render(view(false));
  measure(screen.getByText('名称'), 80, 160);
  await user.hover(screen.getByRole('button'));
  expect(await screen.findByRole('tooltip')).toBeInTheDocument();
  rerender(view(true));
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  rerender(view(false));
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
