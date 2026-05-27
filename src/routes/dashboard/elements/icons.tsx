import { createFileRoute } from '@tanstack/react-router';
import IconsViewPage from '@/features/elements/components/icons-view-page';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspacePageBoundary } from '@/features/workspace-tabs/components/workspace-page-boundary';
import { isWorkspaceTabsEnabled } from '@/config/workspace-tabs';

const meta = defineRouteMeta({
  label: '图标',
  title: 'Dashboard : Icons',
  workspace: {},
  nav: {
    visible: true,
    group: 'components',
    order: 30,
    icon: 'palette',
  },
  page: {
    title: 'Icons',
  },
});

export const Route = createFileRoute('/dashboard/elements/icons')({
  ...meta,
  component: IconsPage
});

function IconsPage() {
  if (!isWorkspaceTabsEnabled()) {
    return <IconsViewPage />
  }

  return (
    <WorkspacePageBoundary
      tabId='/dashboard/elements/icons'
      initialTitle='图标'
      render={() => <IconsViewPage />}
    />
  )
}
