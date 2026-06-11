import { env } from '@/config/env';

const H_SERVICE_ID = 'service-id';
const H_CLIENT_ID = 'client-id';
const H_SERVICE_CODE = 'service-code';

export function setHeader(headers?: HeadersInit): Headers {
  const merged = new Headers(headers);

  if (env.ssoServiceID) {
    merged.set(H_SERVICE_ID, env.ssoServiceID);
  }

  if (env.ssoClientID) {
    merged.set(H_CLIENT_ID, env.ssoClientID);
  }

  if (env.ssoServiceCode) {
    merged.set(H_SERVICE_CODE, env.ssoServiceCode);
  }

  return merged;
}
