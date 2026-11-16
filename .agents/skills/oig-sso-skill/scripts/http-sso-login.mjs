import { constants, publicEncrypt } from 'node:crypto'
import { DevSsoSessionError } from '../../../../vite.sso-session.ts'
import redirectRules from './sso-login-redirect-rules.json' with { type: 'json' }
import {
  isSsoLoginRedirectUrl,
  toCanonicalSsoLoginViewUrl
} from './sso-login-redirect-patch.mjs'

export class SsoCredentialsError extends DevSsoSessionError {
  constructor(message = 'SSO 账号或密码校验未通过，请在终端重新输入。') {
    super(message, 401)
  }
}

function rejectLogin(response, html) {
  const encoded = html.match(/\b(?:var|let|const)\s+errorMsg\s*=\s*("(?:[^"\\]|\\.)*")/)?.[1]
  let message = ''
  try { message = encoded ? JSON.parse(encoded) : '' } catch { /* 使用下方固定错误。 */ }
  if (!message) {
    try {
      const body = JSON.parse(html)
      const value = body?.message ?? body?.msg
      if (typeof value === 'string') message = value
    } catch { /* HTML 响应使用上方 errorMsg。 */ }
  }
  if (/锁定|冻结/.test(message)) {
    throw new DevSsoSessionError('SSO 返回账号锁定或冻结提示，已停止重试；请确认账号状态或联系 SSO 管理员。', 403)
  }
  if (/验证码|二次验证|多因素/.test(message)) {
    throw new DevSsoSessionError('SSO 要求验证码或二次验证，请在官方登录页完成验证。', 403)
  }
  if (response.status === 403 || /禁用|无权|权限/.test(message)) {
    throw new DevSsoSessionError('SSO 拒绝登录，请检查账号状态或应用访问权限。', 403)
  }
  if (response.status === 401 || /(账号|账户|用户名|密码).*(错误|不正确|不匹配|不存在|无效|不能为空)/.test(message)) {
    throw new SsoCredentialsError('SSO 返回账号或密码错误，请在终端重新输入。')
  }
  if (message || !response.ok && !(response.status >= 300 && response.status < 400)) {
    throw new DevSsoSessionError(`SSO 登录失败（HTTP ${response.status}），请检查账号状态和测试环境。`, 502)
  }
}

