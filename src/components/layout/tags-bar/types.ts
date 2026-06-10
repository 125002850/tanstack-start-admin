import type { WorkspaceTabId } from '@/features/workspace-tabs/types';

// overlay / placeholder 需要和真实标签保持同尺寸，否则拖拽中的占位会抖动。
export type OverlayMetrics = {
  width: number;
  height: number;
};
