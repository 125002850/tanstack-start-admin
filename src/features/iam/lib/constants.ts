export const IAM_PERMISSIONS = {
  staff: {
    query: 'iam:staff:query',
    create: 'iam:staff:create',
    update: 'iam:staff:update',
    delete: 'iam:staff:delete',
    resetPassword: 'iam:staff:password:reset'
  },
  dept: {
    manage: 'iam:dept:manage'
  },
  role: {
    manage: 'iam:role:manage'
  },
  menu: {
    manage: 'iam:menu:manage'
  },
  log: {
    loginQuery: 'iam:log:login:query',
    operationQuery: 'iam:log:operation:query'
  }
} as const;

export const ENABLE_STATUS_OPTIONS = [
  { value: 'ENABLED', label: '启用' },
  { value: 'DISABLED', label: '停用' }
] as const;

export const MENU_TYPE_OPTIONS = [
  { value: 'DIR', label: '目录' },
  { value: 'MENU', label: '菜单' },
  { value: 'BUTTON', label: '按钮' }
] as const;

export const DATA_SCOPE_OPTIONS = [
  { value: 'ALL', label: '全部数据' },
  { value: 'DEPT_AND_CHILD', label: '本部门及下级' },
  { value: 'DEPT_ONLY', label: '仅本部门' },
  { value: 'SELF', label: '仅本人' },
  { value: 'CUSTOM_DEPT', label: '自定义部门' }
] as const;

export const LOGIN_RESULT_OPTIONS = [
  { value: 'SUCCESS', label: '成功' },
  { value: 'FAIL', label: '失败' }
] as const;

export const BOOLEAN_RESULT_OPTIONS = [
  { value: 'true', label: '成功' },
  { value: 'false', label: '失败' }
] as const;
