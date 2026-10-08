export function operationAuditEnumCode(value: string | undefined): string {
  return value?.trim() ?? '';
}
export function operationAuditEnumLabel(value: string | undefined): string {
  return operationAuditEnumCode(value) || '-';
}

export function isOperationAuditFailed(value: string | undefined): boolean {
  return operationAuditEnumCode(value).toLowerCase() === 'failed';
}
export function isOperationAuditSuccess(value: string | undefined): boolean {
  return operationAuditEnumCode(value).toLowerCase() === 'success';
}
