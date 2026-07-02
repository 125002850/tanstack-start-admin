import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataTableLinkButtonCell } from '@/components/ui/table/data-table-link-button-cell';

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
});
