import { Icons } from '@/components/icons';
import { DefaultErrorPage } from '@/components/layout/default-error-page';
import { logout } from '@/lib/api/sso/session';

interface LoginForbiddenPageProps {
  message?: string;
  logoutUrl?: string | null;
}

export function LoginForbiddenPage({ message, logoutUrl }: LoginForbiddenPageProps) {
  return (
    <DefaultErrorPage
      code='403'
      title='无权限访问'
      description='当前账号暂未开通本系统的权限，请联系管理员开通权限'
      alertTitle='登录受限'
      alertDescription={message || '没有访问该资源的权限'}
      action={{
        label: '退出登录',
        icon: Icons.logout,
        onClick: () => logout(logoutUrl)
      }}
    />
  );
}
