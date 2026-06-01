const DEFAULT_MIN_SIZE = 80;

/**
 * Clamp a preview width to column min/max constraints.
 * Pure function — no DOM access.
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
  /** The column th's left edge relative to viewport */
  columnLeft: number;
  /** The overlay root's left edge relative to viewport */
  rootLeft: number;
  /** The scroll viewport's current scrollLeft (horizontal scroll offset) */
  scrollLeft: number;
}

/**
 * Calculate the overlay's left offset relative to the overlay root.
 * Accounts for horizontal scroll so the overlay stays aligned with the column
 * when the user has scrolled right.
 */
export function calculateOverlayLeft(params: OverlayPositionParams): number {
  return params.columnLeft - params.rootLeft + params.scrollLeft;
}
