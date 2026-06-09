import { describe, expect, it } from 'vitest';

import {
  normalizeDictionaryItemRecord,
  normalizeDictionaryTypeRecord
} from './adapters';

describe('dictionary adapters', () => {
  it('preserves runtime status and audit fields even when generated types lag behind', () => {
    const typeRecord = normalizeDictionaryTypeRecord({
      id: 1,
      dictTypeCode: 'color',
      dictTypeName: '颜色',
      status: 'ENABLED',
      createdBy: 'System',
      createdAt: '2026-06-08 10:00:00',
      updatedBy: 'Admin',
      updatedAt: '2026-06-08 11:00:00'
    } as never);

    const itemRecord = normalizeDictionaryItemRecord({
      id: 2,
      dictTypeCode: 'color',
      dictItemCode: 'red',
      dictItemName: '红色',
      status: 'DISABLED',
      sort: 20,
      remark: 'Warm color',
      createdBy: 'System',
      createdAt: '2026-06-08 10:05:00',
      updatedBy: 'Admin',
      updatedAt: '2026-06-08 11:05:00'
    } as never);

    expect(typeRecord.status).toBe('ENABLED');
    expect(typeRecord.createdBy).toBe('System');
    expect(typeRecord.updatedAt).toBe('2026-06-08 11:00:00');

    expect(itemRecord.status).toBe('DISABLED');
    expect(itemRecord.sort).toBe(20);
    expect(itemRecord.remark).toBe('Warm color');
    expect(itemRecord.updatedBy).toBe('Admin');
  });

  it('normalizes generated dict DTO audit keys and status enums from the real API', () => {
    const typeRecord = normalizeDictionaryTypeRecord({
      id: 1,
      dictTypeCode: 'payment',
      dictTypeName: '付款状态',
      status: 'ENABLE',
      createBy: 1001,
      createTime: '2026-06-09 09:00:00',
      updateBy: 1002,
      updateTime: '2026-06-09 10:00:00'
    } as never);

    const itemRecord = normalizeDictionaryItemRecord({
      id: 2,
      dictTypeCode: 'payment',
      dictItemCode: 'paid',
      dictItemName: '已支付',
      status: 'DISABLE',
      sort: 30,
      remark: 'Real API payload',
      createBy: 2001,
      createTime: '2026-06-09 09:05:00',
      updateBy: 2002,
      updateTime: '2026-06-09 10:05:00'
    } as never);

    expect(typeRecord.status).toBe('ENABLED');
    expect(typeRecord.createdBy).toBe('1001');
    expect(typeRecord.createdAt).toBe('2026-06-09 09:00:00');
    expect(typeRecord.updatedBy).toBe('1002');
    expect(typeRecord.updatedAt).toBe('2026-06-09 10:00:00');

    expect(itemRecord.status).toBe('DISABLED');
    expect(itemRecord.createdBy).toBe('2001');
    expect(itemRecord.createdAt).toBe('2026-06-09 09:05:00');
    expect(itemRecord.updatedBy).toBe('2002');
    expect(itemRecord.updatedAt).toBe('2026-06-09 10:05:00');
  });
});
