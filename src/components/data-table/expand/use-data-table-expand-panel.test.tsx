import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { ExpandConfigEdge } from './types';
import { useDataTableExpandPanel } from './use-data-table-expand-panel';

afterEach(cleanup);

it('keeps the active tab until the controlled owner accepts the close request', () => {
  const row = { id: '1' };
  const expandConfig: ExpandConfigEdge<typeof row> = {
    rowKey: 'id',
    tabs: [
      { id: 'summary', label: '概览', render: () => null },
      { id: 'details', label: '明细', render: () => null }
    ]
  };
  const onExpandedRowKeyChange = vi.fn();
  const { result, rerender } = renderHook(
    ({ expandedRow }: { expandedRow: typeof row | null }) =>
      useDataTableExpandPanel({
        expandConfig,
        expandedRow,
        expandedRowKey: expandedRow?.id ?? null,
        isExpanded: Boolean(expandedRow),
        onExpandedRowKeyChange
      }),
    { initialProps: { expandedRow: row as typeof row | null } }
  );

  act(() => result.current.setActiveExpandTab('details'));
  act(() => result.current.handleExpandPanelClose());

  expect(onExpandedRowKeyChange).toHaveBeenCalledExactlyOnceWith(null);
  expect(result.current.activeExpandTab).toBe('details');
  rerender({ expandedRow: row });
  expect(result.current.activeExpandTab).toBe('details');

  rerender({ expandedRow: null });
  expect(result.current.activeExpandTab).toBeNull();
  rerender({ expandedRow: row });
  expect(result.current.activeExpandTab).toBe('summary');
});
