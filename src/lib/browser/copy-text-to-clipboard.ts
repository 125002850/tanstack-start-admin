export interface CopyTextToClipboardOptions {
  readonly container?: HTMLElement | null;
}

export async function copyTextToClipboard(
  text: string,
  { container }: CopyTextToClipboardOptions = {}
): Promise<boolean> {
  try {
    if (globalThis.navigator?.clipboard?.writeText) {
      await globalThis.navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // LAN HTTP origins cannot use the async Clipboard API; continue with the user-gesture fallback.
  }

  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') {
    return false;
  }

  const fallbackContainer = container ?? document.body;
  if (fallbackContainer === null || !fallbackContainer.isConnected) return false;

  const activeElement = document.activeElement;
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  textarea.tabIndex = -1;
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  textarea.style.top = '0';
  textarea.style.opacity = '0';
  textarea.style.pointerEvents = 'none';

  try {
    fallbackContainer.append(textarea);
    textarea.focus({ preventScroll: true });

    // Radix Dialog traps focus inside its Content. If another focus scope moves focus away,
    // execCommand('copy') may still return true without updating the system clipboard.
    if (document.activeElement !== textarea) return false;

    textarea.select();
    textarea.setSelectionRange(0, text.length);

    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    textarea.remove();

    if (activeElement instanceof HTMLElement && activeElement.isConnected) {
      try {
        activeElement.focus({ preventScroll: true });
      } catch {
        // Focus restoration is best-effort.
      }
    }
  }
}
