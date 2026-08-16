import * as React from 'react';
import { registerWorkspaceOverlay } from '../utils/workspace-overlay-registry';
import { useWorkspacePageLifecycle } from './use-workspace-page';

/**
 * 声明式浮层认领：浮层打开时向 workspace 注册"如何关闭自己"，
 * 切标签时由 dismissWorkspacePageOverlays 同步调用，关闭后自动注销，组件卸载自动注销。
 *
 * 用法：
 * - 页面受控浮层：useWorkspaceOverlay(dialogOpen, () => setDialogOpen(false))
 * - 共享组件：在组件内部调用，所有使用方自动生效
 * - workspace 关闭或不在 workspace 页面中时 tabId 为空串，注册即 no-op
 */
export function useWorkspaceOverlay(isOpen: boolean, close: () => void) {
  const { tabId } = useWorkspacePageLifecycle();

  React.useEffect(() => {
    if (!isOpen) return;
    return registerWorkspaceOverlay(tabId, close);
  }, [isOpen, close, tabId]);
}
