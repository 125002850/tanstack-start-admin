import type { GlobalDictTypeRspDTO } from '@/lib/api/clients/service/generated/model/globalDictTypeRspDTO';
import type { DictItemRspDTO } from '@/lib/api/clients/service/generated/model/dictItemRspDTO';

export type DictionaryTypeRecord = GlobalDictTypeRspDTO;
export type DictionaryItemRecord = DictItemRspDTO & { sort?: number };

export interface DictionaryTypeMutationPayload {
  id: number;
  dictTypeCode: string;
  dictTypeName: string;
  status?: string;
}

export interface DictionaryItemMutationPayload {
  id?: number;
  dictTypeCode: string;
  dictItemCode: string;
  dictItemName: string;
  status?: string;
  sort?: number;
  remark?: string;
}
