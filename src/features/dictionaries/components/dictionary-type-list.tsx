import * as React from 'react';

import { Badge } from '@/components/ui/badge';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

import type { DictionaryTypeRecord } from '../api/types';

interface DictionaryTypeListProps {
  types: DictionaryTypeRecord[];
  selectedTypeCode: string | null;
  keyword: string;
  onKeywordChange: (value: string) => void;
  onSelect: (dictTypeCode: string) => void;
}

export function DictionaryTypeList({
  types,
  selectedTypeCode,
  keyword,
  onKeywordChange,
  onSelect
}: DictionaryTypeListProps) {
  return (
    <div className='rounded-xl border bg-card xl:sticky xl:top-0'>
      <CardHeader className='border-b px-4 py-4'>
        <CardTitle>字典类型</CardTitle>
        <CardDescription>按编码或名称筛选左侧类型列表</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4 px-4 py-4'>
        <Input
          aria-label='搜索字典类型'
          placeholder='搜索 编码 / 名称'
          value={keyword}
          onChange={(event) => onKeywordChange(event.target.value)}
        />

        <div className='max-h-[56vh] overflow-y-auto pr-2'>
          <div className='space-y-2'>
            {types.length > 0 ? (
              types.map((record) => {
                const isActive = record.dictTypeCode === selectedTypeCode;

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
                    onClick={() => onSelect(record.dictTypeCode)}
                  >
                    <div className='flex items-start justify-between gap-3'>
                      <div className='min-w-0'>
                        <div className='truncate text-sm font-medium'>
                          {record.dictTypeName}
                        </div>
                        <div className='text-muted-foreground truncate text-xs uppercase tracking-[0.18em]'>
                          {record.dictTypeCode}
                        </div>
                      </div>
                      <Badge variant={isActive ? 'default' : 'outline'}>
                        {record.status === 'DISABLED' ? '停用' : '启用'}
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
    </div>
  );
}
