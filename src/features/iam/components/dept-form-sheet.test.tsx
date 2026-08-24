import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { DeptRspDTO } from '@/lib/api/clients/service';
import { createDictionaryTestWrapper } from '@/test/dictionary-test-provider.fixture';

import DeptFormSheet from './dept-form-sheet';

const DEPARTMENTS: DeptRspDTO[] = [
  {
    deptId: 1,
    deptCode: 'RD',
    deptName: '研发部',
    children: [{ deptId: 2, deptCode: 'SUPPORT', deptName: '支持部' }]
  },
  { deptId: 3, deptCode: 'SALES', deptName: '销售部' }
];

describe('DeptFormSheet', () => {
  afterEach(cleanup);

  it('allows changing the default parent department before creation', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(
      <DeptFormSheet
        open
        onOpenChange={vi.fn()}
        dept={null}
        parent={DEPARTMENTS[0]}
        tree={DEPARTMENTS}
        onSubmit={onSubmit}
      />,
      { wrapper: createDictionaryTestWrapper() }
    );

    const parentTrigger = screen.getByRole('combobox', { name: '上级部门' });
    expect(parentTrigger).toHaveTextContent('研发部');

    await user.click(parentTrigger);
    await user.type(screen.getByRole('searchbox', { name: '搜索部门' }), '支持');
    await user.click(screen.getByRole('treeitem', { name: '支持部' }));
    expect(parentTrigger).toHaveTextContent('支持部');
    expect(parentTrigger).toHaveAttribute('aria-expanded', 'false');

    const [deptCodeInput, deptNameInput] = screen.getAllByRole('textbox');
    await user.type(deptCodeInput!, 'OPS');
    await user.type(deptNameInput!, '运维部');
    await user.click(screen.getByRole('button', { name: '创建部门' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        parentId: 2,
        deptCode: 'OPS',
        deptName: '运维部'
      })
    );
  });

  it('allows changing the parent when editing and excludes the current department branch', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    const currentDepartment = {
      ...DEPARTMENTS[0]!.children![0]!,
      parentId: 1,
      status: 'ENABLED' as const
    };

    render(
      <DeptFormSheet
        open
        onOpenChange={vi.fn()}
        dept={currentDepartment}
        tree={DEPARTMENTS}
        onSubmit={onSubmit}
      />,
      { wrapper: createDictionaryTestWrapper() }
    );

    const parentTrigger = screen.getByRole('combobox', { name: '上级部门' });
    expect(parentTrigger).toHaveTextContent('研发部');

    await user.click(parentTrigger);
    expect(screen.queryByRole('treeitem', { name: '支持部' })).not.toBeInTheDocument();
    await user.click(screen.getByRole('treeitem', { name: '销售部' }));
    await user.click(screen.getByRole('button', { name: '保存修改' }));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        deptId: 2,
        parentId: 3
      })
    );
  });
});
