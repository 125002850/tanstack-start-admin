import {
  BizError,
  DecodeError,
  HttpError,
  NetworkError,
  TimeoutError
} from '@oig/react-query-generator/core';

export type ApiStableErrorCode =
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'NETWORK_ERROR'
  | 'TIMEOUT'
  | 'REQUEST_ABORTED'
  | 'REQUEST_FAILED'
  | 'RESPONSE_CONTRACT_MISMATCH';

export type ApiErrorCode = ApiStableErrorCode | number | string;

export interface ApiErrorInfo {
  readonly code: ApiErrorCode;
  readonly message: string;
}

export interface ApiErrorNormalizationOptions {
  readonly fallbackMessage?: string;
}

const STABLE_ERROR_MESSAGES: Record<ApiStableErrorCode, string> = {
  UNAUTHORIZED: '登录状态已失效，请重新登录。',
  FORBIDDEN: '你没有执行此操作的权限。',
  NOT_FOUND: '资源不存在或你已无权访问。',
  RATE_LIMITED: '请求过于频繁，请稍后重试。',
  NETWORK_ERROR: '网络连接失败，请检查网络后重试。',
  TIMEOUT: '请求超时，请稍后重试。',
  REQUEST_ABORTED: '请求已取消。',
  REQUEST_FAILED: '请求未能完成，请稍后重试。',
  RESPONSE_CONTRACT_MISMATCH: '接口返回的数据与契约不符，请检查接口响应。'
};

const MAX_PUBLIC_BUSINESS_ERROR_MESSAGE_LENGTH = 256;
const MAX_BUSINESS_ERROR_CODE_LENGTH = 64;
const PUBLIC_URL_PATTERN = /\bhttps?:\/\/[^\s<>"'，。；！？]+/giu;
const REDACTED_PUBLIC_URL_LABEL = '[链接已隐藏]';

/**
 * 将 generated client 或结构兼容的未知异常归一化为安全、可序列化的 UI 信息。
 * 原始异常、请求信息和响应载荷不会进入返回值。
 */
export function normalizeApiError(
  error: unknown,
  options: ApiErrorNormalizationOptions = {}
): ApiErrorInfo {
  if (isApiRequestAbort(error)) {
    return createStableErrorInfo('REQUEST_ABORTED');
  }

  const contractMismatch = readContractMismatchInfo(error);
  if (contractMismatch !== null) {
    return contractMismatch;
  }

  const stableHttpCode = mapStableHttpStatus(readHttpStatus(error));
  if (stableHttpCode !== null) {
    return createStableErrorInfo(stableHttpCode);
  }

  const stableBusinessCode = mapStableBusinessCode(readBusinessCode(error));
  if (stableBusinessCode !== null) {
    return createStableErrorInfo(stableBusinessCode);
  }

  if (error instanceof TimeoutError || hasErrorName(error, 'TimeoutError')) {
    return createStableErrorInfo('TIMEOUT');
  }

  if (error instanceof NetworkError || hasErrorName(error, 'NetworkError')) {
    return createStableErrorInfo('NETWORK_ERROR');
  }

  const businessInfo = readBusinessErrorInfo(error);
  if (businessInfo !== null) {
    return businessInfo;
  }

  const generatedMessage = readGeneratedPublicMessage(error);
  if (generatedMessage !== null) {
    return { code: 'REQUEST_FAILED', message: generatedMessage };
  }

  return createRequestFailedInfo(options.fallbackMessage);
}

/** 为接口在响应数据中表达的业务失败创建同样的安全信息。 */
export function normalizeBusinessError(
  code: unknown,
  message: unknown,
  options: ApiErrorNormalizationOptions = {}
): ApiErrorInfo {
  const normalizedCode = normalizeBusinessCode(code);
  const publicMessage = readPublicMessage(message);
  return normalizedCode !== null && publicMessage !== null
    ? { code: normalizedCode, message: publicMessage }
    : createRequestFailedInfo(options.fallbackMessage);
}

export function isApiRequestAbort(error: unknown): boolean {
  const record = asRecord(error);
  return record?.name === 'AbortError' || asRecord(record?.causeBody)?.name === 'AbortError';
}

function readBusinessErrorInfo(error: unknown): ApiErrorInfo | null {
  const code = readBusinessCode(error);
  const causeBody = asRecord(asRecord(error)?.causeBody);
  const message = readPublicMessage(causeBody?.msg) ?? readPublicMessage(causeBody?.message);

  return code !== null && message !== null ? { code, message } : null;
}

function readBusinessCode(error: unknown): number | string | null {
  const record = asRecord(error);
  if (record === null) return null;

  return (
    normalizeBusinessCode(asRecord(record.causeBody)?.code) ?? normalizeBusinessCode(record.code)
  );
}

function readGeneratedPublicMessage(error: unknown): string | null {
  if (!(error instanceof BizError) && !(error instanceof HttpError)) {
    return null;
  }

  const causeBody = asRecord(error.causeBody);
  return readPublicMessage(causeBody?.msg) ?? readPublicMessage(causeBody?.message);
}

function readHttpStatus(error: unknown): number | null {
  if (error instanceof HttpError) return error.status;

  const record = asRecord(error);
  const response = asRecord(record?.response);
  return readHttpStatusValue(response?.status) ?? readHttpStatusValue(record?.status);
}

function readHttpStatusValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 100 && value <= 599) {
    return value;
  }

  if (typeof value === 'string' && /^[1-5][0-9]{2}$/.test(value)) {
    return Number(value);
  }

  return null;
}

