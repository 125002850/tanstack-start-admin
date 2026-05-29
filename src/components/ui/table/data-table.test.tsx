import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import {
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  getPaginationRowModel,
} from '@tanstack/react-table'
import { DataTable } from '@/components/ui/table/data-table'
import * as React from 'react'

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({
    count,
    enabled,
    estimateSize,
  }: {
    count: number
    enabled?: boolean
    estimateSize: () => number
  }) => {
    const size = estimateSize()
    const virtualItems = enabled
      ? Array.from({ length: Math.min(count, 4) }, (_, index) => ({
          index,
          start: index * size,
          size,
        }))
      : []

    return {
      getVirtualItems: () => virtualItems,
      getTotalSize: () => count * size,
      scrollToIndex: vi.fn(),
      measure: vi.fn(),
    }
  },
}))

// Mock ScrollArea — avoids Radix instance conflicts in jsdom
vi.mock('@/components/ui/scroll-area', () => ({
  ScrollArea: ({
    children,
    viewportRef,
    viewportProps,
  }: {
    children: React.ReactNode
    viewportRef?: React.Ref<HTMLDivElement>
    viewportProps?: Record<string, unknown>
  }) => {
    const id = viewportProps?.['data-scroll-target-id'] as string | undefined
    return (
      <div data-testid='scroll-area'>
        <div ref={viewportRef} data-scroll-target-id={id} data-testid='scroll-viewport'>
          {children}
        </div>
      </div>
    )
  },
  ScrollBar: () => null,
}))

type TestRow = { id: number; name: string }

const COLUMNS: ColumnDef<TestRow>[] = [
  { accessorKey: 'id', header: 'ID' },
  { accessorKey: 'name', header: 'Name' },
]

function makeRows(count: number): TestRow[] {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }))
}

function useHarnessTable(data: TestRow[], pageSize = 10) {
  return useReactTable({
    data,
    columns: COLUMNS,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize, pageIndex: 0 } },
  })
}

function Harness({
  rows,
  virtualization,
}: {
  rows: TestRow[]
  virtualization?: { enabled: boolean; estimateRowHeight?: number; overscan?: number; rowCountThreshold?: number }
}) {
  const table = useHarnessTable(rows, rows.length)
  return <DataTable table={table} virtualization={virtualization} />
}

afterEach(cleanup)

describe('DataTable body', () => {
  it('renders all rows in normal mode', () => {
    const rows = makeRows(10)
    render(<Harness rows={rows} />)
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 10')).toBeInTheDocument()
  })

  it('renders empty message when no rows', () => {
    render(<Harness rows={[]} />)
    expect(screen.getByText('暂无数据')).toBeInTheDocument()
  })

  it('passes scrollTargetId to viewport', () => {
    const rows = makeRows(5)
    function HarnessWithScrollId() {
      const table = useHarnessTable(rows, 5)
      return <DataTable table={table} scrollTargetId='test-table' />
    }
    render(<HarnessWithScrollId />)
    expect(screen.getByTestId('scroll-viewport')).toHaveAttribute('data-scroll-target-id', 'test-table')
  })

  it('renders all rows when virtualization is disabled', () => {
    const rows = makeRows(150)
    render(<Harness rows={rows} />)
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 150')).toBeInTheDocument()
  })

  it('renders all rows when below threshold', () => {
    const rows = makeRows(50)
    render(
      <Harness
        rows={rows}
        virtualization={{ enabled: true, rowCountThreshold: 100 }}
      />,
    )
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 50')).toBeInTheDocument()
  })

  it('renders fewer DOM rows when virtualizing above threshold', () => {
    const rows = makeRows(200)
    const { container } = render(
      <Harness
        rows={rows}
        virtualization={{ enabled: true, rowCountThreshold: 10, overscan: 0 }}
      />,
    )
    // Virtual scroll with absolute positioning: some rows are rendered, but not all 200
    const rowElements = screen.queryAllByText(/^Item \d+$/)
    expect(rowElements.length).toBeLessThan(200)

    const virtualRows = container.querySelectorAll('tbody[data-virtual-enabled="true"] tr[data-index]')
    expect(virtualRows.length).toBeGreaterThan(0)
    expect((virtualRows[0] as HTMLTableRowElement).style.height).toBe('56px')
  })

})
