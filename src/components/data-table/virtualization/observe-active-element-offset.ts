import { observeElementOffset } from '@tanstack/react-virtual';

/** Activity 清理订阅后，忽略旧 observer 尚未触发的 scroll-end 防抖回调。 */
export const observeActiveElementOffset: typeof observeElementOffset = (instance, callback) => {
  let active = true;
  const unsubscribe = observeElementOffset(instance, (offset, scrolling) => {
    if (active) callback(offset, scrolling);
  });
  return () => {
    active = false;
    unsubscribe?.();
  };
};
