import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyTextToClipboard } from './copy-text-to-clipboard';

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const execCommandDescriptor = Object.getOwnPropertyDescriptor(document, 'execCommand');

afterEach(() => {
  restoreProperty(navigator, 'clipboard', clipboardDescriptor);
  restoreProperty(document, 'execCommand', execCommandDescriptor);
  document.querySelectorAll('textarea').forEach((element) => element.remove());
  vi.restoreAllMocks();
});

describe('copyTextToClipboard', () => {
  it('uses the async Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });

    await expect(copyTextToClipboard('template text')).resolves.toBe(true);
    expect(writeText).toHaveBeenCalledWith('template text');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('falls back to selection copy and restores focus when Clipboard API rejects', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('insecure origin'));
    const execCommand = vi.fn(() => true);
    const input = document.createElement('input');
    document.body.append(input);
    input.focus();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText }
    });
    Object.defineProperty(document, 'execCommand', {
      configurable: true,
      value: execCommand
    });

    await expect(copyTextToClipboard('fallback text')).resolves.toBe(true);
    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
    expect(input).toHaveFocus();

    input.remove();
  });

  it('returns false when neither clipboard implementation is available', async () => {
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined });
    Object.defineProperty(document, 'execCommand', { configurable: true, value: undefined });

    await expect(copyTextToClipboard('unavailable')).resolves.toBe(false);
  });
});

function restoreProperty(
  target: object,
  key: PropertyKey,
  descriptor: PropertyDescriptor | undefined
) {
  if (descriptor === undefined) {
    Reflect.deleteProperty(target, key);
    return;
  }
  Object.defineProperty(target, key, descriptor);
}
