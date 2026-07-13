export const dictTypes = [
  'IAM_OPERATION_LOG_ACTION',
  'IAM_LOGIN_EVENT_TYPE',
  'IAM_LOGIN_RESULT',
  'IAM_LOGIN_FAILURE_REASON',
  'EXPORT_RECORD_STATUS'
] as const;

export type DictTypes = (typeof dictTypes)[number];
