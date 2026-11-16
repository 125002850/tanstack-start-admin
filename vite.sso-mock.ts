import type { IncomingMessage, ServerResponse } from 'node:http';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { execFile, spawn } from 'node:child_process';
import { extname, join, resolve } from 'node:path';
import ts from 'typescript';
import type { Plugin } from 'vite';
import {
  DevSsoSessionError,
  getDevSsoSessionVersion,
  readDevSsoSession,
  resolveDevSsoSessionPath,
  verifyDevSsoSession,
  writeDevSsoSession,
  type DevSsoApplication,
  type DevSsoSession
} from './vite.sso-session.ts';

const LOGIN_INFO_PATH = '/api/getLoginInfo';
const MOCK_USER_ID = '1';
const MOCK_USER_CODE = 'DEV001';
const ROUTE_SOURCE_EXTENSIONS = new Set(['.ts', '.tsx']);

function getStaticPropertyName(name: ts.PropertyName): string | null {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) {
    return name.text;
  }

  if (ts.isComputedPropertyName(name) && ts.isStringLiteralLike(name.expression)) {
    return name.expression.text;
  }

  return null;
}

function findObjectProperty(object: ts.ObjectLiteralExpression, name: string) {
  return object.properties.findLast((property) => {
    if (ts.isSpreadAssignment(property)) return false;
    return getStaticPropertyName(property.name) === name;
  });
}

function collectDefineRouteMetaLocalNames(sourceFile: ts.SourceFile): Set<string> {
  const names = new Set<string>();

  for (const statement of sourceFile.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.moduleSpecifier.text.endsWith('/app-route-meta')
    ) {
      continue;
    }

    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;

    for (const binding of bindings.elements) {
      const importedName = binding.propertyName?.text ?? binding.name.text;
      if (importedName === 'defineRouteMeta') {
        names.add(binding.name.text);
      }
    }
  }

  return names;
}

export function extractDefineRouteMetaMenuKeys(source: string, fileName = 'route.tsx'): string[] {
  const sourceFile = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true,
    fileName.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const defineRouteMetaLocalNames = collectDefineRouteMetaLocalNames(sourceFile);
  const menuKeys = new Set<string>();

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      defineRouteMetaLocalNames.has(node.expression.text)
    ) {
      const metadata = node.arguments[0];
      if (metadata && ts.isObjectLiteralExpression(metadata)) {
        const nav = findObjectProperty(metadata, 'nav');

        if (nav && ts.isPropertyAssignment(nav) && ts.isObjectLiteralExpression(nav.initializer)) {
          const menuKey = findObjectProperty(nav.initializer, 'menuKey');

          if (menuKey) {
            if (
              !ts.isPropertyAssignment(menuKey) ||
              !ts.isStringLiteralLike(menuKey.initializer) ||
              !menuKey.initializer.text.trim()
            ) {
              throw new Error(
                `${fileName}: defineRouteMeta nav.menuKey must be a non-empty string literal`
              );
            }

            menuKeys.add(menuKey.initializer.text.trim());
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return [...menuKeys].toSorted();
}

function collectRouteSourceFiles(root: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...collectRouteSourceFiles(path));
      continue;
    }

    if (entry.isFile() && ROUTE_SOURCE_EXTENSIONS.has(extname(entry.name))) {
      files.push(path);
    }
  }

  return files.toSorted();
}

export function collectAppRouteMenuKeys(
  routesRoot = resolve(process.cwd(), 'src/routes/_app')
): string[] {
  const menuKeys = new Set<string>();

  for (const routeFile of collectRouteSourceFiles(routesRoot)) {
    for (const menuKey of extractDefineRouteMetaMenuKeys(
      readFileSync(routeFile, 'utf8'),
      routeFile
    )) {
      menuKeys.add(menuKey);
    }
  }

  return [...menuKeys].toSorted();
}

function normalizeGatewayPrefix(value: string): string {
  const normalized = value.trim().replace(/^\/+|\/+$/g, '');
  return normalized ? `/${normalized}` : '';
}

export function stripAppGateway(path: string, appGateway: string): string {
  return path.slice(appGateway.length) || '/';
}

