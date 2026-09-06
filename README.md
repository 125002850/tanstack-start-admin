# TanStack Admin Framework

## 项目概览

这是一个基于 **TanStack Router、Shadcn UI、TypeScript 与 Tailwind CSS** 构建的 **纯 SPA 后台管理框架**。

它提供了一套可直接用于生产环境的 **后台界面基础设施**，包含图表、表格、表单、字典管理、导出中心、看板、聊天，以及按功能拆分的目录结构，适合用于 **SaaS 应用、内部工具和管理后台**。

### 长期产品分支

本仓库同时维护两个独立演进的长期产品分支：

- `main`：普通 IAM 管理后台框架，包含框架内置的 IAM 登录与管理能力。
- `features/sso`：基于 SSO 登录的管理后台框架，维护 SSO 专属的认证流程与运行时能力。

两个分支代表不同的产品形态，不以保持完整提交历史同步为目标。除非经过明确的架构决策，禁止将 `main` 整体合并到 `features/sso`，也禁止反向整体合并。

需要在两个产品分支共同生效的修改，应从 `main` 创建短期分支和独立 worktree 开发，保持提交职责单一且不混入 IAM 或 SSO 专属逻辑。修改在 `main` 验证后，通过 `cherry-pick` 将对应原子提交选择性移植到 `features/sso`；如两边实现存在差异，应在目标分支增加适配提交，并分别完成验证。

### 技术栈

