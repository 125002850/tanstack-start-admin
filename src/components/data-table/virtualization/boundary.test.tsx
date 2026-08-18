import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { VirtualBodyBoundary } from './boundary';

function BrokenVirtualBody(): never {
  throw new Error('virtual body failed');
}

describe('VirtualBodyBoundary', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('reports the error and renders the standard body fallback', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const onError = vi.fn();

    render(
      <VirtualBodyBoundary fallback={<div>标准表体</div>} onError={onError}>
        <BrokenVirtualBody />
      </VirtualBodyBoundary>
    );

    expect(screen.getByText('标准表体')).toBeInTheDocument();
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
