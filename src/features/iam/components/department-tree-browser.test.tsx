import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { buildDepartmentBrowserItems, DepartmentTreeBrowser } from './department-tree-browser';

const DEPARTMENTS = [
  {
    deptId: 1,
    deptCode: 'RD',
    deptName: '研发部',
    children: [{ deptId: 2, deptCode: 'PLATFORM', deptName: '平台组' }]
  }
];

describe('DepartmentTreeBrowser', () => {
  afterEach(cleanup);

  it('builds one all-employees root above the department hierarchy', () => {
    const items = buildDepartmentBrowserItems(DEPARTMENTS);

    expect(items).toMatchObject([
      {
        value: 'all',
        label: '全部员工',
        children: [
          {
            value: '1',
            label: '研发部',
            children: [{ value: '2', label: '平台组' }]
          }
        ]
      }
    ]);
  });

  it('searches departments and reports the selected department id', async () => {
    const user = userEvent.setup();
    const onValueChange = vi.fn();
    render(
      <DepartmentTreeBrowser departments={DEPARTMENTS} value={null} onValueChange={onValueChange} />
    );

    await user.type(screen.getByRole('textbox', { name: '搜索部门' }), '平台');
    await user.click(await screen.findByRole('treeitem', { name: '平台组' }));

    expect(onValueChange).toHaveBeenCalledWith(2);
  });
});
