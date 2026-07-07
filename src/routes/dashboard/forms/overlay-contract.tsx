import { createFileRoute } from '@tanstack/react-router';

import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { WorkspaceOverlayContractPage } from '@/features/workspace-tabs/components/workspace-overlay-contract-page';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const meta = defineRouteMeta({
  label: '浮层契约',
  title: '开发示例：浮层契约',
  workspace: {},
  nav: {
    visible: false,
    group: 'components',
    order: 14,
    parentId: '/dashboard/forms',
    icon: 'forms'
  }
});

export const Route = createFileRoute('/dashboard/forms/overlay-contract')({
  ...meta,
  component: OverlayContractPage
});

function OverlayContractPage() {
  return (
    <WorkspacePageRoute
      render={() => <WorkspaceOverlayContractPage />}
      pageContainerProps={{ pageTitle: '浮层契约' }}
    />
  );
}
