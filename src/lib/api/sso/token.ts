export function extractAuthHeader(response: unknown): string | null {
  const headers = (response as Record<string, unknown>)?.headers;
  if (!headers) return null;

  if (typeof (headers as Headers).get === 'function') {
    return (headers as Headers).get('authorization');
  }

  const obj = headers as Record<string, string>;
  for (const key of Object.keys(obj)) {
    if (key.toLowerCase() === 'authorization') {
      return obj[key];
    }
  }
  return null;
}

export { getAuthHeader as getToken } from './session';
export { setAuthHeader as setToken } from './session';
