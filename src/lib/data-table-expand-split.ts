/**
 * DataTable 展开详情分屏尺寸计算。
 *
 * 这些函数不依赖 DOM，供 hook 和测试复用；hook 只负责测量实际 host/pagination 高度，
 * 这里负责把配置、可用空间和用户拖拽请求合并成安全的 topPx 范围。
 */
export const DATA_TABLE_EXPAND_MIN_TOP_PX = 200;
export const DATA_TABLE_EXPAND_SPLIT_HANDLE_PX = 8;
export const DATA_TABLE_EXPAND_KEYBOARD_STEP_PX = 32;
export const DATA_TABLE_DEFAULT_EXPAND_TABLE_SIZING = {
  initialHeight: 360,
  minHeight: 240,
  maxHeight: 640
} as const;

export interface DataTableExpandSplitLayout {
  topPx: number;
  minTopPx: number;
  maxTopPx: number;
  handlePx: number;
  dragEnabled: boolean;
  isConstrained: boolean;
}

/** 简单数值夹紧，保证布局计算不会越过 min/max。 */
function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/** 根据宿主高度和配置限制主表高度。 */
export function clampExpandSplitTop({
  hostHeight,
  topPx,
  minTopPx = DATA_TABLE_EXPAND_MIN_TOP_PX,
  maxTopPx
}: {
  hostHeight: number;
  topPx: number;
  minTopPx?: number;
  maxTopPx?: number;
}) {
  const handlePx = DATA_TABLE_EXPAND_SPLIT_HANDLE_PX;
  const availableMaxTopPx = Math.max(minTopPx, hostHeight - handlePx);
  // maxTopPx 不能超过宿主可用空间，也不能小于 minTopPx。
  const resolvedMaxTopPx = Math.max(
    minTopPx,
    Math.min(maxTopPx ?? availableMaxTopPx, availableMaxTopPx)
  );

  return clamp(topPx, minTopPx, resolvedMaxTopPx);
}

/** 解析完整分屏布局，包括可拖拽范围、当前 topPx 和是否受显式配置约束。 */
export function resolveExpandSplitLayout({
  hostHeight,
  requestedTopPx,
  overheadPx = 0,
  initialTopPx,
  minTopPx = DATA_TABLE_EXPAND_MIN_TOP_PX,
  maxTopPx
}: {
  hostHeight: number;
  requestedTopPx?: number | null;
  overheadPx?: number;
  initialTopPx?: number;
  minTopPx?: number;
  maxTopPx?: number;
}): DataTableExpandSplitLayout {
  const handlePx = DATA_TABLE_EXPAND_SPLIT_HANDLE_PX;
  // pagination 等主表下方固定开销需要先从宿主高度里扣掉。
  const effectiveHeight = Math.max(0, hostHeight - overheadPx);
  const availableMaxTopPx = Math.max(minTopPx, effectiveHeight - handlePx);
  const resolvedMaxTopPx = Math.max(
    minTopPx,
    Math.min(maxTopPx ?? availableMaxTopPx, availableMaxTopPx)
  );
  const dragEnabled = resolvedMaxTopPx > minTopPx;
  const preferredTopPx = requestedTopPx ?? initialTopPx ?? resolvedMaxTopPx;
  const topPx = clampExpandSplitTop({
    hostHeight: effectiveHeight,
    topPx: preferredTopPx,
    minTopPx,
    maxTopPx
  });

  return {
    topPx,
    minTopPx,
    maxTopPx: resolvedMaxTopPx,
    handlePx,
    dragEnabled,
    isConstrained:
      requestedTopPx != null ||
      initialTopPx != null ||
      minTopPx !== DATA_TABLE_EXPAND_MIN_TOP_PX ||
      maxTopPx != null
  };
}
