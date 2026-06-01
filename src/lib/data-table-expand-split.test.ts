import { describe, expect, it } from 'vitest';

import {
  DATA_TABLE_EXPAND_MIN_BOTTOM_PX,
  DATA_TABLE_EXPAND_MIN_TOP_PX,
  DATA_TABLE_EXPAND_SPLIT_HANDLE_PX,
  clampExpandSplitTop,
  resolveExpandSplitLayout
} from '@/lib/data-table-expand-split';

describe('data-table expand split math', () => {
  it('resolves a default split that honors pixel minimums in normal containers', () => {
    const layout = resolveExpandSplitLayout({ hostHeight: 800 });

    expect(layout.dragEnabled).toBe(true);
    expect(layout.topPx).toBe(480);
    expect(layout.bottomPx).toBe(312);
    expect(layout.minTopPx).toBe(DATA_TABLE_EXPAND_MIN_TOP_PX);
    expect(layout.minBottomPx).toBe(DATA_TABLE_EXPAND_MIN_BOTTOM_PX);
    expect(layout.handlePx).toBe(DATA_TABLE_EXPAND_SPLIT_HANDLE_PX);
    expect(layout.maxTopPx).toBe(642);
  });

  it('clamps drag results into the legal range', () => {
    expect(clampExpandSplitTop({ hostHeight: 800, topPx: 120 })).toBe(200);
    expect(clampExpandSplitTop({ hostHeight: 800, topPx: 700 })).toBe(642);
    expect(clampExpandSplitTop({ hostHeight: 800, topPx: 320 })).toBe(320);
  });

  it('re-clamps the existing top height after host resize instead of resetting to the default', () => {
    const layout = resolveExpandSplitLayout({
      hostHeight: 600,
      requestedTopPx: 700
    });

    expect(layout.dragEnabled).toBe(true);
    expect(layout.topPx).toBe(442);
    expect(layout.bottomPx).toBe(150);
    expect(layout.maxTopPx).toBe(442);
  });

  it('enters a locked fallback state when the host height cannot satisfy both minimums', () => {
    const layout = resolveExpandSplitLayout({ hostHeight: 320 });

    expect(layout.dragEnabled).toBe(false);
    expect(layout.locked).toBe(true);
    expect(layout.topPx).toBe(192);
    expect(layout.bottomPx).toBe(120);
    expect(layout.topPx + layout.bottomPx + layout.handlePx).toBe(320);
  });
});
