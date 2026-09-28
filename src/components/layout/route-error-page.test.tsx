import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { LoginRequiredError, LoginForbiddenError } from '@/lib/api/sso/errors';
import { sessionExpiryStore, SessionExpiredError } from '@/lib/api/sso/session-expiry';
import { RouteAccessForbiddenError } from '@/lib/router/route-access';
import { RouteErrorPage } from './route-error-page';

vi.mock('./default-error-page', () => ({
  DefaultErrorPage: ({ code, alertDescription }: { code: string; alertDescription: string }) => (
    <div>
      HTTP {code}: {alertDescription}
    </div>
  )
}));

beforeEach(() => {
  localStorage.clear();
  sessionExpiryStore.setState({ expired: false, logoutUrl: null, redirecting: false });
});
afterEach(cleanup);

it('hands a raw 401 to the global expiry dialog without rendering 500', () => {
  const { container } = render(
    <RouteErrorPage
      error={Object.assign(new Error('unauthorized'), { status: 401 })}
      reset={vi.fn()}
    />
  );
  expect(container).toBeEmptyDOMElement();
  expect(sessionExpiryStore.getState().expired).toBe(true);
});

it('handles session-expired errors even before the store was updated', () => {
  const { container } = render(
    <RouteErrorPage error={new SessionExpiredError()} reset={vi.fn()} />
  );
  expect(container).toBeEmptyDOMElement();
  expect(sessionExpiryStore.getState().expired).toBe(true);
});

it('removes an existing 500 page when a concurrent request expires the session', () => {
  const { container } = render(<RouteErrorPage error={new Error('failure')} reset={vi.fn()} />);
  expect(screen.getByText(/HTTP 500/)).toBeInTheDocument();
  act(() => sessionExpiryStore.setState({ expired: true }));
  expect(container).toBeEmptyDOMElement();
});

it('offers retry when the login service supplied no redirect URL', () => {
  const reset = vi.fn();
  render(<RouteErrorPage error={new LoginRequiredError()} reset={reset} />);
  expect(screen.getByText('暂时无法登录')).toBeInTheDocument();
  expect(screen.queryByText(/HTTP 500/)).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '重试' }));
  expect(reset).toHaveBeenCalledOnce();
  expect(sessionExpiryStore.getState().expired).toBe(false);
});

it('shows a login link while first-entry navigation is pending', () => {
  render(<RouteErrorPage error={new LoginRequiredError('https://sso/login')} reset={vi.fn()} />);
  expect(screen.getByRole('link', { name: '前往登录' })).toHaveAttribute(
    'href',
    'https://sso/login'
  );
  expect(screen.queryByText(/HTTP 500/)).not.toBeInTheDocument();
  expect(sessionExpiryStore.getState().expired).toBe(false);
});

it.each([new LoginForbiddenError(), new RouteAccessForbiddenError('orders')])(
  'retains the forbidden page for %s',
  (error) => {
    render(<RouteErrorPage error={error} reset={vi.fn()} />);
    expect(screen.getByText(/HTTP 403/)).toBeInTheDocument();
    expect(sessionExpiryStore.getState().expired).toBe(false);
  }
);

it('keeps ordinary exceptions on the error page without exposing their raw message', () => {
  render(<RouteErrorPage error={new Error('private internal details')} reset={vi.fn()} />);
  expect(screen.getByText(/HTTP 500/)).toBeInTheDocument();
  expect(screen.queryByText(/private internal details/)).not.toBeInTheDocument();
  expect(sessionExpiryStore.getState().expired).toBe(false);
});
