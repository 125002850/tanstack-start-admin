import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

import { WorkspacePageBoundary } from '@/features/workspace-tabs/components/workspace-page-boundary';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const DictionaryManagementPage = lazyRouteComponent(
  () => import('@/features/dictionaries/components/dictionary-management-page')
);
const DictionaryManagementScreen = lazyRouteComponent(
  () => import('@/features/dictionaries/components/dictionary-management-screen')
);

const meta = defineRouteMeta({
  label: '字典管理',
  title: '系统管理：字典管理',
  nav: {
    visible: true,
    group: 'systemManagement',
    order: 10,
    menuKey: 'dict-management',
    icon: 'databaseCog',
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
      render={() => <DictionaryManagementScreen />}
      renderWhenDisabled={() => <DictionaryManagementPage />}
    />
  );
}
