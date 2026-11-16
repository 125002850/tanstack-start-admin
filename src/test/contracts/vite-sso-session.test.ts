// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { request } from 'node:http';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
const loginProcess = vi.hoisted(() => ({ exec: vi.fn(), spawn: vi.fn() }));
vi.mock('node:child_process', async (importOriginal) => ({
  ...(await importOriginal<typeof import('node:child_process')>()),
  execFile: loginProcess.exec,
  spawn: loginProcess.spawn
}));
import { createDevMockSsoPlugin } from '../../../vite.sso-mock';
import {
  DevSsoSessionError,
  getDevSsoExpiresAt,
  getDevSsoSessionVersion,
  readDevSsoSession,
  resolveDevSsoSessionPath,
  validateDevSsoSession,
  writeDevSsoSession,
  type DevSsoSession
} from '../../../vite.sso-session';

const application = { clientId: 'test-client', serviceId: 'test-service', serviceCode: 'test-app' };
const loginInfo = {
  success: true,
  rspCode: '200',
  msg: 'ok',
  data: {
    userId: '42',
    userCode: 'EMP042',
    realName: '测试员工',
    userName: 'employee',
    phone: '',
    loginUrl: '',
    logoutUrl: '',
    menuData: [
      {
        code: 'task-center-tasks',
        hiddenFlag: 'N',
        children: [],
        num: 0,
        icon: '',
        parentId: '',
        url: '',
        nodeParentId: '',
        menuTips: '',
        appId: '',
        name: '',
        id: '',
        nodeId: '',
        levels: 1,
        linkedList: []
      }
    ]
  }
} as DevSsoSession['loginInfo'];
const fetchGateway = vi.fn<typeof fetch>();
let directory: string;
let file: string;
let session: DevSsoSession;
let server: ViteDevServer | undefined;
let baseUrl: string;
const restoreTerminal: (() => void)[] = [];

function interactiveTerminal() {
  for (const stream of [process.stdin, process.stdout]) {
    const descriptor = Object.getOwnPropertyDescriptor(stream, 'isTTY');
    Object.defineProperty(stream, 'isTTY', { configurable: true, value: true });
    restoreTerminal.push(() => {
      if (descriptor) Object.defineProperty(stream, 'isTTY', descriptor);
      else Reflect.deleteProperty(stream, 'isTTY');
    });
  }
}

beforeEach(() => {
  mkdirSync('playwright/.auth', { recursive: true });
  directory = mkdtempSync('playwright/.auth/dev-session-test-');
  file = join(directory, 'session.json');
  vi.stubEnv('PLAYWRIGHT_SSO_CREDENTIALS', join(directory, 'credentials.json'));
  session = {
    ...application,
    authorization: 'test-credential',
    loginInfoUrl: 'https://gateway.invalid/infra/api/getLoginInfo',
    expiresAt: Date.now() + 3_600_000,
    loginInfo: loginInfo as DevSsoSession['loginInfo']
  };
  fetchGateway.mockReset();
  loginProcess.exec.mockReset();
  loginProcess.spawn.mockReset();
  loginProcess.exec.mockImplementation((_command, _args, _options, done) => {
    queueMicrotask(() => done(new Error('login unavailable in this test')));
  });
  loginProcess.spawn.mockImplementation(() => {
    const child = new EventEmitter();
    writeDevSsoSession(file, session);
    queueMicrotask(() => child.emit('close', 0));
    return child;
  });
  fetchGateway.mockImplementation(async () => Response.json(loginInfo));
  vi.stubGlobal('fetch', fetchGateway);
});

afterEach(async () => {
  await server?.close();
  server = undefined;
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const restore of restoreTerminal.splice(0)) restore();
  rmSync(directory, { recursive: true, force: true });
});

async function start(real = true, userCode?: string, enabled = true) {
  server = await createServer({
    configFile: false,
    logLevel: 'silent',
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { host: '127.0.0.1', port: 0 },
    plugins: [
      {
        name: 'capture-test-server',
        configureServer(current) {
          server = current;
        }
      },
      createDevMockSsoPlugin(
        enabled,
        '/infra',
        userCode,
        real ? { ...application, file } : undefined
      )
    ]
  });
  await server.listen();
  const address = server.httpServer!.address();
  if (!address || typeof address === 'string') throw new Error('Missing test server port');
  baseUrl = `http://127.0.0.1:${address.port}`;
}

