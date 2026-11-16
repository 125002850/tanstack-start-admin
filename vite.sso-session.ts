import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, resolve, sep } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { LoginUserRsp } from './src/lib/api/sso/type';

export interface DevSsoApplication {
  clientId: string;
  serviceId: string;
  serviceCode: string;
}

export interface DevSsoSession extends DevSsoApplication {
  loginId?: string;
  loginInfoUrl: string;
  authorization: string;
  expiresAt: number;
  loginInfo: LoginUserRsp;
}

export class DevSsoSessionError extends Error {
  readonly status: number;

  constructor(message: string, status = 503) {
    super(message);
    this.status = status;
  }
}

const REFRESH_MESSAGE = '请运行 SSO 登录脚本刷新真实开发会话。';

export function resolveDevSsoSessionPath(file: string, root = process.cwd()): string {
  const path = resolve(root, file);
  if (!path.startsWith(resolve(root, 'playwright/.auth') + sep)) {
    throw new DevSsoSessionError('真实会话文件必须保存在本项目的 playwright/.auth/ 下。');
  }
  return path;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isMenuList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        isRecord(item) &&
        typeof item.code === 'string' &&
        (item.children === undefined || isMenuList(item.children))
    )
  );
}

export function validateDevSsoSession(
  value: unknown,
  application: DevSsoApplication,
  now = Date.now()
): DevSsoSession {
  if (
    !isRecord(value) ||
    !application.clientId ||
    !application.serviceId ||
    !application.serviceCode ||
    value.clientId !== application.clientId ||
    value.serviceCode !== application.serviceCode ||
    value.serviceId !== application.serviceId
  ) {
    throw new DevSsoSessionError(`真实会话与当前应用配置不匹配。${REFRESH_MESSAGE}`);
  }
  if (value.loginId !== undefined && (typeof value.loginId !== 'string' || !value.loginId.trim())) {
    throw new DevSsoSessionError(`真实会话标识无效。${REFRESH_MESSAGE}`);
  }
  if (
    typeof value.authorization !== 'string' ||
    !value.authorization.trim() ||
    /[\r\n]/.test(value.authorization) ||
    typeof value.expiresAt !== 'number' ||
    !Number.isSafeInteger(value.expiresAt) ||
    value.expiresAt <= now
  ) {
    throw new DevSsoSessionError(`真实会话缺失或已过期。${REFRESH_MESSAGE}`, 401);
  }
  try {
    const url = new URL(String(value.loginInfoUrl));
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      !url.pathname.endsWith('/api/getLoginInfo')
    )
      throw new Error();
  } catch {
    throw new DevSsoSessionError(`真实会话的登录信息地址无效。${REFRESH_MESSAGE}`);
  }
  const body = value.loginInfo;
  if (
    !isRecord(body) ||
    body.success !== true ||
    !isRecord(body.data) ||
    typeof body.data.userId !== 'string' ||
    !/^\d+$/.test(body.data.userId) ||
    typeof body.data.userCode !== 'string' ||
    !body.data.userCode.trim() ||
    !isMenuList(body.data.menuData)
  ) {
    throw new DevSsoSessionError(`真实会话缺少有效用户、工号或菜单。${REFRESH_MESSAGE}`);
  }
  return value as unknown as DevSsoSession;
}

export function readDevSsoSession(
  file: string,
  application: DevSsoApplication,
  options: { allowExpired?: boolean } = {}
): DevSsoSession {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(resolveDevSsoSessionPath(file), 'utf8'));
  } catch {
    throw new DevSsoSessionError(`无法读取真实会话文件。${REFRESH_MESSAGE}`);
  }
  const session = validateDevSsoSession(value, application, options.allowExpired ? 0 : Date.now());
  return { ...session, loginId: session.loginId || getDevSsoSessionVersion(session.authorization) };
}

export function getDevSsoSessionVersion(authorization: string): string {
  return createHash('sha256').update(authorization).digest('hex');
}

export function writeDevSsoSession(
  file: string,
  session: DevSsoSession,
  expectedVersion?: string
): void {
  validateDevSsoSession(session, session);
  if (
    expectedVersion &&
    getDevSsoSessionVersion(
      readDevSsoSession(file, session, { allowExpired: true }).authorization
    ) !== expectedVersion
  ) {
    throw new DevSsoSessionError('真实会话已切换，已丢弃旧的自动登录结果。', 409);
  }
  const path = resolveDevSsoSessionPath(file);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  const temporaryPath = `${path}.${randomUUID()}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify(session) + '\n', { mode: 0o600 });
  renameSync(temporaryPath, path);
}

export function getDevSsoExpiresAt(authorization: string, now = Date.now()): number {
  try {
    const token = authorization.replace(/^Bearer\s+/i, '');
    const claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    if (typeof claims.exp === 'number' && Number.isSafeInteger(claims.exp * 1000)) {
      return claims.exp * 1000;
    }
  } catch {
    /* 不透明 token 由登录信息接口验证。 */
  }
  // ponytail: 不透明 token 的本地缓存最多一小时；每次登录信息请求仍向网关校验。
  return now + 60 * 60 * 1000;
}

export async function verifyDevSsoSession(session: DevSsoSession): Promise<DevSsoSession> {
  let response: Response;
  try {
    response = await fetch(session.loginInfoUrl, {
      headers: {
        Authorization: session.authorization,
        'client-id': session.clientId,
        'service-id': session.serviceId,
        'service-code': session.serviceCode,
        Accept: 'application/json'
      },
      redirect: 'error',
      credentials: 'omit',
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    throw new DevSsoSessionError('无法连接 SSO 测试网关，请检查网络后重试。', 502);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    /* 下方统一报告安全错误。 */
  }
  const status = isRecord(body) ? Number(body.code ?? body.rspCode) : response.status;
  if (response.status === 401 || status === 401) {
    throw new DevSsoSessionError(`真实 SSO 会话已失效。${REFRESH_MESSAGE}`, 401);
  }
  if (response.status === 403 || status === 403) {
    throw new DevSsoSessionError('当前真实 SSO 用户无权访问当前应用。', 403);
  }
  if (!response.ok || !isRecord(body) || status !== 200 || body.success !== true) {
    throw new DevSsoSessionError('SSO 测试网关未返回有效登录信息。', 502);
  }
  const authorization = response.headers.get('authorization') || session.authorization;
  return validateDevSsoSession(
    {
      ...session,
      authorization,
      expiresAt:
        authorization === session.authorization
          ? session.expiresAt
          : getDevSsoExpiresAt(authorization),
      loginInfo: body
    },
    session
  );
}
