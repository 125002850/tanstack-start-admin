import type { ComponentProps } from 'react';
import type { Badge } from '@/components/ui/badge';
import type { ExportRecordRspDTO } from '@/lib/api/clients/service';
import { EXPORT_RECORD_STATUS } from '@/constants/enums';

export function getStatusBadgeVariant(
  record: ExportRecordRspDTO
): ComponentProps<typeof Badge>['variant'] {
  switch (record.status) {
    case EXPORT_RECORD_STATUS.FAILED:
      return 'destructive';
    case EXPORT_RECORD_STATUS.SUCCESS:
      return 'success';
    case EXPORT_RECORD_STATUS.PROCESSING:
      return 'info';
  }

  return 'outline';
}
