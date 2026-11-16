/* eslint-disable no-console */
import { chmod, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import { loadEnv } from 'vite'
import { getSsoTokenStorageKey } from './sso-storage-key.mjs'
import { loginSsoWithHttp, SsoCredentialsError } from './http-sso-login.mjs'
export { SsoCredentialsError } from './http-sso-login.mjs'
import {
  DevSsoSessionError,
  getDevSsoExpiresAt,
  resolveDevSsoSessionPath,
  verifyDevSsoSession,
  writeDevSsoSession
} from '../../../../vite.sso-session.ts'

const tokenStorageKey = getSsoTokenStorageKey()
const environment = loadEnv(process.env.PLAYWRIGHT_SSO_MODE || 'development', process.cwd(), '')
const setting = name => process.env[name] ?? environment[name]
let stage = '读取登录配置'

import {
  installSsoLoginRedirectPatch,
  SSO_AUTH_HOST
} from './sso-login-redirect-patch.mjs'

const DEFAULT_APP_URL = 'http://localhost:3000/overview'
const DEFAULT_AUTH_STORAGE = 'playwright/.auth/user.json'
const DEFAULT_CREDENTIALS_PATH = 'playwright/.auth/sso-ai-login.local.json'
const LOGIN_TIMEOUT_MS = 10 * 60_000

const AUTH_PATH = path.resolve(
  process.cwd(),
  process.env.PLAYWRIGHT_AUTH_STORAGE ?? DEFAULT_AUTH_STORAGE
)
const CREDENTIALS_PATH = path.resolve(
  process.cwd(),
  process.env.PLAYWRIGHT_SSO_CREDENTIALS ?? DEFAULT_CREDENTIALS_PATH
)

function trimTrailingSlashes(value) {
  return value.replace(/\/+$/, '')
}

function getAppUrl() {
  return process.argv[2] || process.env.PLAYWRIGHT_SSO_APP_URL || DEFAULT_APP_URL
}

function getClientId() {
  const clientId = setting('PLAYWRIGHT_SSO_CLIENT_ID') || setting('VITE_APP_SSO_CLIENT_ID')
  if (!clientId) throw new DevSsoSessionError('缺少当前应用的 SSO clientId。')
  return clientId
}

function getSsoEntryUrl(clientId) {
  return (
    setting('PLAYWRIGHT_SSO_ENTRY_URL') ||
    `https://${SSO_AUTH_HOST}/sso/logout?clientId=${encodeURIComponent(clientId)}`
  )
}

function getSsoLoginViewUrl(clientId) {
  return `https://${SSO_AUTH_HOST}/login/loginView?clientId=${encodeURIComponent(clientId)}`
}

function getRemoteAppPrefix() {
  return trimTrailingSlashes(
    setting('PLAYWRIGHT_SSO_REMOTE_APP_PREFIX') || ''
  )
}

function getLocalAppPrefix(appUrl) {
  return trimTrailingSlashes(
    setting('PLAYWRIGHT_SSO_LOCAL_APP_PREFIX') || new URL(appUrl).origin
  )
}

function toLocalAppUrl(rawUrl, remoteAppPrefix, localAppPrefix) {
  if (!remoteAppPrefix || !rawUrl.startsWith(remoteAppPrefix)) {
    return null
  }

  return `${localAppPrefix}${rawUrl.slice(remoteAppPrefix.length)}`
}

function redactUrl(rawUrl) {
  try {
    const url = new URL(rawUrl)
    url.search = new URLSearchParams(Array.from(url.searchParams, ([key]) => [key, 'REDACTED'])).toString()
    if (url.hash) url.hash = 'REDACTED'
    return url.toString()
  } catch {
    return '[无效地址]'
  }
}

function getEnvBool(name, defaultValue = false) {
  const value = process.env[name]
  if (value == null) return defaultValue
  return value === '1' || value.toLowerCase() === 'true'
}

async function readCredentials() {
  const envAccount = process.env.PLAYWRIGHT_SSO_ACCOUNT
  const envPassword = process.env.PLAYWRIGHT_SSO_PASSWORD

  if (envAccount && envPassword) {
    return { account: envAccount, password: envPassword }
  }

  let fileContents
  try {
    fileContents = await readFile(CREDENTIALS_PATH, 'utf8')
  } catch {
    throw new SsoCredentialsError()
  }

  let parsed
  try {
    parsed = JSON.parse(fileContents)
  } catch {
    throw new SsoCredentialsError()
  }
  const account = typeof parsed?.account === 'string' ? parsed.account.trim() : ''
  const password = typeof parsed?.password === 'string' ? parsed.password : ''

  if (!account || !password) {
    throw new SsoCredentialsError()
  }

  return { account, password }
}

async function launchBrowser() {
  const { chromium } = await import('@playwright/test')
  const proxyServer = process.env.PLAYWRIGHT_BROWSER_PROXY
  const channel = process.env.PLAYWRIGHT_BROWSER_CHANNEL || 'chrome'
  const launchOptions = {
    channel,
    headless: getEnvBool('PLAYWRIGHT_HEADLESS', true),
    args: proxyServer ? [] : ['--no-proxy-server'],
    ...(proxyServer
      ? {
          proxy: {
            server: proxyServer,
            bypass: '127.0.0.1,localhost'
          }
        }
      : {})
  }

  try {
    return await chromium.launch(launchOptions)
  } catch (error) {
    if (process.env.PLAYWRIGHT_BROWSER_CHANNEL) {
      throw error
    }

    console.warn('Chrome channel is unavailable; falling back to bundled Chromium.')
    return await chromium.launch({
      ...launchOptions,
      channel: undefined
    })
  }
}

async function installRemoteAppRedirect(context, remoteAppPrefix, localAppPrefix, appUrl, captureOnly) {
  let callbackUrl
  const matchesCallback = (url) => remoteAppPrefix
    ? toLocalAppUrl(url.toString(), remoteAppPrefix, localAppPrefix) !== null
    : ['http:', 'https:'].includes(url.protocol) &&
      url.origin !== new URL(localAppPrefix).origin &&
      url.hostname !== SSO_AUTH_HOST && url.searchParams.has('token') &&
      (!url.searchParams.has('clientId') || url.searchParams.get('clientId') === getClientId())
  // 部分 Chrome 会在路由改写前拦截回跳；仍保留地址，随后在同一测试页面主动回到本机。
  context.on('request', request => {
    if (request.isNavigationRequest() && matchesCallback(new URL(request.url()))) {
      callbackUrl = new URL(request.url())
    }
  })
  await context.route(
    matchesCallback,
    async (route) => {
      const request = route.request()
      if (request.resourceType() !== 'document' || request.frame().parentFrame()) {
        await route.continue()
        return
      }
      callbackUrl = new URL(request.url())
      if (captureOnly) {
        await route.abort()
        return
      }
      const local = new URL(appUrl)
      local.search = callbackUrl.search
      local.hash = callbackUrl.hash
      const localUrl = remoteAppPrefix
        ? toLocalAppUrl(request.url(), remoteAppPrefix, localAppPrefix)
        : local.href
      console.log('已将当前应用的 SSO 回跳转到本机。')
      await route.fulfill({
        status: 302,
        headers: {
          location: localUrl,
          'cache-control': 'no-store'
        },
        body: ''
      })
    }
  )
  return () => callbackUrl
}

async function openLoginPage(page, ssoEntryUrl, loginViewUrl) {
  console.log(`Opening SSO entry ${redactUrl(ssoEntryUrl)}`)
  await page.goto(ssoEntryUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })

  try {
    await page.waitForSelector('input[name="account"]', { timeout: 20_000 })
  } catch {
    console.log(`SSO entry did not render login form; opening ${redactUrl(loginViewUrl)}`)
    await page.goto(loginViewUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.waitForSelector('input[name="account"]', { timeout: 20_000 })
  }
}

async function submitLogin(page, credentials) {
  await page.locator('input[name="account"]').fill(credentials.account)
  await page.locator('input[name="password"]').fill(credentials.password)
  console.log('Submitting SSO credentials')
  await page.locator('.login-oig').click()
}

export async function waitForLocalToken(page, appOrigin, remoteAppPrefix, localAppPrefix, getCallbackUrl, appUrl, captureOnly) {
  const deadline = Date.now() + LOGIN_TIMEOUT_MS
  let lastUrl = ''
  let lastMessage = ''

  while (Date.now() < deadline) {
    const currentUrl = page.url()
    const callback = getCallbackUrl()
    if (captureOnly && callback?.searchParams.has('token')) return
    if (callback && new URL(currentUrl).origin !== appOrigin) {
      const local = new URL(appUrl)
      local.search = callback.search
      local.hash = callback.hash
      await page.goto(local.href, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      continue
    }
    if (currentUrl.startsWith('chrome-error:')) {
      throw new DevSsoSessionError('SSO 回跳发生网络错误，请检查上方脱敏失败地址和测试环境配置。')
    }
    if (currentUrl !== lastUrl) {
      console.log(`Current URL: ${redactUrl(currentUrl)}`)
      lastUrl = currentUrl
    }

    const localCallbackUrl = toLocalAppUrl(currentUrl, remoteAppPrefix, localAppPrefix)
    if (localCallbackUrl) {
      console.log(`Navigating local callback ${redactUrl(localCallbackUrl)}`)
      await page.goto(localCallbackUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })
      continue
    }

    const token = await page
      .evaluate(
        ({ origin, key }) =>
          window.location.origin === origin && !!localStorage.getItem(key),
        { origin: appOrigin, key: tokenStorageKey }
      )
      .catch(() => null)

    if (token) {
      return
    }

    const message = await page
      .locator('.layui-layer-content')
      .last()
      .textContent({ timeout: 500 })
      .catch(() => null)
    const normalizedMessage = message?.replace(/\s+/g, ' ').trim() ?? ''

    // ponytail: 按常见凭据错误文案识别，SSO 提供结构化错误码后改为按码判断。
    if (/(账号|账户|用户名|密码).*(错误|不正确|不匹配|不存在|无效|过于简单|不能为空)|invalid (username|password|credentials)|incorrect (username|password)|bad credentials/i.test(normalizedMessage)) {
      throw new SsoCredentialsError()
    }

    if (normalizedMessage && normalizedMessage !== lastMessage) {
      console.log('SSO 登录尚未完成，请检查登录提示。')
      lastMessage = normalizedMessage
    }

    await page.waitForTimeout(1000)
  }

  throw new DevSsoSessionError('等待本机 SSO 回跳超时，请检查应用回跳配置。')
}

async function saveDevSession(sessionFile, callback, authorization) {
  stage = '验证当前应用真实用户和权限'
  if (!authorization) throw new DevSsoSessionError('SSO 未返回当前应用的凭据。')
  const gateway = (setting('APP_GATEWAY') || '').replace(/^\/+|\/+$/g, '')
  const loginInfoUrl = setting('PLAYWRIGHT_SSO_LOGIN_INFO_URL') ||
    (callback ? new URL(`/${gateway ? gateway + '/' : ''}api/getLoginInfo`, callback.origin).href : '')
  if (!loginInfoUrl) throw new DevSsoSessionError('缺少测试网关登录信息地址，请配置 PLAYWRIGHT_SSO_LOGIN_INFO_URL。')
  const application = {
    clientId: setting('VITE_APP_SSO_CLIENT_ID') || '',
    serviceId: setting('VITE_APP_SSO_SERVICE_ID') || '',
    serviceCode: setting('VITE_APP_SSO_SERVICE_CODE') || ''
  }
  if (getClientId() !== application.clientId) throw new DevSsoSessionError('登录应用与当前配置的 clientId 不一致。')
  const session = await verifyDevSsoSession({
    ...application, authorization, loginInfoUrl, loginId: randomUUID(),
    expiresAt: getDevSsoExpiresAt(authorization)
  })
  writeDevSsoSession(sessionFile, session, process.env.PLAYWRIGHT_SSO_EXPECTED_SESSION_VERSION)
  return session
}

export async function main(appUrl = getAppUrl()) {
  const appOrigin = new URL(appUrl).origin
  const clientId = getClientId()
  const ssoEntryUrl = getSsoEntryUrl(clientId)
  const loginViewUrl = getSsoLoginViewUrl(clientId)
  const remoteAppPrefix = getRemoteAppPrefix()
  const localAppPrefix = getLocalAppPrefix(appUrl)
  const sessionFile = setting('DEV_MOCK_SSO') === 'true'
    ? setting('DEV_SSO_SESSION_FILE')?.trim()
    : undefined
  if (sessionFile) {
    resolveDevSsoSessionPath(sessionFile)
    if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(appUrl).hostname)) {
      throw new DevSsoSessionError('真实开发会话需要使用本机页面地址。')
    }
  }
  const credentials = await readCredentials()

  if (process.env.PLAYWRIGHT_SSO_SESSION_ONLY === '1') {
    if (!sessionFile) throw new DevSsoSessionError('HTTP 开发会话登录需要启用 DEV_MOCK_SSO 并配置 DEV_SSO_SESSION_FILE。')
    stage = 'HTTP 登录 SSO'
    console.log('正在通过 HTTP 登录 SSO。')
    const callback = await loginSsoWithHttp({ loginViewUrl, clientId, credentials })
    await saveDevSession(sessionFile, callback, callback.searchParams.get('token'))
    console.log('真实开发会话已刷新。')
    return
  }

  await mkdir(path.dirname(AUTH_PATH), { recursive: true, mode: 0o700 })

  const browser = await launchBrowser()
  const closeOnTermination = () => {
    void browser.close().finally(() => process.exit(143))
  }
  process.once('SIGTERM', closeOnTermination)
  const context = await browser.newContext({ ignoreHTTPSErrors: true })

  await installSsoLoginRedirectPatch(context)
  const getCallbackUrl = await installRemoteAppRedirect(context, remoteAppPrefix, localAppPrefix, appUrl, Boolean(sessionFile))

  const page = await context.newPage()
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      console.log(`Navigated: ${redactUrl(frame.url())}`)
    }
  })
  page.on('requestfailed', request => {
    if (request.resourceType() !== 'document') return
    if (sessionFile && getCallbackUrl()?.href === request.url()) return
    const code = request.failure()?.errorText ?? ''
    console.log(`导航请求失败：${redactUrl(request.url())}（${/^net::ERR_[A-Z_]+$/.test(code) ? code : '网络错误'}）`)
  })

  console.log(`Local app origin: ${appOrigin}`)
  console.log(`Remote callback prefix: ${remoteAppPrefix}`)
  console.log(`Local callback prefix: ${localAppPrefix}`)

  try {
    stage = '打开 SSO 登录页'
    await openLoginPage(page, ssoEntryUrl, loginViewUrl)
    stage = '提交测试账号登录'
    await submitLogin(page, credentials)
    stage = '等待 SSO 回跳'
    await waitForLocalToken(page, appOrigin, remoteAppPrefix, localAppPrefix, getCallbackUrl, appUrl, Boolean(sessionFile))
    if (sessionFile) {
      const callback = getCallbackUrl()
      const authorization = callback?.searchParams.get('token') ||
        await page.evaluate(key => localStorage.getItem(key), tokenStorageKey)
      const session = await saveDevSession(sessionFile, callback, authorization)
      const responsePromise = page.waitForResponse(response =>
        new URL(response.url()).pathname.endsWith('/api/getLoginInfo'))
      await page.goto(appUrl, { waitUntil: 'domcontentloaded' })
      const response = await responsePromise
      const loginInfo = await response.json()
      if (!response.ok() || response.headers()['x-oig-dev-sso'] !== 'real' ||
          loginInfo.data?.userId !== session.loginInfo.data.userId ||
          loginInfo.data?.userCode !== session.loginInfo.data.userCode) {
        throw new DevSsoSessionError('本机页面未加载真实用户，请确认开发服务已启用同一会话文件。')
      }
      await page.waitForFunction(key => Boolean(localStorage.getItem(key)), tokenStorageKey)
      console.log('真实用户、工号和菜单已通过测试网关验证，并已供本机开发服务使用。')
    }
    await context.storageState({ path: AUTH_PATH })
    await chmod(AUTH_PATH, 0o600)
  } finally {
    process.removeListener('SIGTERM', closeOnTermination)
    await browser.close()
  }

  console.log(`Saved storage state to ${AUTH_PATH}`)
  console.log(
    'Run AI e2e tests with: bash .agents/skills/oig-sso-skill/scripts/run-ai-e2e.sh'
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(`${stage}失败：${error instanceof DevSsoSessionError ? error.message : '请检查登录提示、应用配置和测试环境连通性。'}`)
    process.exitCode = error instanceof SsoCredentialsError ? 2 : 1
  })
}
