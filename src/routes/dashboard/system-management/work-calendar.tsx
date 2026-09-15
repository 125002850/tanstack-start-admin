import { createFileRoute, lazyRouteComponent } from '@tanstack/react-router';
import * as z from 'zod';

import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import {
  formatShanghaiCurrentYear,
  WORK_CALENDAR_MAX_YEAR,
  WORK_CALENDAR_MIN_YEAR
} from '@/features/work-calendar/model/work-calendar-model';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const WorkCalendarPage = lazyRouteComponent(
  () => import('@/features/work-calendar/work-calendar-page')
);

const meta = defineRouteMeta({
  requiredPermission: 'system:calendar:manage',
  label: '工作日历',
  nav: {
    visible: true,
    group: 'systemManagement',
    order: 30,
    menuKey: 'work-calendar',
    icon: 'calendar',
    shortcut: ['w', 'c']
  },
  workspace: {
    refreshPolicy: 'query-invalidate'
  }
});

const searchSchema = z.object({
  year: z.coerce.number().int().min(WORK_CALENDAR_MIN_YEAR).max(WORK_CALENDAR_MAX_YEAR).optional()
});

export const Route = createFileRoute('/dashboard/system-management/work-calendar')({
  ...meta,
  validateSearch: searchSchema,
  component: WorkCalendarRoutePage
});

function WorkCalendarRoutePage() {
  const search = Route.useSearch();
  const navigate = Route.useNavigate();
  const year = search.year ?? formatShanghaiCurrentYear();

  return (
    <WorkspacePageRoute
      render={() => (
        <WorkCalendarPage
          key={year}
          year={year}
          onYearChange={(nextYear) => navigate({ search: { year: nextYear } })}
        />
      )}
    />
  );
}
