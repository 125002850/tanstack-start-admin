# 配置中心与 API 规范

## 配置中心结构

```text
src/config/
├── index.ts           # barrel：统一导出配置
├── env.ts             # 唯一读取 import.meta.env.VITE_* 的位置
├── data-table.ts      # 表格特性配置
└── workspace-tabs.ts  # workspace tabs 特性配置
```

核心原则：

1. `env.ts` 是环境变量的唯一入口，禁止其他文件直接读取 `import.meta.env.VITE_*`。
2. 特性配置从 `env.ts` 获取环境值。
3. `index.ts` 是常规应用代码的统一导出入口。
4. 每个环境变量必须在 `env.example.txt` 中记录用途与默认值。

## 与 Vite 配置的边界

| | `vite.config.ts` | `src/config/env.ts` |
| --- | --- | --- |
| 运行环境 | Node.js 构建时或 dev server | 浏览器应用运行时 |
| 读取方式 | `loadEnv()` | `import.meta.env.VITE_*` 静态替换 |
| 管辖变量 | `APP_GATEWAY`、`PROXY_URL`、`DEV_MOCK_SSO`、`APP_BASE_PATH`、`ANALYZE` | `VITE_APP_SSO_*`、`VITE_ENABLE_*` |
| 用途 | 代理、公共路径、构建工具开关 | SSO 请求头与客户端特性开关 |

`vite.config.ts` 属于构建工具配置，不纳入 `src/config/`。

`PROXY_URL` 与 `DEV_MOCK_SSO` 的职责必须分离：

- `PROXY_URL` 是唯一的代理目标配置；是否直连后端或经过网关完全由该地址决定。
- `DEV_MOCK_SSO=false`：保留 `APP_GATEWAY`，登录信息来自 `PROXY_URL` 指向的真实服务。
- `DEV_MOCK_SSO=true`：仅在 Vite dev server 中 mock 数字用户和全部已声明的菜单权限；同时为无网关 context path 的后端移除 `APP_GATEWAY`，但不得修改或替换 `PROXY_URL`。
- mock 必须收敛在 Vite `configureServer` middleware，禁止进入生产构建或修改浏览器端菜单权限的 fail-closed 语义。
- mock SSO 仅用于本地开发；联调、验收和生产仍必须验证真实 SSO、菜单权限与后端 action entitlement。

## 环境变量

在 `src/config/env.ts` 中注册新变量：

```ts
export const env = {
  // ...已有变量
  /** 是否启用 XXX 功能（默认关闭） */
  xxxEnabled: getEnvBool('VITE_ENABLE_XXX', false)
} as const;
```

辅助函数：

- `getEnvVar(name, defaultValue)`：读取字符串。
- `getEnvBool(name, defaultValue)`：读取布尔值，`'1'` 和 `'true'` 为 true。

当前 SSO 请求头配置：

- `VITE_APP_SSO_CLIENT_ID` → `client-id`
- `VITE_APP_SSO_SERVICE_ID` → `service-id`
- `VITE_APP_SSO_SERVICE_CODE` → `service-code`

约束：

- 新增 `VITE_*` 时必须同步更新 `env.ts` 和 `env.example.txt`。
- 特性 config 文件只通过相对路径 `./env` 导入环境配置，避免 barrel 循环。
- 常规应用消费者从 `@/config` 导入；`src/lib/api/sso/set-headers.ts` 是现有低层边界，可直接依赖 `@/config/env`，不要在无关任务中顺带迁移。
- `env.ts` 只负责读取与默认值，不包含业务逻辑。
- 纯 SPA 中 `VITE_*` 在构建时静态替换，运行时不可变。
- 不得把 SSO 账号、密码、ticket、token 或环境专属地址写入 tracked 配置、Skill、日志或提交信息。

## 特性配置

纯常量直接定义：

```ts
export const MAX_KEEPALIVE_TABS = 15;
```

依赖环境开关的派生值从 `env.ts` 获取：

```ts
import { env } from './env';

export function isDataTableVirtualizationEnabled(): boolean {
  if (!env.dataTableVirtualization) return false;
  return isBrowserSupportedForVirtualization();
}
```

## SSO 会话与共享 Transport

运行时边界：

