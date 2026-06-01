import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import SheetFormDemo from '@/features/forms/components/sheet-form-demo';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspacePageBoundary } from '@/features/workspace-tabs/components/workspace-page-boundary';

const meta = defineRouteMeta({
  label: '抽屉与弹窗',
  title: 'Dashboard: Sheet Form',
  workspace: {},
  nav: {
    visible: true,
    group: 'components',
    order: 13,
    parentId: '/dashboard/forms',
    icon: 'forms'
  },
  page: {
    title: 'Sheet & Dialog Forms',
    description: 'Form patterns inside sheets and dialogs with external submit buttons.'
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
