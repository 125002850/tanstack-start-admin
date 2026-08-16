import type { WorkspaceTabId } from '../types';

type CloseOverlay = () => void;

/**
 * 显式浮层注册表 —— "浮层驱逐机"的第一层。
 *
 * 页面/组件在浮层打开时通过 useWorkspaceOverlay 注册"如何关闭自己"，
 * 切标签时 dismissWorkspacePageOverlays 先同步调用这些 close()，
 * 剩下的再交给 DOM 扫描兜底（page-overlays.ts）。
 *
 * 与 DOM 契约相比，注册表不依赖任何 UI 库的内部结构：
 * close 就是组件自己的 setOpen(false)。
 */
const registry = new Map<WorkspaceTabId, Map<symbol, CloseOverlay>>();

export function registerWorkspaceOverlay(
  tabId: WorkspaceTabId,
  close: CloseOverlay
): () => void {
  // workspace 关闭或不在 workspace 页面中时 tabId 为空串（use-workspace-page 的 fallback），
  // 注册即 no-op
  if (!tabId) return () => {};

  const key = Symbol();
  let overlays = registry.get(tabId);
  if (!overlays) {
    overlays = new Map();
    registry.set(tabId, overlays);
  }
  overlays.set(key, close);

  return () => {
    overlays?.delete(key);
  };
}

/**
 * 同步关闭某标签页下所有显式注册的浮层，返回注册条目数。
 * 不等待退出动画——动画期间的清理由 DOM 兜底（page-overlays）继续盯。
 */
export function closeRegisteredWorkspaceOverlays(tabId: WorkspaceTabId): number {
  const overlays = registry.get(tabId);
  registry.delete(tabId);
  if (!overlays || overlays.size === 0) return 0;

  for (const close of overlays.values()) {
    try {
      close();
    } catch (error) {
      // 页面自己写的 close 挂了不该阻断切标签，剩余浮层交给 DOM 兜底
      // oxlint-disable-next-line no-console -- unexpected close callback failure
      console.error('[workspace] overlay close 回调执行失败', error);
    }
  }
  return overlays.size;
}

export function resetWorkspaceOverlayRegistry() {
  registry.clear();
}
