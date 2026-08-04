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

// 枚举的展示文案来自后端字典；前端只保留参与业务判断所需的稳定 code。
export const IAM_STATUS_CODES = ['ENABLED', 'DISABLED'] as const;
export const IAM_MENU_TYPE_CODES = ['DIR', 'MENU', 'BUTTON'] as const;
export const IAM_DATA_SCOPE_TYPE_CODES = [
  'ALL',
  'DEPT_AND_CHILD',
  'DEPT_ONLY',
  'SELF',
  'CUSTOM_DEPT'
] as const;

export const BOOLEAN_RESULT_OPTIONS = [
  { value: 'true', label: '成功' },
  { value: 'false', label: '失败' }
] as const;
