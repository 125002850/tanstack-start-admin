import { HTTP_STATUS_FORBIDDEN, HTTP_STATUS_UNAUTHORIZED } from '../../http-status';

export interface LoginForbiddenErrorOptions {
  message?: string;
  loginUrl?: string;
  logoutUrl?: string;
}

export class LoginForbiddenError extends Error {
  readonly status = HTTP_STATUS_FORBIDDEN;
  readonly loginUrl?: string;
  readonly logoutUrl?: string;

  constructor(options: LoginForbiddenErrorOptions = {}) {
    super(options.message || '当前账号无权限访问本系统');
    this.name = 'LoginForbiddenError';
    this.loginUrl = options.loginUrl;
    this.logoutUrl = options.logoutUrl;
  }
}

export function isLoginForbiddenError(error: unknown): error is LoginForbiddenError {
  if (error instanceof LoginForbiddenError) return true;
  if (!error || typeof error !== 'object') return false;

  const record = error as Record<string, unknown>;
  return record.name === 'LoginForbiddenError' && record.status === HTTP_STATUS_FORBIDDEN;
}

/** 首次登录引导失败或正在跳转，与已登录会话过期区分。 */
export class LoginRequiredError extends Error {
  readonly status = HTTP_STATUS_UNAUTHORIZED;
  constructor(readonly redirectUrl?: string) {
    super(redirectUrl ? '正在跳转登录，请稍候。' : '未获取到登录地址，请重试或联系管理员。');
    this.name = 'LoginRequiredError';
  }
}

/** 只识别明确的 401，不根据错误文案猜测登录状态。 */
export function isUnauthorizedResponse(body: unknown): boolean {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const record = body as Record<string, unknown>;
  const code = record.code ?? record.rspCode;
  return (
    code === HTTP_STATUS_UNAUTHORIZED ||
    (typeof code === 'string' && code.trim() === String(HTTP_STATUS_UNAUTHORIZED))
  );
}