function get(path = '/infra/api/getLoginInfo', headers: Record<string, string | undefined> = {}) {
  return new Promise<{
    status: number;
    headers: import('node:http').IncomingHttpHeaders;
    body: string;
  }>((resolve, reject) => {
    const req = request(baseUrl + path, { headers, agent: false }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () =>
        resolve({ status: response.statusCode!, headers: response.headers, body })
      );
    });
    req.on('error', reject);
    req.end();
  });
}

describe('真实开发 SSO 会话', () => {
  it('关闭 mock 时忽略会话配置，不拦截登录请求或触发自动登录', async () => {
    interactiveTerminal();
    await start(true, undefined, false);
    const response = await get();
    expect(response.status).toBe(404);
    expect(response.headers.authorization).toBeUndefined();
    expect(response.headers['x-oig-dev-sso']).toBeUndefined();
    expect(server!.config.server.cors).not.toBe(false);
    expect(server!.config.server.allowedHosts).not.toContain('localhost');
    expect(fetchGateway).not.toHaveBeenCalled();
    expect(loginProcess.exec).not.toHaveBeenCalled();
    expect(loginProcess.spawn).not.toHaveBeenCalled();

    writeDevSsoSession(file, session);
    expect((await get('/' + file)).status).toBe(403);
  });

  it.each(['missing', 'expired', 'invalid', 'wrong-app'])(
    '交互启动时为 %s 会话运行登录 CLI，成功后再启动服务',
    async (scenario) => {
      interactiveTerminal();
      if (scenario === 'invalid') writeFileSync(file, '{broken json');
      else if (scenario !== 'missing')
        writeFileSync(
          file,
          JSON.stringify({
            ...session,
            ...(scenario === 'expired' ? { expiresAt: 1 } : { clientId: 'other-client' })
          })
        );
      await start();
      expect(loginProcess.spawn).toHaveBeenCalledWith(
        'bash',
        expect.arrayContaining([expect.stringContaining('auth-sso-local.sh')]),
        expect.objectContaining({
          stdio: ['inherit', 'inherit', 'pipe'],
          env: expect.objectContaining({
            DEV_MOCK_SSO: 'true',
            DEV_SSO_SESSION_FILE: file,
            PLAYWRIGHT_SSO_SESSION_ONLY: '1',
            VITE_APP_SSO_CLIENT_ID: application.clientId
          })
        })
      );
      expect(loginProcess.spawn).toHaveBeenCalledTimes(1);
      expect((await get()).status).toBe(200);
    }
  );

  it('交互启动时校验并复用有效会话，不要求重新输入账号密码', async () => {
    interactiveTerminal();
    writeDevSsoSession(file, session);
    await start();
    expect(fetchGateway).toHaveBeenCalledTimes(1);
    expect(loginProcess.spawn).not.toHaveBeenCalled();
    expect(loginProcess.exec).not.toHaveBeenCalled();
  });

  it('交互登录失败时将脚本的安全错误保留到 Vite 启动错误中', async () => {
    interactiveTerminal();
    vi.spyOn(process.stderr, 'write').mockReturnValue(true);
    const message = '读取 SSO 登录页失败：SSO 域名解析失败，请检查 DNS 或 VPN。（ENOTFOUND）';
    loginProcess.spawn.mockImplementation(() => {
      const child = Object.assign(new EventEmitter(), { stderr: new PassThrough() });
      queueMicrotask(() => {
        child.emit('exit', 1);
        child.stderr.write('HTTP 登录 SSO失败：');
        child.stderr.write(message + '\r\n');
        child.stderr.write('unrelated-private-detail\n');
        child.stderr.end();
        child.emit('close', 1);
      });
      return child;
    });
    const error = await start().catch((error: unknown) => error);
    expect(error).toBeInstanceOf(DevSsoSessionError);
    expect((error as Error).message).toBe(message);
    expect((error as Error).message).not.toContain('unrelated-private-detail');
  });

  it('后台续会话失败时保留脚本报告的阶段和错误码', async () => {
    writeFileSync(file, JSON.stringify({ ...session, expiresAt: 1 }));
    const message = '请求 SSO 授权跳转失败：SSO 连接被中断，请检查网络。（ECONNRESET）';
    loginProcess.exec.mockImplementation((_command, _args, _options, done) => {
      queueMicrotask(() =>
        done(new Error('private-detail'), '', 'HTTP 登录 SSO失败：' + message + '\n')
      );
    });
    await start();
    const response = await get();
    expect(JSON.parse(response.body).msg).toBe(message);
    expect(loginProcess.exec).toHaveBeenCalledTimes(1);
  });

  it('CLI 修正错误的环境变量凭据后，后续续会话使用新保存的本地凭据', async () => {
    interactiveTerminal();
    vi.stubEnv('PLAYWRIGHT_SSO_ACCOUNT', 'invalid-test-account');
    vi.stubEnv('PLAYWRIGHT_SSO_PASSWORD', 'invalid-test-password');
    loginProcess.spawn.mockImplementation(() => {
      const child = new EventEmitter();
      writeFileSync(
        join(directory, 'credentials.json'),
        JSON.stringify({ account: 'corrected-test-account', password: 'corrected-test-password' })
      );
      writeDevSsoSession(file, session);
      queueMicrotask(() => child.emit('close', 0));
      return child;
    });
    await start();
    expect(process.env.PLAYWRIGHT_SSO_ACCOUNT).toBeUndefined();
    expect(process.env.PLAYWRIGHT_SSO_PASSWORD).toBeUndefined();
    writeFileSync(file, JSON.stringify({ ...session, expiresAt: 1 }));
    await get();
    expect(loginProcess.exec).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Array),
      expect.objectContaining({
        env: expect.not.objectContaining({ PLAYWRIGHT_SSO_ACCOUNT: expect.any(String) })
      }),
      expect.any(Function)
    );
  });

  it.each([403, 502])('启动校验返回 %i 时不要求重新输入账号密码', async (status) => {
    interactiveTerminal();
    writeDevSsoSession(file, session);
    fetchGateway.mockResolvedValueOnce(Response.json({ code: status }, { status }));
    await start();
    expect(loginProcess.spawn).not.toHaveBeenCalled();
    expect(loginProcess.exec).not.toHaveBeenCalled();
  });

  it('显式登录脚本启动开发服务时不重复启动登录 CLI', async () => {
    interactiveTerminal();
    vi.stubEnv('PLAYWRIGHT_SSO_LOGIN_IN_PROGRESS', '1');
    await start();
    expect(loginProcess.spawn).not.toHaveBeenCalled();
  });

  it.each(['DEV001', 'CUSTOM001'])('保留未配置会话文件时的假用户 %s', async (userCode) => {
    await start(false, userCode === 'DEV001' ? undefined : userCode);
    const response = await get();
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body).data.userCode).toBe(userCode);
    expect(response.headers.authorization).toBeUndefined();
    expect(fetchGateway).not.toHaveBeenCalled();
  });

  it('校验网关后透传真实用户和原始菜单，并通过响应头刷新凭据', async () => {
    writeDevSsoSession(file, session);
    fetchGateway.mockResolvedValueOnce(
      Response.json(loginInfo, { headers: { Authorization: 'refreshed-credential' } })
    );
    await start();
    const response = await get();
    expect(response.status).toBe(200);
    expect(JSON.parse(response.body)).toEqual(loginInfo);
    expect(response.headers.authorization).toBe('refreshed-credential');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(fetchGateway).toHaveBeenCalledWith(
      session.loginInfoUrl,
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'test-credential',
          'client-id': application.clientId
        }),
        redirect: 'error'
      })
    );
    expect(readDevSsoSession(file, application).authorization).toBe('refreshed-credential');
    expect(statSync(file).mode & 0o777).toBe(0o600);
  });

  it('每次读取会话文件，切换账号后立即使用新身份', async () => {
    writeDevSsoSession(file, session);
    await start();
    expect((await get()).status).toBe(200);
    const other = {
      ...loginInfo,
      data: { ...loginInfo.data, userId: '43', userCode: 'EMP043', menuData: [] }
    };
    writeDevSsoSession(file, { ...session, authorization: 'other-credential', loginInfo: other });
    fetchGateway.mockResolvedValueOnce(Response.json(other));
    const response = await get();
    expect(JSON.parse(response.body).data).toEqual(other.data);
    expect(response.headers.authorization).toBe('other-credential');
  });

  it('迟到的旧账号查询不能覆盖新账号会话', async () => {
    writeDevSsoSession(file, session);
    let complete!: (response: Response) => void;
    fetchGateway.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        })
    );
    await start();
    const pending = get();
    await vi.waitFor(() => expect(fetchGateway).toHaveBeenCalled());
    const other = { ...loginInfo, data: { ...loginInfo.data, userId: '43', userCode: 'EMP043' } };
    writeDevSsoSession(file, { ...session, authorization: 'other-credential', loginInfo: other });
    complete(Response.json(loginInfo));
    const response = await pending;
    expect(response.status).toBe(409);
    expect(response.headers.authorization).toBeUndefined();
    expect(readDevSsoSession(file, application).loginInfo.data.userId).toBe('43');
  });

  it('拒绝同一 Host 的跨协议来源', async () => {
    writeDevSsoSession(file, session);
    await start();
    expect((await get(undefined, { origin: baseUrl.replace('http:', 'https:') })).status).toBe(403);
    expect(fetchGateway).not.toHaveBeenCalled();
  });

  it.each(['missing', 'invalid', 'expired', 'wrong-app', 'missing-code'])(
    '会话 %s 时不返回假用户，也不请求网关',
    async (scenario) => {
      if (scenario === 'invalid') writeFileSync(file, '{broken json');
      else if (scenario !== 'missing')
        writeFileSync(
          file,
          JSON.stringify({
            ...session,
            ...(scenario === 'expired' ? { expiresAt: 1 } : {}),
            ...(scenario === 'wrong-app' ? { clientId: 'other-client' } : {}),
            ...(scenario === 'missing-code'
              ? { loginInfo: { ...loginInfo, data: { ...loginInfo.data, userCode: '' } } }
              : {})
          })
        );
      await start();
      const response = await get();
      expect(response.status).toBe(scenario === 'expired' ? 401 : 503);
      expect(response.headers.authorization).toBeUndefined();
      expect(response.body).not.toContain('DEV001');
      expect(JSON.parse(response.body).msg).toContain(
        scenario === 'expired' ? '自动续会话失败' : '刷新真实开发会话'
      );
      expect(fetchGateway).not.toHaveBeenCalled();
    }
  );

  it.each([401, 403])('保留网关 %i，不下发缓存凭据或用户', async (status) => {
    writeDevSsoSession(file, session);
    fetchGateway.mockResolvedValueOnce(Response.json({ code: status }, { status }));
    await start();
    const response = await get();
    expect(response.status).toBe(status);
    expect(response.headers.authorization).toBeUndefined();
    expect(response.body).not.toContain('EMP042');
    expect(loginProcess.exec).toHaveBeenCalledTimes(status === 401 ? 1 : 0);
  });

  it('识别 HTTP 200 中的业务 401', async () => {
    writeDevSsoSession(file, session);
    fetchGateway.mockResolvedValueOnce(Response.json({ code: '401' }));
    await start();
    expect((await get()).status).toBe(401);
  });

  it.each(['expired', 'near-expiry', 'gateway-401'])(
    '%s 自动重新登录后校验新凭据并通过响应头下发',
    async (reason) => {
      if (reason === 'gateway-401') {
        fetchGateway.mockResolvedValueOnce(Response.json({ code: 401 }, { status: 401 }));
      }
      writeFileSync(
        file,
        JSON.stringify({
          ...session,
          expiresAt:
            reason === 'expired'
              ? 1
              : reason === 'near-expiry'
                ? Date.now() + 60_000
                : session.expiresAt
        })
      );
      loginProcess.exec.mockImplementation((_command, _args, options, done) => {
        expect(options.env.PLAYWRIGHT_SSO_SESSION_ONLY).toBe('1');
        expect(options.env.PLAYWRIGHT_SSO_EXPECTED_SESSION_VERSION).toBe(
          getDevSsoSessionVersion(session.authorization)
        );
        writeDevSsoSession(
          file,
          { ...session, authorization: 'renewed-credential' },
          options.env.PLAYWRIGHT_SSO_EXPECTED_SESSION_VERSION
        );
        queueMicrotask(() => done(null));
      });
      await start();
      const response = await get();
      expect(response.status).toBe(200);
      expect(response.headers.authorization).toBe('renewed-credential');
      expect(loginProcess.exec).toHaveBeenCalledTimes(1);
    }
  );

  it('并发过期请求只启动一个登录进程', async () => {
    writeFileSync(file, JSON.stringify({ ...session, expiresAt: 1 }));
    loginProcess.exec.mockImplementation((_command, _args, options, done) => {
      setTimeout(() => {
        writeDevSsoSession(
          file,
          { ...session, authorization: 'renewed-credential' },
          options.env.PLAYWRIGHT_SSO_EXPECTED_SESSION_VERSION
        );
        done(null);
      }, 30);
    });
    await start();
    const responses = await Promise.all([get(), get(), get()]);
    expect(responses.map((response) => response.status)).toEqual([200, 200, 200]);
    expect(loginProcess.exec).toHaveBeenCalledTimes(1);
  });

  it('自动登录失败后暂停，避免同一会话反复尝试密码', async () => {
    writeFileSync(file, JSON.stringify({ ...session, expiresAt: 1 }));
    await start();
    expect((await get()).status).toBe(401);
    expect((await get()).status).toBe(401);
    expect(loginProcess.exec).toHaveBeenCalledTimes(1);
  });

  it('本地账号配置更新后允许恢复自动续会话', async () => {
    writeFileSync(file, JSON.stringify({ ...session, expiresAt: 1 }));
    await start();
    expect((await get()).status).toBe(401);
    writeFileSync(join(directory, 'credentials.json'), '{}');
    loginProcess.exec.mockImplementation((_command, _args, options, done) => {
      writeDevSsoSession(
        file,
        { ...session, authorization: 'renewed-credential' },
        options.env.PLAYWRIGHT_SSO_EXPECTED_SESSION_VERSION
      );
      queueMicrotask(() => done(null));
    });
    expect((await get()).status).toBe(200);
    expect(loginProcess.exec).toHaveBeenCalledTimes(2);
  });

  it('提前续期失败时保留仍有效的会话', async () => {
    writeDevSsoSession(file, { ...session, expiresAt: Date.now() + 60_000 });
    await start();
    expect((await get()).status).toBe(200);
    expect((await get()).status).toBe(200);
    expect(loginProcess.exec).toHaveBeenCalledTimes(1);
  });

  it('提前续期失败后，网关轮换旧会话 token 不会引发重复密码尝试', async () => {
    writeDevSsoSession(file, { ...session, expiresAt: Date.now() + 60_000 });
    fetchGateway.mockResolvedValueOnce(
      Response.json(loginInfo, { headers: { Authorization: 'rotated-credential' } })
    );
    await start();
    expect((await get()).status).toBe(200);
    const rotated = readDevSsoSession(file, application);
    writeFileSync(file, JSON.stringify({ ...rotated, expiresAt: Date.now() + 60_000 }));
    expect((await get()).status).toBe(200);
    expect(loginProcess.exec).toHaveBeenCalledTimes(1);
  });

  it('旧的自动登录结果不能覆盖已切换的账号', () => {
    writeDevSsoSession(file, { ...session, authorization: 'other-user' });
    expect(() =>
      writeDevSsoSession(file, session, getDevSsoSessionVersion(session.authorization))
    ).toThrow('已切换');
    expect(readDevSsoSession(file, application).authorization).toBe('other-user');
  });

  it('网络故障返回安全错误，不泄露原始异常或凭据', async () => {
    writeDevSsoSession(file, session);
    fetchGateway.mockRejectedValueOnce(new Error('test-credential secret-url'));
    await start();
    const response = await get();
    expect(response.status).toBe(502);
    expect(response.body).not.toMatch(/test-credential|secret-url/);
    expect(loginProcess.exec).not.toHaveBeenCalled();
  });

  it.each([
    { origin: 'https://foreign.invalid' },
    { host: 'foreign.invalid' },
    { 'sec-fetch-site': 'cross-site' }
  ])('拒绝非本机同源访问 %j', async (headers) => {
    writeDevSsoSession(file, session);
    await start();
    const response = await get(undefined, headers);
    expect(response.status).toBe(403);
    expect(response.headers.authorization).toBeUndefined();
    expect(fetchGateway).not.toHaveBeenCalled();
  });

  it('静态服务不能读取真实会话或其他凭据文件', async () => {
    writeDevSsoSession(file, session);
    await start();
    for (const path of ['/' + file, '/@fs/' + resolveDevSsoSessionPath(file)]) {
      const response = await get(path);
      expect(response.status).toBe(403);
      expect(response.body).not.toContain('test-credential');
    }
  });

  it('普通业务路径不下发凭据，也不访问测试网关', async () => {
    writeDevSsoSession(file, session);
    await start();
    const response = await get('/infra/api/task-center/my-task/page');
    expect(response.headers.authorization).toBeUndefined();
    expect(fetchGateway).not.toHaveBeenCalled();
  });

  it('只允许保存到已忽略的会话目录，并拒绝非法菜单和换行凭据', () => {
    expect(() => resolveDevSsoSessionPath('src/session.json')).toThrow('playwright/.auth');
    expect(() =>
      validateDevSsoSession({ ...session, authorization: 'token\r\nheader' }, application)
    ).toThrow();
    expect(() =>
      validateDevSsoSession(
        { ...session, loginInfo: { ...loginInfo, data: { ...loginInfo.data, menuData: [{}] } } },
        application
      )
    ).toThrow();
  });

  it('使用 JWT 有效期，不透明凭据采用有上限的本地缓存', () => {
    const token = `header.${Buffer.from(JSON.stringify({ exp: 10 })).toString('base64url')}.signature`;
    expect(getDevSsoExpiresAt('Bearer ' + token, 0)).toBe(10_000);
    expect(getDevSsoExpiresAt('opaque', 0)).toBe(3_600_000);
  });
});
