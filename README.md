# tanstack-admin

## 项目概览

这是一个基于 **TanStack Start、Shadcn UI、TypeScript 与 Tailwind CSS** 构建的 **后台管理系统**。

它提供了一套可直接用于生产环境的 **后台界面基础设施**，包含图表、表格、表单，以及按业务拆分的目录结构，适合用于 **SaaS 产品、内部工具和管理后台**。

### 技术栈

| 类别          | 技术                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| 框架          | [TanStack Start](https://tanstack.com/start)                                                          |
| 语言          | [TypeScript](https://www.typescriptlang.org)                                                          |
| 构建工具      | [Vite 7](https://vite.dev)                                                                            |
| 部署层        | [Nitro](https://nitro.build)（Vercel、Cloudflare、Node.js）                                           |
| 样式方案      | [Tailwind CSS v4](https://tailwindcss.com)                                                            |
| 组件体系      | [Shadcn-ui](https://ui.shadcn.com)                                                                    |
| 路由          | [TanStack Router](https://tanstack.com/router)（基于文件、类型安全）                                  |
| 数据获取      | [TanStack React Query](https://tanstack.com/query)                                                    |
| 表格          | [TanStack Table](https://tanstack.com/table)                                                          |
| 表单          | [TanStack Form](https://tanstack.com/form) + [Zod](https://zod.dev)                                   |
| 图表          | [Recharts](https://recharts.org)                                                                      |
| 状态管理      | [Zustand](https://zustand-demo.pmnd.rs)                                                               |
| 命令面板      | [kbar](https://kbar.vercel.app/)                                                                      |
| 主题系统      | [tweakcn](https://tweakcn.com/)                                                                       |
| Lint / 格式化 | [OxLint](https://oxc.rs/docs/guide/usage/linter) / [Oxfmt](https://oxc.rs/docs/guide/usage/formatter) |

## 功能特性

- **后台布局骨架**（侧边栏、顶部栏、内容区域）

- **数据概览页**，包含卡片和基于 Suspense 的独立加载区块

- **数据表格**，支持 React Query 路由加载、客户端缓存、搜索、筛选与分页

- **类型安全的文件路由**，基于 TanStack Router 自动生成路由树

- **服务端函数**，通过 `createServerFn()` 编写服务端逻辑

- **Infobar 组件**，用于在页面中展示提示、状态信息和上下文说明

- **Shadcn UI 组件体系**，配合 Tailwind CSS 使用

- **多主题支持**，内置 10+ 主题并支持快速切换

- **按业务功能划分的目录结构**，更适合扩展型项目

- **Kanban 看板**，支持拖拽交互（dnd-kit + Zustand）

- **聊天界面**，包含会话列表、消息气泡和自动回复演示

- **通知中心**，包含铃铛徽标、弹层预览和完整页面视图

- **命令面板**（Cmd+K），用于快速导航

- **多平台部署能力**，可通过 Nitro preset 部署到 Vercel、Cloudflare、Node.js 等环境

## 页面说明

| 页面                                       | 说明                                                                                           |
| :----------------------------------------- | :--------------------------------------------------------------------------------------------- |
| [数据概览](/dashboard/overview)            | 使用 Recharts 图表和卡片展示概览数据，并通过 Suspense 实现分区独立加载与错误隔离               |
| [产品列表（表格）](/dashboard/product)     | 基于 TanStack Table + React Query，结合路由预取、客户端缓存和 URL 搜索参数实现搜索、筛选与分页 |
| [新建产品表单](/dashboard/product/new)     | 使用 TanStack Form + Zod，并通过 `useMutation` 完成新增与编辑，成功后做缓存失效处理            |
| [用户列表（表格）](/dashboard/users)       | 用户表格页，使用 React Query + URL 状态模式，整体架构与产品模块保持一致                        |
| [React Query 示例](/dashboard/react-query) | 以 Pokemon API 为例，演示 route loader + `useSuspenseQuery` + 客户端缓存模式                   |
| [Kanban 看板](/dashboard/kanban)           | 基于 dnd-kit 和 Zustand 的拖拽任务看板，支持列排序和优先级展示                                 |
| [聊天](/dashboard/chat)                    | 聊天界面，包含会话列表、消息气泡、快捷回复和文件附件能力                                       |
| [通知中心](/dashboard/notifications)       | 通知中心，包含铃铛徽标、弹层预览以及带标签页的完整通知页面                                     |
| [表单示例](/dashboard/forms/basic)         | 展示基础表单、多步骤表单、Sheet/Dialog 表单和高级表单模式                                      |
| [未找到页面](/notfound)                    | 通过 TanStack Router 的 `defaultNotFoundComponent` 实现自定义 404 页面                         |

## 按功能划分的目录结构

```plaintext
src/
├── routes/                        # TanStack Router 的文件路由
│   ├── __root.tsx                 # 根布局（providers、theme、HTML 文档壳）
│   ├── index.tsx                  # 首页（认证跳转）
│   ├── auth/                      # 认证页面（登录、注册）
│   ├── dashboard.tsx              # 控制台布局（侧边栏、头部、KBar）
│   └── dashboard/                 # 控制台业务页面
│       ├── overview.tsx           # 概览页，使用 Suspense 做分区加载
│       ├── product/               # 产品 CRUD（route loader + React Query）
│       ├── users.tsx              # 用户表格页（route loader + React Query）
│       ├── react-query.tsx        # React Query 示例页
│       ├── kanban.tsx             # 任务看板页
│       ├── chat.tsx               # 聊天页面
│       ├── notifications.tsx      # 通知页面
│       ├── forms/                 # 表单示例
│       └── elements/              # UI 展示页
│
├── components/                    # 共享组件
│   ├── ui/                        # UI 基础组件（button、input、kanban 等）
│   ├── layout/                    # 布局组件（header、sidebar 等）
│   ├── themes/                    # 主题系统（selector、mode toggle、config）
│   └── kbar/                      # Command+K 命令面板
│
├── features/                      # 按业务功能组织的模块
│   ├── overview/                  # 控制台数据概览（图表、卡片）
│   ├── products/                  # 产品列表、表单、表格（React Query）
│   ├── users/                     # 用户管理表格（React Query）
│   ├── react-query-demo/          # React Query 示例（Pokemon API）
│   ├── kanban/                    # 拖拽任务看板
│   ├── chat/                      # 聊天模块（会话、气泡、输入框）
│   ├── notifications/             # 通知中心与状态存储
│   ├── auth/                      # 认证相关组件
│   └── forms/                     # 表单展示模块
│
├── lib/                           # 核心工具（query-client、parsers 等）
├── hooks/                         # 自定义 hooks（use-data-table、use-media-query 等）
├── config/                        # infobar、data table 等配置
├── constants/                     # Mock 数据
├── styles/                        # 全局样式与主题文件
│   └── themes/                    # 各主题独立 CSS（OKLCH）
└── types/                         # TypeScript 类型定义
```

## 路由元数据规范

当前项目采用“**route 文件本地定义元数据，运行时统一派生导航与页面头部**”的模式。每个 dashboard 路由应通过 `defineRouteMeta()` 同时声明：

- 文档标题（浏览器标签页）
- 页面头部标题、描述、`infoContent`
- 侧边栏 / KBar 导航信息
- breadcrumb 标签

### 标准写法

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const meta = defineRouteMeta({
  label: '用户',
  title: '概览: 用户管理',
  nav: {
    visible: true,
    group: 'overview',
    order: 30,
    icon: 'teams',
    shortcut: ['u', 'u']
  },
  page: {
    title: 'Users',
    description: 'Manage users (React Query + search params table pattern.)',
    infoContent: usersInfoContent
  }
});

export const Route = createFileRoute('/dashboard/users')({
  ...meta,
  component: UsersPage
});
```

### 字段职责

#### 顶层字段

- `label`
  路由的人类可读名称。默认用于侧边栏标题、KBar 名称，以及 `PageContainer` 在未声明 `page.title` 时的回退标题。
- `title`
  文档标题。`defineRouteMeta()` 会自动生成 `head()`，将它写入浏览器标签页；未提供时回退到 `label`。
- `breadcrumb`
  面包屑元数据。当前支持：
  - `label`: 面包屑文案
  - `to`: 可选，自定义 breadcrumb 链接目标

#### `nav`

- `visible`
  是否进入主导航派生。
- `group`
  顶部分组键，当前固定为 `overview | components | account`。
- `order`
  当前分组内的排序权重，数值越小越靠前。
- `icon`
  对应 `Icons` 表中的图标键。
- `shortcut`
  KBar 快捷键声明。
- `kind: 'container'`
  声明该项是容器菜单，不是普通页面链接。
- `parentId`
  子菜单归属的父级路由路径。当前用于“表单”这种容器菜单。
- `linkable: false`
  显式声明该项不可直接跳转，只作为容器或展示项存在。

#### `page`

- `page.title`
  页面内容区头部标题，对应 `PageContainer > Heading.title`。
- `page.description`
  页面内容区头部描述。
- `page.infoContent`
  页面头部信息浮层内容（Infobar）。

### 运行时消费规则

#### `PageContainer` 回退顺序

- `pageTitle`: 显式 prop > `staticData.page.title` > `staticData.label`
- `pageDescription`: 显式 prop > `staticData.page.description`
- `infoContent`: 显式 prop > `staticData.page.infoContent`

因此，只要页面头部文案属于 route 级静态信息，应优先写进 `defineRouteMeta()`，而不是在 feature 组件里重复传 `PageContainer` props。

#### 导航派生规则

- 侧边栏和 KBar 都从 Router 的 `routesById` + `staticData.nav` 派生，不再维护中心化导航配置。
- 容器菜单依赖 `nav.kind === 'container'` 和子项的 `nav.parentId` 建树，不通过 URL 前缀做隐式推断。
- `linkable: false` 的节点不会生成可执行 KBar action，也不会在侧边栏中渲染成跳转链接。

### 约束

- dashboard 路由新增菜单页时，必须补 `nav.visible/group/order`。
- dashboard 业务页面默认接入 workspace tabs。除重定向页、纯容器页或明确说明的不托管页面外，不要显式设置 `workspace.tagEnabled: false`。
- 新增实际内容页时，应默认按 workspace 页面接入；若页面需要参与多页签管理，route 侧保持默认 `workspace` 配置，并使用 `WorkspacePageBoundary` 托管页面实例。
- 只有明确不需要标签页承载时，才允许关闭 tab；关闭时必须在对应 route 文件旁用注释或实现结构说明原因，避免把业务页面误排除在页签体系外。
- 如果页面需要浏览器标题和页面头部标题不同，使用顶层 `title` 与 `page.title` 分离声明。
- 外部链接按钮不要使用 TanStack Router `Link`；应使用普通 `<a href>`。
- `defineRouteMeta()` 适用于“静态 route metadata + 默认 head”场景。若页面需要特殊 `head()` 逻辑，应在 route 文件中显式扩展，而不是反向修改消费端。

## 快速开始

> [!NOTE]
> 这个后台管理模板基于 **TanStack Start**、**React 19**、**Vite 7** 和 **Shadcn UI** 构建。可按以下步骤在本地运行：

克隆仓库：

```bash
git clone https://github.com/Kiranism/tanstack-start-dashboard.git
cd tanstack-start-dashboard
```

安装依赖并启动：

```bash
corepack enable
pnpm install
cp env.example.txt .env
pnpm dev
```

完成后可以通过 <http://localhost:3000> 访问应用。

> [!IMPORTANT]
> 当前仓库统一使用 `pnpm`，锁文件以 `pnpm-lock.yaml` 为准，不再维护 `bun.lock`。

## 部署

当前仓库默认使用 **Nitro `node-server`** 作为部署目标，适合以 **Docker + Nginx** 的方式自建 SSR 服务。

### 当前推荐方式：自建 SSR

当前部署链路为：

- Docker 构建镜像
- 容器内运行 `node .output/server/index.mjs`
- Nginx 反向代理到容器端口

详细部署步骤见：

- [docs/ssr-docker-nginx-deployment.md](docs/ssr-docker-nginx-deployment.md)

本地或服务器可使用以下命令验证构建与启动：

```bash
pnpm build
pnpm start
```

### 如果要部署到其他平台

可根据目标平台修改 `vite.config.ts` 中的 Nitro preset：

```ts
// Node.js server
nitro({ preset: 'node-server' });

// Vercel
nitro({ preset: 'vercel' });

// Cloudflare Pages
nitro({ preset: 'cloudflare-pages' });

// Netlify
nitro({ preset: 'netlify' });
```

如果要重新切回 Vercel，需要先把 preset 改回 `vercel`，再按对应平台方式部署。

## 与 Next.js 版本的主要区别

| 概念       | Next.js                                 | TanStack Start                                   |
| ---------- | --------------------------------------- | ------------------------------------------------ |
| 路由       | App Router (`app/`)                     | 基于文件的路由（`routes/`），并带有类型安全参数  |
| 数据获取   | Server Components + `HydrationBoundary` | Route `loader` + `useSuspenseQuery`              |
| 布局       | `layout.tsx` 嵌套                       | 基于 `<Outlet />` 的布局路由                     |
| 服务端代码 | `'use server'` actions                  | `createServerFn()`                               |
| 构建工具   | Webpack/Turbopack                       | Vite                                             |
| 部署       | `next start`                            | Nitro（可部署到多种平台）                        |
| URL 状态   | nuqs                                    | TanStack Router `useSearch()` + `validateSearch` |
