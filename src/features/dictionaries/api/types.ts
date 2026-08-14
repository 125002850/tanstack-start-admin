import type {
  DictItemRspDTO,
  GlobalDictTypeRspDTO,
  SystemDictGlobalItemCreateRequest,
  SystemDictGlobalItemUpdateRequest,
  SystemDictGlobalTypeCreateRequest,
  SystemDictGlobalTypeUpdateRequest
} from '@/lib/api/clients/service';

export type DictionaryTypeRecord = GlobalDictTypeRspDTO;
export type DictionaryItemRecord = DictItemRspDTO;

export type DictionaryTypeMutationPayload =
  | SystemDictGlobalTypeCreateRequest
  | (SystemDictGlobalTypeUpdateRequest & Pick<GlobalDictTypeRspDTO, 'status'>);

export type DictionaryItemMutationPayload =
  | SystemDictGlobalItemCreateRequest
  | SystemDictGlobalItemUpdateRequest;
