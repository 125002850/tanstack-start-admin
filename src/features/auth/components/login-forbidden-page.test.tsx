import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LoginForbiddenPage } from './login-forbidden-page';

const mockLogout = vi.hoisted(() => vi.fn<(redirectUrl?: string | null) => void>());

vi.mock('@/lib/api/sso/session', () => ({
  logout: (redirectUrl?: string | null) => mockLogout(redirectUrl)
}));

describe('LoginForbiddenPage', () => {
  afterEach(() => {
    cleanup();
    mockLogout.mockClear();
  });

  it('renders forbidden guidance with current-theme components', () => {
    render(<LoginForbiddenPage message='没有访问该资源的权限' logoutUrl='https://sso/logout' />);

    expect(screen.getByRole('heading', { name: '无权限访问' })).toBeInTheDocument();
    expect(screen.getByTestId('default-error-illustration')).toHaveAttribute(
      'data-error-illustration',
      '403'
    );
    expect(screen.getByText('没有访问该资源的权限')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /退出登录/ })).toBeInTheDocument();
  });

  it('logs out to the provided logoutUrl', () => {
    render(<LoginForbiddenPage logoutUrl='https://sso/logout' />);

    fireEvent.click(screen.getByRole('button', { name: /退出登录/ }));

    expect(mockLogout).toHaveBeenCalledWith('https://sso/logout');
  });
});
