import {
  defaultDropAnimationSideEffects,
  type DropAnimation
} from '@dnd-kit/core';
import { resolveDashboardHomeHref } from '@/lib/router/dashboard-home';

// 长按延迟与容差直接决定“点击”和“拖拽”之间的手感。
// 鼠标与触摸使用不同容差，是为了兼顾桌面精度和手指抖动。
export const LONG_PRESS_DELAY_MS = 180;
export const LONG_PRESS_TOLERANCE_PX = 8;
export const LONG_PRESS_TOUCH_TOLERANCE_PX = 12;

// 首页标签在整个 tags bar 中是“固定钉住”的特殊节点。
export const HOME_ID = resolveDashboardHomeHref();

// 这里保留 drop 动画，避免 overlay 在放下时瞬间消失。
// sideEffects 仅降低 active 元素透明度，让用户能感知“源位置”正在回落。
export const dropAnimation: DropAnimation = {
  sideEffects: defaultDropAnimationSideEffects({
    styles: {
      active: {
        opacity: '0.4'
      }
    }
  })
};
