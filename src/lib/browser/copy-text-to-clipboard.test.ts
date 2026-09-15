import { afterEach, describe, expect, it, vi } from 'vitest';

import { copyTextToClipboard } from './copy-text-to-clipboard';

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
const execCommandDescriptor = Object.getOwnPropertyDescriptor(document, 'execCommand');

describe('browser/copy-text-to-clipboard', () => {
  afterEach(() => {
    restoreProperty(navigator, 'clipboard', clipboardDescriptor);
    restoreProperty(document, 'execCommand', execCommandDescriptor);
    document.body.replaceChildren();
  });

  it('uses the async Clipboard API when available', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const execCommand = vi.fn(() => true);
    setClipboard({ writeText });
    setExecCommand(execCommand);

    await expect(copyTextToClipboard('copied text')).resolves.toBe(true);

    expect(writeText).toHaveBeenCalledWith('copied text');
    expect(execCommand).not.toHaveBeenCalled();
  });

  it('focuses a hidden textarea and falls back to execCommand', async () => {
    const activeButton = document.createElement('button');
    document.body.append(activeButton);
    activeButton.focus();

    setClipboard({ writeText: vi.fn().mockRejectedValue(new DOMException('Not allowed')) });
    setExecCommand(
      vi.fn(() => {
        const textarea = document.querySelector('textarea');

        expect(textarea).toBe(document.activeElement);
        expect(textarea).toHaveValue('fallback text');
        expect(textarea).toHaveAttribute('readonly');
        expect(textarea).toHaveAttribute('tabindex', '-1');
        expect(textarea).toHaveStyle({ left: '-9999px', position: 'fixed', top: '0px' });
        return true;
      })
    );

    await expect(copyTextToClipboard('fallback text')).resolves.toBe(true);

    expect(document.querySelector('textarea')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(activeButton);
  });

  it('mounts the fallback textarea inside the provided focus scope', async () => {
    const dialogContent = document.createElement('div');
    const activeButton = document.createElement('button');
    dialogContent.append(activeButton);
    document.body.append(dialogContent);
    activeButton.focus();

    const keepFocusInsideDialog = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialogContent.contains(event.target)) {
        activeButton.focus();
      }
    };
    document.addEventListener('focusin', keepFocusInsideDialog);

    setClipboard(undefined);
    const execCommand = vi.fn(() => {
      const textarea = dialogContent.querySelector('textarea');

      expect(textarea).toBe(document.activeElement);
      expect(textarea).toHaveValue('dialog fallback text');
      return true;
    });
    setExecCommand(execCommand);

    try {
      await expect(
        copyTextToClipboard('dialog fallback text', { container: dialogContent })
      ).resolves.toBe(true);
    } finally {
      document.removeEventListener('focusin', keepFocusInsideDialog);
    }

    expect(execCommand).toHaveBeenCalledWith('copy');
    expect(dialogContent.querySelector('textarea')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(activeButton);
  });

  it('does not report success when a focus scope moves focus away from the textarea', async () => {
    const dialogContent = document.createElement('div');
    const activeButton = document.createElement('button');
    dialogContent.append(activeButton);
    document.body.append(dialogContent);
    activeButton.focus();

    const keepFocusInsideDialog = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialogContent.contains(event.target)) {
        activeButton.focus();
      }
    };
    document.addEventListener('focusin', keepFocusInsideDialog);

    setClipboard(undefined);
    const execCommand = vi.fn(() => true);
    setExecCommand(execCommand);

    try {
      await expect(copyTextToClipboard('blocked by focus scope')).resolves.toBe(false);
    } finally {
      document.removeEventListener('focusin', keepFocusInsideDialog);
    }

    expect(execCommand).not.toHaveBeenCalled();
    expect(document.querySelector('textarea')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(activeButton);
  });

  it('returns false and cleans up when the fallback throws', async () => {
    const activeButton = document.createElement('button');
    document.body.append(activeButton);
    activeButton.focus();

    setClipboard(undefined);
    setExecCommand(
      vi.fn(() => {
        throw new DOMException('Copy blocked');
      })
    );

    await expect(copyTextToClipboard('blocked text')).resolves.toBe(false);

    expect(document.querySelector('textarea')).not.toBeInTheDocument();
    expect(document.activeElement).toBe(activeButton);
  });

  it('does not reject when restoring focus fails', async () => {
    const activeButton = document.createElement('button');
    document.body.append(activeButton);
    activeButton.focus();
    vi.spyOn(activeButton, 'focus').mockImplementation(() => {
      throw new DOMException('Focus blocked');
    });

    setClipboard(undefined);
    setExecCommand(vi.fn(() => true));

    await expect(copyTextToClipboard('copied text')).resolves.toBe(true);
    expect(document.querySelector('textarea')).not.toBeInTheDocument();
  });
});

function setClipboard(clipboard: Pick<Clipboard, 'writeText'> | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: clipboard
  });
}

function setExecCommand(execCommand: typeof document.execCommand) {
  Object.defineProperty(document, 'execCommand', {
    configurable: true,
    value: execCommand
  });
}

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
