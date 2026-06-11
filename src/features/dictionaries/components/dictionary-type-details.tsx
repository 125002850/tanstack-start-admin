import * as React from 'react';

import { Icons } from '@/components/icons';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

import type { DictionaryTypeRecord } from '../api/types';

interface DictionaryTypeDetailsProps {
  record: DictionaryTypeRecord | null;
  onEdit: () => void;
  onDelete?: () => void;
}

export function DictionaryTypeDetails({ record, onEdit, onDelete }: DictionaryTypeDetailsProps) {
  if (!record) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>请选择字典类型</CardTitle>
          <CardDescription>左侧选择后可查看并维护当前字典类型</CardDescription>
        </CardHeader>
        <CardContent>
          <div className='text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm'>
            暂无可展示的字典类型详情
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className='flex flex-wrap items-start justify-between gap-3'>
          <div className='space-y-1'>
            <CardTitle>{record.dictTypeName}</CardTitle>
            <CardDescription>{`编码：${record.dictTypeCode}`}</CardDescription>
          </div>

          <div className='flex items-center gap-2'>
            <Button variant='outline' size='sm' onClick={onEdit}>
              <Icons.edit className='size-4' />
              编辑
            </Button>
            {onDelete && (
              <Button variant='destructive' size='sm' onClick={onDelete}>
                <Icons.trash className='size-4' />
                删除
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        <DetailField label='名称' value={record.dictTypeName} />
        <DetailField label='状态' value={record.status === 'DISABLE' ? '停用' : '启用'} />
        <DetailField label='编码' value={record.dictTypeCode} />
        <DetailField label='创建人' value={record.createBy} />
        <DetailField label='创建时间' value={record.createTime} />
        <DetailField label='更新人' value={record.updateBy} />
        <DetailField label='更新时间' value={record.updateTime} />
      </CardContent>
    </Card>
  );
}

function DetailField({ label, value }: { label: string; value?: string | number }) {
  return (
    <div className='space-y-1 rounded-lg border bg-muted/20 px-4 py-3'>
      <div className='text-muted-foreground text-xs tracking-[0.18em]'>{label}</div>
      <div className='text-sm font-medium'>{value || '-'}</div>
    </div>
  );
}
