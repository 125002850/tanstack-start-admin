import * as React from 'react';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { Popover, PopoverContent, PopoverTrigger } from './popover';

function Harness({ preventOutside = false, preventRestore = false } = {}) {
  const finalFocus = React.useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={finalFocus}>恢复目标</button>
      <Popover>
        <PopoverTrigger>打开</PopoverTrigger>
        <PopoverContent
          finalFocus={finalFocus}
          onInteractOutside={preventOutside ? (event) => event.preventDefault() : undefined}
          onCloseAutoFocus={preventRestore ? (event) => event.preventDefault() : undefined}
        >
          <input aria-label='弹层输入' />
        </PopoverContent>
      </Popover>
      <input aria-label='外部输入' />
    </>
  );
}

describe('Popover finalFocus', () => {
  afterEach(cleanup);

  it('外部点击关闭时保留新焦点，再次打开后 Escape 仍恢复指定焦点', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByText('打开'));
    await user.click(screen.getByLabelText('外部输入'));
    await waitFor(() => expect(screen.queryByLabelText('弹层输入')).not.toBeInTheDocument());
    expect(screen.getByLabelText('外部输入')).toHaveFocus();
    await user.click(screen.getByText('打开'));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByText('恢复目标')).toHaveFocus());
  });

  it('被阻止的外部交互不会禁用 Escape 的焦点恢复', async () => {
    const user = userEvent.setup();
    render(<Harness preventOutside />);
    await user.click(screen.getByText('打开'));
    await user.click(screen.getByLabelText('外部输入'));
    expect(screen.getByLabelText('弹层输入')).toBeInTheDocument();
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.getByText('恢复目标')).toHaveFocus());
  });

  it('保留调用方阻止自动恢复焦点的能力', async () => {
    const user = userEvent.setup();
    render(<Harness preventRestore />);
    await user.click(screen.getByText('打开'));
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByLabelText('弹层输入')).not.toBeInTheDocument());
    expect(screen.getByText('恢复目标')).not.toHaveFocus();
  });
});