- `src/router.tsx`：创建 Router 前调用 `hydrateFromUrl()`，从 SSO 回调 URL 恢复 token 和登录前查询参数。
- `src/main.tsx`：创建 Router 前调用 `configureApiTransport()`，作为共享 transport middleware 的唯一启动 owner。
- `src/lib/api/transport.ts`：定义 OpenAPI generated client 的共享 middleware，通过 `setTransportMiddlewares()` 注入认证请求头、刷新响应 token，并统一处理业务请求的 401。
- `src/lib/api/sso/set-headers.ts`：组装 SSO 服务头、`Authorization` 与 `X-User-Id`，并从响应头刷新 token。
- `src/lib/api/sso/session.ts`：维护 token、用户 ID、登出地址、登录前查询参数和登出跳转。
- `src/lib/api/sso/bootstrap.ts`：`/api/getLoginInfo` 的手写 `fetch` 边界，负责首次登录/过期会话的 401 跳转。
- `src/lib/api/sso/queries.ts`：维护 SSO 登录信息查询、`menuData` 权限快照，以及登录禁止状态转换。

约束：

- generated API、业务 query/mutation 和页面代码必须复用共享 transport，禁止在边界外散落 `fetch`。
- 当前仓库允许直接调用 `fetch` 的运行时边界只有 `src/lib/api/sso/bootstrap.ts`；新增例外前必须同步调整 API adoption 契约测试。
- 首次登录或缺少 token 的 401 由 `bootstrap.ts` 跳转 `loginUrl`；已有 token 失效后统一清理同源所有应用约定的 SSO 凭据并显示不可关闭的确认框，确认后跳转 `logoutUrl`。并发 401 合并提示，失效后阻止请求及迟到响应刷新 token。页面层不得复制清 token 或重定向逻辑。
- `transport.ts` 的 request middleware 必须统一调用 `createAuthHeaders()`；页面和 generated client 不得重复拼装 SSO 头或注册 middleware。
- 共享 middleware 配置必须使用 `setTransportMiddlewares()` 的替换语义，禁止在启动路径使用 `registerTransportMiddleware()`，避免 HMR 或重复初始化累加执行。
- SSO 响应返回新的 `Authorization` 时，由 `refreshTokenFromResponse()` 统一更新本地会话。
- `menuData` 的导航过滤和路由访问控制遵循 `references/routing-and-navigation.md`，不得仅隐藏菜单而绕过 route guard。
- AI Playwright 的本地 SSO 登录态准备遵循 `oig-sso-skill`，不要把测试凭据或环境地址复制到本 reference。
- `pnpm codegen` 只调用 `openapi-client generate`，禁止在业务仓库增加生成后 patch 脚本。
- `pnpm openapi:fetch` 从已运行的后端拉取 OpenAPI；默认地址为 `http://localhost:8080/v3/api-docs`，需要其他地址时设置 `OPENAPI_FETCH_URL`。该命令不负责启动或重启后端。
- `pnpm api` 按顺序执行 `openapi:fetch` 与 `codegen`；接口契约变化时使用它同步 spec 与 generated client。
- 字典和枚举页面展示必须通过 generated client 批量调用 `/api/system/dict/global/items/options`；页面级缓存一次，表格 cell 禁止发请求。停用项保留在显示映射中，但不得进入可选 options。
- `openapi/clients.ts` 的 `service` client 必须声明 `transportBinding: 'core-singleton'`；单 SPA 共享 package core 单例，如果未来出现 SSR、同页多应用或不同认证管线，再改用独立 transport 或 custom mutator。
- 生成后的 `openapi/.generated/*-orval-mutator.ts` 只能从 `@oig/react-query-generator/core` 导入 `createDefaultApiClientCustomInstance`，不得反向依赖项目 `transport.ts`。
- 生成后的 `src/lib/api/clients/*/generated/**/*.ts` 由 `openapi-client` 自动带上 `// @ts-nocheck`。
- 禁止在 generated 文件中重复注册 middleware。


## 错误呈现与契约修复

- UI 使用 `src/lib/api/error-normalizer.ts` 的 `normalizeApiError()` / `normalizeBusinessError()`，不得直接展示未知异常的原始 message。transport 保留原始异常供认证、重试、取消判断。
- 取消请求不重试、不弹错误；Query 默认由全局 toast 呈现，页面自行展示时传入 `SILENT_QUERY_META`（`@/lib/query-client`）。Mutation 有局部 `onError` 时由局部负责提示。
- 原生 fetch / XMLHttpRequest / bootstrapRequest 的允许边界由 `src/test/contracts/openapi-adoption.test.ts` 检查；新业务功能使用生成客户端，不新增手写业务 transport。
- 接口或类型缺失时，先核对后端 Controller/DTO、服务导出的 OpenAPI 和本地 spec。修复后端契约或同步服务版本后，再执行 `pnpm api`；单独 `pnpm codegen` 不会更新后端契约。
- 禁止手改 spec、generated 文件、生成后 patch 或用类型断言补造契约。后端不可用时报告阻塞；保留模板自身的 IAM/SSO 认证边界与 operationId。

