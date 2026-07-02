import { describe, expect, it } from 'vitest';

import {
  getDictLabel,
  nullableDateTime,
  nullableDecimal,
  nullableFileSize,
  nullableText,
  nullableTrimmedText,
  nullableYesNo
} from './display-formatters';

const getTestDictLabel = (code: string) => (code === '2' ? '成功' : code);

describe('display-formatters', () => {
  it('uses the standard empty placeholder', () => {
    expect(nullableText(null)).toBe('-');
    expect(nullableText('')).toBe('-');
    expect(nullableText(0)).toBe('0');
  });

  it('trims text when the caller needs legacy table text semantics', () => {
    expect(nullableTrimmedText('  ')).toBe('-');
    expect(nullableTrimmedText('  abc  ')).toBe('abc');
  });

  it('formats common nullable values', () => {
    expect(nullableDateTime('2026-06-29T08:09:10Z')).toMatch(/^2026-06-29/);
    expect(nullableFileSize(undefined)).toBe('-');
    expect(nullableFileSize(2048)).toBe('2 KB');
    expect(nullableDecimal(12.34567)).toBe('12.346');
    expect(nullableYesNo(1)).toBe('是');
    expect(nullableYesNo(0)).toBe('否');
  });

  it('ignores dict fallbacks that equal the raw code', () => {
    expect(getDictLabel(getTestDictLabel, 2)).toBe('成功');
    expect(getDictLabel(getTestDictLabel, 'UNKNOWN')).toBeUndefined();
  });
});
