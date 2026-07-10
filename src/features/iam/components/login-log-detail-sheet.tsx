import { useQuery } from '@tanstack/react-query';

import { FieldItem } from '@/components/ui/detail-field';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { iamLoginLogDetailQueryOptions } from '@/lib/api/clients/service';
import type { LoginLogRspDTO } from '@/lib/api/clients/service';

import { formatOptionalDateTime } from '../lib/format';

function LoginLogDetailSheet({
  log,
  open,
  onOpenChange
}: {
  log?: LoginLogRspDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const logId = log?.logId;
  const detailQuery = useQuery({
    ...iamLoginLogDetailQueryOptions({ logId: logId ?? 0 }),
    enabled: open && logId != null
  });
  const detail = detailQuery.data ?? log;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex max-w-xl flex-col'>
        <SheetHeader>
          <SheetTitle>登录日志详情</SheetTitle>
          <SheetDescription>{detail?.username ?? '-'}</SheetDescription>
        </SheetHeader>
        <div className='grid min-h-0 flex-1 gap-3 overflow-auto sm:grid-cols-2'>
          <FieldItem label='日志ID' value={detail?.logId} />
          <FieldItem label='员工ID' value={detail?.staffId} />
          <FieldItem label='用户名' value={detail?.username} />
          <FieldItem label='员工姓名' value={detail?.staffName} />
          <FieldItem label='事件' value={detail?.eventType} />
          <FieldItem label='结果' value={detail?.result} />
          <FieldItem label='IP' value={detail?.ip} />
          <FieldItem label='Token ID' value={detail?.tokenId} valueMaxLines={1} />
          <FieldItem label='时间' value={formatOptionalDateTime(detail?.operationTime)} />
          <FieldItem label='失败原因' value={detail?.failureReason} valueMaxLines={2} />
          <FieldItem label='User Agent' value={detail?.userAgent} valueMaxLines={2} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default LoginLogDetailSheet;
