import * as React from 'react';
import { useQuery } from '@tanstack/react-query';

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet';
import { detailExportRecordQueryOptions, type ExportRecordRspDTO } from '@/lib/api/clients/service';

import { nullableDateTime, nullableFileSize, nullableText } from '@/lib/display-formatters';

function DetailItem({ label, value }: { label: string; value: React.ReactNode }) {
  const displayValue = value === null || value === undefined || value === '' ? '-' : value;

  return (
    <div className='grid grid-cols-[96px_minmax(0,1fr)] gap-3 text-sm'>
      <span className='text-muted-foreground'>{label}</span>
      <span className='min-w-0 break-words'>{displayValue}</span>
    </div>
  );
}

interface ExportRecordDetailSheetProps {
  data: ExportRecordRspDTO;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  getStatusLabel: (record: ExportRecordRspDTO) => string;
}

export function ExportRecordDetailSheet({
  data,
  open,
  onOpenChange,
  getStatusLabel
}: ExportRecordDetailSheetProps) {
  const recordId = data.recordId ?? 0;
  const detailQuery = useQuery({
    ...detailExportRecordQueryOptions({ recordId }),
    enabled: open && recordId > 0
  });
  const detail = detailQuery.data ?? data;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className='flex w-full max-w-xl flex-col sm:max-w-xl'>
        <SheetHeader>
          <SheetTitle>导出详情</SheetTitle>
          <SheetDescription>查看导出任务状态、文件信息和查询摘要。</SheetDescription>
        </SheetHeader>
        <div className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1'>
          <DetailItem label='记录ID' value={nullableText(detail.recordId)} />
          <DetailItem label='文件名' value={nullableText(detail.fileName)} />
          <DetailItem label='导出业务' value={nullableText(detail.exportBizName)} />
          <DetailItem label='业务编码' value={nullableText(detail.exportBizCode)} />
          <DetailItem label='状态' value={getStatusLabel(detail)} />
          <DetailItem label='文件类型' value={nullableText(detail.fileType)} />
          <DetailItem label='内容类型' value={nullableText(detail.contentType)} />
          <DetailItem label='文件大小' value={nullableFileSize(detail.fileSize)} />
          <DetailItem label='下载次数' value={detail.downloadCount ?? 0} />
          <DetailItem label='创建时间' value={nullableDateTime(detail.createTime)} />
          <DetailItem label='完成时间' value={nullableDateTime(detail.finishedTime)} />
          <DetailItem label='查询摘要' value={nullableText(detail.querySnapshotSummary)} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
