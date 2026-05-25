import { createFileRoute } from '@tanstack/react-router';
import PageContainer from '@/components/layout/page-container';
import SheetFormDemo from '@/features/forms/components/sheet-form-demo';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const meta = defineRouteMeta({
  label: '抽屉与弹窗',
  title: 'Dashboard: Sheet Form',
  nav: {
    visible: true,
    group: 'components',
    order: 13,
    parentId: '/dashboard/forms',
    icon: 'forms',
  },
  page: {
    title: 'Sheet & Dialog Forms',
    description: 'Form patterns inside sheets and dialogs with external submit buttons.',
  },
});

export const Route = createFileRoute('/dashboard/forms/sheet-form')({
  ...meta,
  component: () => (
    <PageContainer>
      <SheetFormDemo />
    </PageContainer>
  )
});
