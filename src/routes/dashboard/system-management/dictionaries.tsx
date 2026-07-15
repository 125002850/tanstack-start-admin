import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const DictionaryManagementPage = lazyRouteComponent(
  () => import('@/features/dictionaries/components/dictionary-management-page')
);

const meta = defineRouteMeta({
  title: '系统管理：字典管理',
  nav: {
    group: 'systemManagement',
    menuKey: 'mdm_dict',
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
  return <WorkspacePageRoute render={() => <DictionaryManagementPage />} />;
}
