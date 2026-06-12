import { setHeader } from './set-headers';
import { clearAuth, getAuthHeader, setAuthHeader } from './session';

export async function bootstrapRequest(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const headers = setHeader(init?.headers);
  const token = getAuthHeader();
  if (token) {
    headers.set('Authorization', token);
  }

  const response = await fetch(url, {
    ...init,
    headers
  });

  if (response.status === 401) {
    clearAuth();
  }

  const newToken = response.headers.get('authorization');
  if (newToken) {
    setAuthHeader(newToken);
  }

  return response;
}
