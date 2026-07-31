import type { Column } from '@tanstack/react-table';
import type { CSSProperties } from 'react';

const DATA_TABLE_PINNED_SHADOW_COLOR =
  'var(--data-table-pinned-shadow-color, color-mix(in oklch, var(--foreground) 8%, transparent))';
const DATA_TABLE_PINNED_SHADOW_SOFT_COLOR =
  'var(--data-table-pinned-shadow-soft-color, color-mix(in oklch, var(--foreground) 3%, transparent))';
const DATA_TABLE_PINNED_SHADOW_GRADIENT_COLOR =
  'var(--data-table-pinned-shadow-gradient-color, color-mix(in oklch, var(--foreground) 3.5%, transparent))';
const DATA_TABLE_PINNED_SHADOW_LAYER_WIDTH = 18;

export const DATA_TABLE_PINNED_SHADOWS = {
  left: `8px 0 16px -15px ${DATA_TABLE_PINNED_SHADOW_COLOR}, 18px 0 28px -26px ${DATA_TABLE_PINNED_SHADOW_SOFT_COLOR}`,
  right: `-8px 0 16px -15px ${DATA_TABLE_PINNED_SHADOW_COLOR}, -18px 0 28px -26px ${DATA_TABLE_PINNED_SHADOW_SOFT_COLOR}`
} as const;

/** 固定列边界阴影的伪层样式，覆盖在单元格边缘外侧。 */
export function getColumnPinningShadowOverlayStyle(edge: 'left' | 'right'): CSSProperties {
  return edge === 'right'
    ? {
        right: -DATA_TABLE_PINNED_SHADOW_LAYER_WIDTH,
        width: DATA_TABLE_PINNED_SHADOW_LAYER_WIDTH,
        background: `linear-gradient(to right, ${DATA_TABLE_PINNED_SHADOW_GRADIENT_COLOR} 0%, transparent 78%)`
      }
    : {
        left: -DATA_TABLE_PINNED_SHADOW_LAYER_WIDTH,
        width: DATA_TABLE_PINNED_SHADOW_LAYER_WIDTH,
        background: `linear-gradient(to left, ${DATA_TABLE_PINNED_SHADOW_GRADIENT_COLOR} 0%, transparent 78%)`
      };
}

/** 只在固定区域边界列绘制阴影；内部固定列不重复绘制。 */
export function getColumnPinningShadow<TData>({
  column
}: {
  column: Column<TData>;
}): string | undefined {
  const isPinned = column.getIsPinned();
  if (!isPinned) {
    return undefined;
  }

  const customShadow = column.columnDef.meta?.pinningShadow?.[isPinned];
  if (customShadow) {
    return customShadow;
  }

  if (isPinned === 'left' && column.getIsLastColumn('left')) {
    return DATA_TABLE_PINNED_SHADOWS.left;
  }

  if (isPinned === 'right' && column.getIsFirstColumn('right')) {
    return DATA_TABLE_PINNED_SHADOWS.right;
  }

  return undefined;
}

/** 固定列的公共 sticky 样式；普通列不写 width，交给 colgroup/table-layout 控制。 */
export function getCommonPinningStyles<TData>({
  column
}: {
  column: Column<TData>;
}): CSSProperties {
  const isPinned = column.getIsPinned();

  if (isPinned) {
    return {
      boxShadow: getColumnPinningShadow({ column }),
      left: isPinned === 'left' ? `${column.getStart('left')}px` : undefined,
      right: isPinned === 'right' ? `${column.getAfter('right')}px` : undefined,
      position: 'sticky',
      pointerEvents: 'auto',
      width: column.getSize(),
      zIndex: 2
    };
  }

  return {};
}
