import { createFileRoute } from '@tanstack/react-router';
import IconsViewPage from '@/features/elements/components/icons-view-page';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const meta = defineRouteMeta({
  label: '图标',
  title: 'Dashboard : Icons',
  nav: {
    visible: true,
    group: 'components',
    order: 30,
    icon: 'palette',
  },
  page: {
    title: 'Icons',
  },
});

export const Route = createFileRoute('/dashboard/elements/icons')({
  ...meta,
  component: () => <IconsViewPage />
});
