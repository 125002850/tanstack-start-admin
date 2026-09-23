import { loadEnv } from 'vite';
const env = loadEnv('production', process.cwd(), 'VITE_APP_SSO_');
const code = (process.env.VITE_APP_SSO_SERVICE_CODE ?? env.VITE_APP_SSO_SERVICE_CODE ?? '').trim();
if (!code) throw new Error('UI E2E 缺少 VITE_APP_SSO_SERVICE_CODE');
export const ssoTokenStorageKey = `sso:${encodeURIComponent(code)}:token`;