## SSO 错误呈现

- bootstrap 与共享 transport 同时识别 HTTP 401 和成功 HTTP 响应中明确的 `code` / `rspCode` 401，必须在刷新响应凭据前处理；403 不触发会话失效。
- 首次无凭据的登录引导使用 `LoginRequiredError`，与已登录会话的 `SessionExpiredError` 区分。缺少登录地址时提供重试，不伪装成 500，也不触发退出确认。
- 全局路由和 dashboard 共用 `RouteErrorPage`；会话失效交给全局确认框，首次登录不重复 toast，未知异常统一使用安全错误归一化器。

## SSO 存储隔离

- `VITE_APP_SSO_SERVICE_CODE` 必填；同源独立系统必须配置不同 code。token、用户 ID、退出地址和回跳参数使用 `sso:<编码后的 serviceCode>:` 前缀，禁止读写旧公共 key。
- 升级后旧公共登录缓存不迁移，用户重新通过 SSO 换票。回跳只恢复业务查询参数，忽略暂存的旧 token。
- 会话失效状态由 `sessionExpiryStore` 统一维护；确认退出前不允许 Escape/遮罩关闭提示。无退出地址时清除当前 URL 的 token 后重新进入当前页面。
- E2E 与登录录制脚本必须通过共享 storage-key helper 计算隔离 key；UI 测试使用构建时同一 serviceCode。


## 同源统一登录失效协议

- 适用于同源各应用共用 SSO 网关会话的部署。已有 token 的 401 和主动退出清理所有 `sso:<编码后的 serviceCode>:{token,user_id,user_code,logout_url}`；登录引导的 `clearAuth()` 仍只清当前服务。
- 保留业务数据、登录前查询参数和旧公共 key。清理前保存退出地址，并移除当前 URL token，避免刷新恢复失效凭据。
- `main.tsx` 注册 `subscribeToSsoSessionInvalidation()`，HMR dispose 时取消。各应用使用 localStorage 的 `sso:session-invalidated` 通知（事件 ID、退出地址）同步内存失效状态；接收方不重复广播，阻止请求和迟到响应回写。其他应用也必须接入该协议才能即时响应。
- `X-User-Code` 为可选用户编码头，优先使用登录信息的 `userCode`，并支持从 URL/响应 token 的 JWT payload 提取及本地 token 兜底；解析仅用于字段传递，不代表 JWT 验签或授权。编码按服务存储，失效期间禁止写回，退出与统一失效时清理。缺少编码时不新增该请求头。

## 带过期时间的浏览器缓存

- `src/hooks/use-expiring-storage.ts` 提供 `createExpiringStorage()` 与 `useExpiringStorage()`，支持 local/session storage 和自定义异步 adapter。
- 调用方显式提供独立 key、TTL、类型校验和创建时间提取；失效记录在读取时清理，不依赖后台计时器。hook 的 client 应保持引用稳定。
- 仅用于允许持久化的业务数据，不用于 token、密码等凭据。模板不预设具体业务的缓存内容和期限。

## 浏览器兼容构建

- 浏览器目标最低为 Chrome 111 / Edge 111（Chromium 111），不再支持 Chrome 109/110；`vite.config.ts` 同时设置 JS/CSS target。构建 target 不会补齐运行时 API，入口继续加载 `src/lib/browser/polyfills.ts`。
- 保留 Tailwind v4，OKLCH、`color-mix()` 和透明度由浏览器原生处理，不再生成 Chrome 109 专用颜色回退，也不要求混色变量可在构建时静态解析。共享固定列阴影 token 位于 `src/styles/browser-colors.css`。
- CSS 使用 Vite 内置的 Lightning CSS transformer，并显式配置 `css.lightningcss.targets`，保证 Tailwind 开发输出的嵌套规则也能在 Chrome 111 生效；仅设置 `build.cssTarget` 不能覆盖开发服务。
- Chrome 111 仍需 `AbortSignal.any` 补丁。其他浏览器的现有构建 target 暂时保留，`toSorted` / `toReversed` 补丁继续保留。Firefox 114 低于 Tailwind v4 官方的 Firefox 128 基线，不能仅凭构建 target 声明兼容；其支持范围需单独评估。
- 兼容回归使用 `e2e/browser-compatibility.smoke.spec.ts`，覆盖导航请求、全部主题的明暗模式、透明度、表格混色与固定列颜色；最低版本必须用真实 Chromium 111 验证，不能仅改 User-Agent。开发服务和生产构建都需要验证，并同时在当前稳定版 Chromium 回归。
