import type { ComponentProps, ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { DataTableFacetedFilter } from './data-table-faceted-filter';

vi.mock('@/components/ui/popover', () => ({
  Popover: ({ children }: { children: ReactNode }) => children,
  PopoverTrigger: ({ children }: { children: ReactNode }) => children,
  PopoverContent: ({ children }: { children: ReactNode }) => <div>{children}</div>
}));

vi.mock('@/components/ui/command', () => ({
  Command: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandEmpty: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandInput: (props: ComponentProps<'input'>) => <input {...props} />,
  CommandItem: ({
    children,
    onSelect: _onSelect,
    ...props
  }: ComponentProps<'button'> & { onSelect?: () => void }) => (
    <button type='button' {...props}>
      {children}
    </button>
  ),
  CommandList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  CommandSeparator: () => <hr />
}));

describe('DataTableFacetedFilter tree options', () => {
  afterEach(cleanup);

  it('indents hierarchical options according to their depth', () => {
    render(
      <DataTableFacetedFilter
        title='部门'
        options={[
          { value: '1', label: '总部', depth: 0 },
          { value: '2', label: '研发部', depth: 1 }
        ]}
        multiple
      />
    );

    expect(screen.getByRole('button', { name: /总部/ })).toHaveStyle({ paddingLeft: '8px' });
    expect(screen.getByRole('button', { name: /研发部/ })).toHaveStyle({ paddingLeft: '24px' });
  });
});