export async function loginSsoWithHttp({ loginViewUrl, clientId, credentials }) {
  const loginUrl = new URL(loginViewUrl)
  if (loginUrl.protocol !== 'https:' || loginUrl.username || loginUrl.password) {
    throw new DevSsoSessionError('SSO 登录地址必须是不含凭据的 HTTPS 地址。')
  }
  loginUrl.searchParams.set('clientId', clientId)
  const cookies = new Map()
  const signal = AbortSignal.timeout(30_000)
  let phase = '读取 SSO 登录页'
  const request = async (url, options = {}) => {
    if (url.origin !== loginUrl.origin) {
      throw new DevSsoSessionError('SSO 返回了非预期的登录跳转，请检查应用回跳配置。')
    }
    const response = await fetch(url, {
      ...options,
      redirect: 'manual',
      signal,
      headers: {
        Cookie: [...cookies].map(([name, value]) => `${name}=${value}`).join('; '),
        ...options.headers
      }
    })
    for (const cookie of response.headers.getSetCookie()) {
      const pair = cookie.split(';', 1)[0]
      const separator = pair.indexOf('=')
      if (separator < 1) continue
      const name = pair.slice(0, separator).trim()
      const value = pair.slice(separator + 1)
      if (!value || /;\s*max-age=0(?:;|$)/i.test(cookie)) cookies.delete(name)
      else cookies.set(name, value)
    }
    return response
  }

  try {
    const page = await request(loginUrl)
    const html = await page.text()
    rejectLogin(page, html)
    phase = '解析 SSO 登录协议'
    const form = html.match(/<form\b[^>]*\bid=["']loginForm["'][^>]*>/i)?.[0]
    const action = form?.match(/\baction=["']([^"']+)["']/i)?.[1]
    const key = html.match(/\b(?:var|let|const)\s+public_key\s*=\s*["']([A-Za-z0-9+/=]+)["']/)?.[1]
    if (!action || !key || !/\bmethod=["']post["']/i.test(form)) {
      throw new DevSsoSessionError('SSO 登录表单或 RSA 公钥缺失，请检查登录协议是否变更。')
    }
    phase = 'RSA 密码加密'
    const password = publicEncrypt({
      key: `-----BEGIN PUBLIC KEY-----\n${key}\n-----END PUBLIC KEY-----`,
      padding: constants.RSA_PKCS1_PADDING
    }, Buffer.from(credentials.password)).toString('base64')
    phase = '构造 SSO 登录请求'
    let currentUrl = new URL(action, loginUrl)
    phase = '提交 SSO 登录表单'
    let response = await request(currentUrl, {
      method: 'POST',
      headers: { Origin: loginUrl.origin, Referer: loginUrl.href },
      body: new URLSearchParams({
        account: credentials.account,
        password,
        clientId,
        redirectUrl: loginUrl.searchParams.get('redirectUrl') || ''
      })
    })
    let authorized = false
    for (let redirects = 0; redirects < 8; redirects++) {
      phase = '处理 SSO 登录响应'
      if (!response.ok && !(response.status >= 300 && response.status < 400)) {
        rejectLogin(response, await response.text())
      }
      const location = response.headers.get('location')
      if (location) {
        let next = new URL(location, currentUrl)
        if (next.searchParams.get('token') && ['http:', 'https:'].includes(next.protocol) && !next.username && !next.password) {
          if (next.searchParams.has('clientId') && next.searchParams.get('clientId') !== clientId) {
            throw new DevSsoSessionError('SSO 回跳与当前应用不匹配，请检查 clientId。')
          }
          return next
        }
        if (next.origin !== loginUrl.origin && isSsoLoginRedirectUrl(next)) {
          next = new URL(toCanonicalSsoLoginViewUrl(next))
        }
        currentUrl = next
        phase = '请求 SSO 授权跳转'
        response = await request(currentUrl)
        continue
      }
      rejectLogin(response, await response.text())
      if (!authorized && cookies.has(redirectRules.ticketCookieName)) {
        authorized = true
        const authorizeUrl = new URL(redirectRules.ssoLoginPath, loginUrl)
        authorizeUrl.searchParams.set('clientId', clientId)
        currentUrl = authorizeUrl
        phase = '请求 SSO 授权入口'
        response = await request(currentUrl)
        continue
      }
      throw new DevSsoSessionError('SSO 登录未返回应用 token，请检查账号状态和应用回跳配置。')
    }
    throw new DevSsoSessionError('SSO 登录跳转次数过多，请检查应用回跳配置。')
  } catch (error) {
    if (error instanceof DevSsoSessionError) throw error
    const reasons = {
      ENOTFOUND: 'SSO 域名解析失败，请检查 DNS 或 VPN。',
      EAI_AGAIN: 'SSO 域名解析暂时失败，请检查 DNS 或 VPN。',
      ECONNREFUSED: 'SSO 拒绝连接，请检查服务地址和端口。',
      ECONNRESET: 'SSO 连接被中断，请检查网络。',
      ENETUNREACH: '无法访问 SSO 网络，请检查 VPN 或路由。',
      ETIMEDOUT: 'SSO 连接超时，请检查网络。',
      UND_ERR_CONNECT_TIMEOUT: 'SSO 连接超时，请检查网络。',
      UND_ERR_SOCKET: 'SSO 连接被中断，请检查网络。',
      CERT_HAS_EXPIRED: 'SSO TLS 证书已过期，请联系环境维护人员。',
      UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'SSO TLS 证书链验证失败，请检查本机受信任证书。',
      SELF_SIGNED_CERT_IN_CHAIN: 'SSO TLS 证书链不受信任，请检查本机受信任证书。',
      DEPTH_ZERO_SELF_SIGNED_CERT: 'SSO TLS 证书不受信任，请检查本机受信任证书。',
      ERR_TLS_CERT_ALTNAME_INVALID: 'SSO TLS 证书与域名不匹配，请检查登录地址。',
      ERR_INVALID_URL: 'SSO 返回了无效的请求或跳转地址，请检查登录协议。',
      ERR_OSSL_RSA_DATA_TOO_LARGE_FOR_KEY_SIZE: '密码长度超过 SSO RSA 加密限制，请检查输入。'
    }
    const code = error?.code ?? error?.cause?.code
    const known = Object.hasOwn(reasons, code)
    const type = ['TypeError', 'RangeError', 'SyntaxError'].includes(error?.name) ? `（${error.name}）` : ''
    const reason = signal.aborted
      ? 'HTTP 登录超过 30 秒，请检查网络后重试。'
      : known ? `${reasons[code]}（${code}）` : `请求或协议处理异常${type}，请检查网络和登录协议。`
    throw new DevSsoSessionError(
      `${phase}失败：${reason}`,
      502
    )
  }
}
