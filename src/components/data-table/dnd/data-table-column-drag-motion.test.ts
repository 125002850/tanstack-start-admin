import { describe, expect, it } from 'vitest';

import {
  clearDataTableColumnDragMotion,
  createDataTableColumnDragMotionMap,
  publishDataTableColumnDragMotion,
  resolveDataTableColumnDragCellMotion
} from './data-table-column-drag-motion';

describe('data table column drag motion', () => {
  it('uses internal slots instead of business column ids in CSS variable names', () => {
    const motionByColumnId = createDataTableColumnDragMotionMap(['customer.name', 'status/value']);

    expect(motionByColumnId.get('customer.name')).toMatchObject({
      translateXVariable: '--data-table-column-drag-x-0',
      transitionVariable: '--data-table-column-drag-transition-0'
    });
    expect(motionByColumnId.get('status/value')).toMatchObject({
      translateXVariable: '--data-table-column-drag-x-1',
      transitionVariable: '--data-table-column-drag-transition-1'
    });
  });

  it('publishes header motion on the table and exposes matching body cell styles', () => {
    const tableElement = document.createElement('table');
    const motionByColumnId = createDataTableColumnDragMotionMap(['name']);
    const motion = motionByColumnId.get('name');
    if (!motion) throw new Error('name drag motion missing');

    publishDataTableColumnDragMotion(tableElement, motion, 96.5, 'transform 200ms ease');

    expect(tableElement.style.getPropertyValue(motion.translateXVariable)).toBe('96.5px');
    expect(tableElement.style.getPropertyValue(motion.transitionVariable)).toBe(
      'transform 200ms ease'
    );
    expect(motion.elementStyle.transform).toBe(
      'translate3d(var(--data-table-column-drag-x-0, 0px), 0, 0)'
    );
    expect(motion.cellStyle.transform).toBe(motion.elementStyle.transform);
    expect(resolveDataTableColumnDragCellMotion(motionByColumnId, 'name', true)).toBe(motion);
    expect(resolveDataTableColumnDragCellMotion(motionByColumnId, 'name', false)).toBeUndefined();

    clearDataTableColumnDragMotion(tableElement, motion);
    expect(tableElement.style.getPropertyValue(motion.translateXVariable)).toBe('');
    expect(tableElement.style.getPropertyValue(motion.transitionVariable)).toBe('');
  });
});
