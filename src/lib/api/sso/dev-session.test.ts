// @vitest-environment node

import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import {
  clearTransportMiddlewares,
  createDefaultApiClientCustomInstance
} from '@oig/react-query-generator/core';
import { configureApiTransport } from '../transport';
import { getQueryClient } from '../../query-client';
import { normalizeApiError } from '../error-normalizer';
import { getLoginInfoQueryKey, getLoginInfoQueryOptions } from './queries';
import { getAuthHeader, handleUnauthorized, setAuthHeader } from './session';
import { SessionExpiredError, sessionExpiryStore } from './session-expiry';

vi.mock('@/config/env', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/env')>();
  return { ...actual, env: { ...actual.env, devSsoSessionEnabled: true } };
});
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

const client = createDefaultApiClientCustomInstance('https://example.com');
const loginUser = {
  userId: '42',
  userCode: 'EMP042',
  phone: '',
  userName: 'employee',
  realName: '测试员工',
  menuData: [],
  loginUrl: '',
  logoutUrl: ''
};

function loginResponse(authorization = 'renewed-token') {
  return Response.json(
    { success: true, rspCode: '200', data: loginUser },
    { headers: { Authorization: authorization } }
  );
}

function seedSession(updatedAt = Date.now()) {
  setAuthHeader('cached-token');
  getQueryClient().setQueryData(getLoginInfoQueryKey, loginUser, { updatedAt });
}

function jwt(exp: unknown) {
  return `header.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.signature`;
}

beforeEach(() => {
  sessionExpiryStore.setState({ expired: false, logoutUrl: null, redirecting: false });
  vi.stubGlobal('window', { location: { href: 'https://example.com/overview' } });
  getQueryClient().setDefaultOptions({ queries: { retry: false } });
  configureApiTransport();
});

afterEach(() => {
  clearTransportMiddlewares();
  getQueryClient().clear();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

it('JWT 未临近过期时，即使登录信息缓存已超过一分钟，也不额外校验 SSO', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const now = 1_800_000_000_000;
  vi.setSystemTime(now);
  seedSession(now - 600_000);
  setAuthHeader(jwt(now / 1000 + 3600));
  const fetcher = vi.fn().mockImplementation(async () => Response.json({}));
  vi.stubGlobal('fetch', fetcher);

  await client('/api/first');
  vi.setSystemTime(now + 60_000);
  await client('/api/second');
  expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
    'https://example.com/api/first',
    'https://example.com/api/second'
  ]);
});

it('登录信息仅缓存30秒时，JWT 进入提前两分钟的窗口就先续期，并发请求共用新 token', async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  const now = 1_800_000_000_000;
  vi.setSystemTime(now);
  seedSession();
  setAuthHeader(jwt(now / 1000 + 150));
  vi.setSystemTime(now + 30_000);
  const renewed = jwt(now / 1000 + 3600);
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(loginResponse(renewed))
    .mockImplementation(async () => Response.json({}));
  vi.stubGlobal('fetch', fetcher);

  await Promise.all([client('/api/first'), client('/api/second')]);
  expect(fetcher.mock.calls[0][0]).toMatch(/\/api\/getLoginInfo$/);
  for (const [, init] of fetcher.mock.calls.slice(1)) {
    expect(new Headers(init.headers).get('authorization')).toBe(renewed);
  }
  await client('/api/third');
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/api/getLoginInfo'))).toHaveLength(1);
  expect(fetcher).toHaveBeenCalledTimes(4);
  expect(sessionExpiryStore.getState().expired).toBe(false);
});

