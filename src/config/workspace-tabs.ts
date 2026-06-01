const ENABLED_VALUE = '1';

/** 最大保活标签页数。超出时按 LRU 驱逐非 dirty 标签页。 */
export const MAX_KEEPALIVE_TABS = 15;

export function isWorkspaceTabsEnabled(): boolean {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env) {
      const raw = (import.meta.env as Record<string, string | undefined>)
        .VITE_ENABLE_WORKSPACE_TABS;
      if (raw === undefined) return true;
      return raw === ENABLED_VALUE;
    }
  } catch {
    // import.meta unavailable (e.g. test environment without ESM)
  }
  return true;
}