| 类别          | 技术                                                                                                  |
| ------------- | ----------------------------------------------------------------------------------------------------- |
| 框架          | [TanStack Router](https://tanstack.com/router)（基于文件、类型安全）                                  |
| 语言          | [TypeScript 7](https://www.typescriptlang.org)                                                        |
| 构建工具      | [Vite 8.1](https://vite.dev)                                                                          |
| 样式方案      | [Tailwind CSS v4](https://tailwindcss.com)                                                            |
| 组件体系      | [Shadcn-ui](https://ui.shadcn.com)                                                                    |
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

- **数据表格**，支持 React Query 路由加载、DSL 查询构建、表头本地列值多选筛选、类型安全编辑与跨页草稿、列拖拽排序、状态持久化、虚拟滚动、复制粘贴与分页

- **类型安全的文件路由**，基于 TanStack Router 自动生成路由树

- **纯 SPA 架构**，前端路由，无服务端渲染依赖

- **Infobar 组件**，用于在页面中展示提示、状态信息和上下文说明

- **Shadcn UI 组件体系**，配合 Tailwind CSS 使用

- **多主题支持**，内置 10+ 主题并支持快速切换

- **按功能划分的目录结构**，更适合扩展型项目

- **Kanban 看板**，支持拖拽交互（dnd-kit + Zustand）

- **聊天界面**，包含会话列表、消息气泡和自动回复演示

- **通知中心**，包含铃铛徽标、弹层预览和完整页面视图

- **字典管理**，支持字典类型管理、字典项增删改查，采用 Sheet 抽屉交互

- **工作区页签系统**，支持多页签打开、拖拽排序、LRU 淘汰、页面注册表、统一 WorkspacePageRoute 入口和浮层清理

- **系统管理导航**，提供系统管理和基础设置入口，并支持基于 IAM 菜单树 `menuKey` 的可选菜单权限过滤

- **命令面板**（Cmd+K），用于快速导航

- **多平台部署能力**，构建产物为静态文件，可部署到任意静态服务器

## 页面说明

| 页面                                                   | 说明                                                                             |
| :----------------------------------------------------- | :------------------------------------------------------------------------------- |
| [数据概览](/dashboard/overview)                        | 使用 Recharts 图表和卡片展示概览数据，并通过 Suspense 实现分区独立加载与错误隔离 |
| [Kanban 看板](/dashboard/kanban)                       | 基于 dnd-kit 和 Zustand 的拖拽任务看板，支持列排序和优先级展示                   |
| [聊天](/dashboard/chat)                                | 聊天界面，包含会话列表、消息气泡、快捷回复和文件附件能力                         |
| [通知中心](/dashboard/notifications)                   | 通知中心，包含铃铛徽标、弹层预览以及带标签页的完整通知页面                       |
| [字典管理](/dashboard/system-management/dictionaries)  | 字典类型管理 + 字典项增删改查，支持 Sheet 抽屉交互和搜索筛选                     |
| [导出中心](/dashboard/system-management/export-center) | 管理异步导出任务、导出进度、文件下载和失败重试                                   |
| [系统管理](/dashboard/system-management)               | 系统管理导航页面，提供字典管理、导出中心等基础设施入口                           |
| [表单示例](/dashboard/forms/basic)                     | 展示基础表单、多步骤表单、Sheet/Dialog 表单和高级表单模式                        |
| [未找到页面](/notfound)                                | 通过 TanStack Router 的 `defaultNotFoundComponent` 实现自定义 404 页面           |

## 按功能划分的目录结构

```plaintext
src/
├── assets/                        # 由模块导入的静态资源
├── routes/                        # TanStack Router 的文件路由
│   ├── __root.tsx                 # 根布局（providers、theme、HTML 文档壳）
│   ├── index.tsx                  # 首页（认证跳转）
│   ├── about.tsx                  # 公开关于页
│   ├── privacy-policy.tsx         # 隐私政策
│   ├── terms-of-service.tsx       # 服务条款
│   ├── auth.tsx                   # 认证布局
│   ├── auth/                      # 认证页面（登录、注册、密码流程）
│   ├── dashboard.tsx              # 控制台布局（侧边栏、头部、KBar）
│   └── dashboard/                 # 控制台页面
│       ├── overview.tsx           # 概览页，使用 Suspense 做分区加载
│       ├── kanban.tsx             # 任务看板页
│       ├── chat.tsx               # 聊天页面
│       ├── notifications.tsx      # 通知页面
│       ├── account/               # 账号设置
│       ├── basic-settings/        # IAM 基础设置
│       ├── elements/              # UI 能力示例
│       ├── examples/              # DataTable 等综合示例
│       ├── forms/                 # 表单示例
│       ├── log-management/        # 登录与操作日志
│       └── system-management/     # 系统管理（字典管理、导出中心）
│
├── components/                    # 共享组件
│   ├── ui/                        # Shadcn UI 基础原语（button、input、table 等）
│   ├── data-table/                # DataTable 共享子系统
│   │   ├── actions/               # 顶层、选择和行操作
│   │   ├── cells/                 # 通用单元格展示组件
│   │   ├── columns/               # 稳定列入口与列定义实现
│   │   │   ├── dsl/               # 列 builder、options、formatter 与 type registry
│   │   │   └── header/            # 可排序/筛选列头与 resize handle
│   │   ├── core/                  # 表格壳、表头/表体与能力装配
│   │   │   └── body/              # 普通/虚拟表体与共享 cell 渲染
│   │   ├── dnd/                   # 列拖拽
│   │   ├── editing/               # 单元格编辑子域
│   │   │   ├── adapters/          # 列类型到 editor/codec 的适配
│   │   │   ├── batch/             # 粘贴、填充等批量编辑计划
│   │   │   │   └── fixtures/      # 批量编辑测试输入
│   │   │   ├── cells/             # editable cell 与键盘交互
│   │   │   ├── choice/            # 选项值模型、展示、编辑器与远程查询
│   │   │   ├── codecs/            # 编辑值解析、校验与格式化
│   │   │   └── runtime/           # 跨页草稿、错误、提交与编辑 session 引擎
│   │   ├── expand/                # 展开分屏
│   │   ├── export/                # 导出交互
│   │   ├── feedback/              # loading、empty、error 状态
│   │   ├── filters/               # 工具栏筛选与表头本地 Set Filter
│   │   ├── selection/             # 单元格区域选择、剪贴板、填充与交互编排
│   │   ├── toolbar/               # 工具栏与列面板
│   │   └── virtualization/        # 行列虚拟化
│   ├── dictionary/                # 字典 scope 与内存映射基础设施
│   ├── forms/                     # 共享表单组合
│   ├── layout/                    # 布局组件（header、sidebar 等）
│   ├── modal/                     # 共享 modal 组合
│   ├── themes/                    # 主题系统（selector、mode toggle、config）
│   └── kbar/                      # Command+K 命令面板
│
├── features/                      # 按功能组织的模块
│   ├── iam/                       # IAM API、页面组件与领域工具
│   │   └── components/detail/     # IAM 专属详情展示组件
│   ├── overview/                  # 控制台数据概览（图表、卡片）
│   ├── kanban/                    # 拖拽任务看板
│   ├── chat/                      # 聊天模块（会话、气泡、输入框）
│   ├── notifications/             # 通知中心与状态存储
│   ├── dictionaries/              # 字典管理（类型 + 字典项 CRUD）
│   ├── elements/                  # UI 能力示例
│   ├── export-center/             # 导出中心（任务列表、下载、重试）
│   ├── workspace-tabs/            # 工作区页签系统（注册表、LRU 淘汰、拖拽排序）
│   ├── auth/                      # 认证相关组件
│   └── forms/                     # 表单展示模块
│
├── lib/                           # 无 UI 的跨 feature 共享运行时与纯算法
│   ├── api/                       # API transport、IAM 运行时与生成客户端适配
│   ├── browser/                   # 浏览器 DOM 与 runtime helper
│   ├── data-table/                # DataTable 纯算法与状态持久化
│   ├── formatters/                # 日期、数字和展示格式化
│   ├── router/                    # 路由元数据、守卫与导航算法
│   ├── query-client.ts            # React Query 客户端配置
│   └── utils.ts                   # 通用 cn() 类名合并与浏览器 UUID 生成
├── hooks/                         # 跨 feature 状态编排
│   └── use-data-table/            # 表格状态、服务端 DSL、编辑和本地筛选运行时
├── config/                        # infobar、data table 等配置
├── constants/                     # Mock 数据
├── styles/                        # 全局样式与主题文件
│   └── themes/                    # 各主题独立 CSS（OKLCH）
├── test/                          # 跨子系统测试基础设施与项目级契约
│   ├── contracts/                 # 架构、OpenAPI adoption 等项目级契约测试
│   ├── fixtures/                  # 项目级共享测试输入
│   ├── lint/                      # lint 自测试输入
│   └── smoke/                     # 跨模块 smoke 测试
└── types/                         # 跨层 TypeScript 类型定义（含 data-table.ts）
```

完整的目录归属与 DataTable 子系统边界见 [oig-tanstack-admin 项目结构规范](.agents/skills/oig-tanstack-admin/references/project-structure.md)。

## 字典与枚举展示

后端普通字典和枚举字段只返回稳定 code，页面展示名称由前端字典组件负责。一个页面先用 `useDicts` 或 `DictionaryScope` 声明全部字典类型，通过 generated client 一次请求 `/api/system/dict/global/items/options`；表格 cell 只能读取内存映射，不得逐格请求。

- code/name 映射保留停用项，用于正确显示历史数据；
- 表单 `options` 只含启用项；
- 枚举对前端也视为字典，不在前端复制后端枚举描述；
- 后端导出使用服务端翻译器，不依赖浏览器字典缓存。

## OpenAPI 客户端生成

前端只使用 Swagger 生成客户端调用业务 API。拉取动作只读取已经运行的 Java 服务，不会启动或重启后端：

```bash
# 从默认 http://localhost:8080/v3/api-docs 拉取 spec 并生成客户端
pnpm api

# 后端运行在其他地址时显式指定
OPENAPI_FETCH_TARGET=http://127.0.0.1:18080/v3/api-docs pnpm api

# 仅根据已提交的本地 spec 重新生成，不访问后端
pnpm codegen
```

页面禁止绕过 generated client 直接 `fetch('/...')`。

## 工程规范

开发前阅读 [AGENTS.MD](AGENTS.MD) 和 [项目 Skill 入口](.agents/skills/oig-tanstack-admin/SKILL.md)，再按任务读取下列规范。README 提供项目概览和操作入口；团队约束正文统一维护在 reference，通用 skills 不能覆盖本仓库约束。

| 任务                               | 规范                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------- |
| 安装、首次启动、代码生成与验证     | [开发工作流](.agents/skills/oig-tanstack-admin/references/development-workflow.md)        |
| 目录归属与模块边界                 | [项目结构](.agents/skills/oig-tanstack-admin/references/project-structure.md)             |
| Card、图标与页面布局               | [UI 组件](.agents/skills/oig-tanstack-admin/references/ui-components.md)                  |
| 表格、列 DSL、编辑与虚拟化         | [DataTable](.agents/skills/oig-tanstack-admin/references/data-table.md)                   |
| 路由元数据、权限、导航与 workspace | [路由与导航](.agents/skills/oig-tanstack-admin/references/routing-and-navigation.md)      |
| 表单、选择器与浮层                 | [表单](.agents/skills/oig-tanstack-admin/references/forms.md)                             |
| 拖拽、点击与 pointer 竞争          | [拖拽交互](.agents/skills/oig-tanstack-admin/references/drag-and-pointer-interactions.md) |
| 环境变量、API transport 与 IAM     | [配置与 API](.agents/skills/oig-tanstack-admin/references/configuration-and-api.md)       |
| Git 提交与推送                     | [Git 规范](.agents/skills/oig-tanstack-admin/references/git-commits.md)                   |

## 快速开始

> [!NOTE]
> 这个后台管理框架基于 **TanStack Router**、**React 19**、**Vite 8.1** 和 **Shadcn UI** 构建，采用纯 SPA 架构。可按以下步骤在本地运行：

克隆仓库：

```bash
git clone https://github.com/125002850/tanstack-start-admin.git
cd tanstack-start-admin
```

先按[开发工作流](.agents/skills/oig-tanstack-admin/references/development-workflow.md)确认 Node、pnpm 和包源。首次检出后安装依赖、准备环境文件并生成客户端：

```bash
corepack enable
pnpm install --frozen-lockfile
cp env.example.txt .env
pnpm codegen
pnpm dev
```

完成后可以通过 <http://localhost:3000> 访问应用。

已有 `.env` 时保留现有配置。`pnpm codegen` 使用已提交的本地 OpenAPI spec；`pnpm dev` 启动时由 Router 插件生成路由树。首次单独执行类型检查前，按开发工作流先生成客户端并运行构建。

- `APP_GATEWAY`、`PROXY_URL`：Vite 代理前缀与后端地址
- `OPENAPI_FETCH_TARGET`：可选的 OpenAPI 文档地址，仅供拉取命令使用
- `APP_BASE_PATH`：非根路径部署时的公共路径

> [!IMPORTANT]
> 当前仓库统一使用 `pnpm`，锁文件以 `pnpm-lock.yaml` 为准，不再维护 `bun.lock`。项目及 `@oig/react-query-generator` 5.x 要求 Node.js `>=22.18.0`。

> [!NOTE]
> 当前项目使用 TypeScript 7 执行 `pnpm typecheck`。由于 TypeScript 7.0 尚未提供程序化 Compiler API，依赖该 API 的代码生成和配置加载工具暂时通过官方 `@typescript/typescript6` 兼容包运行；`package.json` 中的 `@typescript/native` 提供 TypeScript 7 的 `tsc`，`typescript` 别名提供 TypeScript 6 API。待 TypeScript 7.1 及相关工具完成 API 迁移后再移除兼容包。

## 部署

本项目为纯 SPA 架构，构建产物为静态文件，可部署到任意静态文件服务器。

### 构建与启动

```bash
pnpm codegen
pnpm build
pnpm preview   # 本地预览构建产物
```

`dist/` 目录为构建输出，包含 `index.html` 与 `assets/` 静态资源。

### 部署方式

`dist/` 目录为构建输出，可部署到任意静态文件服务器（Nginx、Vercel、Netlify、Cloudflare Pages 等）。

## 与 Next.js 版本的主要区别

| 概念     | Next.js                                 | 本项目（TanStack Router SPA）                    |
| -------- | --------------------------------------- | ------------------------------------------------ |
| 架构     | SSR / RSC                               | 纯 SPA（客户端路由）                             |
| 路由     | App Router (`app/`)                     | 基于文件的路由（`routes/`），类型安全参数        |
| 数据获取 | Server Components + `HydrationBoundary` | `useSuspenseQuery` + React Query                 |
| 布局     | `layout.tsx` 嵌套                       | 基于 `<Outlet />` 的布局路由                     |
| 构建工具 | Webpack/Turbopack                       | Vite                                             |
| 部署     | `next start`（Node 服务端）             | 静态文件（`dist/`），部署到任意静态服务器        |
| URL 状态 | nuqs                                    | TanStack Router `useSearch()` + `validateSearch` |
