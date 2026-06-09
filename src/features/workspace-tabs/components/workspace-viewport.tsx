import * as React from 'react';
import type { WorkspacePageDescriptor, WorkspacePageLifecyclePatch } from '../types';
import { useWorkspaceTabStore } from '../utils/store';
import { useWorkspacePageRegistryStore } from '../utils/page-registry';
import { WorkspacePageContext } from '../hooks/use-workspace-page';
import { Activity } from './activity';
import { WorkspaceSlotErrorBoundary } from './workspace-slot-error-boundary';

/**
 * WorkspaceViewport is the ActivityHost — the single owner of all page instances
 * when workspace tabs are enabled.
 *
 * V2 page descriptors (registered by WorkspacePageBoundary):
 *   - Active tab → rendered visibly
 *   - Inactive keep-alive tab → rendered via Activity hidden
 *   - Inactive non-keep-alive tab → not rendered (unmounted)
 */
export function WorkspaceViewport() {
  const tabs = useWorkspaceTabStore((s) => s.tabs);
  const activeId = useWorkspaceTabStore((s) => s.activeId);
  const pageDescriptors = useWorkspacePageRegistryStore((s) => s.descriptors);
  const disabledKeepAliveIds = useWorkspaceTabStore((s) => s.disabledKeepAliveIds);

  const entries = React.useMemo(() => {
    const result: Array<{
      tagId: string;
      descriptor: WorkspacePageDescriptor;
      active: boolean;
    }> = [];

    for (const [tagId, tab] of Object.entries(tabs)) {
      const desc = pageDescriptors[tagId];
      if (!desc) continue;

      const isActive = tagId === activeId;
      if (isActive) {
        result.push({ tagId, descriptor: desc, active: true });
      } else if (tab.keepAlive && !disabledKeepAliveIds.has(tagId)) {
        result.push({ tagId, descriptor: desc, active: false });
      }
    }

    return result;
  }, [tabs, activeId, pageDescriptors, disabledKeepAliveIds]);

  if (entries.length === 0) return null;

  return (
    <>
      {/* V2 page instances: active visible, inactive keep-alive hidden */}
      {entries.map(({ tagId, descriptor, active }) => (
        <WorkspaceSlotErrorBoundary
          key={tagId}
          tagId={tagId}
          fallback={descriptor.errorFallback ?? <DefaultWorkspaceFallback />}
        >
          <PageContextProvider tagId={tagId}>
            <PageRenderer render={descriptor.render} hidden={!active} />
          </PageContextProvider>
        </WorkspaceSlotErrorBoundary>
      ))}
    </>
  );
}

function PageRenderer({ render, hidden }: { render: () => React.ReactNode; hidden: boolean }) {
  return <Activity mode={hidden ? 'hidden' : 'visible'}>{render()}</Activity>;
}

function PageContextProvider({ tagId, children }: { tagId: string; children: React.ReactNode }) {
  const updateLifecycle = React.useCallback(
    (patch: WorkspacePageLifecyclePatch) => {
      useWorkspaceTabStore.getState().updateLifecycle(tagId, patch);
    },
    [tagId]
  );

  const value = React.useMemo(() => ({ tabId: tagId, updateLifecycle }), [tagId, updateLifecycle]);

  return <WorkspacePageContext.Provider value={value}>{children}</WorkspacePageContext.Provider>;
}

function DefaultWorkspaceFallback() {
  return React.createElement(
    'div',
    {
      style: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        height: '100%',
        minHeight: 200,
        color: 'var(--muted-foreground)',
        fontSize: 14
      }
    },
    '糟糕，页面找不到了'
  );
}
