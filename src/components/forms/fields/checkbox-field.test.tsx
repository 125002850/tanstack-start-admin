import { useAppForm } from '@/components/ui/tanstack-form';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { CheckboxField } from './checkbox-field';

describe('CheckboxField', () => {
  it('renders an input-like control and normalizes checked changes', async () => {
    const user = userEvent.setup();
    const onCheckedChange = vi.fn();

    render(
      <CheckboxField
        checked={false}
        fieldLabel='必填'
        id='required-field'
        label='可省略'
        onCheckedChange={onCheckedChange}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: '可省略' });
    const control = screen.getByText('可省略').closest('label');

    expect(control).toHaveClass('shadow-xs');
    expect(checkbox).not.toBeChecked();

    await user.click(screen.getByText('可省略'));

    expect(onCheckedChange).toHaveBeenCalledWith(true);
  });

  it('forwards disabled and invalid states to the field and control', () => {
    render(
      <CheckboxField
        aria-invalid
        checked={false}
        disabled
        id='disabled-field'
        label='不可修改'
        onCheckedChange={vi.fn()}
      />
    );

    const checkbox = screen.getByRole('checkbox', { name: '不可修改' });
    const field = checkbox.closest('[data-slot="field"]');

    expect(checkbox).toBeDisabled();
    expect(checkbox).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAttribute('data-disabled', 'true');
    expect(field).toHaveAttribute('data-invalid', 'true');
  });
});

it('keeps both legacy AppField and composed FormCheckboxField interfaces working', async () => {
  const user = userEvent.setup();
  const saved = vi.fn();
  function FormHarness() {
    const form = useAppForm({
      defaultValues: { accepted: false, subscribed: false },
      onSubmit: ({ value }) => saved(value)
    });
    return (
      <form.AppForm>
        <form.Form>
          <form.AppField name='accepted'>
            {(field) => <field.CheckboxField label='接受条款' />}
          </form.AppField>
          <form.CheckboxField name='subscribed' label='订阅通知' />
          <button type='submit'>保存选项</button>
        </form.Form>
      </form.AppForm>
    );
  }
  render(<FormHarness />);
  await user.click(screen.getByRole('checkbox', { name: '接受条款' }));
  await user.click(screen.getByRole('checkbox', { name: '订阅通知' }));
  await user.click(screen.getByRole('button', { name: '保存选项' }));
  expect(saved).toHaveBeenCalledWith({ accepted: true, subscribed: true });
});
