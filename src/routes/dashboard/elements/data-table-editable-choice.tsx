import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const DataTableEditableChoiceContractPage = lazyRouteComponent(
  () => import('@/features/elements/components/data-table-editable-choice-contract-page'),
  'DataTableEditableChoiceContractPage'
);

const meta = defineRouteMeta({
  label: '可编辑选择表格',
  title: '开发示例：可编辑选择表格',
  workspace: {},
  nav: {
    visible: false,
    group: 'components',
    order: 31,
    icon: 'palette'
  }
});

export const Route = createFileRoute('/dashboard/elements/data-table-editable-choice')({
  ...meta,
  component: DataTableEditableChoicePage
});

function DataTableEditableChoicePage() {
  return (
    <WorkspacePageRoute
      render={() => <DataTableEditableChoiceContractPage />}
      pageContainerProps={{ pageTitle: '可编辑选择表格' }}
    />
  );
}
