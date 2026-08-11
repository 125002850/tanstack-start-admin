import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  dismissWorkspacePageOverlays,
  registerWorkspacePageOverlayRoot,
  resetWorkspacePageOverlays
} from './page-overlays';

describe('workspace page overlays', () => {
  afterEach(() => {
    cleanup();
    resetWorkspacePageOverlays();
  });

  it('closes an open tooltip before switching workspace pages', async () => {
    const user = userEvent.setup();
    const tabId = '/dashboard/tooltip';

    render(
      <div
        ref={(root) => {
          if (root) registerWorkspacePageOverlayRoot(tabId, root);
        }}
      >
        <Tooltip>
          <TooltipTrigger>Tooltip trigger</TooltipTrigger>
          <TooltipContent>Tooltip content</TooltipContent>
        </Tooltip>
      </div>
    );

    const trigger = screen.getByRole('button', { name: 'Tooltip trigger' });
    await user.hover(trigger);
    await screen.findByRole('tooltip');
    expect(document.querySelector('[data-slot="tooltip-content"]')).not.toHaveAttribute(
      'data-state',
      'closed'
    );

    const dismissResult = dismissWorkspacePageOverlays(tabId);

    await act(async () => {
      await dismissResult.waitForSettled();
    });

    expect(trigger).toHaveAttribute('data-state', 'closed');
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });

  it('does not wait for persistent content controlled by a regular tab', () => {
    const tabId = '/dashboard/calendar';

    render(
      <div
        ref={(root) => {
          if (root) registerWorkspacePageOverlayRoot(tabId, root);
        }}
      >
        <button aria-controls='calendar-panel' aria-selected='true' role='tab'>
          Calendar
        </button>
        <div id='calendar-panel' role='tabpanel'>
          Calendar content
        </div>
      </div>
    );

    const dismissResult = dismissWorkspacePageOverlays(tabId);

    expect(dismissResult.hasPendingExit).toBe(false);
  });
});
