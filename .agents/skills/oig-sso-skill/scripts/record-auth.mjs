/* eslint-disable no-console */
import { mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium } from '@playwright/test'

import {
  installSsoLoginRedirectPatch,
  SSO_AUTH_HOST
} from './sso-login-redirect-patch.mjs'

const DEFAULT_CLIENT_ID = '2064249343121747970'
const DEFAULT_APP_URL = 'http://localhost:3000/dashboard/overview'
const DEFAULT_REMOTE_APP_PREFIX = 'http://192.168.186.148:30227/track-bench-admin'
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
  return process.env.PLAYWRIGHT_SSO_CLIENT_ID || DEFAULT_CLIENT_ID
}

function getSsoEntryUrl(clientId) {
  return (
    process.env.PLAYWRIGHT_SSO_ENTRY_URL ||
    `https://${SSO_AUTH_HOST}/sso/logout?clientId=${encodeURIComponent(clientId)}`
  )
}

function getSsoLoginViewUrl(clientId) {
  return `https://${SSO_AUTH_HOST}/login/loginView?clientId=${encodeURIComponent(clientId)}`
}

function getRemoteAppPrefix() {
  return trimTrailingSlashes(
    process.env.PLAYWRIGHT_SSO_REMOTE_APP_PREFIX || DEFAULT_REMOTE_APP_PREFIX
  )
}

function getLocalAppPrefix(appUrl) {
  return trimTrailingSlashes(
    process.env.PLAYWRIGHT_SSO_LOCAL_APP_PREFIX || new URL(appUrl).origin
  )
}

function toLocalAppUrl(rawUrl, remoteAppPrefix, localAppPrefix) {
  if (!rawUrl.startsWith(remoteAppPrefix)) {
    return null
  }

  return `${localAppPrefix}${rawUrl.slice(remoteAppPrefix.length)}`
}

function redactUrl(rawUrl) {
  try {
    const url = new URL(rawUrl)
    for (const key of ['ticket', 'token']) {
      if (url.searchParams.has(key)) {
        url.searchParams.set(key, 'REDACTED')
      }
    }
    return url.toString()
  } catch {
    return rawUrl
      .replace(/([?&]ticket=)[^&]+/g, '$1REDACTED')
      .replace(/([?&]token=)[^&]+/g, '$1REDACTED')
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
  } catch (error) {
    throw new Error(
      `Missing SSO credentials. Create ${CREDENTIALS_PATH} or set PLAYWRIGHT_SSO_ACCOUNT and PLAYWRIGHT_SSO_PASSWORD.`,
      { cause: error }
    )
  }

  const parsed = JSON.parse(fileContents)
  const account = typeof parsed.account === 'string' ? parsed.account.trim() : ''
  const password = typeof parsed.password === 'string' ? parsed.password : ''

  if (!account || !password) {
    throw new Error(`Invalid SSO credentials in ${CREDENTIALS_PATH}`)
  }

  return { account, password }
}

async function launchBrowser() {
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

async function installRemoteAppRedirect(context, remoteAppPrefix, localAppPrefix) {
  await context.route(
    (url) => toLocalAppUrl(url.toString(), remoteAppPrefix, localAppPrefix) !== null,
    async (route) => {
      const request = route.request()
      const localUrl = toLocalAppUrl(request.url(), remoteAppPrefix, localAppPrefix)

      if (!localUrl) {
        await route.continue()
        return
      }

      if (request.resourceType() === 'document') {
        console.log(`Rewriting remote callback to ${redactUrl(localUrl)}`)
      }
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
}

async function openLoginPage(page, ssoEntryUrl, loginViewUrl) {
  console.log(`Opening SSO entry ${ssoEntryUrl}`)
  await page.goto(ssoEntryUrl, { waitUntil: 'domcontentloaded', timeout: 60_000 })

  try {
    await page.waitForSelector('input[name="account"]', { timeout: 20_000 })
  } catch {
    console.log(`SSO entry did not render login form; opening ${loginViewUrl}`)
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

async function waitForLocalToken(page, appOrigin, remoteAppPrefix, localAppPrefix) {
  const deadline = Date.now() + LOGIN_TIMEOUT_MS
  let lastUrl = ''
  let lastMessage = ''

  while (Date.now() < deadline) {
    const currentUrl = page.url()
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
        (origin) =>
          window.location.origin === origin ? localStorage.getItem('sso_token') : null,
        appOrigin
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

    if (normalizedMessage && normalizedMessage !== lastMessage) {
      console.log(`SSO message: ${normalizedMessage}`)
      lastMessage = normalizedMessage
    }

    await page.waitForTimeout(1000)
  }

  throw new Error(`Timed out waiting for SSO token on ${appOrigin}. Last URL: ${page.url()}`)
}

async function main() {
  const appUrl = getAppUrl()
  const appOrigin = new URL(appUrl).origin
  const clientId = getClientId()
  const ssoEntryUrl = getSsoEntryUrl(clientId)
  const loginViewUrl = getSsoLoginViewUrl(clientId)
  const remoteAppPrefix = getRemoteAppPrefix()
  const localAppPrefix = getLocalAppPrefix(appUrl)
  const credentials = await readCredentials()

  await mkdir(path.dirname(AUTH_PATH), { recursive: true })

  const browser = await launchBrowser()
  const context = await browser.newContext({ ignoreHTTPSErrors: true })

  await installSsoLoginRedirectPatch(context)
  await installRemoteAppRedirect(context, remoteAppPrefix, localAppPrefix)

  const page = await context.newPage()
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) {
      console.log(`Navigated: ${redactUrl(frame.url())}`)
    }
  })

  console.log(`Local app origin: ${appOrigin}`)
  console.log(`Remote callback prefix: ${remoteAppPrefix}`)
  console.log(`Local callback prefix: ${localAppPrefix}`)

  await openLoginPage(page, ssoEntryUrl, loginViewUrl)
  await submitLogin(page, credentials)
  await waitForLocalToken(page, appOrigin, remoteAppPrefix, localAppPrefix)
  await context.storageState({ path: AUTH_PATH })
  await browser.close()

  console.log(`Saved storage state to ${AUTH_PATH}`)
  console.log(
    'Run AI e2e tests with: bash .agents/skills/oig-sso-skill/scripts/run-ai-e2e.sh'
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
