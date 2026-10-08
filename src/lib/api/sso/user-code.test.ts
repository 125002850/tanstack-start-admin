import { beforeEach, expect, it, vi } from 'vitest';

function token(claims: Record<string, unknown>) {
  return `header.${btoa(JSON.stringify(claims)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')}.signature`;
}

beforeEach(() => {
  vi.resetModules();
  localStorage.clear();
  window.history.replaceState({}, '', '/overview');
});

it('extracts userCode from URL token and refreshes it from response token', async () => {
  const session = await import('./session');
  const { createAuthHeaders, refreshTokenFromResponse } = await import('./set-headers');
  window.history.replaceState({}, '', `?token=${token({ userCode: 'EMP001' })}`);
  session.hydrateFromUrl();
  expect(createAuthHeaders().get('X-User-Code')).toBe('EMP001');
  refreshTokenFromResponse(
    new Response(null, { headers: { Authorization: token({ userCode: 'EMP002' }) } })
  );
  expect(createAuthHeaders().get('X-User-Code')).toBe('EMP002');
  expect(localStorage.getItem('sso:test-service:user_code')).toBe('EMP002');
});

it('uses stored login userCode first and falls back to an existing JWT', async () => {
  const session = await import('./session');
  localStorage.setItem('sso:test-service:token', token({ userCode: 'JWT001' }));
  expect(session.getLoginUserCode()).toBe('JWT001');
  session.setLoginUserCode(' LOGIN001 ');
  expect(session.getLoginUserCode()).toBe('LOGIN001');
});

it.each(['not-a-jwt', token({}), token({ userCode: 123 }), token({ userCode: ' ' })])(
  'omits userCode for absent or invalid claims: %s',
  async (value) => {
    const session = await import('./session');
    const { createAuthHeaders } = await import('./set-headers');
    session.setAuthHeader(value);
    expect(session.getLoginUserCode()).toBeNull();
    expect(createAuthHeaders().has('X-User-Code')).toBe(false);
  }
);

it('clears local userCode and prevents late responses from restoring it after global expiry', async () => {
  const session = await import('./session');
  session.setAuthHeader(token({ userCode: 'EMP001' }));
  session.clearAuth();
  expect(session.getLoginUserCode()).toBeNull();
  session.setAuthHeader(token({ userCode: 'EMP002' }));
  localStorage.setItem('sso:other-app:user_code', 'OTHER');
  session.handleUnauthorized();
  session.setLoginUserCode('LATE');
  session.setAuthHeader(token({ userCode: 'LATE' }));
  expect(session.getLoginUserCode()).toBeNull();
  expect(localStorage.getItem('sso:other-app:user_code')).toBeNull();
});
