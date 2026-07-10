import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import ResetPasswordSheet from './reset-password-sheet';

describe('ResetPasswordSheet', () => {
  afterEach(cleanup);

  it('keeps the new password field inside its own autocomplete form', () => {
    const { container } = render(
      <ResetPasswordSheet
        open
        onOpenChange={vi.fn()}
        staff={{ staffId: 1, username: 'alice' }}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />
    );

    const passwordInput =
      container.ownerDocument.querySelector<HTMLInputElement>('input[type="password"]');

    expect(passwordInput).not.toBeNull();
    expect(passwordInput).toHaveAttribute('name', 'newPassword');
    expect(passwordInput).toHaveAttribute('autocomplete', 'new-password');
    expect(passwordInput?.closest('form')).not.toBeNull();
  });
});
