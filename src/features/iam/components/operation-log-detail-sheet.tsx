import { useQuery } from '@tanstack/react-query';

import { FieldItem } from '@/components/ui/detail-field';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { iamOperationLogDetailQueryOptions } from '@/lib/api/clients/service';
import type { OperationLogRspDTO } from '@/lib/api/clients/service';

import { formatOptionalDateTime } from '../lib/format';

function OperationLogDetailSheet({
  log,
  open,
  onOpenChange
}: {
  log?: OperationLogRspDTO | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const logId = log?.logId;
  const detailQuery = useQuery({
    ...iamOperationLogDetailQueryOptions({ logId: logId ?? 0 }),
    enabled: open && logId != null
  });
  const detail = detailQuery.data ?? log;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex max-w-2xl flex-col sm:max-w-2xl'>
        <SheetHeader>
          <SheetTitle>操作日志详情</SheetTitle>
          <SheetDescription>{detail?.module ?? '-'}</SheetDescription>
        </SheetHeader>
        <div className='grid min-h-0 flex-1 gap-3 overflow-auto sm:grid-cols-2'>
          <FieldItem label='日志ID' value={detail?.logId} />
          <FieldItem label='操作人ID' value={detail?.operatorId} />
          <FieldItem label='用户名' value={detail?.operatorUsername} />
          <FieldItem label='员工姓名' value={detail?.operatorStaffName} />
          <FieldItem label='模块' value={detail?.module} />
          <FieldItem label='动作' value={detail?.action} />
          <FieldItem label='结果' value={detail?.success ? '成功' : '失败'} />
          <FieldItem label='耗时' value={detail?.costMillis == null ? '-' : `${detail.costMillis} ms`} />
          <FieldItem label='方法' value={detail?.httpMethod} />
          <FieldItem label='IP' value={detail?.ip} />
          <FieldItem label='路径' value={detail?.requestPath} valueMaxLines={2} />
          <FieldItem label='时间' value={formatOptionalDateTime(detail?.operationTime)} />
          <FieldItem label='请求摘要' value={detail?.requestSummary} valueMaxLines={2} />
          <FieldItem label='响应摘要' value={detail?.responseSummary} valueMaxLines={2} />
          <FieldItem label='错误信息' value={detail?.errorMessage} valueMaxLines={2} />
          <FieldItem label='User Agent' value={detail?.userAgent} valueMaxLines={2} />
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default OperationLogDetailSheet;
