import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import * as z from 'zod';

import { Button } from '@/components/ui/button';

import { useAppForm } from './tanstack-form';

function BaseFieldForm() {
  const form = useAppForm({
    defaultValues: {
      name: ''
    },
    validators: {
      onSubmit: z.object({
        name: z.string().min(1, '请输入名称')
      })
    },
    onSubmit: vi.fn()
  });

  return (
    <form.AppForm>
      <form.Form>
        <form.AppField name='name'>
          {(field) => <field.TextField label='名称' required />}
        </form.AppField>
        <Button type='submit'>提交</Button>
      </form.Form>
    </form.AppForm>
  );
}

function SelectFieldForm() {
  const form = useAppForm({
    defaultValues: {
      status: ''
    },
    onSubmit: vi.fn()
  });

  return (
    <form.AppForm>
      <form.Form>
        <form.AppField name='status'>
          {(field) => (
            <field.SelectField label='状态' options={[{ label: '启用', value: 'enabled' }]} />
          )}
        </form.AppField>
      </form.Form>
    </form.AppForm>
  );
}

describe('TanStack form field accessibility', () => {
  it('associates AppField base controls with their validation message', async () => {
    const user = userEvent.setup();
    render(<BaseFieldForm />);

    await user.click(screen.getByRole('button', { name: '提交' }));

    const input = screen.getByRole('textbox', { name: '名称' });
    const error = await screen.findByText('请输入名称');

    expect(error.id).not.toContain('undefined');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', error.id);
  });

  it('keeps select triggers within the field width', () => {
    render(<SelectFieldForm />);

    expect(screen.getByRole('combobox', { name: '状态' })).toHaveClass('w-full', 'min-w-0');
  });
});
