export function operationAuditEnumCode(value: string | undefined): string {
  return value?.trim() ?? '';
}
export function operationAuditEnumLabel(value: string | undefined): string {
  return operationAuditEnumCode(value) || '-';
}
