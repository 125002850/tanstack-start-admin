// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  SsoCredentialsError,
  waitForLocalToken
} from '../../../.agents/skills/oig-sso-skill/scripts/record-auth.mjs';

afterEach(() => vi.restoreAllMocks());

function loginPage(message) {
  let callback;
  const page = {
    url: () => 'https://auth.invalid/login',
    evaluate: vi.fn().mockResolvedValue(false),
    locator: () => ({ last: () => ({ textContent: async () => message }) }),
    waitForTimeout: async () => {
      callback = new URL('https://app.invalid/?token=test-callback');
    }
  };
  return () =>
    waitForLocalToken(
      page,
      'http://localhost:3090',
      '',
      'http://localhost:3090',
      () => callback,
      'http://localhost:3090/overview',
      true
    );
}

describe('SSO CLI 登录失败识别', () => {
  it.each([
    '账号或密码错误',
    '用户名不存在',
    '密码不正确',
    '密码过于简单，请前往个人中心修改密码!',
    'invalid credentials'
  ])('%s 会立即要求重新输入凭据', async (message) => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(loginPage(message)()).rejects.toBeInstanceOf(SsoCredentialsError);
  });

  it('普通网络提示不被当作账号密码错误', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    await expect(loginPage('网络异常，请稍后重试')()).resolves.toBeUndefined();
  });
});
