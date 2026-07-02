import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspacePageBoundary } from '@/features/workspace-tabs/components/workspace-page-boundary';

const IconsViewPage = lazyRouteComponent(
  () => import('@/features/elements/components/icons-view-page')
);

const meta = defineRouteMeta({
  label: '图标',
  title: '开发示例：图标',
  workspace: {},
  nav: {
    visible: false,
    group: 'components',
    order: 30,
    icon: 'palette'
  }
});

export const Route = createFileRoute('/dashboard/elements/icons')({
  ...meta,
  component: IconsPage
});

function IconsPage() {
  return (
    <WorkspacePageBoundary tabId='/dashboard/elements/icons' render={() => <IconsViewPage />} />
  );
}
