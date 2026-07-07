import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataTableCellTooltipProvider } from '@/components/ui/table/cells/data-table-cell-tooltip';
import { DataTableLinkButtonCell } from '@/components/ui/table/cells/data-table-link-button-cell';

afterEach(cleanup);

describe('DataTableLinkButtonCell', () => {
  it('renders a placeholder for empty values', () => {
    render(<DataTableLinkButtonCell value='' onClick={vi.fn()} />);

    expect(screen.getByText('-')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls the handler without bubbling to the row container', () => {
    const handleClick = vi.fn();
    const handleRowClick = vi.fn();

    render(
      <div role='row' tabIndex={0} onClick={handleRowClick} onKeyDown={vi.fn()}>
        <DataTableLinkButtonCell value='TR-001' onClick={handleClick} />
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: 'TR-001' }));

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleRowClick).not.toHaveBeenCalled();
  });

  it('truncates text values and shows the shared tooltip when overflowing', async () => {
    const longCode = 'TRK-CUSTOMER-INVENTORY-001-EXTRA-LONG-CODE';
    const scrollWidthSpy = vi
      .spyOn(HTMLElement.prototype, 'scrollWidth', 'get')
      .mockReturnValue(260);
    const clientWidthSpy = vi
      .spyOn(HTMLElement.prototype, 'clientWidth', 'get')
      .mockReturnValue(80);

    try {
      const user = userEvent.setup();

      render(
        <DataTableCellTooltipProvider>
          <DataTableLinkButtonCell value={longCode} onClick={vi.fn()} />
        </DataTableCellTooltipProvider>
      );

      const linkText = screen.getByText(longCode);
      expect(linkText).toHaveClass('truncate');

      await user.hover(linkText);

      expect(await screen.findByRole('tooltip')).toHaveTextContent(longCode);
    } finally {
      scrollWidthSpy.mockRestore();
      clientWidthSpy.mockRestore();
    }
  });
});
