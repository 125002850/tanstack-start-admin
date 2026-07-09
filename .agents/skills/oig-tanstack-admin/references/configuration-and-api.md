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

- `src/lib/api/transport.ts`：OpenAPI generated client 的唯一共享 transport，统一注入 `Authorization`，并在 401 时触发 refresh / logout。
- `src/lib/api/iam/session.ts`：维护 access token、refresh token、登出跳转和密码修改后的 token 更新。
- `src/lib/api/iam/request.ts`：本地 IAM `/api/iam/*` 信封接口的手写请求边界，负责 `fetch`、超时、JSON 解码和业务错误转换。
- `src/lib/api/iam/queries.ts`：维护 `iam/me` 查询、权限快照和当前账号归一化。

约束：

- generated API、业务 query/mutation 和页面代码必须优先复用共享 transport 或 `iamRequest()`，禁止在边界外散落 `fetch`。
- 当前仓库允许直接调用 `fetch` 的 runtime 边界只有 `src/lib/api/iam/request.ts`；新增例外前必须同步调整契约测试。
- `transport.ts` 的 request middleware 只负责注入 `Authorization` 和 token freshness，不再拼装 `service-id` / `client-id` / `service-code` 一类 SSO 头。
- 401 处理统一收敛到 `transport.ts` 与 `iam/session.ts`；页面层不要自行复制 refresh、清 token 或重定向逻辑。
- `pnpm codegen` 只调用 `openapi-client generate`，禁止在业务仓库增加生成后 patch 脚本。
- 生成后的 `openapi/.generated/*-orval-mutator.ts` 由 `openapi-client` 按约定导入 `src/lib/api/transport.ts`，只创建带 `basePath` 的实例。
- 生成后的 `src/lib/api/clients/*/generated/**/*.ts` 由 `openapi-client` 自动带上 `// @ts-nocheck`。
- 禁止在 generated 文件中重复注册 middleware。
