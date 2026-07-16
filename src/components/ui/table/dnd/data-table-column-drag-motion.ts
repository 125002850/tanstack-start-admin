import type { CSSProperties } from 'react';

const IDLE_TRANSFORM_TRANSITION = 'transform 0ms linear';

/**
 * 单列拖拽期间共享的视觉位移契约。
 *
 * 表头是唯一的 dnd-kit sortable 订阅者，并把实时 X 位移写入 table CSS 变量；同列
 * 已渲染的 body cell 只消费变量，从而避免 pointer move 触发整张 tbody 的 React 更新。
 */
export interface DataTableColumnDragMotion {
  translateXVariable: `--data-table-column-drag-x-${number}`;
  transitionVariable: `--data-table-column-drag-transition-${number}`;
  elementStyle: CSSProperties;
  cellStyle: CSSProperties;
}

export type DataTableColumnDragMotionMap = ReadonlyMap<string, DataTableColumnDragMotion>;

/** CSS 变量使用内部连续 slot，避免业务 column id 中的特殊字符进入自定义属性名。 */
export function createDataTableColumnDragMotionMap(
  columnIds: readonly string[]
): DataTableColumnDragMotionMap {
  return new Map(
    columnIds.map((columnId, index) => {
      const translateXVariable = `--data-table-column-drag-x-${index}` as const;
      const transitionVariable = `--data-table-column-drag-transition-${index}` as const;
      const elementStyle: CSSProperties = {
        transform: `translate3d(var(${translateXVariable}, 0px), 0, 0)`,
        transition: `var(${transitionVariable}, ${IDLE_TRANSFORM_TRANSITION})`
      };

      return [
        columnId,
        {
          translateXVariable,
          transitionVariable,
          elementStyle,
          cellStyle: {
            ...elementStyle,
            backgroundColor: 'var(--data-table-row-surface)',
            transition: `var(${transitionVariable}, ${IDLE_TRANSFORM_TRANSITION}), outline-color 150ms ease-out, box-shadow 150ms ease-out`
          }
        }
      ];
    })
  );
}

/** 把单个 sortable header 的实时位移发布给同列 body cells。 */
export function publishDataTableColumnDragMotion(
  tableElement: HTMLTableElement,
  motion: DataTableColumnDragMotion,
  translateX: number,
  transition: string | undefined
) {
  tableElement.style.setProperty(
    motion.transitionVariable,
    transition ?? IDLE_TRANSFORM_TRANSITION
  );
  tableElement.style.setProperty(motion.translateXVariable, `${translateX}px`);
}

/** header 卸载、拖拽取消或列窗口切换时移除临时变量，避免残留视觉位移。 */
export function clearDataTableColumnDragMotion(
  tableElement: HTMLTableElement,
  motion: DataTableColumnDragMotion
) {
  tableElement.style.removeProperty(motion.translateXVariable);
  tableElement.style.removeProperty(motion.transitionVariable);
}

/** 只在真实拖拽期间返回 motion，静止状态不为 td 创建额外 transform stacking context。 */
export function resolveDataTableColumnDragCellMotion(
  motionByColumnId: DataTableColumnDragMotionMap,
  columnId: string,
  isColumnDragging: boolean
) {
  return isColumnDragging ? motionByColumnId.get(columnId) : undefined;
}
