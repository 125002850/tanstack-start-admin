import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import DemoForm from '@/components/forms/demo-form';
import { defineAppRouteStaticData } from '@/lib/router/app-route-meta';

const staticData = defineAppRouteStaticData({
  label: '基础表单',
  documentTitle: 'Dashboard: Basic Form',
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
  staticData,
  head: () => ({ meta: [{ title: staticData.documentTitle ?? staticData.label }] }),
  component: () => (
    <PageContainer>
      <DemoForm />
    </PageContainer>
  )
});
