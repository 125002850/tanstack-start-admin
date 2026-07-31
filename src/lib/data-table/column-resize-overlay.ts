const DEFAULT_MIN_SIZE = 80;

/**
 * 将拖拽预览宽度限制在列 min/max 范围内。
 *
 * 这是无 DOM 访问的纯函数，方便单元测试覆盖列宽边界。
 */
export function clampWidth(
  startWidth: number,
  deltaX: number,
  minSize?: number,
  maxSize?: number
): number {
  const min = minSize ?? DEFAULT_MIN_SIZE;
  const max = maxSize ?? Number.MAX_SAFE_INTEGER;
  const raw = startWidth + deltaX;
  if (raw < min) return min;
  if (raw > max) return max;
  return raw;
}

export interface OverlayPositionParams {
  /** 当前 th 相对 viewport 的左边界。 */
  columnLeft: number;
  /** overlay root 相对 viewport 的左边界。 */
  rootLeft: number;
  /** 横向滚动容器当前 scrollLeft。 */
  scrollLeft: number;
}

/**
 * 计算 overlay 相对 overlay root 的 left。
 *
 * 需要加上 scrollLeft，否则用户横向滚动后预览层会停留在可视区域坐标，而不是列的真实位置。
 */
export function calculateOverlayLeft(params: OverlayPositionParams): number {
  return params.columnLeft - params.rootLeft + params.scrollLeft;
}
