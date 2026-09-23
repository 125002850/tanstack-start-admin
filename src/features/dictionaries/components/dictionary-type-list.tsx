import { OverflowTooltip } from '@/components/ui/overflow-tooltip';
import * as React from 'react';
import type { Table } from '@tanstack/react-table';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { useDebouncedCallback } from '@/hooks/use-debounced-callback';
import { cn } from '@/lib/utils';

import type { DictionaryTypeRecord } from '../api/types';
import { DICTIONARY_TYPE_KEYWORD_FILTER_COLUMN_ID } from './dictionary-type-columns';
import { DictStatus, getStatusLabel } from '@/constants/enums';

interface DictionaryTypeListProps {
  table: Table<DictionaryTypeRecord>;
  types: DictionaryTypeRecord[];
  selectedTypeCode: string | null;
  onSelect: (dictTypeCode: string) => void;
  onAddType: () => void;
}

export function DictionaryTypeList({
  table,
  types,
  selectedTypeCode,
  onSelect,
  onAddType
}: DictionaryTypeListProps) {
  const keywordColumn = table.getColumn(DICTIONARY_TYPE_KEYWORD_FILTER_COLUMN_ID);
  const keywordFilterValue = (keywordColumn?.getFilterValue() as string | undefined) ?? '';
  const [keyword, setKeyword] = React.useState(keywordFilterValue);
  const debouncedSetKeywordFilter = useDebouncedCallback((value: string) => {
    keywordColumn?.setFilterValue(value);
  }, 300);

  React.useEffect(() => {
    setKeyword(keywordFilterValue);
  }, [keywordFilterValue]);

  return (
    <Card className='min-w-0 shrink-0 xl:h-full xl:min-h-0'>
      <CardHeader className='shrink-0'>
        <CardTitle>字典类型</CardTitle>
        <CardDescription>按字典编码或名称筛选字典类型列表</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex items-center gap-2'>
          <Input
            value={keyword}
            placeholder='搜索 编码 / 名称'
            className='h-9 min-w-0 flex-1'
            onChange={(event) => {
              const nextKeyword = event.target.value;
              setKeyword(nextKeyword);
              debouncedSetKeywordFilter(nextKeyword);
            }}
          />
          <Button variant='outline' size='icon' onClick={onAddType}>
            <Icons.add className='size-4' />
            <span className='sr-only'>新增字典类型</span>
          </Button>
        </div>

        <div className='max-h-72 min-h-0 flex-1 overflow-y-auto pr-2 xl:max-h-none'>
          <div className='flex flex-col gap-2'>
            {types.length > 0 ? (
              types.map((record) => {
                const isActive = record.dictTypeCode === selectedTypeCode;

                return (
                  <OverflowTooltip
                    key={record.id}
                    content={
                      <div className='flex flex-col gap-1'>
                        <span className='font-medium'>{record.dictTypeName}</span>
                        <span>{record.dictTypeCode}</span>
                      </div>
                    }
                  >
                    <button
                      type='button'
                      aria-pressed={isActive}
                      className={cn(
                        'w-full rounded-xl border px-3 py-3 text-left transition-colors',
                        isActive
                          ? 'border-primary bg-primary/8 shadow-xs'
                          : 'bg-background hover:bg-muted/60'
                      )}
                      onClick={() => onSelect(record.dictTypeCode!)}
                    >
                      <div className='flex items-start justify-between gap-3'>
                        <div className='min-w-0'>
                          <div data-overflow-tooltip-text className='truncate text-sm font-medium'>
                            {record.dictTypeName}
                          </div>
                          <div
                            data-overflow-tooltip-text
                            className='text-muted-foreground truncate text-xs tracking-[0.18em]'
                          >
                            {record.dictTypeCode}
                          </div>
                        </div>
                        <Badge
                          variant={
                            record.status === DictStatus.ENABLE
                              ? 'success'
                              : record.status === DictStatus.DISABLE
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {getStatusLabel(record.status)}
                        </Badge>
                      </div>
                    </button>
                  </OverflowTooltip>
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
  );
}
