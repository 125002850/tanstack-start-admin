import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, cleanup, fireEvent, act } from '@testing-library/react';
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  getPaginationRowModel
} from '@tanstack/react-table';
import { DataTable } from '@/components/ui/table/data-table';
import * as React from 'react';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({
    count,
    enabled,
    estimateSize
  }: {
    count: number;
    enabled?: boolean;
    estimateSize: () => number;
  }) => {
    const size = estimateSize();
    const items = enabled
      ? Array.from({ length: Math.min(count, 4) }, (_, i) => ({ index: i, start: i * size, size }))
      : [];
    return {
      getVirtualItems: () => items,
      getTotalSize: () => count * size,
      scrollToIndex: vi.fn(),
      measure: vi.fn()
    };
  }
}));

vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    viewportRef,
    viewportProps
  }: {
    children: React.ReactNode;
    viewportRef?: React.Ref<HTMLDivElement>;
    viewportProps?: Record<string, unknown>;
  }) => {
    const id = viewportProps?.['data-scroll-target-id'] as string | undefined;
    return (
      <div data-slot='scroll-area'>
        <div
          ref={viewportRef}
          data-slot='scroll-area-viewport'
          data-scroll-target-id={id}
          data-testid='scroll-viewport'
        >
          {children}
        </div>
      </div>
    );
  },
  ScrollBar: () => null
}));

type TestRow = { id: number; name: string; price: number };

const COLUMNS_WITH_SIZING: ColumnDef<TestRow>[] = [
  { accessorKey: 'id', header: 'ID', size: 80, minSize: 60, enableResizing: true },
  { accessorKey: 'name', header: 'Name', size: 170, minSize: 100, enableResizing: true },
  { accessorKey: 'price', header: 'Price', size: 111, minSize: 80, enableResizing: false }
];

function makeRows(count: number): TestRow[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    name: `Product ${i + 1}`,
    price: Math.round(Math.random() * 1000) / 10
  }));
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function Harness({ columns = COLUMNS_WITH_SIZING, rows = makeRows(5) }: any = {}) {
  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    enableColumnResizing: true,
    columnResizeMode: 'onEnd' as const,
    initialState: { pagination: { pageSize: rows.length || 10, pageIndex: 0 } }
  });
  return <DataTable table={table} />;
}

afterEach(cleanup);

