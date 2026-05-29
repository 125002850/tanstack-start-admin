import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import DemoForm from '@/components/forms/demo-form';
import { defineRouteMeta } from '@/lib/router/app-route-meta';
import { WorkspacePageBoundary } from '@/features/workspace-tabs/components/workspace-page-boundary';

const meta = defineRouteMeta({
  label: '基础表单',
  title: 'Dashboard: Basic Form',
  workspace: {},
  nav: {
    visible: true,
    group: 'components',
    order: 11,
    parentId: '/dashboard/forms',
    icon: 'forms',
    shortcut: ['f', 'f'],
  },
  page: {
    title: 'Basic Form',
    description: 'A comprehensive form demo with all field types.',
  },
});

export const Route = createFileRoute('/dashboard/forms/basic')({
  ...meta,
  component: BasicFormPage
});

function BasicFormPage() {
  return (
    <WorkspacePageBoundary
      tabId='/dashboard/forms/basic'
      render={() => <BasicFormContent />}
    />
  )
}

function BasicFormContent() {
  return (
    <PageContainer>
      <DemoForm />
    </PageContainer>
  )
}
