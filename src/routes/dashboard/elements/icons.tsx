import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';

const IconsManagementPage = lazyRouteComponent(
  () => import('@/features/elements/components/icons-view-page'),
  'IconsManagementPage'
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
  return <WorkspacePageRoute render={() => <IconsManagementPage />} />;
}
