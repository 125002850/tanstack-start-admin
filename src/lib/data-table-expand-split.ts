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

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

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
  const resolvedMaxTopPx = Math.max(
    minTopPx,
    Math.min(maxTopPx ?? availableMaxTopPx, availableMaxTopPx)
  );

  return clamp(topPx, minTopPx, resolvedMaxTopPx);
}

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
