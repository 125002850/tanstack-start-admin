import * as React from 'react';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';

import type { DictionaryTypeMutationPayload, DictionaryTypeRecord } from '../api/types';

export const STATUS_OPTIONS = [
  { value: 'ENABLED', label: '启用' },
  { value: 'DISABLED', label: '停用' }
] as const;

interface DictionaryTypeDetailsProps {
  record: DictionaryTypeRecord | null;
  draft: DictionaryTypeMutationPayload | null;
  isEditing: boolean;
  pending: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: () => Promise<void>;
  onDraftChange: (
    updater: (current: DictionaryTypeMutationPayload) => DictionaryTypeMutationPayload
  ) => void;
}

export function DictionaryTypeDetails({
  record,
  draft,
  isEditing,
  pending,
  onStartEdit,
  onCancelEdit,
  onSave,
  onDraftChange
}: DictionaryTypeDetailsProps) {
  if (!record || !draft) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>请选择字典类型</CardTitle>
          <CardDescription>左侧选择后可查看并维护当前字典类型。</CardDescription>
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
            <Badge variant={record.status === 'DISABLED' ? 'secondary' : 'default'}>
              {record.status === 'DISABLED' ? '停用' : '启用'}
            </Badge>
            {isEditing ? (
              <>
                <Button variant='outline' size='sm' onClick={onCancelEdit}>
                  取消
                </Button>
                <Button size='sm' isLoading={pending} onClick={() => void onSave()}>
                  保存
                </Button>
              </>
            ) : (
              <Button variant='outline' size='sm' onClick={onStartEdit}>
                <Icons.edit className='size-4' />
                编辑
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
        {isEditing ? (
          <>
            <EditableField label='字典名称'>
              <Input
                value={draft.dictTypeName}
                onChange={(event) =>
                  onDraftChange((current) => ({
                    ...current,
                    dictTypeName: event.target.value
                  }))
                }
              />
            </EditableField>

            <EditableField label='状态'>
              <Select
                value={draft.status ?? 'ENABLED'}
                onValueChange={(value) =>
                  onDraftChange((current) => ({
                    ...current,
                    status: value
                  }))
                }
              >
                <SelectTrigger className='w-full'>
                  <SelectValue placeholder='请选择状态' />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </EditableField>
          </>
        ) : (
          <>
            <DetailField label='名称' value={record.dictTypeName} />
            <DetailField label='状态' value={record.status === 'DISABLED' ? '停用' : '启用'} />
          </>
        )}

        <DetailField label='编码' value={record.dictTypeCode} />
        <DetailField label='创建人' value={record.createdBy} />
        <DetailField label='创建时间' value={record.createdAt} />
        <DetailField label='更新人' value={record.updatedBy} />
        <DetailField label='更新时间' value={record.updatedAt} />
      </CardContent>
    </Card>
  );
}

function DetailField({ label, value }: { label: string; value?: string }) {
  return (
    <div className='space-y-1 rounded-lg border bg-muted/20 px-4 py-3'>
      <div className='text-muted-foreground text-xs tracking-[0.18em]'>{label}</div>
      <div className='text-sm font-medium'>{value || '-'}</div>
    </div>
  );
}

function EditableField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className='space-y-2 rounded-lg border bg-muted/20 px-4 py-3'>
      <div className='text-muted-foreground text-xs tracking-[0.18em]'>{label}</div>
      {children}
    </div>
  );
}
