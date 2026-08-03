import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExportRecordLinkButtonCell } from './export-record-link-button-cell';

afterEach(cleanup);

describe('ExportRecordLinkButtonCell', () => {
  it('renders a placeholder for empty values', () => {
    render(<ExportRecordLinkButtonCell value='' onClick={vi.fn()} />);

    expect(screen.getByText('-')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls the handler without bubbling to the row container', () => {
    const handleClick = vi.fn();
    const handleRowClick = vi.fn();

    render(
      <div role='row' tabIndex={0} onClick={handleRowClick} onKeyDown={vi.fn()}>
        <ExportRecordLinkButtonCell value='TR-001' onClick={handleClick} />
      </div>
    );

    fireEvent.click(screen.getByRole('button', { name: 'TR-001' }));

    expect(handleClick).toHaveBeenCalledTimes(1);
    expect(handleRowClick).not.toHaveBeenCalled();
  });

  it('truncates text values and exposes the full value as the native tooltip', () => {
    const longCode = 'TRK-CUSTOMER-INVENTORY-001-EXTRA-LONG-CODE';

    render(<ExportRecordLinkButtonCell value={longCode} onClick={vi.fn()} />);

    expect(screen.getByText(longCode)).toHaveClass('truncate');
    expect(screen.getByRole('button', { name: longCode })).toHaveAttribute('title', longCode);
  });
});
