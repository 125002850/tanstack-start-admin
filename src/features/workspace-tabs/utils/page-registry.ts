import { create } from 'zustand';
import type { WorkspacePageDescriptor, WorkspaceTabId } from '../types';

interface WorkspacePageRegistryState {
  descriptors: Record<WorkspaceTabId, WorkspacePageDescriptor>;
  registerDescriptor: (tabId: WorkspaceTabId, descriptor: WorkspacePageDescriptor) => void;
  unregisterDescriptor: (tabId: WorkspaceTabId) => void;
  retainDescriptors: (tabIds: WorkspaceTabId[]) => void;
  resetDescriptors: () => void;
}

export const useWorkspacePageRegistryStore = create<WorkspacePageRegistryState>()((set) => ({
  descriptors: {},

  registerDescriptor: (tabId, descriptor) =>
    set((state) => {
      if (state.descriptors[tabId] === descriptor) {
        return state;
      }

      return {
        descriptors: { ...state.descriptors, [tabId]: descriptor }
      };
    }),

  unregisterDescriptor: (tabId) =>
    set((state) => {
      if (!(tabId in state.descriptors)) {
        return state;
      }

      const { [tabId]: _removed, ...rest } = state.descriptors;
      return { descriptors: rest };
    }),

  retainDescriptors: (tabIds) =>
    set((state) => {
      const keep = new Set(tabIds);
      const nextDescriptors: Record<WorkspaceTabId, WorkspacePageDescriptor> = {};
      let changed = false;

      for (const [tabId, descriptor] of Object.entries(state.descriptors)) {
        if (keep.has(tabId)) {
          nextDescriptors[tabId] = descriptor;
        } else {
          changed = true;
        }
      }

      if (
        !changed &&
        Object.keys(nextDescriptors).length === Object.keys(state.descriptors).length
      ) {
        return state;
      }

      return { descriptors: nextDescriptors };
    }),

  resetDescriptors: () =>
    set((state) => {
      if (Object.keys(state.descriptors).length === 0) {
        return state;
      }

      return { descriptors: {} };
    })
}));
