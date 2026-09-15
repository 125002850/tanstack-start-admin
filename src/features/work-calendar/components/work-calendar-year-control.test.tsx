import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { WorkCalendarYearControl } from './work-calendar-year-control';

afterEach(cleanup);

describe('WorkCalendarYearControl', () => {
  it('uses a text input without native number steppers', () => {
    render(<WorkCalendarYearControl year={2026} onYearChange={vi.fn()} />);

    const input = screen.getByRole('textbox', { name: '工作日历年份' });
    expect(input).toHaveAttribute('type', 'text');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).not.toHaveAttribute('min');
    expect(input).not.toHaveAttribute('max');
  });

  it('performs one deterministic change when stepping from an edited year', async () => {
    const user = userEvent.setup();
    const onYearChange = vi.fn();
    render(<WorkCalendarYearControl year={2026} onYearChange={onYearChange} />);

    const input = screen.getByRole('textbox', { name: '工作日历年份' });
    await user.clear(input);
    await user.type(input, '2030');
    await user.click(screen.getByRole('button', { name: '下一年' }));

    expect(onYearChange).toHaveBeenCalledTimes(1);
    expect(onYearChange).toHaveBeenCalledWith(2031);
  });

  it('restores the committed year while a requested navigation is pending or cancelled', async () => {
    const user = userEvent.setup();
    const onYearChange = vi.fn();
    render(
      <>
        <WorkCalendarYearControl year={2026} onYearChange={onYearChange} />
        <button type='button'>离开年份控件</button>
      </>
    );

    const input = screen.getByRole('textbox', { name: '工作日历年份' });
    await user.clear(input);
    await user.type(input, '2030');
    await user.click(screen.getByRole('button', { name: '离开年份控件' }));

    expect(onYearChange).toHaveBeenCalledTimes(1);
    expect(onYearChange).toHaveBeenCalledWith(2030);
    expect(input).toHaveValue('2026');
  });
});
