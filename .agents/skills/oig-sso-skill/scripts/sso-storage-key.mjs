import { loadEnv } from 'vite';

export function getSsoTokenStorageKey() {
  const env = loadEnv(process.env.PLAYWRIGHT_SSO_MODE || 'development', process.cwd(), 'VITE_APP_SSO_');
  const serviceCode = (process.env.VITE_APP_SSO_SERVICE_CODE ?? env.VITE_APP_SSO_SERVICE_CODE ?? '').trim();
  if (!serviceCode) throw new Error('缺少 VITE_APP_SSO_SERVICE_CODE，无法确定本项目 SSO 登录态。');
  return `sso:${encodeURIComponent(serviceCode)}:token`;
}
