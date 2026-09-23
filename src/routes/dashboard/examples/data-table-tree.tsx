import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const DataTableTreeExamplePage = lazyRouteComponent(
  () => import('@/features/elements/components/data-table-tree-example-page'),
  'DataTableTreeExamplePage'
);

const meta = defineRouteMeta({
  label: '树形表格',
  nav: { visible: false, group: 'examples', order: 11, icon: 'code' }
});

export const Route = createFileRoute('/dashboard/examples/data-table-tree')({
  ...meta,
  component: DataTableTreeRoutePage
});

function DataTableTreeRoutePage() {
  return (
    <WorkspacePageRoute contentSizing='contained' render={() => <DataTableTreeExamplePage />} />
  );
}
