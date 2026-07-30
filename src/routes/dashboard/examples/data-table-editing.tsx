import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';

import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const DataTableEditingExamplePage = lazyRouteComponent(
  () => import('@/features/elements/components/data-table-editable-choice-contract-page'),
  'DataTableEditingExamplePage'
);

const meta = defineRouteMeta({
  label: '表格编辑',
  title: '示例：表格编辑',
  // 大数据压测页离开后释放表格实例，避免 500 行当前页和远程选项缓存长期驻留。
  workspace: { keepAlive: false },
  nav: {
    visible: true,
    group: 'examples',
    order: 10,
    icon: 'edit',
    shortcut: ['e', 't']
  }
});

export const Route = createFileRoute('/dashboard/examples/data-table-editing')({
  ...meta,
  component: DataTableEditingRoutePage
});

function DataTableEditingRoutePage() {
  return (
    <WorkspacePageRoute
      render={() => <DataTableEditingExamplePage />}
      pageContainerProps={{
        pageTitle: '表格编辑',
        pageDescription: '在大数据虚拟表格中验证 DataTable 支持的全部单元格编辑器。'
      }}
    />
  );
}
