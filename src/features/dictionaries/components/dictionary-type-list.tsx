import * as React from 'react';
import type { Table } from '@tanstack/react-table';

import { Icons } from '@/components/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { DataTablePagination } from '@/components/ui/table/data-table-pagination';
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar';
import { cn } from '@/lib/utils';

import type { DictionaryTypeRecord } from '../api/types';

interface DictionaryTypeListProps {
  table: Table<DictionaryTypeRecord>;
  total: number;
  types: DictionaryTypeRecord[];
  selectedTypeCode: string | null;
  onSelect: (dictTypeCode: string) => void;
  onAddType: () => void;
}

export function DictionaryTypeList({
  table,
  total,
  types,
  selectedTypeCode,
  onSelect,
  onAddType
}: DictionaryTypeListProps) {
  return (
    <Card className='xl:sticky xl:top-0'>
      <CardHeader>
        <CardTitle>字典类型</CardTitle>
        <CardDescription>按字典编码或名称筛选字典类型列表</CardDescription>
      </CardHeader>
      <CardContent className='space-y-4'>
        <DataTableToolbar table={table} className='p-0'>
          <Button variant='outline' size='icon' onClick={onAddType}>
            <Icons.add className='size-4' />
            <span className='sr-only'>新增字典类型</span>
          </Button>
        </DataTableToolbar>

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
                        {record.status === 'DISABLE' ? '停用' : '启用'}
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
        <DataTablePagination table={table} totalRowCount={total} />
      </CardContent>
    </Card>
  );
}
