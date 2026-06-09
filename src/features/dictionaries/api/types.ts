export type DictionaryStatus = 'ENABLED' | 'DISABLED' | string;

export interface DictionaryAuditRecord {
  createdBy?: string;
  createdAt?: string;
  updatedBy?: string;
  updatedAt?: string;
}

export interface DictionaryTypeRecord extends DictionaryAuditRecord {
  id: number;
  dictTypeCode: string;
  dictTypeName: string;
  status?: DictionaryStatus;
}

export interface DictionaryItemRecord extends DictionaryAuditRecord {
  id: number;
  dictTypeCode: string;
  dictItemCode: string;
  dictItemName: string;
  status?: DictionaryStatus;
  sort?: number;
  remark?: string;
}

export interface DictionaryTypeListResult {
  total: number;
  list: DictionaryTypeRecord[];
}

export interface DictionaryTypeMutationPayload {
  id: number;
  dictTypeCode: string;
  dictTypeName: string;
  status?: DictionaryStatus;
}

export interface DictionaryItemMutationPayload {
  id?: number;
  dictTypeCode: string;
  dictItemCode: string;
  dictItemName: string;
  status?: DictionaryStatus;
  sort?: number;
  remark?: string;
}
