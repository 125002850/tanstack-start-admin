import { mutationOptions } from '@tanstack/react-query';

import {
  createGlobalItem,
  createGlobalType,
  deleteGlobalItem,
  updateGlobalItem,
  updateGlobalType
} from '@/lib/api/clients/dict';
import { getQueryClient } from '@/lib/query-client';

import { dictionaryItemKeys, dictionaryTypeKeys } from './queries';
import type {
  DictionaryItemMutationPayload,
  DictionaryTypeMutationPayload
} from './types';

export const createDictionaryTypeMutation = mutationOptions({
  mutationFn: async (payload: DictionaryTypeMutationPayload) =>
    createGlobalType(payload as never),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: dictionaryTypeKeys.all });
  }
});

export const updateDictionaryTypeMutation = mutationOptions({
  mutationFn: async (payload: DictionaryTypeMutationPayload) =>
    updateGlobalType(payload as never),
  onSuccess: () => {
    getQueryClient().invalidateQueries({ queryKey: dictionaryTypeKeys.all });
  }
});

export const createDictionaryItemMutation = mutationOptions({
  mutationFn: async (payload: DictionaryItemMutationPayload) =>
    createGlobalItem(payload as never),
  onSuccess: (_, payload) => {
    getQueryClient().invalidateQueries({
      queryKey: dictionaryItemKeys.list(payload.dictTypeCode)
    });
  }
});

export const updateDictionaryItemMutation = mutationOptions({
  mutationFn: async (payload: DictionaryItemMutationPayload) =>
    updateGlobalItem(payload as never),
  onSuccess: (_, payload) => {
    getQueryClient().invalidateQueries({
      queryKey: dictionaryItemKeys.list(payload.dictTypeCode)
    });
  }
});

export const deleteDictionaryItemMutation = mutationOptions({
  mutationFn: async (payload: { dictTypeCode: string; id: number }) =>
    deleteGlobalItem({ id: payload.id } as never),
  onSuccess: (_, payload) => {
    getQueryClient().invalidateQueries({
      queryKey: dictionaryItemKeys.list(payload.dictTypeCode)
    });
  }
});

export const bulkDeleteDictionaryItemsMutation = mutationOptions({
  mutationFn: async (payload: { dictTypeCode: string; ids: number[] }) =>
    Promise.all(payload.ids.map((id) => deleteGlobalItem({ id } as never))),
  onSuccess: (_, payload) => {
    getQueryClient().invalidateQueries({
      queryKey: dictionaryItemKeys.list(payload.dictTypeCode)
    });
  }
});
