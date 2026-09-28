import { useEffect } from 'react';
import { useStore } from 'zustand';
import type { ErrorComponentProps } from '@tanstack/react-router';
import { Icons } from '@/components/icons';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { LoginForbiddenPage } from '@/features/auth/components/login-forbidden-page';
import { RouteAccessForbiddenPage } from '@/features/auth/components/route-access-forbidden-page';
import { normalizeApiError } from '@/lib/api/error-normalizer';
import { LoginRequiredError, isLoginForbiddenError } from '@/lib/api/sso/errors';
import { handleUnauthorized } from '@/lib/api/sso/session';
import { sessionExpiryStore } from '@/lib/api/sso/session-expiry';
import { isRouteAccessForbiddenError } from '@/lib/router/route-access';
import { DefaultErrorPage } from './default-error-page';

/** 全局路由与 dashboard 共用，避免不同错误边界误把认证异常显示为 500。 */
export function RouteErrorPage({ error, reset }: ErrorComponentProps) {
  const expired = useStore(sessionExpiryStore, (state) => state.expired);
  const loginRequired = error instanceof LoginRequiredError;
  const errorInfo = normalizeApiError(error);
  const unauthorized = !loginRequired && errorInfo.code === 'UNAUTHORIZED';

  useEffect(() => {
    if (unauthorized && !expired) handleUnauthorized();
  }, [unauthorized, expired]);

  // 全局确认框位于路由树外，此处不重复展示错误页。
  if (expired || unauthorized) return null;
  if (loginRequired) {
    return (
      <main className='flex min-h-screen items-center justify-center p-6'>
        <section className='flex w-full max-w-xl flex-col gap-4'>
          <Alert>
            <Icons.info className='size-4' aria-hidden='true' />
            <AlertTitle>{error.redirectUrl ? '正在前往登录页' : '暂时无法登录'}</AlertTitle>
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
          {error.redirectUrl ? (
            <Button asChild>
              <a href={error.redirectUrl}>前往登录</a>
            </Button>
          ) : (
            <Button onClick={reset}>重试</Button>
          )}
        </section>
      </main>
    );
  }
  if (isLoginForbiddenError(error)) {
    return <LoginForbiddenPage message={error.message} logoutUrl={error.logoutUrl} />;
  }
  if (isRouteAccessForbiddenError(error)) {
    return <RouteAccessForbiddenPage message={error.message} />;
  }
  return (
    <DefaultErrorPage
      code='500'
      title='系统异常'
      description='页面加载时遇到异常，当前操作未能继续。'
      alertTitle='运行异常'
      alertDescription={errorInfo.message}
      action={{ label: '重试', icon: Icons.rotateClockwise, onClick: reset }}
    />
  );
}
