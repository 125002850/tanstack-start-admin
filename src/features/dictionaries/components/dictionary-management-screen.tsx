import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type {
  DictionaryItemRecord,
  DictionaryStatus,
  DictionaryTypeRecord
} from '../api/types';

export type { DictionaryItemRecord, DictionaryStatus, DictionaryTypeRecord };

type DictionaryManagementScreenProps = {
  dictionaryTypes: DictionaryTypeRecord[];
  dictionaryItemsByType: Record<string, DictionaryItemRecord[]>;
  selectedCode?: string | null;
  onSelectedCodeChange?: (code: string | null) => void;
  renderDetails?: (record: DictionaryTypeRecord | null) => React.ReactNode;
  renderItemPanel?: (
    record: DictionaryTypeRecord | null,
    items: DictionaryItemRecord[]
  ) => React.ReactNode;
};

function matchesKeyword(record: DictionaryTypeRecord, keyword: string) {
  if (!keyword) {
    return true;
  }

  const normalized = keyword.trim().toLowerCase();
  return (
    record.dictTypeCode.toLowerCase().includes(normalized) ||
    record.dictTypeName.toLowerCase().includes(normalized)
  );
}

function resolveStatusLabel(status?: string) {
  if (!status) {
    return '未知';
  }

  if (status === 'ENABLED') {
    return '启用';
  }

  if (status === 'DISABLED') {
    return '停用';
  }

  return status;
}

