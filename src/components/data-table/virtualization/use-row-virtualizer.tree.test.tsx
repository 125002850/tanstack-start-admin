import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { useRowVirtualizer } from './use-row-virtualizer';

afterEach(cleanup);

describe('tree row virtualization', () => {
  it('keys visible nodes by identity and does not reset scrolling when an expansion inserts rows', () => {
    const parent = { id: 'parent' };
    const sibling = { id: 'sibling' };
    const child = { id: 'child' };
    const { result, rerender } = renderHook(
      ({ rows, resetKey }) => useRowVirtualizer({ rows, resetKey, scrollViewport: null }),
      { initialProps: { rows: [parent, sibling], resetKey: 'page-0' } }
    );
    const scrollToIndex = vi.spyOn(result.current.virtualizer, 'scrollToIndex');
    expect(result.current.virtualizer.options.getItemKey(1)).toBe('sibling');

    rerender({ rows: [parent, child, sibling], resetKey: 'page-0' });
    expect(result.current.virtualizer.options.getItemKey(1)).toBe('child');
    expect(result.current.virtualizer.options.getItemKey(2)).toBe('sibling');
    expect(scrollToIndex).not.toHaveBeenCalled();

    rerender({ rows: [parent, sibling], resetKey: 'page-1' });
    expect(scrollToIndex).toHaveBeenCalledWith(0, { behavior: 'auto' });
  });
});
