// @vitest-environment node

import { constants, generateKeyPairSync, privateDecrypt } from 'node:crypto';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  loginSsoWithHttp,
  SsoCredentialsError
} from '../../../.agents/skills/oig-sso-skill/scripts/http-sso-login.mjs';
import { DevSsoSessionError, readDevSsoSession } from '../../../vite.sso-session';

vi.mock('@playwright/test', () => {
  throw new Error('HTTP 登录不应加载 Playwright');
});

const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 1024 });
const publicKeyBody = publicKey
  .export({ type: 'spki', format: 'pem' })
  .replace(/-----[^-]+-----|\s/g, '');
const loginHtml = `<form id="loginForm" action="/login/submit" method="post"></form>
  <script>var public_key = "${publicKeyBody}";</script>`;
const loginViewUrl = 'https://auth.invalid/login/loginView';
const credentials = { account: 'fixture-account', password: 'fixture-password' };
const fetchSso = vi.fn();
const login = () => loginSsoWithHttp({ loginViewUrl, clientId: 'fixture-client', credentials });
const redirect = (location, cookies = []) =>
  new Response(null, {
    status: 302,
    headers: [['Location', location], ...cookies.map((cookie) => ['Set-Cookie', cookie])]
  });

beforeEach(() => {
  fetchSso.mockReset();
  vi.stubGlobal('fetch', fetchSso);
  fetchSso.mockResolvedValueOnce(
    new Response(loginHtml, {
      headers: { 'Set-Cookie': 'JSESSIONID=fixture-session; Path=/; HttpOnly' }
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('SSO HTTP 登录', () => {
  it('开发会话完整登录、网关校验和保存全程不加载 Playwright', async () => {
    mkdirSync('playwright/.auth', { recursive: true });
    const directory = mkdtempSync('playwright/.auth/http-login-test-');
    const application = {
      clientId: 'fixture-client',
      serviceId: 'fixture-service',
      serviceCode: 'fixture-app'
    };
    const file = join(directory, 'session.json');
    const credentialFile = join(directory, 'credentials.json');
    try {
      writeFileSync(credentialFile, JSON.stringify(credentials), { mode: 0o600 });
      for (const [name, value] of Object.entries({
        DEV_MOCK_SSO: 'true',
        DEV_SSO_SESSION_FILE: file,
        PLAYWRIGHT_SSO_SESSION_ONLY: '1',
        PLAYWRIGHT_SSO_EXPECTED_SESSION_VERSION: '',
        PLAYWRIGHT_SSO_CLIENT_ID: application.clientId,
        PLAYWRIGHT_SSO_CREDENTIALS: credentialFile,
        PLAYWRIGHT_SSO_ACCOUNT: '',
        PLAYWRIGHT_SSO_PASSWORD: '',
        PLAYWRIGHT_SSO_LOGIN_INFO_URL: 'https://gateway.invalid/infra/api/getLoginInfo',
        VITE_APP_SSO_CLIENT_ID: application.clientId,
        VITE_APP_SSO_SERVICE_ID: application.serviceId,
        VITE_APP_SSO_SERVICE_CODE: application.serviceCode
      })) {
        vi.stubEnv(name, value);
      }
      vi.spyOn(console, 'log').mockImplementation(() => {});
      fetchSso.mockResolvedValueOnce(redirect('http://app.invalid/?token=fixture-token'));
      fetchSso.mockResolvedValueOnce(
        Response.json({
          rspCode: '200',
          success: true,
          data: { userId: '42', userCode: 'EMP042', menuData: [] }
        })
      );
      const { main } =
        await import('../../../.agents/skills/oig-sso-skill/scripts/record-auth.mjs');
      await main('http://127.0.0.1:3090/overview');
      const session = readDevSsoSession(file, application);
      expect(session.authorization).toBe('fixture-token');
      expect(session.loginInfo.data.userCode).toBe('EMP042');
      expect(fetchSso).toHaveBeenCalledTimes(3);
      expect(fetchSso.mock.calls[2][0]).toBe('https://gateway.invalid/infra/api/getLoginInfo');
    } finally {
      rmSync(directory, { recursive: true, force: true });
    }
  });

  it('用页面 RSA 公钥加密密码，透传 Cookie，并从回跳取得 token', async () => {
    fetchSso.mockResolvedValueOnce(
      redirect('/sso/login?clientId=fixture-client', [
        'ticket-id-test=fixture-ticket; Path=/; Secure'
      ])
    );
    fetchSso.mockResolvedValueOnce(redirect('http://app.invalid/?token=fixture-token'));
    const callback = await login();
    expect(callback.searchParams.get('token')).toBe('fixture-token');
    expect(fetchSso).toHaveBeenCalledTimes(3);
    const [url, options] = fetchSso.mock.calls[1];
    expect(url.href).toBe('https://auth.invalid/login/submit');
    expect(options.method).toBe('POST');
    expect(options.redirect).toBe('manual');
    expect(options.headers.Cookie).toBe('JSESSIONID=fixture-session');
    expect(options.body.get('account')).toBe(credentials.account);
    expect(options.body.get('clientId')).toBe('fixture-client');
    const padded = privateDecrypt(
      { key: privateKey, padding: constants.RSA_NO_PADDING },
      Buffer.from(options.body.get('password'), 'base64')
    );
    expect(padded.subarray(0, 2)).toEqual(Buffer.from([0, 2]));
    expect(padded.subarray(padded.indexOf(0, 2) + 1).toString()).toBe(credentials.password);
    expect(fetchSso.mock.calls[2][1].headers.Cookie).toContain('ticket-id-test=fixture-ticket');
    expect(fetchSso.mock.calls.some(([target]) => target.hostname === 'app.invalid')).toBe(false);
  });

  it('登录返回票据但没有 HTTP 跳转时，再请求 SSO 授权入口', async () => {
    fetchSso.mockResolvedValueOnce(
      new Response('', { headers: { 'Set-Cookie': 'ticket-id-test=fixture-ticket; Path=/' } })
    );
    fetchSso.mockResolvedValueOnce(redirect('https://app.invalid/?token=fixture-token'));
    await login();
    expect(fetchSso.mock.calls[2][0].pathname).toBe('/sso/login');
  });

  it('HTTP 401 立即要求重新输入，不等待回跳或泄露后端原文', async () => {
    fetchSso.mockResolvedValueOnce(new Response(credentials.password, { status: 401 }));
    const error = await login().catch((error) => error);
    expect(error).toBeInstanceOf(SsoCredentialsError);
    expect(error.message).not.toContain(credentials.password);
    expect(fetchSso).toHaveBeenCalledTimes(2);
  });

  it('识别 HTTP 200 登录页中的账号密码错误', async () => {
    fetchSso.mockResolvedValueOnce(
      new Response('<script>var errorMsg = "账号或密码错误";</script>')
    );
    await expect(login()).rejects.toBeInstanceOf(SsoCredentialsError);
  });

  it('HTTP 500 JSON 中的账号锁定优先于密码错误，不触发重复输入', async () => {
    fetchSso.mockResolvedValueOnce(
      Response.json({ message: '账号密码错误次数过多，账号已锁定' }, { status: 500 })
    );
    const error = await login().catch((error) => error);
    expect(error).toBeInstanceOf(DevSsoSessionError);
    expect(error).not.toBeInstanceOf(SsoCredentialsError);
    expect(error.status).toBe(403);
    expect(error.message).toContain('已停止重试');
    expect(fetchSso).toHaveBeenCalledTimes(2);
  });

  it('JSON 业务响应中的普通密码错误可以重新输入', async () => {
    fetchSso.mockResolvedValueOnce(Response.json({ message: '账号或密码错误' }, { status: 500 }));
    await expect(login()).rejects.toBeInstanceOf(SsoCredentialsError);
  });

  it.each([
    [403, ''],
    [200, '<script>var errorMsg = "请输入验证码";</script>'],
    [200, '<script>var errorMsg = "账号已锁定";</script>']
  ])('权限或额外验证失败（HTTP %i）不要求重复输入密码', async (status, html) => {
    fetchSso.mockResolvedValueOnce(new Response(html, { status }));
    const error = await login().catch((error) => error);
    expect(error).toBeInstanceOf(DevSsoSessionError);
    expect(error).not.toBeInstanceOf(SsoCredentialsError);
    expect(error.status).toBe(403);
  });

  it('拒绝把 Cookie 或凭据发送到其他登录域名', async () => {
    fetchSso.mockResolvedValueOnce(redirect('https://foreign.invalid/login'));
    await expect(login()).rejects.toThrow('非预期的登录跳转');
    expect(fetchSso).toHaveBeenCalledTimes(2);
  });

  it('拒绝向跨域表单提交账号密码', async () => {
    fetchSso.mockReset();
    fetchSso.mockResolvedValueOnce(
      new Response(loginHtml.replace('/login/submit', 'https://foreign.invalid/login'))
    );
    await expect(login()).rejects.toThrow('非预期的登录跳转');
    expect(fetchSso).toHaveBeenCalledTimes(1);
  });

  it('拒绝错误应用的 token 回跳', async () => {
    fetchSso.mockResolvedValueOnce(
      redirect('https://app.invalid/?token=fixture-token&clientId=other-client')
    );
    await expect(login()).rejects.toThrow('当前应用不匹配');
  });

  it('协议变更缺少公钥时直接报告错误，不发送密码', async () => {
    fetchSso.mockReset();
    fetchSso.mockResolvedValueOnce(new Response('<html>unavailable</html>'));
    await expect(login()).rejects.toThrow('RSA 公钥缺失');
    expect(fetchSso).toHaveBeenCalledTimes(1);
  });

  it('网络异常使用固定文案，不输出原始异常', async () => {
    fetchSso.mockRejectedValueOnce(new Error('private-network-detail'));
    await expect(login()).rejects.toThrow(
      '提交 SSO 登录表单失败：请求或协议处理异常，请检查网络和登录协议。'
    );
  });

  it('DNS 失败保留阶段和安全错误码，不输出原始异常或私有地址', async () => {
    fetchSso.mockReset();
    fetchSso.mockRejectedValueOnce(
      new TypeError('private-network-detail', {
        cause: { code: 'ENOTFOUND', message: 'private-host-and-token' }
      })
    );
    const error = await login().catch((error) => error);
    expect(error.message).toContain('读取 SSO 登录页失败');
    expect(error.message).toContain('ENOTFOUND');
    expect(error.message).not.toContain('private-');
    expect(fetchSso).toHaveBeenCalledTimes(1);
  });

  it.each(['CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'])(
    'TLS 错误 %s 明确报告证书问题',
    async (code) => {
      fetchSso.mockRejectedValueOnce(new TypeError('private-tls-detail', { cause: { code } }));
      const error = await login().catch((error) => error);
      expect(error.message).toContain('提交 SSO 登录表单失败');
      expect(error.message).toContain(code);
      expect(error.message).toContain('证书');
      expect(error.message).not.toContain('private-tls-detail');
    }
  );

  it('授权跳转阶段的连接错误与提交密码失败分开报告', async () => {
    fetchSso.mockResolvedValueOnce(redirect('/sso/login?clientId=fixture-client'));
    fetchSso.mockRejectedValueOnce(
      new TypeError('private-detail', { cause: { code: 'ECONNREFUSED' } })
    );
    const error = await login().catch((error) => error);
    expect(error.message).toContain('请求 SSO 授权跳转失败');
    expect(error.message).toContain('ECONNREFUSED');
  });

  it('无效回跳地址报告协议错误，不输出带 token 的原始 URL', async () => {
    fetchSso.mockResolvedValueOnce(redirect('http://[invalid?token=private-token'));
    const error = await login().catch((error) => error);
    expect(error.message).toContain('处理 SSO 登录响应失败');
    expect(error.message).toContain('ERR_INVALID_URL');
    expect(error.message).not.toContain('private-token');
  });

  it('RSA 加密失败时不发送登录请求，并报告加密阶段', async () => {
    const error = await loginSsoWithHttp({
      loginViewUrl,
      clientId: 'fixture-client',
      credentials: { ...credentials, password: 'x'.repeat(300) }
    }).catch((error) => error);
    expect(error.message).toContain('RSA 密码加密失败');
    expect(error.message).toContain('ERR_OSSL_RSA_DATA_TOO_LARGE_FOR_KEY_SIZE');
    expect(fetchSso).toHaveBeenCalledTimes(1);
  });

  it('超时明确报告当前阶段和 30 秒上限', async () => {
    const controller = new AbortController();
    vi.spyOn(AbortSignal, 'timeout').mockReturnValue(controller.signal);
    fetchSso.mockImplementationOnce(async () => {
      controller.abort();
      throw new Error('private-timeout-detail');
    });
    const error = await login().catch((error) => error);
    expect(error.message).toContain('提交 SSO 登录表单失败');
    expect(error.message).toContain('30 秒');
    expect(error.message).not.toContain('private-timeout-detail');
  });

  it('循环跳转在上限内结束', async () => {
    fetchSso.mockResolvedValue(redirect('/sso/loop'));
    await expect(login()).rejects.toThrow('登录跳转次数过多');
    expect(fetchSso).toHaveBeenCalledTimes(10);
  });
});
