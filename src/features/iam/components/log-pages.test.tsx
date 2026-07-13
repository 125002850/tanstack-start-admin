import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LoginResultBadge } from '../lib/format';

describe('LoginResultBadge with dict getLabel', () => {
  afterEach(cleanup);

  it('renders label from getLabel when provided', () => {
    const getLabel = vi.fn((code: string) => {
      const map: Record<string, string> = { SUCCESS: '成功', FAIL: '失败' };
      return map[code] ?? code;
    });
    const { container } = render(<LoginResultBadge result='SUCCESS' getLabel={getLabel} />);
    expect(container.textContent).toBe('成功');
    expect(getLabel).toHaveBeenCalledWith('SUCCESS');
  });

  it('renders unknown code as-is when getLabel provided', () => {
    const getLabel = vi.fn((code: string) => code);
    const { container } = render(<LoginResultBadge result='UNKNOWN' getLabel={getLabel} />);
    expect(container.textContent).toBe('UNKNOWN');
  });

  it('falls back to hardcoded labels when getLabel is not provided', () => {
    const { container } = render(<LoginResultBadge result='SUCCESS' />);
    expect(container.textContent).toBe('成功');
  });

  it('renders null result as dash', () => {
    const { container } = render(<LoginResultBadge result={null} />);
    expect(container.textContent).toBe('-');
  });

  it('renders null result as dash when getLabel provided', () => {
    const getLabel = vi.fn((code: string) => code);
    const { container } = render(<LoginResultBadge result={null} getLabel={getLabel} />);
    expect(container.textContent).toBe('-');
    expect(getLabel).not.toHaveBeenCalled();
  });

  it('FAIL variant style is destructive', () => {
    const { container } = render(<LoginResultBadge result='FAIL' />);
    const badge = container.querySelector('span');
    expect(badge).toBeTruthy();
    expect(badge!.className).toContain('destructive');
  });
});

describe('dictTypes constant', () => {
  it('includes IAM_LOGIN dict types', async () => {
    const { dictTypes } = await import('@/constants/dictTypes');
    expect(dictTypes).toContain('IAM_LOGIN_EVENT_TYPE');
    expect(dictTypes).toContain('IAM_LOGIN_RESULT');
    expect(dictTypes).toContain('IAM_LOGIN_FAILURE_REASON');
  });
});
