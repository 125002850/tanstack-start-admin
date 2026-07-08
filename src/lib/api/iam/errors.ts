import { HttpError } from '@oig/react-query-generator/core';
import { IAM_AUTH_MUST_CHANGE_PASSWORD_CODE } from './constants';

export class AuthRequiredError extends Error {
  constructor(message = '请先登录') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

export class PasswordChangeRequiredError extends Error {
  constructor(message = '必须修改密码') {
    super(message);
    this.name = 'PasswordChangeRequiredError';
  }
}

export class PermissionDeniedError extends Error {
  constructor(message = '没有访问该资源的权限') {
    super(message);
    this.name = 'PermissionDeniedError';
  }
}

function getBodyCode(body: unknown): number | undefined {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) return undefined;
  const code = (body as { code?: unknown }).code;
  if (typeof code === 'number') return code;
  if (typeof code === 'string') {
    const parsed = Number(code);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function isAuthRequiredError(error: unknown): error is AuthRequiredError {
  return (
    error instanceof AuthRequiredError ||
    (error as { name?: unknown })?.name === 'AuthRequiredError'
  );
}

export function isPasswordChangeRequiredError(
  error: unknown
): error is PasswordChangeRequiredError {
  if (error instanceof PasswordChangeRequiredError) return true;
  if ((error as { name?: unknown })?.name === 'PasswordChangeRequiredError') return true;
  if (error instanceof HttpError) {
    return getBodyCode(error.causeBody) === IAM_AUTH_MUST_CHANGE_PASSWORD_CODE;
  }
  return false;
}

export function isPermissionDeniedError(error: unknown): error is PermissionDeniedError {
  return (
    error instanceof PermissionDeniedError ||
    (error as { name?: unknown })?.name === 'PermissionDeniedError'
  );
}