it('JWT 已过期时，即使登录信息刚缓存，也在发送业务请求前续期', async () => {
  seedSession();
  setAuthHeader(jwt(Math.floor(Date.now() / 1000) - 1));
  const renewed = jwt(Math.floor(Date.now() / 1000) + 3600);
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(loginResponse(renewed))
    .mockResolvedValueOnce(Response.json({}));
  vi.stubGlobal('fetch', fetcher);

  await client('/api/save', { method: 'POST' });
  expect(fetcher.mock.calls[0][0]).toMatch(/\/api\/getLoginInfo$/);
  expect(new Headers(fetcher.mock.calls[1][1].headers).get('authorization')).toBe(renewed);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it.each([undefined, null, '1800000000', Number.MAX_SAFE_INTEGER])(
  'JWT 的 exp 为 %j 时沿用一分钟校验，不因无效有效期反复续期',
  async (exp) => {
    seedSession();
    setAuthHeader(jwt(exp));
    const fetcher = vi.fn().mockImplementation(async () => Response.json({}));
    vi.stubGlobal('fetch', fetcher);
    await client('/api/first');
    await client('/api/second');
    expect(fetcher.mock.calls.map(([url]) => url)).toEqual([
      'https://example.com/api/first',
      'https://example.com/api/second'
    ]);
  }
);

it('休眠后并发业务请求先共用一次登录校验，再携带新 token 发送', async () => {
  seedSession(Date.now() - 60_001);
  let complete!: (response: Response) => void;
  const fetcher = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve;
        })
    )
    .mockImplementation(async () => Response.json({}));
  vi.stubGlobal('fetch', fetcher);

  const pending = Promise.all([client('/api/first'), client('/api/second')]);
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  expect(fetcher.mock.calls[0][0]).toMatch(/\/api\/getLoginInfo$/);
  complete(loginResponse());
  await pending;

  for (const [, init] of fetcher.mock.calls.slice(1)) {
    expect(new Headers(init.headers).get('authorization')).toBe('renewed-token');
    expect(new Headers(init.headers).get('X-User-Id')).toBe('42');
  }
  await client('/api/third');
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/api/getLoginInfo'))).toHaveLength(1);
  expect(sessionExpiryStore.getState().expired).toBe(false);
});

it('已有后台续期时，即使缓存新鲜，业务请求也等待新 token', async () => {
  seedSession();
  let complete!: (response: Response) => void;
  const fetcher = vi
    .fn()
    .mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          complete = resolve;
        })
    )
    .mockImplementation(async () => Response.json({}));
  vi.stubGlobal('fetch', fetcher);

  const refreshing = getQueryClient().fetchQuery({ ...getLoginInfoQueryOptions(), staleTime: 0 });
  const pending = client('/api/save', { method: 'POST' });
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  complete(loginResponse());
  await Promise.all([refreshing, pending]);

  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(new Headers(fetcher.mock.calls[1][1].headers).get('authorization')).toBe('renewed-token');
});

it('401 续期后不重放业务操作，迟到的旧 401 和成功响应不能覆盖新会话', async () => {
  seedSession();
  let completeLogin!: (response: Response) => void;
  let completeUnauthorized!: (response: Response) => void;
  let completeSuccess!: (response: Response) => void;
  const fetcher = vi.fn(async (url: string) => {
    if (url.endsWith('/api/getLoginInfo')) {
      return new Promise<Response>((resolve) => {
        completeLogin = resolve;
      });
    }
    if (url.endsWith('/api/late-401')) {
      return new Promise<Response>((resolve) => {
        completeUnauthorized = resolve;
      });
    }
    if (url.endsWith('/api/late-success')) {
      return new Promise<Response>((resolve) => {
        completeSuccess = resolve;
      });
    }
    return url.endsWith('/api/save') || url.endsWith('/api/another-save')
      ? new Response('', { status: 401 })
      : Response.json({});
  });
  vi.stubGlobal('fetch', fetcher);

  const save = client('/api/save', { method: 'POST' }).catch((error: unknown) => error);
  const anotherSave = client('/api/another-save', { method: 'POST' }).catch(
    (error: unknown) => error
  );
  const lateUnauthorized = client('/api/late-401').catch((error: unknown) => error);
  const lateSuccess = client('/api/late-success');
  await vi.waitFor(() => expect(completeLogin).toBeTypeOf('function'));
  completeLogin(loginResponse());
  for (const error of await Promise.all([save, anotherSave])) {
    expect(normalizeApiError(error)).toEqual({
      code: 'UNAUTHORIZED',
      message: '登录状态已更新，请重试本次操作。'
    });
  }
  expect(sessionExpiryStore.getState().expired).toBe(false);

  completeUnauthorized(new Response('', { status: 401 }));
  expect(await lateUnauthorized).toMatchObject({ status: 401 });
  completeSuccess(Response.json({}, { headers: { Authorization: 'obsolete-token' } }));
  await lateSuccess;
  await client('/api/next');

  expect(getAuthHeader()).toBe('renewed-token');
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/api/getLoginInfo'))).toHaveLength(1);
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/api/save'))).toHaveLength(1);
  expect(fetcher.mock.calls.filter(([url]) => url.endsWith('/api/another-save'))).toHaveLength(1);
});

