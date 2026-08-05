import { resolveDashboardHomeHref } from '@/lib/router/dashboard-home';

// 鼠标移动超过阈值才进入拖拽，普通点击不会被识别为排序手势。
// 触摸端继续使用长按，避免横向滚动与拖拽过早竞争。
export const MOUSE_DRAG_ACTIVATION_DISTANCE_PX = 10;
export const TOUCH_DRAG_ACTIVATION_DELAY_MS = 250;
export const TOUCH_DRAG_TOLERANCE_PX = 5;

// 首页标签在整个 tags bar 中是“固定钉住”的特殊节点。
export const HOME_ID = resolveDashboardHomeHref();
