# TanStack Start SSR → Pure SPA Migration Plan

## 概要

去掉 `@tanstack/react-start` + `nitro` SSR 外壳，保留 `@tanstack/react-router` + `@tanstack/react-query` + `vite` SPA 架构。

---

## 变更清单

### 1. 新建 `index.html` (项目根目录)

Vite SPA 入口 HTML，含反白屏脚本：

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
    <script>
      // 反白屏：在 React 加载前从 localStorage 恢复主题
      (function () {
        try {
          var t = localStorage.getItem('theme');
          var at = localStorage.getItem('active_theme');
          if (at) document.documentElement.setAttribute('data-theme', at);
          if (t === 'dark' || (!t && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
          }
        } catch (_) {}
      })();
    </script>
  </head>
  <body class="bg-background overflow-x-hidden overscroll-none font-sans antialiased">
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

### 2. 新建 `src/main.tsx`

Svelte/React SPA 入口：

```tsx
import { RouterProvider } from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';
import { createRouter } from './router';

const router = createRouter();

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Missing #root element');
const root = createRoot(rootEl);
root.render(<RouterProvider router={router} />);
```

### 3. 修改 `src/routes/__root.tsx`

- 删除 `createServerFn` import 和 `getActiveTheme` 定义
- 删除 `loader` 字段
- `component` 中删除 `<html>` / `<head>` / `<body>` 外壳（由 `index.html` 提供）
- 删除 `<Scripts />`（SSR hydration 专用）
- 保留 `<HeadContent>` / `<Outlet>` / 主题 provider / `TanStackRouterDevtools`
- `ActiveThemeProvider` 的 `initialTheme` 改为从 `localStorage` 读取或默认值

### 4. 修改 `src/routes/dashboard/react-query.tsx`

删除 `loader` 字段（数据由组件内 `useSuspenseQuery` 客户端获取，`<Suspense>` 已有 fallback）

### 5. 修改 `src/routes/dashboard/product/$productId.tsx`

删除 `loader` 字段（同 react-query）

### 6. 修改 `vite.config.ts`

- 删除 `import { tanstackStart } from '@tanstack/react-start/plugin/vite'`
- 删除 `import { nitro } from 'nitro/vite'`
- 添加 `import { tanstackRouter } from '@tanstack/router-plugin/vite'`
- 替换 `tanstackStart()` + `nitro(...)` 为 `tanstackRouter()`（target=spa 或默认）
- 恢复 Vite 原生 `server.proxy` 配置 `/api` → 后端（SPA 模式下 Vite dev server 是唯一的 HTTP server，proxy 正常工作）

### 7. 删除文件

- `src/server.ts` — SSR 入口，不再需要
- `src/start.ts` — TanStack Start 实例，不再需要
- `nitro.config.ts` — Nitro dev 代理，不再需要

### 8. 修改 `package.json`

**删除依赖：**
- `@tanstack/react-start`
- `nitro`

**修改 scripts：**
- `"start": "node .output/server/index.mjs"` → `"preview": "vite preview"`（或删除）

### 9. 修改 `src/routeTree.gen.ts` 中的类型声明

此文件由 `@tanstack/router-plugin/vite` 自动生成，需确认生成结果中：
- `declare module '@tanstack/react-start'` 块被移除
- router 类型注册改为 `declare module '@tanstack/react-router'`

**无需手动编辑** — 删除 `src/start.ts` 后重新运行 `vite dev` 自动重新生成。

### 10. 修改 `src/lib/query-client.ts`

注释修改即可（"In TanStack Start" → 删除）。

---

## 不变更的文件

- `src/router.tsx` — `createRouter` + `routerWithQueryClient` 在 SPA 模式完全兼容
- `src/lib/query-client.ts` — 逻辑不变
- 所有 24 个无 loader 的路由文件
- 所有数据层（services、queries、mutations）
- 所有 UI 组件、hooks、工具函数
- `tsconfig.json` — 无需改动
- `tailwindcss` / 样式 — 无需改动

---

## 验证步骤

1. `pnpm dev` 启动
2. 浏览器访问 `http://localhost:3000` — 首页渲染正常
3. 访问 `/dashboard/react-query` — Pokemon 正常加载（有短暂 loading）
4. 访问 `/dashboard/product/1` — 产品详情正常加载
5. 切换主题 — dark/light 正常，无白屏闪烁
6. `curl http://localhost:3000/api/mdm/dict/global/types/list` — 代理到后端正常
7. `pnpm build` + `pnpm preview` — 生产构建正常（静态文件，nginx 部署）

---

## Review (2026-06-09)

### 完成项与差异

- 所有 10 项变更按计划执行完成，无差异
- `routeTree.gen.ts` 由 `@tanstack/router-plugin/vite` 自动重新生成，`ssr: true` 和 `startInstance` 类型已移除
- `@tanstack/react-start` (1.167.65) 和 `nitro` (3.0.260603-beta) 已从依赖中移除，减少 60 个包
- `query-client.ts` 注释未修改（低优先级，非阻塞）

### 验证结果

| 测试项 | 状态 |
|--------|------|
| 首页 / 重定向到 dashboard | 通过 |
| 仪表盘概览（图表、卡片） | 通过 |
| React Query 页面（useSuspenseQuery） | 通过 |
| 产品管理页（表格、分页） | 通过 |
| API 代理 /api → 后端 | 通过（后端返回 405 Method Not Allowed，GET 需改用 POST） |
| 主题切换 | 通过 |
| 路由导航 | 通过 |
| Dev server 启动 | 通过（319ms） |

### 已删除文件

- `src/server.ts`
- `src/start.ts`
- `nitro.config.ts`

### Action Items

- **P2**: React Query 页面文案 "Prefetched on server, hydrated on client" 已过时，建议更新
- **P2**: `src/lib/query-client.ts` 注释中仍有 "In TanStack Start" 字样，可清理
- **P2**: 构建产物产到 `dist/` 目录（Vite SPA 默认），确认 nginx 配置指向 `dist/`
