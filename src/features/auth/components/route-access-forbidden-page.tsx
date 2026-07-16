import { Icons } from '@/components/icons';
import { DefaultErrorPage } from '@/components/layout/default-error-page';
import { resolveDashboardHomeHref } from '@/lib/router/dashboard-home';

interface RouteAccessForbiddenPageProps {
  message?: string;
}

export function RouteAccessForbiddenPage({ message }: RouteAccessForbiddenPageProps) {
  return (
    <DefaultErrorPage
      code='403'
      title='无权限访问'
      description='当前账号没有访问此页面的权限。'
      alertTitle='权限不足'
      alertDescription={message || '该页面未包含在当前账号的可访问菜单中。'}
      action={{
        label: '返回工作台',
        icon: Icons.arrowRight,
        href: resolveDashboardHomeHref()
      }}
    />
  );
}
