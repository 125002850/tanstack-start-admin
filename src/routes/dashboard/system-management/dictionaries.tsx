import { createFileRoute } from '@tanstack/react-router';

import DictionaryManagementPage from '@/features/dictionaries/components/dictionary-management-page';
import { WorkspacePageBoundary } from '@/features/workspace-tabs/components/workspace-page-boundary';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const meta = defineRouteMeta({
  label: '字典管理',
  title: '概览：字典管理',
  nav: {
    visible: true,
    group: 'overview',
    order: 26,
    parentId: '/dashboard/system-management',
    icon: 'code',
    shortcut: ['d', 'm']
  },
  workspace: {
    refreshPolicy: 'query-invalidate'
  }
});

export const Route = createFileRoute('/dashboard/system-management/dictionaries')({
  ...meta,
  component: DictionariesPage
});

function DictionariesPage() {
  return (
    <WorkspacePageBoundary
      tabId='/dashboard/system-management/dictionaries'
      render={() => <DictionaryManagementPage />}
      renderWhenDisabled={() => <DictionaryManagementPage />}
    />
  );
}