describe('DataTableColumnResizeHandle overlay lifecycle', () => {
  it('renders resize handles for resizable columns', () => {
    const { container } = render(<Harness />);
    const handles = container.querySelectorAll('div[data-resizing]');
    expect(handles.length).toBe(2);
  });

  it('does not render resize handle for non-resizable column', () => {
    const { container } = render(<Harness />);
    const ths = container.querySelectorAll('thead th');
    expect(ths[2]?.querySelector('div[data-resizing]')).toBeNull();
  });

  it('creates overlay in overlay root on mousedown', () => {
    const { container } = render(<Harness />);
    const handle = container.querySelector('div[data-resizing]') as HTMLElement;

    fireEvent.mouseDown(handle, { clientX: 180 });

    const overlayRoot = container.querySelector('[data-table-resize-overlay-root]');
    expect(overlayRoot).toBeTruthy();

    const children = Array.from(overlayRoot!.children);
    const overlay = children.find(
      (el) =>
        (el as HTMLElement).style.position === 'absolute' &&
        (el as HTMLElement).style.pointerEvents === 'none'
    );
    expect(overlay).toBeTruthy();

    fireEvent.mouseUp(document);
  });

  it('overlay has pointer-events: none', () => {
    const { container } = render(<Harness />);
    const handle = container.querySelector('div[data-resizing]') as HTMLElement;

    fireEvent.mouseDown(handle, { clientX: 180 });

    const overlayRoot = container.querySelector('[data-table-resize-overlay-root]');
    const children = Array.from(overlayRoot!.children);
    const overlay = children.find(
      (el) =>
        (el as HTMLElement).style.position === 'absolute' &&
        (el as HTMLElement).style.pointerEvents === 'none'
    ) as HTMLElement;
    expect(overlay?.style.pointerEvents).toBe('none');

    fireEvent.mouseUp(document);
  });

  it('overlay is removed on mouseup', () => {
    const { container } = render(<Harness />);
    const handle = container.querySelector('div[data-resizing]') as HTMLElement;

    fireEvent.mouseDown(handle, { clientX: 180 });

    const overlayRoot = container.querySelector('[data-table-resize-overlay-root]');
    const childrenDuring = Array.from(overlayRoot!.children);
    const overlayDuring = childrenDuring.find(
      (el) =>
        (el as HTMLElement).style.position === 'absolute' &&
        (el as HTMLElement).style.pointerEvents === 'none'
    );
    expect(overlayDuring).toBeTruthy();

    fireEvent.mouseUp(document);

    const childrenAfter = Array.from(overlayRoot!.children);
    const overlayAfter = childrenAfter.find(
      (el) =>
        (el as HTMLElement).style.position === 'absolute' &&
        (el as HTMLElement).style.pointerEvents === 'none'
    );
    expect(overlayAfter).toBeUndefined();
  });

  it('restores body userSelect and cursor on mouseup', () => {
    document.body.style.userSelect = 'text';
    document.body.style.cursor = 'auto';

    const { container } = render(<Harness />);
    const handle = container.querySelector('div[data-resizing]') as HTMLElement;

    fireEvent.mouseDown(handle, { clientX: 180 });

    expect(document.body.style.userSelect).toBe('none');
    expect(document.body.style.cursor).toBe('col-resize');

    fireEvent.mouseUp(document);

    expect(document.body.style.userSelect).toBe('text');
    expect(document.body.style.cursor).toBe('auto');
  });

  it('overlay is removed on Escape key', async () => {
    const { container } = render(<Harness />);
    const handle = container.querySelector('div[data-resizing]') as HTMLElement;

    fireEvent.mouseDown(handle, { clientX: 180 });

    const overlayRoot = container.querySelector('[data-table-resize-overlay-root]');
    const childrenDuring = Array.from(overlayRoot!.children);
    const overlayDuring = childrenDuring.find(
      (el) =>
        (el as HTMLElement).style.position === 'absolute' &&
        (el as HTMLElement).style.pointerEvents === 'none'
    );
    expect(overlayDuring).toBeTruthy();

    await act(() => {
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    });

    const childrenAfter = Array.from(overlayRoot!.children);
    const overlayAfter = childrenAfter.find(
      (el) =>
        (el as HTMLElement).style.position === 'absolute' &&
        (el as HTMLElement).style.pointerEvents === 'none'
    );
    expect(overlayAfter).toBeUndefined();
  });

  it('creates and removes the overlay on touchstart/touchend while restoring userSelect', () => {
    document.body.style.userSelect = 'text';

    const { container } = render(<Harness />);
    const handle = container.querySelector('div[data-resizing]') as HTMLElement;

    fireEvent.touchStart(handle, {
      touches: [{ clientX: 180 }]
    });

    const overlayRoot = container.querySelector('[data-table-resize-overlay-root]');
    const childrenDuring = Array.from(overlayRoot!.children);
    const overlayDuring = childrenDuring.find(
      (el) =>
        (el as HTMLElement).style.position === 'absolute' &&
        (el as HTMLElement).style.pointerEvents === 'none'
    );

    expect(overlayDuring).toBeTruthy();

    fireEvent.touchEnd(document);

    const childrenAfter = Array.from(overlayRoot!.children);
    const overlayAfter = childrenAfter.find(
      (el) =>
        (el as HTMLElement).style.position === 'absolute' &&
        (el as HTMLElement).style.pointerEvents === 'none'
    );

    expect(overlayAfter).toBeUndefined();
    expect(document.body.style.userSelect).toBe('text');
  });

  it('overlay is not created when column is not resizable', () => {
    const { container } = render(<Harness />);
    const ths = container.querySelectorAll('thead th');
    expect(ths[2]?.querySelector('div[data-resizing]')).toBeNull();

    const overlayRoot = container.querySelector('[data-table-resize-overlay-root]');
    const children = Array.from(overlayRoot!.children);
    const overlay = children.find(
      (el) =>
        (el as HTMLElement).style.position === 'absolute' &&
        (el as HTMLElement).style.pointerEvents === 'none'
    );
    expect(overlay).toBeUndefined();
  });
});
