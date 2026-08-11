# 配置中心与 API 规范

## 配置中心结构

```text
src/config/
├── index.ts           # barrel：统一导出配置
├── env.ts             # 唯一读取 import.meta.env.VITE_* 的位置
├── data-table.ts      # 表格特性配置
├── infoconfig.ts      # 页面 Infobar 配置
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
| 管辖变量 | `APP_GATEWAY`、`PROXY_URL`、`ANALYZE` | `VITE_ENABLE_WORKSPACE_TABS` 等 |
| 用途 | 代理、构建工具开关 | 客户端特性开关 |

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

约束：

- 新增 `VITE_*` 时必须同步更新 `env.ts` 和 `env.example.txt`。
- 特性 config 文件只通过相对路径 `./env` 导入环境配置，避免 barrel 循环。
- 常规应用消费者从 `@/config` 导入；低层基础设施若现有实现直接依赖 `@/config/env`，不要在无关任务中顺带迁移。
- `env.ts` 只负责读取与默认值，不包含业务逻辑。
- 纯 SPA 中 `VITE_*` 在构建时静态替换，运行时不可变。

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

## 请求、认证与共享 Transport

当前主线使用本地 IAM 登录链路，不再维护 `src/lib/api/sso/*` 运行时代码。

运行时边界：

- `src/main.tsx`：创建 Router 前调用 `configureApiTransport()`，作为共享 transport middleware 的唯一启动 owner。
- `src/lib/api/transport.ts`：定义 OpenAPI generated client 的共享 middleware，通过 `setTransportMiddlewares()` 统一注入 `Authorization`，并在 401 时触发 refresh / logout。
- `src/lib/api/iam/session.ts`：维护 access token、refresh token、登出跳转和密码修改后的 token 更新。
- `src/lib/api/iam/request.ts`：本地 IAM `/api/iam/*` 信封接口的手写请求边界，负责 `fetch`、超时、JSON 解码和业务错误转换。
- `src/lib/api/iam/queries.ts`：维护 `iam/me` 查询、权限快照和当前账号归一化。

约束：

- generated API、业务 query/mutation 和页面代码必须优先复用共享 transport 或 `iamRequest()`，禁止在边界外散落 `fetch`。
- 当前仓库允许直接调用 `fetch` 的 runtime 边界只有 `src/lib/api/iam/request.ts`；新增例外前必须同步调整契约测试。
- `transport.ts` 的 request middleware 只负责注入 `Authorization` 和 token freshness，不再拼装 `service-id` / `client-id` / `service-code` 一类 SSO 头。
- 共享 middleware 配置必须使用 `setTransportMiddlewares()` 的替换语义，禁止在启动路径使用 `registerTransportMiddleware()`，避免 HMR 或重复初始化累加执行。
- 401 处理统一收敛到 `transport.ts` 与 `iam/session.ts`；页面层不要自行复制 refresh、清 token 或重定向逻辑。
- `pnpm codegen` 只调用 `openapi-client generate`，禁止在业务仓库增加生成后 patch 脚本。
- `pnpm openapi:fetch` 从已运行的后端拉取 OpenAPI；默认地址为 `http://localhost:8080/v3/api-docs`，需要其他地址时设置 `OPENAPI_FETCH_TARGET`。该命令不负责启动或重启后端。
- `pnpm api` 按顺序执行 `openapi:fetch` 与 `codegen`；接口契约变化时使用它同步 spec 与 generated client。
- 字典和枚举页面展示必须通过 generated client 批量调用 `/api/system/dict/global/items/options`；页面级缓存一次，表格 cell 禁止发请求。停用项保留在显示映射中，但不得进入可选 options。
- `openapi/clients.ts` 的 `service` client 必须声明 `transportBinding: 'core-singleton'`；单 SPA 共享 package core 单例，如果未来出现 SSR、同页多应用或不同认证管线，再改用独立 transport 或 custom mutator。
- 生成后的 `openapi/.generated/*-orval-mutator.ts` 只能从 `@oig/react-query-generator/core` 导入 `createDefaultApiClientCustomInstance`，不得反向依赖项目 `transport.ts`。
- 生成后的 `src/lib/api/clients/*/generated/**/*.ts` 由 `openapi-client` 自动带上 `// @ts-nocheck`。
- 禁止在 generated 文件中重复注册 middleware。
