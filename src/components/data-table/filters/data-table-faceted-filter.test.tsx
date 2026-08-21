import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Column } from '@tanstack/react-table';
import { useState, type ComponentProps, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataTableFacetedFilter } from './data-table-faceted-filter';

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => children,
  PopoverTrigger: ({ children }: { children: ReactNode }) => children,
  PopoverContent: ({ children, ...props }: ComponentProps<'div'>) => (
    <div {...props}>{children}</div>
  )
}));

vi.mock('@/components/ui/command', () => ({
  Command: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandInput: (props: ComponentProps<'input'>) => <input {...props} />,
  CommandItem: ({
    children,
    onSelect,
    keywords,
    ...props
  }: ComponentProps<'button'> & { keywords?: string[]; onSelect?: () => void }) => (
    <button type='button' data-search-keywords={keywords?.join(',')} onClick={onSelect} {...props}>
      {children}
    </button>
  ),
  CommandList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandSeparator: () => <hr />
}));

afterEach(cleanup);

describe('DataTableFacetedFilter', () => {
  it('keeps flat multi-select options independent', () => {
    function Harness() {
      const [filterValue, setFilterValue] = useState<string[]>();
      const column = {
        getFilterValue: () => filterValue,
        setFilterValue: (value: unknown) => setFilterValue(value as string[] | undefined)
      } as Column<Record<string, never>, string>;

      return (
        <>
          <DataTableFacetedFilter
            column={column}
            title='状态'
            options={[
              { value: 'enabled', label: '启用' },
              { value: 'disabled', label: '停用' }
            ]}
            multiple
          />
          <output aria-label='当前筛选值'>{JSON.stringify(filterValue ?? [])}</output>
        </>
      );
    }

    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '启用' }));

    expect(screen.getByLabelText('当前筛选值')).toHaveTextContent('["enabled"]');
    expect(screen.getByRole('button', { name: '停用' })).toBeInTheDocument();
  });

  it('forwards hidden search keywords to the command item', () => {
    render(
      <DataTableFacetedFilter
        title='员工'
        options={[
          {
            value: 'E001',
            label: '张三',
            keywords: ['E001', 'zhangsan']
          }
        ]}
      />
    );

    expect(screen.getByRole('button', { name: '张三' })).toHaveAttribute(
      'data-search-keywords',
      'E001,zhangsan'
    );
  });
});
