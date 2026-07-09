// @vitest-environment node

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

const PROJECT_ROOT = process.cwd();

function readProjectFile(path: string) {
  return readFileSync(resolve(PROJECT_ROOT, path), 'utf8');
}

function expectCreateActionInTableActions({
  path,
  rowType,
  actionText
}: {
  path: string;
  rowType: string;
  actionText: string;
}) {
  const source = readProjectFile(path);
  const tableActionsIndex = source.indexOf(`React.useMemo<DataTableAction<${rowType}>[]>`);
  const actionLabelIndex = source.indexOf(`label: '${actionText}'`, tableActionsIndex);

  expect(tableActionsIndex, `${path} missing DataTableAction tableActions`).toBeGreaterThanOrEqual(
    0
  );
  expect(actionLabelIndex, `${path} must define ${actionText} in tableActions`).toBeGreaterThan(
    tableActionsIndex
  );
}

function expectDataTableUsesTableActions(path: string) {
  const source = readProjectFile(path);

  expect(source, `${path} must pass tableActions to DataTable`).toContain(
    'tableActions={tableActions}'
  );
}

function expectActionsBarUsesTableActions(path: string) {
  const source = readProjectFile(path);

  expect(source, `${path} must render DataTableActionsBar with tableActions`).toContain(
    '<DataTableActionsBar table={actionTable} actions={tableActions} />'
  );
}

function expectCreateActionOutsideDataTableToolbar(path: string, actionText: string) {
  const source = readProjectFile(path);

  expect(source, `${path} must not render ${actionText} inside DataTableToolbar`).not.toMatch(
    new RegExp(`<DataTableToolbar[\\s\\S]*${actionText}[\\s\\S]*</DataTableToolbar>`)
  );
}

describe('IAM management tableActions', () => {
  it('keeps staff and role create actions in DataTable tableActions', () => {
    expectCreateActionInTableActions({
      path: 'src/features/iam/components/staff-management-page.tsx',
      rowType: 'StaffRspDTO',
      actionText: '新增员工'
    });
    expectDataTableUsesTableActions('src/features/iam/components/staff-management-page.tsx');
    expectCreateActionOutsideDataTableToolbar(
      'src/features/iam/components/staff-management-page.tsx',
      '新增员工'
    );

    expectCreateActionInTableActions({
      path: 'src/features/iam/components/role-management-page.tsx',
      rowType: 'RoleRspDTO',
      actionText: '新增角色'
    });
    expectDataTableUsesTableActions('src/features/iam/components/role-management-page.tsx');
    expectCreateActionOutsideDataTableToolbar(
      'src/features/iam/components/role-management-page.tsx',
      '新增角色'
    );
  });

  it('keeps department and menu create actions in the shared table actions bar', () => {
    expectCreateActionInTableActions({
      path: 'src/features/iam/components/dept-management-page.tsx',
      rowType: 'DeptRspDTO',
      actionText: '新增部门'
    });
    expectActionsBarUsesTableActions('src/features/iam/components/dept-management-page.tsx');

    expectCreateActionInTableActions({
      path: 'src/features/iam/components/menu-management-page.tsx',
      rowType: 'MenuRspDTO',
      actionText: '新增菜单'
    });
    expectActionsBarUsesTableActions('src/features/iam/components/menu-management-page.tsx');
  });
});