export function getMockSsoLoginInfoPath(appGateway: string): string {
  return `${normalizeGatewayPrefix(appGateway)}${LOGIN_INFO_PATH}`;
}

export function createMockSsoLoginInfoResponse(
  menuKeys: readonly string[] = collectAppRouteMenuKeys(),
  userCode: string = MOCK_USER_CODE
) {
  const uniqueMenuKeys = [...new Set(menuKeys)].toSorted();

  return {
    rspCode: '200',
    msg: 'ok',
    success: true,
    data: {
      userId: MOCK_USER_ID,
      userCode,
      phone: '',
      userName: 'local-dev',
      realName: '本地开发用户',
      menuData: uniqueMenuKeys.map((code) => ({
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

function getSsoLoginFailure(stderr: string): string | undefined {
  return [
    ...stderr.matchAll(
      /^(?:HTTP 登录 SSO|验证当前应用真实用户和权限|读取登录配置)失败：([^\r\n]+)\r?$/gm
    )
  ].at(-1)?.[1];
}

export function createDevMockSsoPlugin(
  enabled: boolean,
  appGateway: string,
  userCode: string = MOCK_USER_CODE,
  realSession?: DevSsoApplication & { file: string }
): Plugin {
  const loginInfoPath = getMockSsoLoginInfoPath(appGateway);

  return {
    name: 'oig-dev-sso-mock',
    apply: 'serve',
    config(config) {
      if (!realSession) return;
      return {
        server: {
          ...(enabled ? { host: '127.0.0.1', allowedHosts: ['localhost'], cors: false } : {}),
          fs: {
            deny: [
              ...(config.server?.fs?.deny ?? [
                '.env',
                '.env.*',
                '*.{crt,pem,key,p12,pfx,cer,der}',
                '.npmrc',
                '.yarnrc.yml',
                '**/.git/**'
              ]),
              '**/playwright/.auth/**'
            ]
          }
        }
      };
    },
    async configureServer(server) {
      if (!enabled) {
        return;
      }
      if (
        realSession &&
        !['127.0.0.1', 'localhost', '::1'].includes(String(server.config.server.host))
      ) {
        throw new Error('真实 SSO 开发会话仅允许监听本机地址，请移除 --host 0.0.0.0。');
      }

      let refreshing: Promise<void> | undefined;
      let failedVersion: string | undefined;
      const controller = new AbortController();
      server.httpServer?.once('close', () => controller.abort());
      if (realSession) resolveDevSsoSessionPath(realSession.file, server.config.root);
      const credentialFile =
        process.env.PLAYWRIGHT_SSO_CREDENTIALS ||
        resolve(server.config.root, 'playwright/.auth/sso-ai-login.local.json');
      const getCredentialVersion = () => {
        try {
          return String(statSync(credentialFile).mtimeMs);
        } catch {
          return 'missing';
        }
      };

      if (
        realSession &&
        process.stdin.isTTY &&
        process.stdout.isTTY &&
        process.env.PLAYWRIGHT_SSO_LOGIN_IN_PROGRESS !== '1'
      ) {
        let previous: DevSsoSession | undefined;
        try {
          previous = readDevSsoSession(realSession.file, realSession, { allowExpired: true });
          if (previous.expiresAt <= Date.now() + 120_000) {
            throw new DevSsoSessionError('真实开发会话即将过期。', 401);
          }
          const session = await verifyDevSsoSession(previous);
          writeDevSsoSession(
            realSession.file,
            session,
            getDevSsoSessionVersion(previous.authorization)
          );
        } catch (error) {
          if (error instanceof DevSsoSessionError && [401, 503].includes(error.status)) {
            const credentialVersion = getCredentialVersion();
            server.config.logger.info('正在准备真实开发 SSO 会话，请按终端提示登录。');
            const appUrl = new URL(
              server.config.base + 'overview',
              `http://127.0.0.1:${server.config.server.port}`
            ).href;
            await new Promise<void>((resolveLogin, reject) => {
              let stderr = '';
              const child = spawn(
                'bash',
                [
                  resolve(
                    server.config.root,
                    '.agents/skills/oig-sso-skill/scripts/auth-sso-local.sh'
                  ),
                  appUrl
                ],
                {
                  cwd: server.config.root,
                  stdio: ['inherit', 'inherit', 'pipe'],
                  signal: controller.signal,
                  env: {
                    ...process.env,
                    DEV_MOCK_SSO: 'true',
                    DEV_SSO_SESSION_FILE: realSession.file,
                    VITE_APP_SSO_CLIENT_ID: realSession.clientId,
                    VITE_APP_SSO_SERVICE_ID: realSession.serviceId,
                    VITE_APP_SSO_SERVICE_CODE: realSession.serviceCode,
                    PLAYWRIGHT_SSO_MODE: server.config.mode,
                    PLAYWRIGHT_SSO_SESSION_ONLY: '1',
                    ...(previous
                      ? {
                          PLAYWRIGHT_SSO_EXPECTED_SESSION_VERSION: getDevSsoSessionVersion(
                            previous.authorization
                          )
                        }
                      : {})
                  }
                }
              );
              child.stderr?.setEncoding('utf8');
              child.stderr?.on('data', (chunk: string) => {
                process.stderr.write(chunk);
                stderr = (stderr + chunk).slice(-4096);
              });
              child.once('error', () =>
                reject(new DevSsoSessionError('无法启动 SSO 登录脚本，请检查本机运行环境。'))
              );
              child.once('close', (code) => {
                if (code === 0) resolveLogin();
                else
                  reject(
                    new DevSsoSessionError(
                      getSsoLoginFailure(stderr) ?? '真实开发 SSO 登录未完成，请检查终端提示。'
                    )
                  );
              });
            });
            readDevSsoSession(realSession.file, realSession);
            if (getCredentialVersion() !== credentialVersion) {
              delete process.env.PLAYWRIGHT_SSO_ACCOUNT;
              delete process.env.PLAYWRIGHT_SSO_PASSWORD;
            }
          } else {
            server.config.logger.warn(
              error instanceof DevSsoSessionError ? error.message : '真实开发 SSO 会话校验失败。'
            );
          }
        }
      }

      const renew = (previous: DevSsoSession): Promise<void> => {
        if (refreshing) return refreshing;
        const credentialVersion =
          process.env.PLAYWRIGHT_SSO_ACCOUNT && process.env.PLAYWRIGHT_SSO_PASSWORD
            ? 'environment'
            : getCredentialVersion();
        const version = getDevSsoSessionVersion(previous.authorization);
        const attemptVersion = (previous.loginId || version) + ':' + credentialVersion;
        if (failedVersion === attemptVersion) {
          return Promise.reject(
            new DevSsoSessionError(
              '自动续会话已暂停，请检查本地账号配置或手动运行 SSO 登录脚本。',
              401
            )
          );
        }
        const address = server.httpServer?.address();
        const port =
          address && typeof address !== 'string' ? address.port : server.config.server.port;
        const appUrl = new URL(server.config.base + 'overview', `http://127.0.0.1:${port}`).href;
        server.config.logger.info('正在自动刷新真实开发 SSO 会话。');
        refreshing = new Promise<void>((resolveRefresh, reject) => {
          execFile(
            process.execPath,
            [
              resolve(server.config.root, '.agents/skills/oig-sso-skill/scripts/record-auth.mjs'),
              appUrl
            ],
            {
              cwd: server.config.root,
              timeout: 90_000,
              signal: controller.signal,
              env: {
                ...process.env,
                DEV_MOCK_SSO: 'true',
                DEV_SSO_SESSION_FILE: realSession!.file,
                PLAYWRIGHT_SSO_MODE: server.config.mode,
                PLAYWRIGHT_SSO_APP_URL: appUrl,
                PLAYWRIGHT_SSO_CLIENT_ID: previous.clientId,
                PLAYWRIGHT_SSO_LOGIN_INFO_URL: previous.loginInfoUrl,
                PLAYWRIGHT_SSO_SESSION_ONLY: '1',
                PLAYWRIGHT_SSO_EXPECTED_SESSION_VERSION: version,
                VITE_APP_SSO_CLIENT_ID: previous.clientId,
                VITE_APP_SSO_SERVICE_ID: previous.serviceId,
                VITE_APP_SSO_SERVICE_CODE: previous.serviceCode
              }
            },
            (error, _stdout, stderr) => {
              if (error) {
                failedVersion = attemptVersion;
                reject(
                  new DevSsoSessionError(
                    getSsoLoginFailure(stderr ?? '') ??
                      '自动续会话失败，已暂停自动尝试；请检查本地账号配置后重新登录。',
                    401
                  )
                );
              } else {
                failedVersion = undefined;
                resolveRefresh();
              }
            }
          );
        }).finally(() => {
          refreshing = undefined;
        });
        return refreshing;
      };

      const handleLoginInfo = async (
        request: IncomingMessage,
        response: ServerResponse,
        next: () => void
      ) => {
        if (!isLoginInfoRequest(request, loginInfoPath)) {
          next();
          return;
        }

        response.statusCode = 200;
        response.setHeader('Content-Type', 'application/json; charset=utf-8');
        response.setHeader('Cache-Control', 'no-store');
        if (realSession) {
          response.setHeader('X-Oig-Dev-Sso', 'real');
          const host = request.headers.host ?? '';
          const origin = request.headers.origin;
          const address = request.socket.remoteAddress ?? '';
          const localAddress = address === '::1' || /^(::ffff:)?127\./.test(address);
          let localHost = false;
          try {
            const url = new URL(`http://${host}`);
            localHost =
              ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) &&
              (!origin || new URL(origin).origin === url.origin);
          } catch {
            /* 无效 Host/Origin 拒绝访问。 */
          }
          if (!localAddress || !localHost || request.headers['sec-fetch-site'] === 'cross-site') {
            response.statusCode = 403;
            response.end(
              JSON.stringify({
                success: false,
                rspCode: '403',
                msg: '真实开发会话仅限本机同源访问。'
              })
            );
            return;
          }
          try {
            let previous = readDevSsoSession(realSession.file, realSession, { allowExpired: true });
            let renewed = false;
            if (previous.expiresAt <= Date.now() + 120_000) {
              try {
                await renew(previous);
                previous = readDevSsoSession(realSession.file, realSession);
                renewed = true;
              } catch (error) {
                if (previous.expiresAt <= Date.now()) throw error;
                server.config.logger.warn('提前续会话失败，暂时保留仍有效的当前会话。');
              }
            }
            let session;
            try {
              session = await verifyDevSsoSession(previous);
            } catch (error) {
              if (!(error instanceof DevSsoSessionError) || error.status !== 401 || renewed)
                throw error;
              await renew(previous);
              previous = readDevSsoSession(realSession.file, realSession);
              session = await verifyDevSsoSession(previous);
            }
            const current = readDevSsoSession(realSession.file, realSession);
            if (
              current.authorization !== previous.authorization ||
              current.loginInfo.data.userId !== previous.loginInfo.data.userId ||
              current.loginInfo.data.userCode !== previous.loginInfo.data.userCode
            ) {
              throw new DevSsoSessionError('真实开发会话已更新，请重试以使用当前用户。', 409);
            }
            writeDevSsoSession(realSession.file, session);
            response.setHeader('Authorization', session.authorization);
            response.end(JSON.stringify(session.loginInfo));
          } catch (error) {
            response.statusCode = error instanceof DevSsoSessionError ? error.status : 503;
            const message =
              error instanceof DevSsoSessionError
                ? error.message
                : '真实开发会话不可用，请重新运行 SSO 登录脚本。';
            server.config.logger.warn(message);
            response.end(
              JSON.stringify({
                success: false,
                rspCode: String(response.statusCode),
                msg: message
              })
            );
          }
          return;
        }
        response.end(JSON.stringify(createMockSsoLoginInfoResponse(undefined, userCode)));
      };
      server.middlewares.use((request, response, next) => {
        void handleLoginInfo(request, response, next).catch(next);
      });
    }
  };
}
