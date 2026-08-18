import { afterEach, describe, expect, it, vi } from 'vitest';

import { createUuid } from './utils';

const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createUuid', () => {
  it('uses crypto.randomUUID when available', () => {
    const randomUuid = vi.fn(() => '9cfccbf5-a034-4ad1-9a6a-485f4b79e12c');
    vi.stubGlobal('crypto', { randomUUID: randomUuid });

    expect(createUuid()).toBe('9cfccbf5-a034-4ad1-9a6a-485f4b79e12c');
    expect(randomUuid).toHaveBeenCalledOnce();
  });

  it('uses crypto.getRandomValues when randomUUID is unavailable', () => {
    const getRandomValues = vi.fn((bytes: Uint8Array) => {
      bytes.set(Array.from({ length: 16 }, (_value, index) => index));
      return bytes;
    });
    vi.stubGlobal('crypto', { getRandomValues });

    expect(createUuid()).toBe('00010203-0405-4607-8809-0a0b0c0d0e0f');
    expect(getRandomValues).toHaveBeenCalledOnce();
  });

  it('still returns a UUID v4 when the Crypto API is unavailable', () => {
    vi.stubGlobal('crypto', undefined);

    expect(createUuid()).toMatch(UUID_V4_PATTERN);
  });
});
