import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  clearTransportMiddlewares,
  createDefaultApiClientCustomInstance
} from '@oig/react-query-generator/core';
import { configureApiTransport } from '../transport';
import { getQueryClient } from '../../query-client';
import { bootstrapRequest } from './bootstrap';
import { sessionExpiryStore, SessionExpiredError } from './session-expiry';
import { getAuthHeader, setAuthHeader, setLogoutUrl } from './session';
import { toast } from 'sonner';
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
const client = createDefaultApiClientCustomInstance('https://example.com');
beforeEach(() => {
  localStorage.clear();
  sessionExpiryStore.setState({ expired: false, logoutUrl: null, redirecting: false });
  vi.stubGlobal('window', { location: { href: 'https://example.com/dashboard' } });
  configureApiTransport();
});
afterEach(() => {
  clearTransportMiddlewares();
  getQueryClient().clear();
  vi.unstubAllGlobals();
});

it('business 401 blocks later transport/bootstrap requests and suppresses repeated toast/retry', async () => {
  setAuthHeader('expired');
  setLogoutUrl('https://sso/logout');
  const fetcher = vi
    .fn()
    .mockImplementation(() => Promise.resolve(new Response('', { status: 401 })));
  vi.stubGlobal('fetch', fetcher);
  await expect(
    getQueryClient().fetchQuery({ queryKey: ['expired'], queryFn: () => client('/api/orders') })
  ).rejects.toMatchObject({ status: 401 });
  expect(sessionExpiryStore.getState().expired).toBe(true);
  expect(window.location.href).toBe('https://example.com/dashboard');
  await expect(client('/api/orders')).rejects.toBeInstanceOf(SessionExpiredError);
  await expect(bootstrapRequest('/api/getLoginInfo')).rejects.toBeInstanceOf(SessionExpiredError);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(toast.error).not.toHaveBeenCalled();
});

it('does not restore token from a successful response arriving after a concurrent 401', async () => {
  setAuthHeader('expired');
  let finish!: (response: Response) => void;
  vi.stubGlobal(
    'fetch',
    vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<Response>((resolve) => {
            finish = resolve;
          })
      )
      .mockResolvedValueOnce(new Response('', { status: 401 }))
  );
  const pending = client('/api/slow');
  await expect(client('/api/expired')).rejects.toMatchObject({ status: 401 });
  finish(
    new Response('{}', {
      headers: { authorization: 'late-token', 'content-type': 'application/json' }
    })
  );
  await expect(pending).rejects.toBeInstanceOf(SessionExpiredError);
  expect(getAuthHeader()).toBeNull();
});

it('first entry ignores legacy token and follows login URL without showing expiry dialog', async () => {
  localStorage.setItem('sso_token', 'other-project');
  const fetcher = vi
    .fn()
    .mockResolvedValue(
      new Response(JSON.stringify({ data: { loginUrl: 'https://sso/login' } }), { status: 401 })
    );
  vi.stubGlobal('fetch', fetcher);
  await bootstrapRequest('/api/getLoginInfo');
  expect(fetcher.mock.calls[0][1].headers.has('authorization')).toBe(false);
  expect(sessionExpiryStore.getState().expired).toBe(false);
  expect(window.location.href).toBe('https://sso/login');
});

it('expired bootstrap waits for confirmation and retains response logout URL', async () => {
  setAuthHeader('expired');
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ data: { logoutUrl: 'https://sso/response-logout' } }), {
        status: 401
      })
    )
  );
  await bootstrapRequest('/api/getLoginInfo');
  expect(sessionExpiryStore.getState()).toMatchObject({
    expired: true,
    logoutUrl: 'https://sso/response-logout'
  });
  expect(window.location.href).toBe('https://example.com/dashboard');
});

it('403 does not invalidate the session', async () => {
  setAuthHeader('valid');
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('', { status: 403 })));
  await expect(client('/api/forbidden')).rejects.toMatchObject({ status: 403 });
  expect(sessionExpiryStore.getState().expired).toBe(false);
  expect(getAuthHeader()).toBe('valid');
});
