import redirectRules from './sso-login-redirect-rules.json' with { type: 'json' }

export const SSO_AUTH_HOST = redirectRules.authHost
export const SSO_LOGIN_VIEW_ORIGIN = `https://${SSO_AUTH_HOST}`

const wildcardLoginViewHosts = new Set(
  redirectRules.wildcardLoginViewHosts.map((host) => host.toLowerCase())
)

function classifySsoLoginRedirectUrl(url) {
  const protocol = url.protocol.toLowerCase()
  const host = url.host.toLowerCase()
  const pathname = url.pathname

  if (
    protocol === 'https:' &&
    host === SSO_AUTH_HOST &&
    pathname === redirectRules.ssoLoginPath
  ) {
    return 'sso-login'
  }

  if (
    protocol === 'https:' &&
    host === SSO_AUTH_HOST &&
    pathname === redirectRules.ssoLogoutPath
  ) {
    return 'sso-logout'
  }

  if (
    protocol === 'http:' &&
    host === SSO_AUTH_HOST &&
    pathname === redirectRules.loginViewPath
  ) {
    return 'http-login-view'
  }

  if (
    protocol === 'https:' &&
    wildcardLoginViewHosts.has(host) &&
    pathname === redirectRules.loginViewPath
  ) {
    return 'wildcard-login-view'
  }

  return null
}

export function isSsoLoginRedirectUrl(url) {
  return classifySsoLoginRedirectUrl(url) !== null
}

export function toCanonicalSsoLoginViewUrl(url) {
  return `${SSO_LOGIN_VIEW_ORIGIN}${redirectRules.loginViewPath}${url.search}${url.hash}`
}

function hasTicketCookie(headers) {
  const cookieHeader = headers.cookie ?? ''
  return cookieHeader
    .split(';')
    .some((cookie) => cookie.trim().startsWith(`${redirectRules.ticketCookieName}=`))
}

export async function installSsoLoginRedirectPatch(target) {
  await target.route(isSsoLoginRedirectUrl, async (route) => {
    const request = route.request()
    const requestUrl = new URL(request.url())
    const redirectType = classifySsoLoginRedirectUrl(requestUrl)

    if (redirectType === 'sso-login' && hasTicketCookie(request.headers())) {
      await route.continue()
      return
    }

    await route.fulfill({
      status: 302,
      headers: {
        location: toCanonicalSsoLoginViewUrl(requestUrl),
        'cache-control': 'no-store'
      },
      body: ''
    })
  })
}
