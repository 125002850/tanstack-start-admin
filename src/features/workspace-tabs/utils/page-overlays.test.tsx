import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import * as React from 'react';
import { createPortal } from 'react-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import {
  captureWorkspacePageOverlays,
  dismissWorkspacePageOverlays,
  registerWorkspacePageOverlayRoot,
  resetWorkspacePageOverlays
} from './page-overlays';

describe('workspace page overlays', () => {
  beforeEach(() => {
    // 本文件的用例都没有注册浮层，DOM 兜底会触发 DEV 未注册告警；
    // 统一静音，由专门的用例断言告警行为。
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    resetWorkspacePageOverlays();
    vi.restoreAllMocks();
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

  it('waits for a closed popover portal to finish its exit before settling', async () => {
    const tabId = '/dashboard/animated-popover';
    let finishExitAnimation: (() => void) | undefined;

    function AnimatedPopover() {
      const [state, setState] = React.useState<'closed' | 'open'>('open');
      const [mounted, setMounted] = React.useState(true);

      finishExitAnimation = () => setMounted(false);

      React.useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
          if (event.key === 'Escape') setState('closed');
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
      }, []);

      return (
        <div
          ref={(root) => {
            if (root) registerWorkspacePageOverlayRoot(tabId, root);
          }}
        >
          <button
            aria-controls='animated-popover-content'
            aria-expanded={state === 'open'}
            data-slot='popover-trigger'
            data-state={state}
          >
            Animated popover
          </button>
          {mounted
            ? createPortal(
                <div data-slot='popover-content' data-state={state} id='animated-popover-content'>
                  Animated popover content
                </div>,
                document.body
              )
            : null}
        </div>
      );
    }

    render(<AnimatedPopover />);

    const dismissResult = dismissWorkspacePageOverlays(tabId);
    let settled = false;
    const settledPromise = dismissResult.waitForSettled().then(() => {
      settled = true;
    });

    await screen.findByText('Animated popover content');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(screen.getByRole('button', { name: 'Animated popover' })).toHaveAttribute(
      'data-state',
      'closed'
    );
    expect(screen.getByText('Animated popover content')).toHaveAttribute('data-state', 'closed');
    expect(settled).toBe(false);

    act(() => finishExitAnimation?.());
    await act(async () => settledPromise);

    expect(screen.queryByText('Animated popover content')).not.toBeInTheDocument();
  });

  it('detects a popover already closed by pointerdown before the workspace click handler runs', async () => {
    const tabId = '/dashboard/pointerdown-closed-popover';
    let beginExitAnimation: (() => void) | undefined;
    let finishExitAnimation: (() => void) | undefined;

    function ExitingPopover() {
      const [state, setState] = React.useState<'closed' | 'open'>('open');
      const [mounted, setMounted] = React.useState(true);
      beginExitAnimation = () => setState('closed');
      finishExitAnimation = () => setMounted(false);

      return (
        <div
          ref={(root) => {
            if (root) registerWorkspacePageOverlayRoot(tabId, root);
          }}
        >
          <button aria-expanded={state === 'open'} data-slot='popover-trigger' data-state={state}>
            Exiting popover
          </button>
          {mounted
            ? createPortal(
                <div data-radix-popper-content-wrapper=''>
                  <div data-slot='popover-content' data-state={state}>
                    Exiting popover content
                  </div>
                </div>,
                document.body
              )
            : null}
        </div>
      );
    }

    render(<ExitingPopover />);

    const snapshot = captureWorkspacePageOverlays(tabId);
    expect(snapshot).not.toBeNull();

    act(() => beginExitAnimation?.());

    const dismissResult = dismissWorkspacePageOverlays(tabId, snapshot);
    expect(dismissResult.hasPendingExit).toBe(true);

    let settled = false;
    const settledPromise = dismissResult.waitForSettled().then(() => {
      settled = true;
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });

    expect(settled).toBe(false);
    expect(screen.getByText('Exiting popover content')).toBeInTheDocument();

    act(() => finishExitAnimation?.());
    await act(async () => settledPromise);

    expect(screen.queryByText('Exiting popover content')).not.toBeInTheDocument();
  });

  it('does not claim an unrelated closed portal after a captured overlay has settled', () => {
    const tabId = '/dashboard/captured-overlay';
    let finishExitAnimation: (() => void) | undefined;

    function CapturedOverlay() {
      const [open, setOpen] = React.useState(true);
      finishExitAnimation = () => setOpen(false);

      return (
        <div
          ref={(root) => {
            if (root) registerWorkspacePageOverlayRoot(tabId, root);
          }}
        >
          <button
            aria-controls='captured-overlay-content'
            aria-expanded={open}
            data-slot='popover-trigger'
            data-state={open ? 'open' : 'closed'}
          >
            Captured overlay
          </button>
          {open
            ? createPortal(
                <div data-slot='popover-content' data-state='open' id='captured-overlay-content'>
                  Captured overlay content
                </div>,
                document.body
              )
            : null}
          {createPortal(
            <div data-slot='popover-content' data-state='closed'>
              Unrelated closed portal
            </div>,
            document.body
          )}
        </div>
      );
    }

    render(<CapturedOverlay />);

    const snapshot = captureWorkspacePageOverlays(tabId);
    expect(snapshot).not.toBeNull();
    act(() => finishExitAnimation?.());

    const dismissResult = dismissWorkspacePageOverlays(tabId, snapshot);

    expect(dismissResult.hasPendingExit).toBe(false);
    expect(screen.getByText('Unrelated closed portal')).toBeInTheDocument();
  });

  it('skips the compatibility scan when pointerdown captured no open overlay', () => {
    const tabId = '/dashboard/empty-overlay-capture';

    render(
      <div
        ref={(root) => {
          if (root) registerWorkspacePageOverlayRoot(tabId, root);
        }}
      >
        {createPortal(
          <div data-slot='popover-content' data-state='closed'>
            Pre-existing closed portal
          </div>,
          document.body
        )}
      </div>
    );

    const snapshot = captureWorkspacePageOverlays(tabId);
    expect(snapshot).toBeNull();

    const dismissResult = dismissWorkspacePageOverlays(tabId, snapshot);

    expect(dismissResult.hasPendingExit).toBe(false);
    expect(screen.getByText('Pre-existing closed portal')).toBeInTheDocument();
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

  it('does not treat an expanded accordion as a portal overlay', () => {
    const tabId = '/dashboard/accordion';

    render(
      <div
        ref={(root) => {
          if (root) registerWorkspacePageOverlayRoot(tabId, root);
        }}
      >
        <button
          aria-controls='accordion-panel'
          aria-expanded='true'
          data-slot='accordion-trigger'
          data-state='open'
        >
          Advanced settings
        </button>
        <div id='accordion-panel'>Persistent content</div>
      </div>
    );

    const dismissResult = dismissWorkspacePageOverlays(tabId);

    expect(dismissResult.hasPendingExit).toBe(false);
    expect(screen.getByRole('button', { name: 'Advanced settings' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('closes nested portal layers from top to bottom before settling', async () => {
    const tabId = '/dashboard/nested-overlays';
    const escapeOrder: string[] = [];

    function NestedOverlays() {
      const [openLayers, setOpenLayers] = React.useState(2);

      React.useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
          if (event.key !== 'Escape') return;
          setOpenLayers((current) => {
            if (current === 0) return current;
            escapeOrder.push(current === 2 ? 'child' : 'parent');
            return current - 1;
          });
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
      }, []);

      return (
        <div
          ref={(root) => {
            if (root) registerWorkspacePageOverlayRoot(tabId, root);
          }}
        >
          {openLayers >= 1 ? (
            <div data-slot='dialog-content' data-state='open'>
              Parent dialog
            </div>
          ) : null}
          {openLayers >= 2 ? (
            <div data-slot='popover-content' data-state='open'>
              Child popover
            </div>
          ) : null}
        </div>
      );
    }

    render(<NestedOverlays />);

    const dismissResult = dismissWorkspacePageOverlays(tabId);

    await act(async () => {
      await dismissResult.waitForSettled();
    });

    expect(escapeOrder).toEqual(['child', 'parent']);
    expect(document.querySelector('[data-state="open"]')).not.toBeInTheDocument();
  });

  it('falls back to an explicit DOM close control when Escape does not close the layer', async () => {
    const tabId = '/dashboard/blocking-dialog';

    function BlockingDialog() {
      const [open, setOpen] = React.useState(true);

      return (
        <div
          ref={(root) => {
            if (root) registerWorkspacePageOverlayRoot(tabId, root);
          }}
        >
          {open ? (
            <div data-slot='dialog-content' data-state='open'>
              <button data-slot='dialog-close' onClick={() => setOpen(false)}>
                Close dialog
              </button>
            </div>
          ) : null}
        </div>
      );
    }

    render(<BlockingDialog />);

    const dismissResult = dismissWorkspacePageOverlays(tabId);

    await act(async () => {
      await dismissResult.waitForSettled();
    });

    expect(screen.queryByRole('button', { name: 'Close dialog' })).not.toBeInTheDocument();
  });

  it('warns once in dev when the DOM fallback closes an unregistered overlay', async () => {
    const warnMock = vi.mocked(console.warn);
    const tabId = '/dashboard/unregistered-popover';
    let reopenPopover: (() => void) | undefined;

    function UnregisteredPopover() {
      const [open, setOpen] = React.useState(true);
      reopenPopover = () => setOpen(true);

      React.useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
          if (event.key === 'Escape') setOpen(false);
        };

        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
      }, []);

      return (
        <div
          ref={(root) => {
            if (root) registerWorkspacePageOverlayRoot(tabId, root);
          }}
        >
          {open ? (
            <div data-slot='popover-content' data-state='open'>
              Unregistered popover content
            </div>
          ) : null}
        </div>
      );
    }

    render(<UnregisteredPopover />);

    const firstDismiss = dismissWorkspacePageOverlays(tabId);
    await act(async () => {
      await firstDismiss.waitForSettled();
    });

    expect(screen.queryByText('Unregistered popover content')).not.toBeInTheDocument();
    expect(warnMock).toHaveBeenCalledTimes(1);
    expect(warnMock.mock.calls[0]?.[0]).toContain(tabId);

    // 同一 tab 会话内重复出现只提醒一次，避免切换流程中刷屏
    act(() => reopenPopover?.());
    const secondDismiss = dismissWorkspacePageOverlays(tabId);
    await act(async () => {
      await secondDismiss.waitForSettled();
    });

    expect(screen.queryByText('Unregistered popover content')).not.toBeInTheDocument();
    expect(warnMock).toHaveBeenCalledTimes(1);
  });
});
