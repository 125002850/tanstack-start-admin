import { cleanup, render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EmployeePickerDialog } from './employee-picker-dialog';

afterEach(cleanup);
const alice = { employeeId: 1, employeeNo: 'A001', employeeName: '张一' };
const bob = { employeeId: 2, employeeNo: 'A002', employeeName: '李二' };
const departments = [{ value: '1', label: '研发部' }];

describe('EmployeePickerDialog', () => {
  it('keeps selections across result pages and renders caller-owned selected details', async () => {
    const confirm = vi.fn();
    const query = vi.fn();
    const props = {
      open: true,
      onOpenChange: vi.fn(),
      value: [],
      departments,
      onConfirm: confirm,
      onQueryChange: query
    };
    const user = userEvent.setup();
    const { rerender } = render(
      <EmployeePickerDialog
        {...props}
        employees={[alice]}
        renderSelectedEmployee={(employee) => <span>详情 {employee.employeeNo}</span>}
      />
    );
    await user.click(screen.getByRole('checkbox', { name: '选择张一' }));
    rerender(
      <EmployeePickerDialog
        {...props}
        employees={[bob]}
        renderSelectedEmployee={(employee) => <span>详情 {employee.employeeNo}</span>}
      />
    );
    expect(
      within(screen.getByRole('region', { name: '已选员工' })).getByText('张一')
    ).toBeVisible();
    expect(screen.getByText('详情 A001')).toBeVisible();
    await user.click(screen.getByRole('checkbox', { name: '选择李二' }));
    await user.click(screen.getByRole('button', { name: '确认选择' }));
    expect(confirm).toHaveBeenCalledWith([alice, bob]);
  });

  it('exposes department/search queries and keeps selected input after a request error', async () => {
    const query = vi.fn();
    const user = userEvent.setup();
    render(
      <EmployeePickerDialog
        open
        onOpenChange={vi.fn()}
        value={[alice]}
        departments={departments}
        employees={[]}
        onQueryChange={query}
        error='目录不可用'
        onRetry={vi.fn()}
      />
    );
    await user.click(screen.getByRole('treeitem', { name: '研发部' }));
    await waitFor(() => expect(query).toHaveBeenLastCalledWith({ departmentId: '1', keyword: '' }));
    expect(screen.getByRole('button', { name: '确认选择' })).toBeDisabled();
    expect(
      within(screen.getByRole('region', { name: '已选员工' })).getByText('张一')
    ).toBeVisible();
  });
});
