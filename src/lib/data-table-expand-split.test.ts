import { describe, expect, it } from 'vitest';

import {
  DATA_TABLE_EXPAND_MIN_TOP_PX,
  DATA_TABLE_EXPAND_SPLIT_HANDLE_PX,
  clampExpandSplitTop,
  resolveExpandSplitLayout
} from '@/lib/data-table-expand-split';

describe('data-table expand split math', () => {
  it('resolves a configured initial table height without stretching to the host maximum', () => {
    const layout = resolveExpandSplitLayout({
      hostHeight: 800,
      initialTopPx: 360,
      maxTopPx: 640
    });

    expect(layout.dragEnabled).toBe(true);
    expect(layout.topPx).toBe(360);
    expect(layout.minTopPx).toBe(DATA_TABLE_EXPAND_MIN_TOP_PX);
    expect(layout.handlePx).toBe(DATA_TABLE_EXPAND_SPLIT_HANDLE_PX);
    expect(layout.maxTopPx).toBe(640);
    expect(layout.isConstrained).toBe(true);
  });

  it('clamps drag results into the legal range', () => {
    expect(clampExpandSplitTop({ hostHeight: 800, topPx: 120 })).toBe(200);
    expect(clampExpandSplitTop({ hostHeight: 800, topPx: 700 })).toBe(700);
    expect(clampExpandSplitTop({ hostHeight: 800, topPx: 320 })).toBe(320);
  });

  it('re-clamps the existing top height after host resize instead of resetting to the default', () => {
    const layout = resolveExpandSplitLayout({
      hostHeight: 600,
      requestedTopPx: 700,
      maxTopPx: 640
    });

    expect(layout.dragEnabled).toBe(true);
    expect(layout.topPx).toBe(592);
    expect(layout.maxTopPx).toBe(592);
  });

  it('remains draggable even at small host heights since bottom panel is content-driven', () => {
    const layout = resolveExpandSplitLayout({ hostHeight: 320 });

    expect(layout.dragEnabled).toBe(true);
    expect(layout.topPx).toBe(312);
    expect(layout.maxTopPx).toBe(312);
  });

  it('respects overheadPx when calculating max', () => {
    const layout = resolveExpandSplitLayout({
      hostHeight: 800,
      overheadPx: 100,
      initialTopPx: 360,
      maxTopPx: 640
    });

    expect(layout.maxTopPx).toBe(640);
    expect(layout.topPx).toBe(360);
  });
});
