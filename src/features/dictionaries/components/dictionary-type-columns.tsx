import type { ColumnDef } from '@tanstack/react-table';

import type { DictionaryTypeRecord } from '../api/types';

export const DICTIONARY_TYPE_KEYWORD_FILTER_COLUMN_ID = 'keyword';

export const dictionaryTypeColumns: Array<ColumnDef<DictionaryTypeRecord>> = [
  {
    id: DICTIONARY_TYPE_KEYWORD_FILTER_COLUMN_ID,
    accessorFn: (record) => `${record.dictTypeCode ?? ''} ${record.dictTypeName ?? ''}`.trim(),
    header: '字典类型搜索',
    enableColumnFilter: true,
    enableSorting: false,
    meta: {
      variant: 'text',
      label: '字典类型搜索',
      placeholder: '搜索 编码 / 名称'
    }
  }
];
