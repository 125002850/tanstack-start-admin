import { env } from './env';

/** 最大保活标签页数。超出时按 LRU 驱逐非 dirty 标签页。 */
export const MAX_KEEPALIVE_TABS = 15;

export function isWorkspaceTabsEnabled(): boolean {
  return env.workspaceTabsEnabled;
}
