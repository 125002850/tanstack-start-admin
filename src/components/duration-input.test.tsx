import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { DurationInput } from './duration-input';

afterEach(cleanup);
const originalScroll = Object.getOwnPropertyDescriptor(Element.prototype, 'scrollIntoView');
beforeAll(() =>
  Object.defineProperty(Element.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() })
);
afterAll(() => {
  if (originalScroll) Object.defineProperty(Element.prototype, 'scrollIntoView', originalScroll);
  else Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
});
const units = { minute: { label: '分钟' }, hour: { label: '小时' } };

it('保留输入原文，切换单位不隐式换算或舍入，关闭单位菜单触发校验', async () => {
  const blur = vi.fn();
  function Example() {
    const [value, setValue] = useState({ value: '', unit: 'minute' as keyof typeof units });
    return (
      <>
        <DurationInput
          id='duration'
          label='时长'
          value={value}
          units={units}
          onChange={setValue}
          onBlur={blur}
        />
        <output>{JSON.stringify(value)}</output>
      </>
    );
  }
  const user = userEvent.setup();
  render(<Example />);
  await user.type(screen.getByRole('textbox', { name: '时长' }), '001.250');
  await user.tab();
  await user.keyboard('{ArrowDown}');
  expect(await screen.findByRole('option', { name: '小时' })).toBeVisible();
  await user.keyboard('{End}{Enter}');
  expect(screen.getByRole('textbox', { name: '时长' })).toHaveValue('001.250');
  expect(screen.getByRole('status')).toHaveTextContent('{"value":"001.250","unit":"hour"}');
  expect(blur).toHaveBeenCalled();
});

it('禁用时锁定数值与单位，并保留必填和错误关联', () => {
  const change = vi.fn();
  render(
    <DurationInput
      id='duration'
      label='时长'
      value={{ value: '5', unit: 'minute' }}
      units={units}
      onChange={change}
      onBlur={vi.fn()}
      disabled
      required
      invalid
      describedBy='duration-error'
    />
  );
  const input = screen.getByRole('textbox', { name: '时长' });
  expect(input).toBeDisabled();
  expect(input).toBeRequired();
  expect(input).toHaveAttribute('aria-invalid', 'true');
  expect(input).toHaveAttribute('aria-describedby', 'duration-error');
  expect(screen.getByRole('combobox', { name: '时长单位' })).toBeDisabled();
  expect(change).not.toHaveBeenCalled();
});
