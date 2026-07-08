const DEFAULT_DASHBOARD_HREF = '/dashboard/overview';

export function getCurrentInternalHref(): string {
  if (typeof window === 'undefined') return DEFAULT_DASHBOARD_HREF;
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export function sanitizeInternalRedirect(
  value: string | null | undefined,
  fallback = DEFAULT_DASHBOARD_HREF
): string {
  const candidate = value?.trim();
  if (!candidate) return fallback;
  if (!candidate.startsWith('/')) return fallback;
  if (candidate.startsWith('//')) return fallback;

  try {
    const url = new URL(candidate, window.location.origin);
    if (url.origin !== window.location.origin) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

export function getRedirectParam(search: URLSearchParams | string): string | null {
  const params = typeof search === 'string' ? new URLSearchParams(search) : search;
  return params.get('redirect');
}

export function buildSignInHref(redirect = getCurrentInternalHref()): string {
  const safeRedirect = sanitizeInternalRedirect(redirect);
  const params = new URLSearchParams();
  params.set('redirect', safeRedirect);
  return `/auth/sign-in?${params.toString()}`;
}
