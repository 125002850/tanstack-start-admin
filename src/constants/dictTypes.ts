export const dictTypes = [
  'ENABLE_STATUS',
  'YES_NO',
  'IAM_STATUS',
  'IAM_DATA_SCOPE_TYPE',
  'IAM_MENU_TYPE',
  'IAM_OPERATION_LOG_ACTION',
  'IAM_OPERATION_LOG_MODULE',
  'IAM_LOGIN_EVENT_TYPE',
  'IAM_LOGIN_RESULT',
  'IAM_LOGIN_FAILURE_REASON',
  'EXPORT_RECORD_STATUS'
] as const;

export type DictTypes = (typeof dictTypes)[number];
