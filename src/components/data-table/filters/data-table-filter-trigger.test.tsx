import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { MouseEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Icons } from '@/components/icons';

import { DataTableFilterTrigger } from './data-table-filter-trigger';

describe('DataTableFilterTrigger', () => {
  afterEach(cleanup);

  it('owns the idle toolbar trigger styling and icon', () => {
    render(
      <DataTableFilterTrigger
        title='员工'
        state={{ status: 'idle', icon: <Icons.calendar data-testid='idle-icon' /> }}
      />
    );

    const trigger = screen.getByRole('button', { name: '员工' });
    expect(trigger).toHaveClass('data-table-filter-control', 'border-dashed', 'h-8');
    expect(trigger).not.toHaveAttribute('data-active');
    expect(screen.getByTestId('idle-icon')).toBeInTheDocument();
  });

  it('renders the shared active summary and clears without opening the trigger', () => {
    const onClear = vi.fn((event: MouseEvent<HTMLElement>) => {
      event.preventDefault();
      event.stopPropagation();
    });
    const onClick = vi.fn();
    const { container } = render(
      <DataTableFilterTrigger
        title='员工'
        onClick={onClick}
        state={{
          status: 'active',
          onClear,
          selection: {
            kind: 'labels',
            count: 1,
            items: [{ key: 'E001', label: '张三（E001）' }]
          }
        }}
      />
    );

    const trigger = screen.getByRole('button', { name: /员工/ });
    expect(trigger).toHaveAttribute('data-active', 'true');
    expect(screen.getByText('张三（E001）')).toBeInTheDocument();

    fireEvent.click(container.querySelector('[data-filter-clear]')!);

    expect(onClear).toHaveBeenCalledOnce();
    expect(onClick).not.toHaveBeenCalled();
  });
});
