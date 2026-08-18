import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { DataTableBadgeListCell } from '@/components/data-table/cells/data-table-badge-list-cell';
import { DataTableCellTooltipProvider } from '@/components/data-table/cells/data-table-cell-tooltip';

afterEach(cleanup);

describe('DataTableBadgeListCell', () => {
  it('renders compact badges and exposes hidden values through the shared tooltip', async () => {
    const user = userEvent.setup();
    render(
      <DataTableCellTooltipProvider>
        <DataTableBadgeListCell
          items={[
            { key: 'A1', label: '车队' },
            { key: 'A2', label: '报关行' },
            { key: 'UNMAPPED', label: 'UNMAPPED' }
          ]}
        />
      </DataTableCellTooltipProvider>
    );

    const list = screen.getByLabelText('车队，报关行，UNMAPPED');
    expect(screen.getByText('车队')).toHaveAttribute('data-slot', 'badge');
    expect(screen.getByText('报关行')).toHaveAttribute('data-slot', 'badge');
    expect(screen.queryByText('UNMAPPED')).not.toBeInTheDocument();
    expect(screen.getByText('+1')).toHaveAttribute('data-slot', 'badge');

    await user.hover(list);

    expect(await screen.findByRole('tooltip')).toHaveTextContent('车队，报关行，UNMAPPED');
  });

  it('renders a placeholder for an empty list', () => {
    render(<DataTableBadgeListCell items={[]} />);

    expect(screen.getByText('-')).toBeInTheDocument();
  });
});