function mapStableHttpStatus(status: number | null): ApiStableErrorCode | null {
  switch (status) {
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 408:
      return 'TIMEOUT';
    case 429:
      return 'RATE_LIMITED';
    default:
      return null;
  }
}

function mapStableBusinessCode(code: number | string | null): ApiStableErrorCode | null {
  switch (code) {
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 429:
      return 'RATE_LIMITED';
    default:
      return null;
  }
}

function normalizeBusinessCode(value: unknown): number | string | null {
  if (typeof value === 'number' && Number.isSafeInteger(value)) {
    return value;
  }

  if (typeof value !== 'string') return null;

  const code = value.trim();
  if (code.length === 0 || code.length > MAX_BUSINESS_ERROR_CODE_LENGTH) return null;

  if (/^-?[0-9]+$/.test(code)) {
    const parsed = Number(code);
    return Number.isSafeInteger(parsed) ? parsed : code;
  }

  return code;
}

function readPublicMessage(value: unknown): string | null {
  if (typeof value !== 'string') return null;

  const message = value.trim().replace(PUBLIC_URL_PATTERN, REDACTED_PUBLIC_URL_LABEL);
  return message.length > 0 && message.length <= MAX_PUBLIC_BUSINESS_ERROR_MESSAGE_LENGTH
    ? message
    : null;
}

function createRequestFailedInfo(fallbackMessage: string | undefined): ApiErrorInfo {
  const fallback = typeof fallbackMessage === 'string' ? fallbackMessage.trim() : '';
  return {
    code: 'REQUEST_FAILED',
    message: fallback.length > 0 ? fallback : STABLE_ERROR_MESSAGES.REQUEST_FAILED
  };
}

function createStableErrorInfo(code: ApiStableErrorCode): ApiErrorInfo {
  return { code, message: STABLE_ERROR_MESSAGES[code] };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasErrorName(error: unknown, name: string): boolean {
  return asRecord(error)?.name === name;
}

const SCHEMA_MISMATCH_PATTERN = /Response body does not match the OpenAPI schema \((.+)\)\.$/;
const SAFE_SCHEMA_PATH_PATTERN = /^[A-Za-z0-9_$.[\]-]+$/;
const MAX_SCHEMA_PATH_LENGTH = 160;

function readContractMismatchInfo(error: unknown): ApiErrorInfo | null {
  if (!(error instanceof DecodeError) && !hasErrorName(error, 'DecodeError')) {
    return null;
  }

  const record = asRecord(error);
  const path = typeof record?.message === 'string' ? extractSchemaPath(record.message) : null;
  return {
    code: 'RESPONSE_CONTRACT_MISMATCH',
    message:
      path === null
        ? STABLE_ERROR_MESSAGES.RESPONSE_CONTRACT_MISMATCH
        : `接口返回的数据与契约不符，问题字段：${path}。`
  };
}

function extractSchemaPath(message: string): string | null {
  const issue = SCHEMA_MISMATCH_PATTERN.exec(message)?.[1];
  if (issue === undefined) return null;

  const separator = issue.indexOf(': ');
  const path = separator === -1 ? '' : issue.slice(0, separator);
  return path.length > 0 &&
    path.length <= MAX_SCHEMA_PATH_LENGTH &&
    SAFE_SCHEMA_PATH_PATTERN.test(path)
    ? path
    : null;
}
