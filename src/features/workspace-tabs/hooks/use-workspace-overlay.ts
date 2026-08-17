import { useOverlayLifecycle } from '@/components/ui/overlay-lifecycle';

/**
 * 声明式浮层认领：浮层打开时向 workspace 注册"如何关闭自己"，
 * 切标签时由 dismissWorkspacePageOverlays 同步调用，关闭后自动注销，组件卸载自动注销。
 *
 * 用法：
 * - 页面受控浮层：useWorkspaceOverlay(dialogOpen, () => setDialogOpen(false))
 * - workspace 页面由 WorkspaceViewport 提供注册实现
 * - 通用 UI 应直接使用 useOverlayLifecycle，避免反向依赖 workspace feature
 */
export function useWorkspaceOverlay(isOpen: boolean, close: () => void) {
  useOverlayLifecycle(isOpen, close);
}
