import { describe, expect, it } from 'vitest';

import {
  buildDataTableCellRangeTsv,
  createDataTableCellRangeIndex,
  getDataTableCellRangeEdges,
  isDataTableCellInRange,
  moveDataTableCellCoordinate,
  normalizeDataTableCellClipboardText,
  resolveDataTableCellClipboardText,
  resolveDataTableCellRangeBounds,
  type DataTableCellRange
} from './data-table-cell-range';

const rowIds = ['row-a', 'row-b', 'row-c'];
const columnIds = ['name', 'amount', 'status'];
const index = createDataTableCellRangeIndex(rowIds, columnIds);

describe('DataTable cell range model', () => {
  it('normalizes forward and reverse ranges to the same bounds', () => {
    const forward: DataTableCellRange = {
      anchor: { rowId: 'row-a', columnId: 'name' },
      focus: { rowId: 'row-c', columnId: 'amount' }
    };
    const reverse: DataTableCellRange = {
      anchor: forward.focus,
      focus: forward.anchor
    };

    expect(resolveDataTableCellRangeBounds(forward, index)).toEqual({
      rowStart: 0,
      rowEnd: 2,
      columnStart: 0,
      columnEnd: 1
    });
    expect(resolveDataTableCellRangeBounds(reverse, index)).toEqual(
      resolveDataTableCellRangeBounds(forward, index)
    );
  });

  it('returns null when either endpoint leaves the current model', () => {
    expect(
      resolveDataTableCellRangeBounds(
        {
          anchor: { rowId: 'row-a', columnId: 'name' },
          focus: { rowId: 'missing', columnId: 'amount' }
        },
        index
      )
    ).toBeNull();
  });

  it('derives membership and logical edges without materializing selected ids', () => {
    const bounds = resolveDataTableCellRangeBounds(
      {
        anchor: { rowId: 'row-a', columnId: 'name' },
        focus: { rowId: 'row-b', columnId: 'amount' }
      },
      index
    );

    expect(bounds).not.toBeNull();
    expect(isDataTableCellInRange({ rowId: 'row-b', columnId: 'name' }, bounds!, index)).toBe(true);
    expect(isDataTableCellInRange({ rowId: 'row-c', columnId: 'name' }, bounds!, index)).toBe(
      false
    );
    expect(getDataTableCellRangeEdges({ rowId: 'row-a', columnId: 'name' }, bounds!, index)).toBe(
      'block-start inline-start'
    );
    expect(getDataTableCellRangeEdges({ rowId: 'row-b', columnId: 'amount' }, bounds!, index)).toBe(
      'inline-end block-end'
    );
  });

  it('moves by visual arrow direction and clamps at model edges', () => {
    const start = { rowId: 'row-b', columnId: 'amount' };

    expect(moveDataTableCellCoordinate(start, 'ArrowLeft', 'ltr', index)).toEqual({
      rowId: 'row-b',
      columnId: 'name'
    });
    expect(moveDataTableCellCoordinate(start, 'ArrowLeft', 'rtl', index)).toEqual({
      rowId: 'row-b',
      columnId: 'status'
    });
    expect(
      moveDataTableCellCoordinate({ rowId: 'row-a', columnId: 'name' }, 'ArrowUp', 'ltr', index)
    ).toEqual({ rowId: 'row-a', columnId: 'name' });
  });

  it('serializes the normalized rectangle as row-major TSV', () => {
    const bounds = resolveDataTableCellRangeBounds(
      {
        anchor: { rowId: 'row-b', columnId: 'amount' },
        focus: { rowId: 'row-a', columnId: 'name' }
      },
      index
    );

    expect(
      buildDataTableCellRangeTsv(bounds!, index, ({ rowId, columnId }) => `${rowId}:${columnId}`)
    ).toBe('row-a:name\trow-a:amount\nrow-b:name\trow-b:amount');
  });

  it('normalizes line breaks and resolves copy text by explicit priority', () => {
    expect(normalizeDataTableCellClipboardText('Line 1\r\nLine 2\rLine 3')).toBe(
      'Line 1\nLine 2\nLine 3'
    );
    expect(
      resolveDataTableCellClipboardText({
        copyValue: 1234.5,
        renderedText: '1,234.50',
        rawValue: 1234.5
      })
    ).toBe('1234.5');
    expect(resolveDataTableCellClipboardText({ renderedText: 'Rendered', rawValue: 'Raw' })).toBe(
      'Rendered'
    );
    expect(resolveDataTableCellClipboardText({ rawValue: null })).toBe('');
  });
});
