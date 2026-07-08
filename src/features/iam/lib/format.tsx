import type * as React from 'react';
import { Badge } from '@/components/ui/badge';
import { nullableDateTime, nullableText } from '@/lib/display-formatters';
import { BOOLEAN_RESULT_OPTIONS, DATA_SCOPE_OPTIONS, ENABLE_STATUS_OPTIONS, LOGIN_RESULT_OPTIONS, MENU_TYPE_OPTIONS } from './constants';

type BadgeVariant = React.ComponentProps<typeof Badge>['variant'];

function optionLabel(options: readonly { value: string; label: string }[], value?: string | null) {
  return options.find((option) => option.value === value)?.label ?? nullableText(value);
}

export function statusLabel(status?: string | null) {
  return optionLabel(ENABLE_STATUS_OPTIONS, status);
}

export function statusVariant(status?: string | null): BadgeVariant {
  return status === 'ENABLED' ? 'default' : 'destructive';
}

export function nextStatus(status?: string | null): 'ENABLED' | 'DISABLED' {
  return status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
}

export function StatusBadge({ status }: { status?: string | null }) {
  return <Badge variant={statusVariant(status)}>{statusLabel(status)}</Badge>;
}

export function menuTypeLabel(type?: string | null) {
  return optionLabel(MENU_TYPE_OPTIONS, type);
}

export function MenuTypeBadge({ type }: { type?: string | null }) {
  const variant: BadgeVariant = type === 'BUTTON' ? 'secondary' : type === 'DIR' ? 'outline' : 'default';
  return <Badge variant={variant}>{menuTypeLabel(type)}</Badge>;
}

export function dataScopeLabel(type?: string | null) {
  return optionLabel(DATA_SCOPE_OPTIONS, type);
}

export function DataScopeBadge({ type }: { type?: string | null }) {
  return <Badge variant='outline'>{dataScopeLabel(type)}</Badge>;
}

export function loginResultLabel(result?: string | null) {
  return optionLabel(LOGIN_RESULT_OPTIONS, result);
}

export function LoginResultBadge({ result }: { result?: string | null }) {
  return <Badge variant={result === 'SUCCESS' ? 'default' : 'destructive'}>{loginResultLabel(result)}</Badge>;
}

export function BooleanResultBadge({ value }: { value?: boolean | null }) {
  const text = optionLabel(BOOLEAN_RESULT_OPTIONS, String(value));
  return <Badge variant={value ? 'default' : 'destructive'}>{text}</Badge>;
}

export function formatOptionalDateTime(value?: string | null) {
  return nullableDateTime(value);
}
