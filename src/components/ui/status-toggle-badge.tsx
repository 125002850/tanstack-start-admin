import { DictStatus, getStatusLabel } from '@/constants/enums';
import { Badge } from './badge';

interface StatusToggleBadgeProps {
  status?: string;
  onClick: () => void;
  variant?: 'default' | 'destructive' | 'secondary' | 'outline';
  getVariant?: (isEnabled: boolean) => 'default' | 'destructive' | 'secondary' | 'outline' | undefined;
}

function isEnabledStatus(status?: string): boolean {
  return status === DictStatus.ENABLE || status === 'enable' || status === 'ENABLE';
}

export function StatusToggleBadge({ status, onClick, getVariant }: StatusToggleBadgeProps) {
  const enabled = isEnabledStatus(status);
  const variant = getVariant?.(enabled) ?? (enabled ? undefined : 'destructive');

  return (
    <Badge variant={variant} className='cursor-pointer' onClick={onClick}>
      {getStatusLabel(status)}
    </Badge>
  );
}
