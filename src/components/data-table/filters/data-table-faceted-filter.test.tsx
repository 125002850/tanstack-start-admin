import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { Column } from '@tanstack/react-table';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DataTableFacetedFilter } from './data-table-faceted-filter';

afterEach(cleanup);
beforeEach(() => {
  Element.prototype.hasPointerCapture ??= vi.fn(() => false);
  Element.prototype.setPointerCapture ??= vi.fn();
  Element.prototype.releasePointerCapture ??= vi.fn();
  Element.prototype.scrollIntoView ??= vi.fn();
});

describe('DataTableFacetedFilter', () => {
  it('supports a required controlled filter without a column', () => {
    function Harness() {
      const [value, setValue] = useState(['crm']);
      return (
        <DataTableFacetedFilter
          title='业务系统'
          value={value}
          onValueChange={(next) => setValue(next ?? [])}
          clearable={false}
          options={[
            { value: 'crm', label: 'CRM' },
            { value: 'wms', label: 'WMS' }
          ]}
        />
      );
    }
    const { container } = render(<Harness />);
    expect(container.querySelector('[data-filter-clear]')).toBeNull();
    expect(screen.queryByText('清除筛选')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '业务系统' }));
    fireEvent.click(screen.getByRole('option', { name: 'WMS' }));
    expect(screen.getByRole('button', { name: /业务系统/ })).toHaveTextContent('WMS');
    fireEvent.click(screen.getByRole('button', { name: '业务系统' }));
    fireEvent.click(screen.getByRole('option', { name: 'WMS' }));
    expect(screen.getByRole('button', { name: /业务系统/ })).toHaveTextContent('WMS');
  });

  it('searches option keywords and clears an optional single selection', () => {
    function Harness() {
      const [value, setValue] = useState<string[]>();
      return (
        <>
          <DataTableFacetedFilter
            title='状态'
            value={value ?? []}
            onValueChange={setValue}
            options={[
              { value: 'enabled', label: '启用', keywords: ['可用'] },
              { value: 'disabled', label: '停用' }
            ]}
          />
          <output aria-label='当前筛选值'>{JSON.stringify(value ?? [])}</output>
        </>
      );
    }
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: '状态' }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: '可用' } });
    expect(screen.queryByRole('option', { name: '停用' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('option', { name: '启用' }));
    expect(screen.getByLabelText('当前筛选值')).toHaveTextContent('["enabled"]');
    expect(screen.queryByRole('option')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '状态' }));
    fireEvent.click(screen.getByRole('option', { name: '清除筛选' }));
    expect(screen.getByLabelText('当前筛选值')).toHaveTextContent('[]');
  });

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
    fireEvent.click(screen.getByRole('button', { name: '状态' }));
    fireEvent.click(screen.getByRole('option', { name: '启用' }));

    expect(screen.getByLabelText('当前筛选值')).toHaveTextContent('["enabled"]');
    expect(screen.getByRole('option', { name: '停用' })).toBeInTheDocument();
  });

  it('searches by hidden option keywords', () => {
    render(
      <DataTableFacetedFilter
        title='员工'
        options={[
          { value: 'E001', label: '张三', keywords: ['E001', 'zhangsan'] },
          { value: 'E002', label: '李四' }
        ]}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: '员工' }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'zhangsan' } });
    expect(screen.getByRole('option', { name: '张三' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: '李四' })).not.toBeInTheDocument();
  });
});
