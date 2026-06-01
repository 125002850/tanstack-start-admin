import { describe, it, expect } from 'vitest';
import {
  clampWidth,
  calculateOverlayLeft,
  type OverlayPositionParams
} from '@/lib/data-table-column-resize-overlay';

describe('clampWidth', () => {
  it('returns startWidth when deltaX is zero', () => {
    expect(clampWidth(150, 0, 100, 300)).toBe(150);
  });

  it('adds deltaX to startWidth within range', () => {
    expect(clampWidth(150, 50, 100, 300)).toBe(200);
  });

  it('clamps to minSize when below', () => {
    expect(clampWidth(100, -30, 80, 300)).toBe(80);
  });

  it('clamps to maxSize when above', () => {
    expect(clampWidth(150, 200, 80, 300)).toBe(300);
  });

  it('uses default minSize 80 when minSize is undefined', () => {
    expect(clampWidth(90, -50, undefined, 300)).toBe(80);
  });

  it('uses no effective max when maxSize is undefined', () => {
    expect(clampWidth(100, 5000, 50, undefined)).toBe(5100);
  });

  it('clamps exactly at min boundary', () => {
    expect(clampWidth(80, 0, 80, 300)).toBe(80);
  });

  it('clamps exactly at max boundary', () => {
    expect(clampWidth(300, 0, 80, 300)).toBe(300);
  });

  it('permits negative deltaX that stays in range', () => {
    expect(clampWidth(150, -20, 100, 300)).toBe(130);
  });
});

describe('calculateOverlayLeft', () => {
  it('returns columnLeft - rootLeft when no scroll', () => {
    const params: OverlayPositionParams = {
      columnLeft: 350,
      rootLeft: 300,
      scrollLeft: 0
    };
    expect(calculateOverlayLeft(params)).toBe(50);
  });

  it('adds scrollLeft to the offset', () => {
    const params: OverlayPositionParams = {
      columnLeft: 200,
      rootLeft: 300,
      scrollLeft: 150
    };
    // 200 - 300 + 150 = 50
    expect(calculateOverlayLeft(params)).toBe(50);
  });

  it('handles pinned column with large left offset', () => {
    const params: OverlayPositionParams = {
      columnLeft: 500,
      rootLeft: 300,
      scrollLeft: 0
    };
    expect(calculateOverlayLeft(params)).toBe(200);
  });

  it('handles column scrolled far to the right', () => {
    const params: OverlayPositionParams = {
      columnLeft: 100,
      rootLeft: 300,
      scrollLeft: 400
    };
    // 100 - 300 + 400 = 200
    expect(calculateOverlayLeft(params)).toBe(200);
  });
});
