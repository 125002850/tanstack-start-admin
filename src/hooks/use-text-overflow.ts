import { useCallback, useRef } from 'react';

/** 交互时读取布局，避免为每段文本常驻尺寸监听器。 */
export function useTextOverflow<TElement extends HTMLElement = HTMLSpanElement>(
  axis: 'horizontal' | 'both' = 'both'
) {
  const ref = useRef<TElement>(null);
  const checkOverflow = useCallback(() => {
    const element = ref.current;
    if (!element || element.clientWidth === 0) return false;
    return (
      element.scrollWidth > element.clientWidth + 1 ||
      (axis === 'both' && element.scrollHeight > element.clientHeight + 1)
    );
  }, [axis]);
  return { ref, checkOverflow };
}
