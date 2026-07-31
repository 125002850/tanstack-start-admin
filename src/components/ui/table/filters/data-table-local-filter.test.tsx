import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Column } from '@tanstack/react-table';
import * as React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataTableLocalFilter } from './data-table-local-filter';
import type {
  DataTableLocalColumnFilter,
  DataTableLocalFilterOption,
  DataTableLocalFilteringRuntime
} from '@/types/data-table';

vi.mock('@tanstack/react-virtual', () => ({
  useVirtualizer: ({ count, estimateSize }: { count: number; estimateSize: () => number }) => ({
    getTotalSize: () => count * estimateSize(),
    getVirtualItems: () =>
      Array.from({ length: count }, (_, index) => ({
        index,
        key: index,
        size: estimateSize(),
        start: index * estimateSize()
      }))
  })
}));

interface TestRow {
  name: string;
}

const OPTIONS: DataTableLocalFilterOption[] = [
  { key: 'string:Alpha', label: 'Alpha' },
  { key: 'string:Beta', label: 'Beta' }
];

function createColumn() {
  return {
    id: 'name',
    columnDef: { meta: { localFilter: { variant: 'text' } } }
  } as unknown as Column<TestRow, unknown>;
}

function Harness({ options = OPTIONS }: { options?: DataTableLocalFilterOption[] }) {
  const [filters, setFilters] = React.useState<DataTableLocalColumnFilter[]>([]);
  const runtime = React.useMemo<DataTableLocalFilteringRuntime>(
    () => ({
      filters,
      getFilterOptions: () => options,
      getFilterValue: (columnId) => filters.find((filter) => filter.id === columnId)?.value,
      setFilterValue: (columnId, value) =>
        setFilters(
          value
            ? [...filters.filter((filter) => filter.id !== columnId), { id: columnId, value }]
            : filters.filter((filter) => filter.id !== columnId)
        ),
      reset: () => setFilters([])
    }),
    [filters, options]
  );

  return (
    <>
      <DataTableLocalFilter column={createColumn()} runtime={runtime} title='名称' />
      <output data-testid='filter-state'>{JSON.stringify(filters)}</output>
    </>
  );
}

afterEach(cleanup);

describe('DataTableLocalFilter', () => {
  it('applies checkbox changes immediately and exposes active state', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '筛选当前页：名称' }));

    expect(screen.getByRole('checkbox', { name: 'Alpha' })).toBeChecked();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Alpha' }));

    expect(screen.getByRole('button', { name: '筛选当前页：名称' })).toHaveAttribute(
      'data-active',
      'true'
    );
    expect(screen.getByTestId('filter-state')).toHaveTextContent('string:Beta');
    expect(screen.getByTestId('filter-state')).not.toHaveTextContent('string:Alpha');
  });

  it('uses search only to narrow the option list', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '筛选当前页：名称' }));

    fireEvent.change(screen.getByRole('textbox', { name: '搜索名称筛选值' }), {
      target: { value: 'beta' }
    });

    await waitFor(() => {
      expect(screen.queryByRole('checkbox', { name: 'Alpha' })).not.toBeInTheDocument();
    });
    expect(screen.getByRole('checkbox', { name: 'Beta' })).toBeChecked();
    expect(screen.getByTestId('filter-state')).toHaveTextContent('[]');
  });

  it('selects only matching options when Enter confirms a search', async () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '筛选当前页：名称' }));
    const search = screen.getByRole('textbox', { name: '搜索名称筛选值' });

    fireEvent.change(search, { target: { value: 'beta' } });
    await waitFor(() => {
      expect(screen.queryByRole('checkbox', { name: 'Alpha' })).not.toBeInTheDocument();
    });
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(screen.getByTestId('filter-state')).toHaveTextContent('string:Beta');
    expect(screen.getByTestId('filter-state')).not.toHaveTextContent('string:Alpha');
  });

  it('supports partial select-all and normalizes all selected back to no filter', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '筛选当前页：名称' }));

    fireEvent.click(screen.getByRole('checkbox', { name: 'Alpha' }));
    expect(screen.getByRole('checkbox', { name: '全选名称筛选值' })).toHaveAttribute(
      'data-state',
      'indeterminate'
    );

    fireEvent.click(screen.getByRole('checkbox', { name: '全选名称筛选值' }));

    expect(screen.getByRole('button', { name: '筛选当前页：名称' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByTestId('filter-state')).toHaveTextContent('[]');
  });

  it('keeps an empty selection as an active filter', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '筛选当前页：名称' }));

    fireEvent.click(screen.getByRole('checkbox', { name: 'Alpha' }));
    fireEvent.click(screen.getByRole('checkbox', { name: 'Beta' }));

    expect(screen.getByRole('button', { name: '筛选当前页：名称' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByTestId('filter-state')).toHaveTextContent('"selectedKeys":[]');
  });
});
