import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';

afterEach(cleanup);

describe('overlay content after-close lifecycle', () => {
  it('runs Dialog callbacks when content finishes closing', async () => {
    const onAfterClose = vi.fn();
    const onCloseAutoFocus = vi.fn();
    const { rerender } = render(
      <Dialog open>
        <DialogContent onAfterClose={onAfterClose} onCloseAutoFocus={onCloseAutoFocus}>
          <DialogTitle>Test dialog</DialogTitle>
          <DialogDescription>Test dialog description</DialogDescription>
        </DialogContent>
      </Dialog>
    );

    expect(onAfterClose).not.toHaveBeenCalled();

    rerender(
      <Dialog open={false}>
        <DialogContent onAfterClose={onAfterClose} onCloseAutoFocus={onCloseAutoFocus}>
          <DialogTitle>Test dialog</DialogTitle>
          <DialogDescription>Test dialog description</DialogDescription>
        </DialogContent>
      </Dialog>
    );

    await waitFor(() => {
      expect(onCloseAutoFocus).toHaveBeenCalledTimes(1);
      expect(onAfterClose).toHaveBeenCalledTimes(1);
    });
  });

  it('runs Sheet callbacks when content finishes closing', async () => {
    const onAfterClose = vi.fn();
    const onCloseAutoFocus = vi.fn();
    const { rerender } = render(
      <Sheet open>
        <SheetContent onAfterClose={onAfterClose} onCloseAutoFocus={onCloseAutoFocus}>
          <SheetTitle>Test sheet</SheetTitle>
          <SheetDescription>Test sheet description</SheetDescription>
        </SheetContent>
      </Sheet>
    );

    expect(onAfterClose).not.toHaveBeenCalled();

    rerender(
      <Sheet open={false}>
        <SheetContent onAfterClose={onAfterClose} onCloseAutoFocus={onCloseAutoFocus}>
          <SheetTitle>Test sheet</SheetTitle>
          <SheetDescription>Test sheet description</SheetDescription>
        </SheetContent>
      </Sheet>
    );

    await waitFor(() => {
      expect(onCloseAutoFocus).toHaveBeenCalledTimes(1);
      expect(onAfterClose).toHaveBeenCalledTimes(1);
    });
  });

  it('focuses the first editable field when SheetContent opts in', async () => {
    render(
      <Sheet open>
        <SheetContent autoFocusFirstField>
          <SheetTitle>Test sheet</SheetTitle>
          <SheetDescription>Test sheet description</SheetDescription>
          <input aria-label='Disabled field' disabled />
          <input aria-label='First editable field' />
          <input aria-label='Second editable field' />
        </SheetContent>
      </Sheet>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('First editable field')).toHaveFocus();
    });
  });

  it('focuses the first editable field when it appears after the sheet opens', async () => {
    const { rerender } = render(
      <Sheet open>
        <SheetContent autoFocusFirstField>
          <SheetTitle>Test sheet</SheetTitle>
          <SheetDescription>Test sheet description</SheetDescription>
          <div>Loading</div>
        </SheetContent>
      </Sheet>
    );

    rerender(
      <Sheet open>
        <SheetContent autoFocusFirstField>
          <SheetTitle>Test sheet</SheetTitle>
          <SheetDescription>Test sheet description</SheetDescription>
          <input aria-label='Ready field' />
        </SheetContent>
      </Sheet>
    );

    await waitFor(() => {
      expect(screen.getByLabelText('Ready field')).toHaveFocus();
    });
  });
});
