// @vitest-environment node

import { globSync, readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import {
  createDevMockSsoPlugin,
  createMockSsoLoginInfoResponse,
  DEV_MOCK_SSO_MENU_KEYS,
  getMockSsoLoginInfoPath,
  stripAppGateway
} from './vite.sso-mock';

describe('development SSO mock', () => {
  it('normalizes the gateway prefix for the mocked login endpoint', () => {
    expect(getMockSsoLoginInfoPath('/admin-api')).toBe('/admin-api/api/getLoginInfo');
    expect(getMockSsoLoginInfoPath('/')).toBe('/api/getLoginInfo');
  });

  it('strips the gateway prefix when proxying to a gatewayless backend', () => {
    expect(stripAppGateway('/admin-api/api/system/dicts', '/admin-api')).toBe('/api/system/dicts');
    expect(stripAppGateway('/admin-api', '/admin-api')).toBe('/');
  });

  it('returns a numeric local user and grants every route menu key', () => {
    const response = createMockSsoLoginInfoResponse();
    const routeMenuKeys = new Set<string>();

    for (const routeFile of globSync('src/routes/**/*.tsx')) {
      const source = readFileSync(routeFile, 'utf8');
      for (const match of source.matchAll(/menuKey:\s*['"]([^'"]+)['"]/g)) {
        routeMenuKeys.add(match[1]);
      }
    }

    expect(response.data.userId).toMatch(/^\d+$/);
    expect(new Set(DEV_MOCK_SSO_MENU_KEYS)).toEqual(routeMenuKeys);
    expect(new Set(response.data.menuData.map((item) => item.code))).toEqual(routeMenuKeys);
    expect(response.data.menuData.every((item) => item.hiddenFlag === 'N')).toBe(true);
  });

  it('only registers the middleware when DEV_MOCK_SSO is enabled', () => {
    const disabledUse = vi.fn();
    const enabledUse = vi.fn();
    const disabledPlugin = createDevMockSsoPlugin(false, '/admin-api');
    const enabledPlugin = createDevMockSsoPlugin(true, '/admin-api');

    const configureDisabled = disabledPlugin.configureServer;
    const configureEnabled = enabledPlugin.configureServer;
    expect(configureDisabled).toBeTypeOf('function');
    expect(configureEnabled).toBeTypeOf('function');

    if (typeof configureDisabled === 'function' && typeof configureEnabled === 'function') {
      configureDisabled.call({} as never, { middlewares: { use: disabledUse } } as never);
      configureEnabled.call({} as never, { middlewares: { use: enabledUse } } as never);
    }

    expect(disabledUse).not.toHaveBeenCalled();
    expect(enabledUse).toHaveBeenCalledOnce();
  });
});
