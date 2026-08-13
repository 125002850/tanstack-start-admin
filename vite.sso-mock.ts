import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

const LOGIN_INFO_PATH = '/api/getLoginInfo';
const MOCK_USER_ID = '1';

export const DEV_MOCK_SSO_MENU_KEYS = ['dict-management', 'export-center'] as const;

function normalizeGatewayPrefix(value: string): string {
  const normalized = value.trim().replace(/^\/+|\/+$/g, '');
  return normalized ? `/${normalized}` : '';
}

export function getMockSsoLoginInfoPath(appGateway: string): string {
  return `${normalizeGatewayPrefix(appGateway)}${LOGIN_INFO_PATH}`;
}

export function stripAppGateway(path: string, appGateway: string): string {
  return path.slice(appGateway.length) || '/';
}

export function createMockSsoLoginInfoResponse() {
  return {
    rspCode: '200',
    msg: 'ok',
    success: true,
    data: {
      userId: MOCK_USER_ID,
      phone: '',
      userName: 'local-dev',
      realName: '本地开发用户',
      menuData: DEV_MOCK_SSO_MENU_KEYS.map((code) => ({
        code,
        hiddenFlag: 'N',
        children: []
      })),
      loginUrl: '',
      logoutUrl: ''
    }
  };
}

function isLoginInfoRequest(request: IncomingMessage, loginInfoPath: string): boolean {
  if ((request.method ?? 'GET').toUpperCase() !== 'GET') {
    return false;
  }

  const pathname = new URL(request.url ?? '/', 'http://vite.local').pathname;
  return pathname === loginInfoPath;
}

export function createDevMockSsoPlugin(enabled: boolean, appGateway: string): Plugin {
  const loginInfoPath = getMockSsoLoginInfoPath(appGateway);

  return {
    name: 'oig-dev-sso-mock',
    apply: 'serve',
    configureServer(server) {
      if (!enabled) {
        return;
      }

      server.middlewares.use(
        (request: IncomingMessage, response: ServerResponse, next: () => void) => {
          if (!isLoginInfoRequest(request, loginInfoPath)) {
            next();
            return;
          }

          response.statusCode = 200;
          response.setHeader('Content-Type', 'application/json; charset=utf-8');
          response.setHeader('Cache-Control', 'no-store');
          response.end(JSON.stringify(createMockSsoLoginInfoResponse()));
        }
      );
    }
  };
}
