import type { ColumnDef } from '@tanstack/react-table';

import type { DictionaryTypeRecord } from '../api/types';

export const dictionaryTypeColumns: Array<ColumnDef<DictionaryTypeRecord>> = [
  {
    accessorKey: 'dictTypeCode',
    header: '字典类型编码',
    enableColumnFilter: true,
    enableSorting: true,
    meta: {
      variant: 'text',
      label: '字典类型编码',
      placeholder: '筛选编码'
    }
  },
  {
    accessorKey: 'dictTypeName',
    header: '字典类型名称',
    enableColumnFilter: true,
    enableSorting: true,
    meta: {
      variant: 'text',
      label: '字典类型名称',
      placeholder: '筛选名称'
    }
  }
];
