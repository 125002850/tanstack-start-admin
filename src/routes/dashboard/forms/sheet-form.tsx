import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspacePageBoundary } from '@/features/workspace-tabs/components/workspace-page-boundary';

const SheetFormDemo = lazyRouteComponent(
  () => import('@/features/forms/components/sheet-form-demo')
);

const meta = defineRouteMeta({
  label: '抽屉与弹窗',
  title: '开发示例：抽屉与弹窗',
  workspace: {},
  nav: {
    visible: false,
    group: 'components',
    order: 13,
    parentId: '/dashboard/forms',
    icon: 'forms'
  }
});

export const Route = createFileRoute('/dashboard/forms/sheet-form')({
  ...meta,
  component: SheetFormPage
});

function SheetFormPage() {
  return (
    <WorkspacePageBoundary
      tabId='/dashboard/forms/sheet-form'
      render={() => <SheetFormContent />}
    />
  );
}

function SheetFormContent() {
  return (
    <PageContainer>
      <SheetFormDemo />
    </PageContainer>
  );
}
