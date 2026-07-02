import type { Column } from '@tanstack/react-table';
import { cleanup, render, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataTableDateFilter } from '@/components/ui/table/data-table-date-filter';

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  PopoverTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  PopoverContent: ({ children }: { children: ReactNode }) => (
    <div data-testid='popover-content'>{children}</div>
  )
}));

function createColumn(filterValue?: unknown) {
  return {
    getFilterValue: () => filterValue,
    setFilterValue: vi.fn()
  } as unknown as Column<unknown, unknown>;
}

afterEach(cleanup);

describe('DataTableDateFilter', () => {
  it('renders Chinese labels for single date filter calendar', () => {
    render(<DataTableDateFilter column={createColumn()} title='创建日期' />);

    expect(screen.getByText('一')).toBeInTheDocument();
  });

  it('renders Chinese labels for date range filter calendar', () => {
    render(<DataTableDateFilter column={createColumn()} title='创建日期' multiple />);

    expect(screen.getByText('一')).toBeInTheDocument();
  });
});
