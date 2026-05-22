import { createFileRoute } from '@tanstack/react-router';
import KanbanViewPage from '@/features/kanban/components/kanban-view-page';
import { defineAppRouteStaticData } from '@/lib/router/app-route-meta';

const staticData = defineAppRouteStaticData({
  label: '看板',
  documentTitle: 'Dashboard : Kanban view',
  nav: {
    visible: true,
    group: 'overview',
    order: 40,
    icon: 'kanban',
    shortcut: ['k', 'k'],
  },
});

export const Route = createFileRoute('/dashboard/kanban')({
  staticData,
  head: () => ({ meta: [{ title: staticData.documentTitle ?? staticData.label }] }),
  component: () => <KanbanViewPage />
});
