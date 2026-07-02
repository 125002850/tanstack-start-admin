import type { BrowserContext, Page } from '@playwright/test';

export const SSO_AUTH_HOST = 'caweb-auth-master.ksout.oigit.com';
export const SSO_LOGIN_VIEW_ORIGIN = `https://${SSO_AUTH_HOST}`;

const SSO_LOGIN_REDIRECT_URL =
  /^(?:https:\/\/caweb-auth-master\.ksout\.oigit\.com\/sso\/login|http:\/\/caweb-auth-master\.ksout\.oigit\.com\/login\/loginView|https:\/\/(?:%2A|\*)\.ksout\.oigit\.com\/login\/loginView)(?:[?#].*)?$/i;

function toCanonicalSsoLoginViewUrl(url: string) {
  const parsedUrl = new URL(url);
  return `${SSO_LOGIN_VIEW_ORIGIN}/login/loginView${parsedUrl.search}${parsedUrl.hash}`;
}

export async function installSsoLoginRedirectPatch(target: BrowserContext | Page) {
  await target.route(SSO_LOGIN_REDIRECT_URL, async (route) => {
    await route.fulfill({
      status: 302,
      headers: {
        location: toCanonicalSsoLoginViewUrl(route.request().url())
      },
      body: ''
    });
  });
}
