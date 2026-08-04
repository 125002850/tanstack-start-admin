import type * as React from 'react';
import { DictText } from '@/components/dictionary/dictionary-scope';
import { Badge } from '@/components/ui/badge';
import { nullableDateTime, nullableText } from '@/lib/formatters/display';
import { BOOLEAN_RESULT_OPTIONS } from './constants';

type BadgeVariant = React.ComponentProps<typeof Badge>['variant'];

function optionLabel(options: readonly { value: string; label: string }[], value?: string | null) {
  return options.find((option) => option.value === value)?.label ?? nullableText(value);
}

export function statusVariant(status?: string | null): BadgeVariant {
  return status === 'ENABLED' ? 'default' : 'destructive';
}

export function nextStatus(status?: string | null): 'ENABLED' | 'DISABLED' {
  return status === 'ENABLED' ? 'DISABLED' : 'ENABLED';
}

export function StatusBadge({ status }: { status?: string | null }) {
  return (
    <Badge variant={statusVariant(status)}>
      <DictText typeCode='IAM_STATUS' value={status} />
    </Badge>
  );
}

export function MenuTypeBadge({ type }: { type?: string | null }) {
  const variant: BadgeVariant =
    type === 'BUTTON' ? 'secondary' : type === 'DIR' ? 'outline' : 'default';
  return (
    <Badge variant={variant}>
      <DictText typeCode='IAM_MENU_TYPE' value={type} />
    </Badge>
  );
}

export function DataScopeBadge({ type }: { type?: string | null }) {
  return (
    <Badge variant='outline'>
      <DictText typeCode='IAM_DATA_SCOPE_TYPE' value={type} />
    </Badge>
  );
}

export function LoginResultBadge({
  result,
  getLabel
}: {
  result?: string | null;
  getLabel?: (code: string) => string;
}) {
  return (
    <Badge variant={result === 'SUCCESS' ? 'default' : 'destructive'}>
      {result && getLabel ? (
        getLabel(result)
      ) : (
        <DictText typeCode='IAM_LOGIN_RESULT' value={result} />
      )}
    </Badge>
  );
}

export function BooleanResultBadge({ value }: { value?: boolean | null }) {
  const text = optionLabel(BOOLEAN_RESULT_OPTIONS, String(value));
  return <Badge variant={value ? 'default' : 'destructive'}>{text}</Badge>;
}

export function formatOptionalDateTime(value?: string | null) {
  return nullableDateTime(value);
}
