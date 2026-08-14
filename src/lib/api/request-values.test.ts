import { describe, expect, it } from 'vitest';

import { emptyStringToUndefined } from './request-values';

describe('emptyStringToUndefined', () => {
  it.each([[''], [null], [undefined]])('converts %s to undefined', (value) => {
    expect(emptyStringToUndefined(value)).toBeUndefined();
  });

  it('preserves non-empty strings', () => {
    expect(emptyStringToUndefined('value')).toBe('value');
  });

  it('does not trim whitespace implicitly', () => {
    expect(emptyStringToUndefined('  ')).toBe('  ');
  });
});
