// @vitest-environment node

import {
  BizError,
  DecodeError,
  HttpError,
  NetworkError,
  TimeoutError
} from '@oig/react-query-generator/core';
import { describe, expect, it } from 'vitest';

import { isApiRequestAbort, normalizeApiError, normalizeBusinessError } from './error-normalizer';

const REQUEST = { method: 'POST', url: '/test' };

describe('api error normalizer', () => {
  it.each([
    [3003201, '场景编码已被占用。'],
    [3003223, '这是后端新增且前端未知的业务错误。'],
    ['3003999', '未来业务码无需同步前端文案表。'],
    ['SCHEDULE_CONFLICT', '调度任务已被其他请求修改。']
  ] as const)('uses the backend message for business code %s', (code, message) => {
    expect(
      normalizeApiError({
        status: 200,
        causeBody: { code, msg: message }
      })
    ).toEqual({
      code: typeof code === 'string' && /^\d+$/.test(code) ? Number(code) : code,
      message
    });
  });

  it('keeps a business 404 distinct from an HTTP 404', () => {
    expect(
      normalizeApiError(
        new BizError('request failed', REQUEST, 404, {
          code: 404,
          msg: 'url 转发规则为空'
        })
      )
    ).toEqual({ code: 404, message: 'url 转发规则为空' });
  });

  it('retains only the public business code and message', () => {
    const marker = 'RAW_BACKEND_EXCEPTION_MARKER';
    const info = normalizeApiError({
      status: 500,
      causeBody: {
        code: 3003113,
        msg: '发布前校验已变化，请重新校验。',
        className: marker,
        stack: marker,
        payload: marker,
        sourceSnippet: marker,
        transportSecret: marker
      },
      message: marker,
      stack: marker
    });

    expect(info).toEqual({
      code: 3003113,
      message: '发布前校验已变化，请重新校验。'
    });
    expect(JSON.stringify(info)).not.toContain(marker);
  });

  it('redacts a long URL before preserving the actionable business message', () => {
    const signedUrl = `http://10.0.0.1:9000/file.jpg?X-Amz-Security-Token=${'secret'.repeat(80)}`;
    const info = normalizeApiError(
      {
        causeBody: {
          code: 3003245,
          msg: `附件 URL 不可访问：${signedUrl}。请确认文件地址是否正确且可由消息平台访问。`
        }
      },
      { fallbackMessage: '模拟调用失败，请检查请求后重试。' }
    );

    expect(info).toEqual({
      code: 3003245,
      message: '附件 URL 不可访问：[链接已隐藏]。请确认文件地址是否正确且可由消息平台访问。'
    });
    expect(JSON.stringify(info)).not.toContain('10.0.0.1');
    expect(JSON.stringify(info)).not.toContain('X-Amz-Security-Token');
    expect(JSON.stringify(info)).not.toContain('secret');
  });

  it.each([
    [401, 'UNAUTHORIZED', '登录状态已失效，请重新登录。'],
    [403, 'FORBIDDEN', '你没有执行此操作的权限。'],
    [404, 'NOT_FOUND', '资源不存在或你已无权访问。'],
    [408, 'TIMEOUT', '请求超时，请稍后重试。'],
    [429, 'RATE_LIMITED', '请求过于频繁，请稍后重试。']
  ] as const)('uses a stable message for HTTP status %s', (status, code, message) => {
    expect(
      normalizeApiError(
        new HttpError('request failed', REQUEST, status, `HTTP ${status}`, new Headers(), {
          code: 3003201,
          msg: '不应展示的后端文案'
        })
      )
    ).toEqual({ code, message });
  });

  it.each([
    [401, 'UNAUTHORIZED', '登录状态已失效，请重新登录。'],
    [403, 'FORBIDDEN', '你没有执行此操作的权限。'],
    [429, 'RATE_LIMITED', '请求过于频繁，请稍后重试。']
  ] as const)('uses a stable message for auth business code %s', (businessCode, code, message) => {
    expect(
      normalizeApiError({
        causeBody: { code: businessCode, msg: '不应展示的后端文案' }
      })
    ).toEqual({ code, message });
  });

  it('uses a bounded generated HTTP response message when no business code exists', () => {
    expect(
      normalizeApiError(
        new HttpError('request failed', REQUEST, 503, 'HTTP 503', new Headers(), {
          message: 'service unavailable'
        })
      )
    ).toEqual({ code: 'REQUEST_FAILED', message: 'service unavailable' });
  });

  it.each([
    { caseName: 'missing message', error: { causeBody: { code: 3003999 } } },
    { caseName: 'blank message', error: { causeBody: { code: 3003999, msg: '   ' } } },
    {
      caseName: 'oversized message',
      error: { causeBody: { code: 3003999, msg: 'x'.repeat(257) } }
    },
    { caseName: 'missing business code', error: { causeBody: { msg: '缺少业务码' } } }
  ])(
    'uses the caller fallback when public business information is unavailable: $caseName',
    ({ error }) => {
      expect(normalizeApiError(error, { fallbackMessage: '当前操作失败。' })).toEqual({
        code: 'REQUEST_FAILED',
        message: '当前操作失败。'
      });
    }
  );

  it('normalizes an in-band business failure', () => {
    expect(normalizeBusinessError(3003218, '发送对象不可用')).toEqual({
      code: 3003218,
      message: '发送对象不可用'
    });
    expect(normalizeBusinessError(3003218, null, { fallbackMessage: '路由过程未成功。' })).toEqual({
      code: 'REQUEST_FAILED',
      message: '路由过程未成功。'
    });
  });

  it('normalizes timeout and network errors without retaining their causes', () => {
    const marker = new Error('RAW_TRANSPORT_MARKER');

    expect(normalizeApiError(new TimeoutError('request timed out', REQUEST, marker))).toEqual({
      code: 'TIMEOUT',
      message: '请求超时，请稍后重试。'
    });
    expect(normalizeApiError(new NetworkError('network failed', REQUEST, marker))).toEqual({
      code: 'NETWORK_ERROR',
      message: '网络连接失败，请检查网络后重试。'
    });
  });

  it('surfaces a safe schema path for a response contract mismatch', () => {
    const marker = 'RAW_BACKEND_MARKER';
    const info = normalizeApiError(
      new DecodeError(
        'Response body does not match the OpenAPI schema (data.syntaxCapabilities.variablePathPattern: Invalid input).',
        REQUEST,
        { marker }
      )
    );

    expect(info).toEqual({
      code: 'RESPONSE_CONTRACT_MISMATCH',
      message: '接口返回的数据与契约不符，问题字段：data.syntaxCapabilities.variablePathPattern。'
    });
    expect(JSON.stringify(info)).not.toContain(marker);
  });

  it('uses a stable contract message when a decode path is unavailable', () => {
    expect(
      normalizeApiError(new DecodeError('Failed to decode JSON response body.', REQUEST))
    ).toEqual({
      code: 'RESPONSE_CONTRACT_MISMATCH',
      message: '接口返回的数据与契约不符，请检查接口响应。'
    });
  });

  it('recognizes aborts and does not expose their raw message', () => {
    const error = { name: 'AbortError', message: 'RAW_ABORT_MARKER' };
    const wrappedError = new NetworkError('network failed', REQUEST, error);

    expect(isApiRequestAbort(error)).toBe(true);
    expect(isApiRequestAbort(wrappedError)).toBe(true);
    expect(normalizeApiError(error)).toEqual({
      code: 'REQUEST_ABORTED',
      message: '请求已取消。'
    });
    expect(normalizeApiError(wrappedError)).toEqual({
      code: 'REQUEST_ABORTED',
      message: '请求已取消。'
    });
  });

  it('does not expose an unknown Error message', () => {
    expect(normalizeApiError(new Error('RAW_UNKNOWN_ERROR'))).toEqual({
      code: 'REQUEST_FAILED',
      message: '请求未能完成，请稍后重试。'
    });
  });
});
