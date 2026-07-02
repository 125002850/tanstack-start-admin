export interface LoginForbiddenErrorOptions {
  message?: string;
  loginUrl?: string;
  logoutUrl?: string;
}

export class LoginForbiddenError extends Error {
  readonly status = 403;
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
  return record.name === 'LoginForbiddenError' && record.status === 403;
}
