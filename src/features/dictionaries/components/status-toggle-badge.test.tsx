import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { StatusToggleBadge } from './status-toggle-badge';

afterEach(cleanup);

describe('StatusToggleBadge', () => {
  it.each(['enable', 'ENABLE', 'Enable'])('normalizes enabled status %s', (status) => {
    const getVariant = vi.fn(() => 'outline' as const);

    render(<StatusToggleBadge status={status} onClick={vi.fn()} getVariant={getVariant} />);

    expect(getVariant).toHaveBeenCalledWith(true);
  });

  it('keeps disabled status distinct from enabled status', () => {
    const getVariant = vi.fn(() => 'outline' as const);

    render(<StatusToggleBadge status='disable' onClick={vi.fn()} getVariant={getVariant} />);

    expect(getVariant).toHaveBeenCalledWith(false);
  });
});
