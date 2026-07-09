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

## 请求头与共享 Transport

认证环境值由 `env.ts` 提供；请求头组装位于 `src/lib/api/sso/set-headers.ts`：

```ts
function buildHeaders(headers?: HeadersInit): Headers {
  const merged = new Headers(headers);

  if (env.ssoServiceID) {
    merged.set('service-id', env.ssoServiceID);
  }

  if (env.ssoClientID) {
    merged.set('client-id', env.ssoClientID);
  }

  if (env.ssoServiceCode) {
    merged.set('service-code', env.ssoServiceCode);
  }

  return merged;
}

export function createAuthHeaders(init?: HeadersInit): Headers {
  const headers = buildHeaders(init);
  const token = getAuthHeader();

  if (token) {
    headers.set('Authorization', token);
  }

  return headers;
}
```

所有 HTTP 请求必须复用项目共享 transport：

- `src/lib/api/transport.ts` 创建唯一 transport 并注册请求、响应 middleware。
- 请求 middleware 调用 `createAuthHeaders()` 注入 SSO 头与 Authorization。
- 响应 middleware 调用 `refreshTokenFromResponse()`，并集中处理 HTTP 401。
- `createApiClientCustomInstance` 由同一 transport 工厂创建。
- 除 `src/lib/api/sso/bootstrap.ts` 这类登录引导请求外，业务和通用 API 代码禁止直接调用 `fetch`。
- `pnpm codegen` 只调用 `openapi-client generate`，禁止在业务仓库增加生成后 patch 脚本。
- 生成后的 `openapi/.generated/*-orval-mutator.ts` 由 `openapi-client` 按约定导入 `src/lib/api/transport.ts`，只创建带 `basePath` 的实例。
- 生成后的 `src/lib/api/clients/*/generated/**/*.ts` 由 `openapi-client` 自动带上 `// @ts-nocheck`。
- 禁止在 generated 文件中重复注册 middleware。
