import { describe, expect, it } from 'vitest';

import {
  getStaffCellEditRequest,
  getStaffColumns,
  mapStaffTableData,
  staffTableQueryOptions,
  type StaffTableRow
} from './staff-management-page';

describe('staff table query adapter', () => {
  it('maps department and status multi-select conditions to plural API fields', () => {
    const queryOptions = staffTableQueryOptions({
      pageNo: 1,
      pageSize: 20,
      condition: {
        nodeType: 'compose',
        logic: 'AND',
        children: [
          { nodeType: 'text', field: 'deptId', op: 'IN', values: ['10', '20'] },
          { nodeType: 'text', field: 'status', op: 'IN', values: ['ENABLED', 'DISABLED'] }
        ]
      }
    });

    expect(queryOptions.queryKey.at(-1)).toMatchObject({
      deptIds: [10, 20],
      statuses: ['ENABLED', 'DISABLED']
    });
  });
});

describe('staff cell editor adapter', () => {
  const row: StaffTableRow = {
    staffId: 7,
    username: 'zhangsan',
    staffCode: 'S007',
    staffName: '张三',
    deptId: 10,
    deptName: '研发部',
    phone: '13800000000',
    email: 'zhangsan@example.com',
    status: 'ENABLED',
    remark: '测试员工',
    roleIds: [2],
    roles: [{ roleId: 2, roleName: '审计员' }]
  };

  it('normalizes API rows into editable department, status and role values', () => {
    expect(
      mapStaffTableData({
        total: 1,
        list: [
          {
            staffId: 7,
            deptId: 10,
            status: 'ENABLED',
            roles: [{ roleId: 2 }, { roleCode: 'NO_ID' }]
          }
        ]
      })
    ).toEqual({
      total: 1,
      list: [
        {
          staffId: 7,
          deptId: 10,
          status: 'ENABLED',
          roles: [{ roleId: 2 }, { roleCode: 'NO_ID' }],
          roleIds: [2]
        }
      ]
    });
  });

  it('declares phone, department, status and roles with matching cell editors', () => {
    const columns = getStaffColumns(
      () => undefined,
      [{ value: '10', label: '研发部' }],
      [{ value: 10, label: '研发部' }],
      [{ value: 2, label: '审计员' }]
    );
    const editableColumns = columns
      .map((column) => column.meta?.editableCell ?? column.meta?.editableChoice)
      .filter((meta) => meta !== undefined);

    expect(editableColumns).toMatchObject([
      {
        field: 'deptId',
        type: 'select',
        selectionMode: 'single',
        allowEmpty: false
      },
      {
        field: 'phone',
        editor: 'input',
        inputType: 'tel',
        inputMode: 'tel',
        allowEmpty: true
      },
      {
        field: 'status',
        editor: 'switch',
        checkedValue: 'ENABLED',
        uncheckedValue: 'DISABLED',
        allowEmpty: false
      },
      {
        field: 'roleIds',
        type: 'select',
        selectionMode: 'multiple',
        allowEmpty: true
      }
    ]);
  });

  it('routes each editable field to its matching IAM request', () => {
    expect(
      getStaffCellEditRequest(row, {
        rowId: '7',
        field: 'phone',
        previousValue: '13800000000',
        value: '13900000000'
      })
    ).toEqual({
      kind: 'staff',
      request: {
        staffId: 7,
        staffCode: 'S007',
        staffName: '张三',
        deptId: 10,
        phone: '13900000000',
        email: 'zhangsan@example.com',
        avatar: undefined,
        status: 'ENABLED',
        remark: '测试员工'
      }
    });
    expect(
      getStaffCellEditRequest(row, {
        rowId: '7',
        field: 'deptId',
        previousValue: 10,
        value: 20
      })
    ).toEqual({
      kind: 'staff',
      request: {
        staffId: 7,
        staffCode: 'S007',
        staffName: '张三',
        deptId: 20,
        phone: '13800000000',
        email: 'zhangsan@example.com',
        avatar: undefined,
        status: 'ENABLED',
        remark: '测试员工'
      }
    });
    expect(
      getStaffCellEditRequest(row, {
        rowId: '7',
        field: 'status',
        previousValue: 'ENABLED',
        value: 'DISABLED'
      })
    ).toEqual({
      kind: 'status',
      request: { staffId: 7, status: 'DISABLED' }
    });
    expect(
      getStaffCellEditRequest(row, {
        rowId: '7',
        field: 'roleIds',
        previousValue: [2],
        value: [2, 3]
      })
    ).toEqual({
      kind: 'roles',
      request: { staffId: 7, roleIds: [2, 3] }
    });
  });

  it('rejects incomplete full-update payloads before calling the API', () => {
    expect(
      getStaffCellEditRequest(
        { ...row, staffCode: undefined },
        {
          rowId: '7',
          field: 'deptId',
          previousValue: 10,
          value: 20
        }
      )
    ).toBeNull();
  });
});
