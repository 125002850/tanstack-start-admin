import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DeptRspDTO } from '@/lib/api/clients/service';
import DeptDataTable from './dept-data-table';

vi.mock('@/components/ui/table/toolbar/data-table-view-options', () => ({
  DataTableViewOptions: () => null
}));

const DEPT_TREE: DeptRspDTO[] = [
  {
    deptId: 1,
    deptName: '总部',
    deptCode: 'HQ',
    sortOrder: 1,
    status: 'ENABLED',
    children: [
      {
        deptId: 2,
        parentId: 1,
        deptName: '研发部',
        deptCode: 'RD',
        sortOrder: 1,
        status: 'ENABLED',
        children: [
          {
            deptId: 3,
            parentId: 2,
            deptName: '平台组',
            deptCode: 'PLATFORM',
            sortOrder: 1,
            status: 'ENABLED'
          }
        ]
      }
    ]
  }
];

const callbacks = {
  onKeywordChange: vi.fn(),
  onRefresh: vi.fn(),
  onAddDept: vi.fn(),
  onEditDept: vi.fn(),
  onToggleStatus: vi.fn(),
  onDeleteDept: vi.fn(),
  onViewDetail: vi.fn()
};

function renderDeptDataTable(keyword = '') {
  return render(
    <DeptDataTable
      rows={DEPT_TREE}
      totalCount={3}
      isFetching={false}
      keyword={keyword}
      canManageDept={false}
      {...callbacks}
    />
  );
}

afterEach(cleanup);

describe('DeptDataTable tree expansion', () => {
  it('不暴露无法提交到部门树接口的表头排序状态', () => {
    renderDeptDataTable();

    for (const header of screen.getAllByRole('columnheader')) {
      expect(header).not.toHaveAttribute('aria-sort');
    }
  });

  it('默认展示完整部门树，并允许单独折叠父部门', async () => {
    const user = userEvent.setup();
    renderDeptDataTable();

    expect(screen.getByText('研发部')).toBeInTheDocument();
    expect(screen.getByText('平台组')).toBeInTheDocument();

    const headquartersToggle = screen.getByRole('button', { name: '折叠 总部' });
    expect(headquartersToggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(headquartersToggle);

    expect(screen.queryByText('研发部')).not.toBeInTheDocument();
    expect(screen.queryByText('平台组')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '展开 总部' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('使用表格操作区按钮切换全部部门的展开状态', async () => {
    const user = userEvent.setup();
    renderDeptDataTable();

    const toolbar = screen.getByRole('toolbar', { name: '部门树操作' });
    const tableActions = screen.getByRole('group', { name: '表格操作' });
    expect(within(toolbar).queryByRole('button', { name: /折叠全部部门/ })).not.toBeInTheDocument();

    await user.click(within(tableActions).getByRole('button', { name: /折叠全部部门/ }));

    expect(screen.queryByText('研发部')).not.toBeInTheDocument();
    expect(within(tableActions).getByRole('button', { name: /展开全部部门/ })).toBeEnabled();

    await user.click(within(tableActions).getByRole('button', { name: /展开全部部门/ }));

    expect(screen.getByText('研发部')).toBeInTheDocument();
    expect(screen.getByText('平台组')).toBeInTheDocument();
  });

  it('输入搜索词后自动展开此前折叠的部门路径', async () => {
    const user = userEvent.setup();
    const view = renderDeptDataTable();

    await user.click(screen.getByRole('button', { name: '折叠 总部' }));
    expect(screen.queryByText('研发部')).not.toBeInTheDocument();

    view.rerender(
      <DeptDataTable
        rows={DEPT_TREE}
        totalCount={3}
        isFetching={false}
        keyword='研发'
        canManageDept={false}
        {...callbacks}
      />
    );

    expect(await screen.findByText('研发部')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '折叠 总部' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });
});
