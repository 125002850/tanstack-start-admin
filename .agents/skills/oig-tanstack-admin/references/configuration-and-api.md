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
| 管辖变量 | `APP_GATEWAY`、`PROXY_URL`、`APP_BASE_PATH`、`ANALYZE` | `VITE_APP_SSO_*`、`VITE_ENABLE_*` |
| 用途 | 代理、公共路径、构建工具开关 | SSO 请求头与客户端特性开关 |

`vite.config.ts` 属于构建工具配置，不纳入 `src/config/`。

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
- `src/lib/api/transport.ts`：OpenAPI generated client 的唯一共享 transport，注入认证请求头、刷新响应 token，并统一处理业务请求的 401。
- `src/lib/api/sso/set-headers.ts`：组装 SSO 服务头、`Authorization` 与 `X-User-Id`，并从响应头刷新 token。
- `src/lib/api/sso/session.ts`：维护 token、用户 ID、登出地址、登录前查询参数和登出跳转。
- `src/lib/api/sso/bootstrap.ts`：`/api/getLoginInfo` 的手写 `fetch` 边界，负责首次登录/过期会话的 401 跳转。
- `src/lib/api/sso/queries.ts`：维护 SSO 登录信息查询、`menuData` 权限快照，以及登录禁止状态转换。

约束：

- generated API、业务 query/mutation 和页面代码必须复用共享 transport，禁止在边界外散落 `fetch`。
- 当前仓库允许直接调用 `fetch` 的运行时边界只有 `src/lib/api/sso/bootstrap.ts`；新增例外前必须同步调整 API adoption 契约测试。
- 首次登录或缺少 token 的 401 由 `bootstrap.ts` 跳转 `loginUrl`；已有 token 失效后的 401 优先跳转 `logoutUrl`。页面层不得复制清 token 或重定向逻辑。
- `transport.ts` 的 request middleware 必须统一调用 `createAuthHeaders()`；页面和 generated client 不得重复拼装 SSO 头或注册 middleware。
- SSO 响应返回新的 `Authorization` 时，由 `refreshTokenFromResponse()` 统一更新本地会话。
- `menuData` 的导航过滤和路由访问控制遵循 `references/routing-and-navigation.md`，不得仅隐藏菜单而绕过 route guard。
- AI Playwright 的本地 SSO 登录态准备遵循 `oig-sso-skill`，不要把测试凭据或环境地址复制到本 reference。
- `pnpm codegen` 只调用 `openapi-client generate`，禁止在业务仓库增加生成后 patch 脚本。
- 生成后的 `openapi/.generated/*-orval-mutator.ts` 按约定导入 `src/lib/api/transport.ts`，只创建带 `basePath` 的实例。
- 生成后的 `src/lib/api/clients/*/generated/**/*.ts` 由 `openapi-client` 自动带上 `// @ts-nocheck`。
- 禁止在 generated 文件中重复注册 middleware。