it.each([{ code: 401 }, { code: '401' }, { rspCode: '401' }])(
  '业务响应 %j 同样恢复开发会话且不重放请求',
  async (body) => {
    seedSession();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(Response.json(body))
      .mockResolvedValueOnce(loginResponse());
    vi.stubGlobal('fetch', fetcher);
    await expect(client('/api/save', { method: 'POST' })).rejects.toMatchObject({ status: 401 });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(getAuthHeader()).toBe('renewed-token');
    expect(sessionExpiryStore.getState().expired).toBe(false);
  }
);

it('续期仍返回 401 时才进入统一会话失效流程，停止业务请求', async () => {
  seedSession(Date.now() - 60_001);
  const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 401 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(client('/api/save', { method: 'POST' })).rejects.toBeInstanceOf(SessionExpiredError);
  await expect(client('/api/next')).rejects.toBeInstanceOf(SessionExpiredError);
  expect(fetcher).toHaveBeenCalledOnce();
  expect(fetcher.mock.calls[0][0]).toMatch(/\/api\/getLoginInfo$/);
  expect(sessionExpiryStore.getState().expired).toBe(true);
  expect(getAuthHeader()).toBeNull();
});

it('续期的临时网络故障保留会话，下一次操作可重新校验', async () => {
  seedSession(Date.now() - 60_001);
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(new Response('', { status: 502 }))
    .mockResolvedValueOnce(loginResponse())
    .mockResolvedValueOnce(Response.json({}));
  vi.stubGlobal('fetch', fetcher);
  await expect(client('/api/save', { method: 'POST' })).rejects.toMatchObject({ status: 502 });
  expect(getAuthHeader()).toBe('cached-token');
  expect(sessionExpiryStore.getState().expired).toBe(false);
  await client('/api/next');
  expect(getAuthHeader()).toBe('renewed-token');
  expect(fetcher).toHaveBeenCalledTimes(3);
});

it('业务 403 不触发续期或清理会话', async () => {
  seedSession();
  const fetcher = vi.fn().mockResolvedValue(new Response('', { status: 403 }));
  vi.stubGlobal('fetch', fetcher);
  await expect(client('/api/forbidden')).rejects.toMatchObject({ status: 403 });
  expect(fetcher).toHaveBeenCalledOnce();
  expect(sessionExpiryStore.getState().expired).toBe(false);
});

it('续期期间发生统一退出时，迟到的新 token 不能恢复会话或发送业务请求', async () => {
  seedSession(Date.now() - 60_001);
  let complete!: (response: Response) => void;
  const fetcher = vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        complete = resolve;
      })
  );
  vi.stubGlobal('fetch', fetcher);
  const pending = client('/api/save', { method: 'POST' });
  await vi.waitFor(() => expect(fetcher).toHaveBeenCalledOnce());
  handleUnauthorized();
  complete(loginResponse());
  await expect(pending).rejects.toBeInstanceOf(SessionExpiredError);
  expect(fetcher).toHaveBeenCalledOnce();
  expect(getAuthHeader()).toBeNull();
});
