import type {
  DictItemRspDTO,
  GlobalDictTypeRspDTO,
  ListGlobalItemsByTypeResponse,
  ListGlobalTypesResponse
} from '@/lib/api/clients/dict';

import type {
  DictionaryAuditRecord,
  DictionaryItemRecord,
  DictionaryTypeListResult,
  DictionaryTypeRecord
} from './types';

function readString(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === 'string' ? value : undefined;
}

function readStringLike(source: Record<string, unknown>, key: string) {
  const value = source[key];
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);
  return undefined;
}

function readNumber(source: Record<string, unknown>, key: string) {
  const value = source[key];
  return typeof value === 'number' ? value : undefined;
}

function normalizeStatus(value: unknown) {
  if (value === 'ENABLE' || value === 'ENABLED') return 'ENABLED';
  if (value === 'DISABLE' || value === 'DISABLED') return 'DISABLED';
  return typeof value === 'string' ? value : undefined;
}

function readAudit(source: Record<string, unknown>): DictionaryAuditRecord {
  return {
    createdBy: readStringLike(source, 'createdBy') ?? readStringLike(source, 'createBy'),
    createdAt: readString(source, 'createdAt') ?? readString(source, 'createTime'),
    updatedBy: readStringLike(source, 'updatedBy') ?? readStringLike(source, 'updateBy'),
    updatedAt: readString(source, 'updatedAt') ?? readString(source, 'updateTime')
  };
}

export function normalizeDictionaryTypeRecord(record: GlobalDictTypeRspDTO): DictionaryTypeRecord {
  const source = record as Record<string, unknown>;

  return {
    id: record.id ?? 0,
    dictTypeCode: record.dictTypeCode ?? '',
    dictTypeName: record.dictTypeName ?? '',
    status: normalizeStatus(source.status),
    ...readAudit(source)
  };
}

export function normalizeDictionaryItemRecord(record: DictItemRspDTO): DictionaryItemRecord {
  const source = record as Record<string, unknown>;

  return {
    id: record.id ?? 0,
    dictTypeCode: record.dictTypeCode ?? '',
    dictItemCode: record.dictItemCode ?? '',
    dictItemName: record.dictItemName ?? '',
    status: normalizeStatus(source.status),
    sort: readNumber(source, 'sort'),
    remark: readString(source, 'remark'),
    ...readAudit(source)
  };
}

export function normalizeDictionaryTypeList(
  response: ListGlobalTypesResponse
): DictionaryTypeListResult {
  return {
    total: response.total ?? 0,
    list: (response.list ?? []).map(normalizeDictionaryTypeRecord)
  };
}

export function normalizeDictionaryItems(response: ListGlobalItemsByTypeResponse) {
  return (response ?? []).map(normalizeDictionaryItemRecord);
}
