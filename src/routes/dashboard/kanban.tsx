import { createFileRoute } from '@tanstack/react-router';
import KanbanViewPage from '@/features/kanban/components/kanban-view-page';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspacePageBoundary } from '@/features/workspace-tabs/components/workspace-page-boundary';
import { isWorkspaceTabsEnabled } from '@/config/workspace-tabs';

const meta = defineRouteMeta({
  label: '看板',
  title: 'Dashboard : Kanban view',
  workspace: {},
  nav: {
    visible: true,
    group: 'overview',
    order: 40,
    icon: 'kanban',
    shortcut: ['k', 'k'],
  },
  page: {
    title: 'Kanban',
    description: 'Manage tasks with drag and drop',
  },
});

export const Route = createFileRoute('/dashboard/kanban')({
  ...meta,
  component: KanbanPage
});

function KanbanPage() {
  if (!isWorkspaceTabsEnabled()) {
    return <KanbanViewPage />
  }

  return (
    <WorkspacePageBoundary
      tabId='/dashboard/kanban'
      initialTitle='看板'
      render={() => <KanbanViewPage />}
    />
  )
}
