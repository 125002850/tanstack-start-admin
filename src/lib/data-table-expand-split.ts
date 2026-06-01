export const DATA_TABLE_EXPAND_MIN_TOP_PX = 200;
export const DATA_TABLE_EXPAND_MIN_BOTTOM_PX = 150;
export const DATA_TABLE_EXPAND_SPLIT_HANDLE_PX = 8;
export const DATA_TABLE_EXPAND_DEFAULT_TOP_RATIO = 0.6;
export const DATA_TABLE_EXPAND_KEYBOARD_STEP_PX = 32;

const MIN_EXPAND_HOST_HEIGHT =
  DATA_TABLE_EXPAND_MIN_TOP_PX +
  DATA_TABLE_EXPAND_MIN_BOTTOM_PX +
  DATA_TABLE_EXPAND_SPLIT_HANDLE_PX;

interface ClampExpandSplitTopOptions {
  hostHeight: number;
  topPx: number;
}

interface ResolveExpandSplitLayoutOptions {
  hostHeight: number;
  requestedTopPx?: number | null;
}

export interface DataTableExpandSplitLayout {
  topPx: number;
  bottomPx: number;
  minTopPx: number;
  minBottomPx: number;
  maxTopPx: number;
  handlePx: number;
  dragEnabled: boolean;
  locked: boolean;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getDefaultTopPx(hostHeight: number) {
  return Math.round(hostHeight * DATA_TABLE_EXPAND_DEFAULT_TOP_RATIO);
}

export function clampExpandSplitTop({ hostHeight, topPx }: ClampExpandSplitTopOptions) {
  const availableHeight = Math.max(0, hostHeight - DATA_TABLE_EXPAND_SPLIT_HANDLE_PX);

  if (hostHeight < MIN_EXPAND_HOST_HEIGHT) {
    return clamp(topPx, 0, availableHeight);
  }

  return clamp(
    topPx,
    DATA_TABLE_EXPAND_MIN_TOP_PX,
    hostHeight - DATA_TABLE_EXPAND_SPLIT_HANDLE_PX - DATA_TABLE_EXPAND_MIN_BOTTOM_PX
  );
}

export function resolveExpandSplitLayout({
  hostHeight,
  requestedTopPx
}: ResolveExpandSplitLayoutOptions): DataTableExpandSplitLayout {
  const handlePx = DATA_TABLE_EXPAND_SPLIT_HANDLE_PX;
  const nextTopPx = clampExpandSplitTop({
    hostHeight,
    topPx: requestedTopPx ?? getDefaultTopPx(hostHeight)
  });
  const bottomPx = Math.max(0, hostHeight - handlePx - nextTopPx);
  const dragEnabled = hostHeight >= MIN_EXPAND_HOST_HEIGHT;
  const maxTopPx = dragEnabled
    ? hostHeight - handlePx - DATA_TABLE_EXPAND_MIN_BOTTOM_PX
    : Math.max(0, hostHeight - handlePx);

  return {
    topPx: nextTopPx,
    bottomPx,
    minTopPx: DATA_TABLE_EXPAND_MIN_TOP_PX,
    minBottomPx: DATA_TABLE_EXPAND_MIN_BOTTOM_PX,
    maxTopPx,
    handlePx,
    dragEnabled,
    locked: !dragEnabled
  };
}
