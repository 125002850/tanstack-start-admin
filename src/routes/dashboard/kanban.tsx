import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspacePageBoundary } from '@/features/workspace-tabs/components/workspace-page-boundary';

const KanbanViewPage = lazyRouteComponent(
  () => import('@/features/kanban/components/kanban-view-page')
);

const meta = defineRouteMeta({
  label: '看板',
  title: '开发示例：看板',
  workspace: {},
  nav: {
    visible: false,
    group: 'components',
    order: 20,
    icon: 'kanban',
    shortcut: ['k', 'k']
  }
});

export const Route = createFileRoute('/dashboard/kanban')({
  ...meta,
  component: KanbanPage
});

function KanbanPage() {
  return <WorkspacePageBoundary tabId='/dashboard/kanban' render={() => <KanbanViewPage />} />;
}
