import { env } from '@/config/env';

export function createSsoStorageKeys(serviceCode: string) {
  const code = serviceCode.trim();
  if (!code) throw new Error('缺少 VITE_APP_SSO_SERVICE_CODE，无法隔离 SSO 登录态。');
  const prefix = `sso:${encodeURIComponent(code)}`;
  return {
    token: `${prefix}:token`,
    userId: `${prefix}:user_id`,
    logoutUrl: `${prefix}:logout_url`,
    loginReturnSearch: `${prefix}:login_return_search`
  } as const;
}

export const ssoStorageKeys = createSsoStorageKeys(env.ssoServiceCode);
