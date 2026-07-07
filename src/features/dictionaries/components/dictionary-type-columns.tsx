import type { ColumnDef } from '@tanstack/react-table';

import { createDataTableColumnDsl } from '@/components/ui/table/columns/data-table-column-factory';
import { nullableText } from '@/lib/display-formatters';

import type { DictionaryTypeRecord } from '../api/types';

export const DICTIONARY_TYPE_KEYWORD_FILTER_COLUMN_ID = 'keyword';

const columnDsl = createDataTableColumnDsl<DictionaryTypeRecord>();

export const dictionaryTypeColumns: Array<ColumnDef<DictionaryTypeRecord>> = [
  columnDsl.custom({
    id: DICTIONARY_TYPE_KEYWORD_FILTER_COLUMN_ID,
    accessorFn: (record) => `${record.dictTypeCode ?? ''} ${record.dictTypeName ?? ''}`.trim(),
    title: '字典类型搜索',
    filter: 'text',
    filterPlaceholder: '搜索 编码 / 名称',
    enableSorting: false,
    cell: ({ getValue }) => nullableText(getValue())
  })
];
