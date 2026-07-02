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
import { getStatusLabel } from '@/constants/enums';

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
    <Card className='xl:sticky xl:top-0'>
      <CardHeader>
        <CardTitle>字典类型</CardTitle>
        <CardDescription>按字典编码或名称筛选字典类型列表</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <div className='flex items-center gap-2'>
          <Input
            value={keyword}
            placeholder='搜索 编码 / 名称'
            className='h-9 flex-1'
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

        <div className='max-h-[64vh] overflow-y-auto pr-2'>
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
                    onClick={() => onSelect(record.dictTypeCode!)}
                  >
                    <div className='flex items-start justify-between gap-3'>
                      <div className='min-w-0'>
                        <div className='truncate text-sm font-medium'>{record.dictTypeName}</div>
                        <div className='text-muted-foreground truncate text-xs tracking-[0.18em]'>
                          {record.dictTypeCode}
                        </div>
                      </div>
                      <Badge variant={isActive ? 'default' : 'outline'}>
                        {getStatusLabel(record.status)}
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
  );
}
