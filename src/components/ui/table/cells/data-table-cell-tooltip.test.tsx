import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataTableCellTooltipProvider } from '@/components/ui/table/cells/data-table-cell-tooltip';
import { DataTableOverflowTooltipText } from '@/components/ui/table/cells/data-table-overflow-tooltip-text';
import {
  dismissWorkspacePageOverlays,
  registerWorkspacePageOverlayRoot,
  resetWorkspacePageOverlays
} from '@/features/workspace-tabs/utils/page-overlays';

afterEach(() => {
  cleanup();
  resetWorkspacePageOverlays();
  vi.restoreAllMocks();
});

function OverflowTooltipHarness({ value }: { value: string }) {
  return (
    <DataTableCellTooltipProvider>
      <DataTableOverflowTooltipText value={value}>{value}</DataTableOverflowTooltipText>
    </DataTableCellTooltipProvider>
  );
}

function ActivityOverflowTooltipHarness({
  mode,
  value
}: {
  mode: 'visible' | 'hidden';
  value: string;
}) {
  return (
    <React.Activity mode={mode}>
      <OverflowTooltipHarness value={value} />
    </React.Activity>
  );
}

function WorkspaceOverlayRootTooltipHarness({ tabId, value }: { tabId: string; value: string }) {
  const rootRef = React.useRef<HTMLDivElement | null>(null);

  React.useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    return registerWorkspacePageOverlayRoot(tabId, root);
  }, [tabId]);

  return (
    <div ref={rootRef}>
      <OverflowTooltipHarness value={value} />
    </div>
  );
}

describe('DataTableCellTooltipProvider', () => {
  it('closes the shared tooltip when a hovered cell value is replaced', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(260);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(80);

    const user = userEvent.setup();
    const firstValue = 'TRK-CUSTOMER-INVENTORY-001-EXTRA-LONG-CODE';
    const nextValue = 'TRK-CUSTOMER-INVENTORY-002-EXTRA-LONG-CODE';

    const { rerender } = render(<OverflowTooltipHarness value={firstValue} />);

    await user.hover(screen.getByText(firstValue));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(firstValue);

    rerender(<OverflowTooltipHarness value={nextValue} />);

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('closes the shared tooltip when the keep-alive page is hidden', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(260);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(80);

    const user = userEvent.setup();
    const value = 'FU20260617001-LONG-FOLLOW-UP-CODE';

    const { rerender } = render(<ActivityOverflowTooltipHarness mode='visible' value={value} />);

    await user.hover(screen.getByText(value));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(value);

    rerender(<ActivityOverflowTooltipHarness mode='hidden' value={value} />);

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  it('closes the shared tooltip through workspace overlay cleanup', async () => {
    vi.spyOn(HTMLElement.prototype, 'scrollWidth', 'get').mockReturnValue(260);
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(80);

    const user = userEvent.setup();
    const tabId = '/dashboard/system-management/export-center';
    const value = 'FU20260617001-LONG-FOLLOW-UP-CODE';

    render(<WorkspaceOverlayRootTooltipHarness tabId={tabId} value={value} />);

    await user.hover(screen.getByText(value));

    expect(await screen.findByRole('tooltip')).toHaveTextContent(value);

    const dismissResult = dismissWorkspacePageOverlays(tabId);
    expect(dismissResult.hasPendingExit).toBe(true);

    await waitFor(() => {
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });
});
