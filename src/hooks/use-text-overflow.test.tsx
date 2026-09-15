import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useTextOverflow } from './use-text-overflow';

afterEach(cleanup);

describe('useTextOverflow', () => {
  it('remeasures current layout and tolerates one pixel rounding', () => {
    const { result } = renderHook(() => useTextOverflow('horizontal'));
    expect(result.current.checkOverflow()).toBe(false);
    const element = document.createElement('span');
    result.current.ref.current = element;
    Object.defineProperties(element, {
      clientWidth: { configurable: true, value: 100 },
      scrollWidth: { configurable: true, value: 101 }
    });
    expect(result.current.checkOverflow()).toBe(false);
    Object.defineProperty(element, 'scrollWidth', { value: 102 });
    expect(result.current.checkOverflow()).toBe(true);
    Object.defineProperty(element, 'clientWidth', { value: 150 });
    expect(result.current.checkOverflow()).toBe(false);
  });

  it('detects line clamp height and ignores hidden elements', () => {
    const { result } = renderHook(() => useTextOverflow());
    const element = document.createElement('span');
    result.current.ref.current = element;
    Object.defineProperties(element, {
      clientWidth: { configurable: true, value: 100 },
      scrollWidth: { value: 100 },
      clientHeight: { value: 40 },
      scrollHeight: { value: 60 }
    });
    expect(result.current.checkOverflow()).toBe(true);
    Object.defineProperty(element, 'clientWidth', { value: 0 });
    expect(result.current.checkOverflow()).toBe(false);
  });
});
