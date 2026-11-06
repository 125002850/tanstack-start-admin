import { observeElementOffset } from '@tanstack/react-virtual';

/** 只通知当前轴的位移和滚动结束；Activity 清理后忽略旧订阅的延迟回调。 */
export const observeActiveElementOffset: typeof observeElementOffset = (instance, callback) => {
  let active = true;
  let previousOffset = instance.scrollOffset ?? 0;
  let wasScrolling = false;
  // Activity 恢复时旧订阅的 scroll-end 已失效，清除残留的滚动状态。
  if (instance.isScrolling) callback(previousOffset, false);
  const unsubscribe = observeElementOffset(instance, (offset, scrolling) => {
    if (!active) return;
    // 同一 viewport 的 scroll 同时发给行、列 virtualizer。另一轴的滚动不应触发整表刷新。
    if (offset === previousOffset && (scrolling || !wasScrolling)) return;
    previousOffset = offset;
    wasScrolling = scrolling;
    callback(offset, scrolling);
  });
  return () => {
    active = false;
    unsubscribe?.();
  };
};
