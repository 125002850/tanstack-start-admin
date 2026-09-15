import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { OverflowTooltipText } from './overflow-tooltip-text';

afterEach(cleanup);

describe('OverflowTooltipText', () => {
  it('only opens when truncated and remeasures on the next hover', async () => {
    const user = userEvent.setup();
    render(<OverflowTooltipText text='详情文字' />);
    const text = screen.getByText('详情文字');
    Object.defineProperties(text, {
      clientWidth: { configurable: true, value: 100 },
      scrollWidth: { value: 160 }
    });
    await user.hover(text);
    expect(await screen.findByRole('tooltip')).toHaveTextContent('详情文字');
    await user.unhover(text);
    fireEvent.pointerMove(document.body, { clientX: 500, clientY: 500 });
    Object.defineProperty(text, 'clientWidth', { value: 180 });
    await user.hover(text);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('supports keyboard focus and hides obsolete text after a value change', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<OverflowTooltipText text='旧文字' />);
    const text = screen.getByText('旧文字');
    Object.defineProperties(text, { clientWidth: { value: 80 }, scrollWidth: { value: 160 } });
    await user.tab();
    expect(await screen.findByRole('tooltip')).toHaveTextContent('旧文字');
    rerender(<OverflowTooltipText text='新文字' />);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});
