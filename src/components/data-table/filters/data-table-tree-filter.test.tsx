import { useState, type ComponentProps, type ReactNode } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Column } from '@tanstack/react-table';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataTableTreeFilter, dataTableOptionsToTreeItems } from './data-table-tree-filter';

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => children,
  PopoverTrigger: ({ children }: { children: ReactNode }) => children,
  PopoverContent: ({ children, ...props }: ComponentProps<'div'>) => (
    <div {...props}>{children}</div>
  )
}));

afterEach(cleanup);

describe('DataTableTreeFilter', () => {
  const options = [
    { value: 'root', label: '总部', depth: 0 },
    { value: 'research', label: '研发部', depth: 1 },
    { value: 'frontend', label: '前端组', depth: 2 },
    { value: 'operations', label: '运维部', depth: 1 }
  ];

  it('converts ordered depth options into reusable tree items', () => {
    expect(dataTableOptionsToTreeItems(options)).toMatchObject([
      {
        value: 'root',
        children: [
          { value: 'research', children: [{ value: 'frontend' }] },
          { value: 'operations' }
        ]
      }
    ]);
  });

  it('writes cascaded tree selections back to the table column', () => {
    function Harness() {
      const [filterValue, setFilterValue] = useState<string[]>();
      const column = {
        getFilterValue: () => filterValue,
        setFilterValue: (value: unknown) => setFilterValue(value as string[] | undefined)
      } as Column<Record<string, never>, string>;

      return (
        <>
          <DataTableTreeFilter column={column} title='部门' options={options} />
          <output aria-label='当前部门筛选值'>{JSON.stringify(filterValue ?? [])}</output>
        </>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole('treeitem', { name: '研发部，未选中' }));

    expect(screen.getByRole('treeitem', { name: '研发部，已选中' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByRole('treeitem', { name: '总部，部分选中' })).toHaveAttribute(
      'aria-checked',
      'mixed'
    );
    expect(screen.getByLabelText('当前部门筛选值')).toHaveTextContent('["research","frontend"]');
  });

  it('selects nodes independently when selectionMode is independent', () => {
    function Harness() {
      const [filterValue, setFilterValue] = useState<string[]>();
      const column = {
        getFilterValue: () => filterValue,
        setFilterValue: (value: unknown) => setFilterValue(value as string[] | undefined)
      } as Column<Record<string, never>, string>;

      return (
        <>
          <DataTableTreeFilter
            column={column}
            title='部门'
            options={options}
            selectionMode='independent'
          />
          <output aria-label='当前部门筛选值'>{JSON.stringify(filterValue ?? [])}</output>
        </>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole('treeitem', { name: '研发部，未选中' }));

    expect(screen.getByRole('treeitem', { name: '研发部，已选中' })).toHaveAttribute(
      'aria-checked',
      'true'
    );
    expect(screen.getByRole('treeitem', { name: '总部，未选中' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
    expect(screen.getByRole('treeitem', { name: '前端组，未选中' })).toHaveAttribute(
      'aria-checked',
      'false'
    );
    expect(screen.getByLabelText('当前部门筛选值')).toHaveTextContent('["research"]');
  });
});