export function DictionaryManagementScreen({
  dictionaryTypes,
  dictionaryItemsByType,
  selectedCode,
  onSelectedCodeChange,
  renderDetails,
  renderItemPanel
}: DictionaryManagementScreenProps) {
  const [keyword, setKeyword] = React.useState('');
  const [internalSelectedCode, setInternalSelectedCode] = React.useState<string | null>(
    dictionaryTypes[0]?.dictTypeCode ?? null
  );
  const isControlled = selectedCode !== undefined;

  const filteredTypes = React.useMemo(
    () => dictionaryTypes.filter((record) => matchesKeyword(record, keyword)),
    [dictionaryTypes, keyword]
  );

  const activeSelectedCode = isControlled ? selectedCode : internalSelectedCode;

  React.useEffect(() => {
    const nextSelectedCode =
      filteredTypes.length === 0
        ? null
        : activeSelectedCode && filteredTypes.some((record) => record.dictTypeCode === activeSelectedCode)
          ? activeSelectedCode
          : filteredTypes[0]?.dictTypeCode ?? null;

    if (nextSelectedCode === activeSelectedCode) {
      return;
    }

    if (isControlled) {
      onSelectedCodeChange?.(nextSelectedCode);
      return;
    }

    setInternalSelectedCode(nextSelectedCode);
  }, [activeSelectedCode, filteredTypes, isControlled, onSelectedCodeChange]);

  const selectedType =
    filteredTypes.find((record) => record.dictTypeCode === activeSelectedCode) ?? filteredTypes[0] ?? null;
  const selectedItems = selectedType ? dictionaryItemsByType[selectedType.dictTypeCode] ?? [] : [];

  return (
    <div className='grid min-h-[calc(100dvh-12rem)] grid-cols-1 gap-4 xl:grid-cols-[300px_minmax(0,1fr)]'>
      <Card className='overflow-hidden py-0 xl:min-h-0'>
        <CardHeader className='border-b px-4 py-4'>
          <CardTitle>字典类型</CardTitle>
          <CardDescription>按编码或名称筛选左侧类型列表</CardDescription>
        </CardHeader>
        <CardContent className='flex min-h-0 flex-1 flex-col gap-4 px-4 py-4'>
          <Input
            aria-label='搜索字典类型'
            placeholder='搜索 code / name'
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
          />

          <div className='min-h-0 flex-1 overflow-auto pr-3'>
            <div className='space-y-2'>
              {filteredTypes.length > 0 ? (
                filteredTypes.map((record) => {
                  const isActive = record.dictTypeCode === selectedType?.dictTypeCode;

                  return (
                    <button
                      key={record.id}
                      type='button'
                      data-state={isActive ? 'active' : 'inactive'}
                      className={cn(
                        'w-full rounded-xl border px-3 py-3 text-left transition-colors',
                        isActive
                          ? 'border-primary bg-primary/8 shadow-xs'
                          : 'bg-background hover:bg-muted/60'
                      )}
                      onClick={() => {
                        if (!isControlled) {
                          setInternalSelectedCode(record.dictTypeCode);
                        }
                        onSelectedCodeChange?.(record.dictTypeCode);
                      }}
                    >
                      <div className='flex items-start justify-between gap-3'>
                        <div className='min-w-0'>
                          <div className='truncate text-sm font-medium'>{record.dictTypeName}</div>
                          <div className='text-muted-foreground truncate text-xs uppercase tracking-[0.18em]'>
                            {record.dictTypeCode}
                          </div>
                        </div>
                        <Badge variant={isActive ? 'default' : 'outline'}>
                          {resolveStatusLabel(record.status)}
                        </Badge>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className='text-muted-foreground rounded-xl border border-dashed px-4 py-10 text-center text-sm'>
                  没有匹配的字典类型
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className='flex min-w-0 flex-col gap-4'>
        <Card>
          {renderDetails ? (
            renderDetails(selectedType)
          ) : (
            <>
              <CardHeader className='gap-3'>
                <div className='flex flex-wrap items-start justify-between gap-3'>
                  <div className='space-y-1'>
                    <CardTitle>{selectedType?.dictTypeName ?? '请选择字典类型'}</CardTitle>
                    <CardDescription>
                      {selectedType ? `编码：${selectedType.dictTypeCode}` : '左侧选择后查看详情'}
                    </CardDescription>
                  </div>
                  {selectedType && <Badge>{resolveStatusLabel(selectedType.status)}</Badge>}
                </div>
              </CardHeader>
              <CardContent className='grid gap-4 sm:grid-cols-2 xl:grid-cols-4'>
                <DetailField label='名称' value={selectedType?.dictTypeName} />
                <DetailField label='编码' value={selectedType?.dictTypeCode} />
                <DetailField label='创建人' value={selectedType?.createdBy} />
                <DetailField label='创建时间' value={selectedType?.createdAt} />
                <DetailField label='更新人' value={selectedType?.updatedBy} />
                <DetailField label='更新时间' value={selectedType?.updatedAt} />
              </CardContent>
            </>
          )}
        </Card>

        <Card className='min-h-0 flex-1'>
          {renderItemPanel ? (
            renderItemPanel(selectedType, selectedItems)
          ) : (
            <>
              <CardHeader>
                <CardTitle>字典项列表</CardTitle>
                <CardDescription>展示当前字典类型下的字典项</CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className='min-h-0 flex-1 px-0'>
                <div className='min-h-[320px] overflow-auto'>
                  <table className='w-full min-w-[720px] border-separate border-spacing-0 text-sm'>
                    <thead className='bg-muted/70'>
                      <tr className='text-muted-foreground'>
                        <HeaderCell>编码</HeaderCell>
                        <HeaderCell>名称</HeaderCell>
                        <HeaderCell>状态</HeaderCell>
                        <HeaderCell>排序</HeaderCell>
                        <HeaderCell>备注</HeaderCell>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedItems.length > 0 ? (
                        selectedItems.map((item) => (
                          <tr key={item.id} className='border-b last:border-b-0'>
                            <BodyCell>{item.dictItemCode}</BodyCell>
                            <BodyCell>{item.dictItemName}</BodyCell>
                            <BodyCell>{resolveStatusLabel(item.status)}</BodyCell>
                            <BodyCell>{item.sort ?? '-'}</BodyCell>
                            <BodyCell>{item.remark ?? '-'}</BodyCell>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={5}
                            className='text-muted-foreground px-6 py-12 text-center text-sm'
                          >
                            {selectedType ? '当前字典类型暂无字典项' : '请先选择字典类型'}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
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

function HeaderCell({ children }: { children: React.ReactNode }) {
  return (
    <th className='px-6 py-3 text-left text-xs font-medium tracking-[0.18em] whitespace-nowrap uppercase'>
      {children}
    </th>
  );
}

function BodyCell({ children }: { children: React.ReactNode }) {
  return <td className='px-6 py-4 align-middle whitespace-nowrap'>{children}</td>;
}
