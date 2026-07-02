import { env } from './env';

/**
 * 最大保活标签页数。超出时按 LRU 驱逐非 dirty 标签页。
 * 调高前必须用重表格/表单页面压测内存与切换耗时；重页面优先通过
 * route metadata 设置 `workspace.keepAlive: false` 或后续引入页面级权重。
 */
export const MAX_KEEPALIVE_TABS = 15;

export function isWorkspaceTabsEnabled(): boolean {
  return env.workspaceTabsEnabled;
}
