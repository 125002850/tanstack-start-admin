import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AutocompleteInput } from './autocomplete-input';
import { Sheet, SheetContent, SheetTitle } from './sheet';

type Suggestion = {
  label: string;
  value: string;
};

const suggestions: Suggestion[] = [
  { label: 'SO-001', value: 'SO-001' },
  { label: 'SO-002', value: 'SO-002' }
];

function AutocompleteInputHarness() {
  const [value, setValue] = React.useState('');

  return (
    <AutocompleteInput
      aria-label='订单号'
      value={value}
      onValueChange={setValue}
      items={suggestions}
      itemToValue={(item) => item.value}
      onSelect={(item) => setValue(item.value)}
      renderItem={(item) => item.label}
    />
  );
}

function AutocompleteInputSheetHarness({
  onOpenChange
}: {
  onOpenChange: (open: boolean) => void;
}) {
  const [value, setValue] = React.useState('SO');

  return (
    <Sheet open onOpenChange={onOpenChange}>
      <SheetContent aria-describedby={undefined}>
        <SheetTitle>编辑任务</SheetTitle>
        <div>状态提醒：是</div>
        <AutocompleteInput
          aria-label='订单号'
          value={value}
          onValueChange={setValue}
          items={suggestions}
          itemToValue={(item) => item.value}
          onSelect={(item) => setValue(item.value)}
          renderItem={(item) => item.label}
        />
        <div>附件</div>
      </SheetContent>
    </Sheet>
  );
}

describe('AutocompleteInput', () => {
  afterEach(cleanup);

  it('keeps free text input while allowing a suggestion to fill the value', async () => {
    const user = userEvent.setup();

    render(<AutocompleteInputHarness />);

    const input = screen.getByRole('combobox', { name: '订单号' });

    await user.type(input, 'MANUAL-001');
    expect(input).toHaveValue('MANUAL-001');

    await user.clear(input);
    await user.click(input);
    await user.click(await screen.findByText('SO-001'));

    expect(input).toHaveValue('SO-001');
  });

  it('does not steal focus when the user moves to another field', async () => {
    const user = userEvent.setup();

    render(
      <div data-slot='dialog-content' data-testid='overlay-host'>
        <AutocompleteInputHarness />
        <input aria-label='客户名称' />
      </div>
    );

    const orderNoInput = screen.getByRole('combobox', { name: '订单号' });
    const customerInput = screen.getByRole('textbox', { name: '客户名称' });

    await user.click(orderNoInput);
    expect(await screen.findByText('SO-001')).toBeInTheDocument();

    await user.click(customerInput);

    await waitFor(() => {
      expect(customerInput).toHaveFocus();
    });
  });

  it('keeps suggestions inside the parent sheet overlay', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();

    render(<AutocompleteInputSheetHarness onOpenChange={onOpenChange} />);

    await user.click(screen.getByRole('combobox', { name: '订单号' }));

    const option = await screen.findByText('SO-001');
    expect(option.closest('[data-slot="sheet-content"]')).not.toBeNull();

    await user.click(screen.getByText('状态提醒：是'));
    await user.click(screen.getByText('附件'));

    expect(onOpenChange).not.toHaveBeenCalledWith(false);
    expect(screen.getByRole('heading', { name: '编辑任务' })).toBeInTheDocument();
  });
});
