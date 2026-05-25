import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import DemoForm from '@/components/forms/demo-form';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const meta = defineRouteMeta({
  label: '基础表单',
  title: 'Dashboard: Basic Form',
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
  component: () => (
    <PageContainer>
      <DemoForm />
    </PageContainer>
  )
});
