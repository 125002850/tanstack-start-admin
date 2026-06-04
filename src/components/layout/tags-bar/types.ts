import type { WorkspaceTabId } from '@/features/workspace-tabs/types';

// overlay / placeholder 需要和真实标签保持同尺寸，否则拖拽中的占位会抖动。
export type OverlayMetrics = {
  width: number;
  height: number;
};

// TagVisualState 是拖拽期间的“视图快照”。
// 它只保留渲染所需的最小信息，避免组件在拖拽中继续依赖会变化的业务对象。
export type TagVisualState = {
  id: WorkspaceTabId;
  title: string;
  closable: boolean;
  dirty: boolean;
  isActive: boolean;
};
