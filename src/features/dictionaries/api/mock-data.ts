import type { DictionaryItemRecord, DictionaryTypeRecord } from './types';

export const MOCK_DICTIONARY_TYPES: DictionaryTypeRecord[] = [
  {
    id: 1,
    dictTypeCode: 'color',
    dictTypeName: '颜色',
    status: 'ENABLED',
    createdBy: 'System',
    createdAt: '2026-06-08 10:00:00',
    updatedBy: 'System',
    updatedAt: '2026-06-08 10:00:00'
  },
  {
    id: 2,
    dictTypeCode: 'size',
    dictTypeName: '尺寸',
    status: 'DISABLED',
    createdBy: 'Admin',
    createdAt: '2026-06-08 11:00:00',
    updatedBy: 'Admin',
    updatedAt: '2026-06-08 11:20:00'
  },
  {
    id: 3,
    dictTypeCode: 'status',
    dictTypeName: '状态',
    status: 'ENABLED',
    createdBy: 'Operator',
    createdAt: '2026-06-08 12:00:00',
    updatedBy: 'Operator',
    updatedAt: '2026-06-08 12:10:00'
  }
];

export const MOCK_DICTIONARY_ITEMS_BY_TYPE: Record<string, DictionaryItemRecord[]> = {
  color: [
    {
      id: 11,
      dictTypeCode: 'color',
      dictItemCode: 'red',
      dictItemName: '红色',
      status: 'ENABLED',
      sort: 10,
      remark: '用于主视觉强调色',
      createdBy: 'System',
      createdAt: '2026-06-08 10:05:00',
      updatedBy: 'System',
      updatedAt: '2026-06-08 10:05:00'
    },
    {
      id: 12,
      dictTypeCode: 'color',
      dictItemCode: 'blue',
      dictItemName: '蓝色',
      status: 'ENABLED',
      sort: 20,
      remark: '用于信息提示色',
      createdBy: 'System',
      createdAt: '2026-06-08 10:06:00',
      updatedBy: 'Designer',
      updatedAt: '2026-06-08 10:30:00'
    }
  ],
  size: [
    {
      id: 21,
      dictTypeCode: 'size',
      dictItemCode: 's',
      dictItemName: '小',
      status: 'ENABLED',
      sort: 10,
      remark: '适配紧凑布局',
      createdBy: 'Admin',
      createdAt: '2026-06-08 11:05:00',
      updatedBy: 'Admin',
      updatedAt: '2026-06-08 11:05:00'
    },
    {
      id: 22,
      dictTypeCode: 'size',
      dictItemCode: 'l',
      dictItemName: '大',
      status: 'DISABLED',
      sort: 30,
      remark: '历史配置，暂不使用',
      createdBy: 'Admin',
      createdAt: '2026-06-08 11:08:00',
      updatedBy: 'Admin',
      updatedAt: '2026-06-08 11:18:00'
    }
  ],
  status: [
    {
      id: 31,
      dictTypeCode: 'status',
      dictItemCode: 'draft',
      dictItemName: '草稿',
      status: 'ENABLED',
      sort: 10,
      remark: '尚未提交审核',
      createdBy: 'Operator',
      createdAt: '2026-06-08 12:05:00',
      updatedBy: 'Operator',
      updatedAt: '2026-06-08 12:05:00'
    },
    {
      id: 32,
      dictTypeCode: 'status',
      dictItemCode: 'published',
      dictItemName: '已发布',
      status: 'ENABLED',
      sort: 20,
      remark: '已生效状态',
      createdBy: 'Operator',
      createdAt: '2026-06-08 12:06:00',
      updatedBy: 'Operator',
      updatedAt: '2026-06-08 12:08:00'
    }
  ]
};
