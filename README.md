# TanStack Admin Framework（SSO）

## 项目概览

这是一个基于 **TanStack Router、Shadcn UI、TypeScript 与 Tailwind CSS** 构建的纯 SPA 后台管理框架。本分支使用企业 SSO 登录，前端通过登录信息接口建立会话，并使用 SSO 返回的菜单数据同时约束导航可见性和页面访问。

框架提供后台布局、数据表格、表单、字典管理、导出中心、工作区页签、看板、聊天、通知中心和多主题能力，适合 SaaS 应用、内部工具与管理后台。

### 长期产品分支

本仓库同时维护两个独立演进的长期产品分支：

- `main`：普通 IAM 管理后台框架，包含框架内置的 IAM 登录与管理能力。
- `features/sso`：基于 SSO 登录的管理后台框架，维护 SSO 专属的认证流程与运行时能力。

两个分支代表不同的产品形态，不以保持完整提交历史同步为目标。除非经过明确的架构决策，禁止将 `main` 整体合并到 `features/sso`，也禁止反向整体合并。

需要在两个产品分支共同生效的修改，应从 `main` 创建短期分支和独立 worktree 开发，保持提交职责单一且不混入 IAM 或 SSO 专属逻辑。修改在 `main` 验证后，通过 `cherry-pick` 将对应原子提交选择性移植到 `features/sso`；如两边实现存在差异，应在目标分支增加适配提交，并分别完成验证。

### 技术栈

| 类别          | 技术                                                                 |
| ------------- | -------------------------------------------------------------------- |
| 框架          | [TanStack Router](https://tanstack.com/router)（基于文件、类型安全） |
| 语言          | [TypeScript 7](https://www.typescriptlang.org)                       |
| 构建工具      | [Vite 8.1](https://vite.dev)                                         |
| 样式方案      | [Tailwind CSS v4](https://tailwindcss.com)                           |
| 组件体系      | [Shadcn UI](https://ui.shadcn.com)                                   |
| 数据获取      | [TanStack React Query](https://tanstack.com/query)                   |
| 表格          | [TanStack Table](https://tanstack.com/table)                         |
| 表单          | [TanStack Form](https://tanstack.com/form) + [Zod](https://zod.dev)  |
| 图表          | [Recharts](https://recharts.org)                                     |
| 状态管理      | [Zustand](https://zustand-demo.pmnd.rs)                              |
| 命令面板      | [kbar](https://kbar.vercel.app)                                      |
| 主题系统      | [tweakcn](https://tweakcn.com)                                       |
| Lint / 格式化 | [OxLint](https://oxc.rs) / [Oxfmt](https://oxc.rs)                   |

## 功能特性

- 企业 SSO 登录、回跳会话恢复、统一登出与 401 处理
- 基于 SSO `menuData.code` 的导航过滤和 route 访问控制
- 后台布局骨架（侧边栏、顶部栏、内容区域）
- 数据概览页与基于 Suspense 的独立加载区块
- 数据表格，支持 DSL 查询、服务端分页、类型安全的选择列编辑与跨页草稿、本地列值筛选、列拖拽与持久化、虚拟滚动、单元格复制和区域选择
- 类型安全的文件路由，以及由 route metadata 派生的侧边栏、KBar、breadcrumb 与 workspace 行为
- 工作区页签，支持拖拽排序、LRU 淘汰、页面注册表、保活与浮层清理
- Shadcn UI 组件体系、10+ 主题与明暗模式
- 表单示例、Kanban 看板、聊天、通知中心、字典管理与导出中心
- 静态构建产物，可部署到任意静态文件服务器

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

## 目录结构

```text
src/
├── routes/                         # TanStack Router 文件路由
│   ├── __root.tsx                  # 根布局与全局 Provider
│   ├── index.tsx                   # 首页重定向
│   ├── auth/                       # 兼容认证入口
│   ├── dashboard.tsx               # SSO 登录信息 loader 与控制台布局
│   └── dashboard/                  # 控制台内容页
├── components/
│   ├── ui/                         # Shadcn UI 基础原语（button、input、table 等）
│   ├── data-table/                 # DataTable 共享子系统
│   │   ├── actions/                # 顶层、选择和行操作
│   │   ├── cells/                  # 通用单元格展示组件
│   │   ├── columns/                # 稳定列入口与列定义实现
│   │   │   ├── dsl/                # 列 builder、options、formatter 与 type registry
│   │   │   └── header/             # 可排序/筛选列头与 resize handle
│   │   ├── core/                   # 表格壳、表头/表体、选择、粘贴与填充
│   │   │   └── fixtures/           # 矩阵粘贴等核心行为的测试输入资产
│   │   ├── dnd/                    # 列拖拽
│   │   ├── editing/                # 单元格编辑子域
│   │   │   ├── adapters/           # 列类型到 editor/codec 的适配
│   │   │   ├── cells/              # editable cell 与键盘交互
│   │   │   └── codecs/             # 编辑值解析、校验与格式化
│   │   ├── expand/                 # 展开分屏
│   │   ├── export/                 # 导出交互
│   │   ├── feedback/               # loading、empty、error 状态
│   │   ├── filters/                # 工具栏筛选与表头本地 Set Filter
│   │   ├── toolbar/                # 工具栏与列面板
│   │   └── virtualization/         # 行列虚拟化
│   ├── forms/                      # 共享表单组合
│   ├── layout/                     # Header、Sidebar、PageContainer
│   ├── modal/                      # 共享 modal 组合
│   ├── themes/                     # 主题系统
│   └── kbar/                       # Command+K 命令面板
├── features/
│   ├── auth/                       # SSO 禁止访问与路由无权限状态页
│   ├── workspace-tabs/             # 工作区页签、页面注册与保活
│   ├── dictionaries/               # 字典管理
│   ├── export-center/              # 导出中心
│   ├── overview/                   # 数据概览
│   ├── forms/                      # 表单示例
│   ├── kanban/                     # 看板
│   ├── chat/                       # 聊天
│   └── notifications/              # 通知中心
├── lib/                           # 无 UI 的跨 feature 共享运行时与纯算法
│   ├── api/                       # API transport、SSO 会话与生成客户端适配
│   │   ├── sso/                   # SSO bootstrap、session、headers、queries
│   │   ├── transport.ts           # OpenAPI generated client 共享 transport
│   │   └── clients/               # OpenAPI 生成客户端
│   ├── data-table/                # DataTable 纯算法与状态持久化
│   ├── formatters/                # 日期、数字和展示格式化
│   ├── router/                    # 路由元数据、守卫与导航算法
│   ├── query-client.ts            # React Query 客户端配置
│   └── utils.ts                   # 通用 cn() 类名合并与浏览器 UUID 生成
├── config/                        # 环境变量与特性配置
├── hooks/                         # 跨 feature 状态编排
│   └── use-data-table/            # 表格状态、服务端 DSL、编辑和本地筛选运行时
├── styles/                        # 全局样式与主题
├── test/                          # 跨子系统测试基础设施与项目级契约
│   ├── contracts/                 # 架构、OpenAPI adoption 等项目级契约测试
│   └── smoke/                     # 冒烟测试
└── types/                         # TypeScript 类型
```

## SSO 运行时

1. `src/router.tsx` 创建 Router 前调用 `hydrateFromUrl()`，从 SSO 回调 URL 恢复 token 和登录前查询参数。
2. `/dashboard` loader 调用 `ensureSsoLoginInfo()`；`bootstrapRequest()` 获取登录信息，并在未登录或会话过期时跳转 SSO 提供的登录/登出地址。
3. `src/lib/api/transport.ts` 为 generated client 注入 SSO 服务头、`Authorization` 和 `X-User-Id`，并从响应头刷新 token。
4. 侧边栏、KBar 和声明了 `nav.menuKey` 的 route 使用同一份可见 `menuData.code` 集合，分别完成菜单过滤与访问校验。

SSO 账号、密码、ticket、token 和环境专属地址不得写入 tracked 文件。AI Playwright 登录态准备与本地回跳流程由 [`oig-sso-skill`](.agents/skills/oig-sso-skill/SKILL.md) 维护。

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
OPENAPI_FETCH_URL=http://127.0.0.1:18080/v3/api-docs pnpm api

# 仅根据已提交的本地 spec 重新生成，不访问后端
pnpm codegen
```

页面禁止绕过 generated client 直接 `fetch('/...')`。

## 开发规范

README 只维护项目定位、运行方式和架构入口；可执行的工程约束集中维护在 [`oig-tanstack-admin`](.agents/skills/oig-tanstack-admin/SKILL.md)，避免 README、代理规则和技能 reference 多处重复。

开始修改前先阅读 [`AGENTS.MD`](AGENTS.MD)，再按任务加载对应 reference：

| 任务领域                              | 规范入口                                                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| UI、Card、图标、PageContainer         | [`ui-components.md`](.agents/skills/oig-tanstack-admin/references/ui-components.md)                   |
| DataTable、分页、虚拟化、审计列       | [`data-table.md`](.agents/skills/oig-tanstack-admin/references/data-table.md)                         |
| 表单、SearchCombobox、Sheet / Dialog  | [`forms.md`](.agents/skills/oig-tanstack-admin/references/forms.md)                                   |
| 路由、导航、SSO 菜单权限、workspace   | [`routing-and-navigation.md`](.agents/skills/oig-tanstack-admin/references/routing-and-navigation.md) |
| 环境变量、SSO 会话、OpenAPI transport | [`configuration-and-api.md`](.agents/skills/oig-tanstack-admin/references/configuration-and-api.md)   |
| Git 提交                              | [`git-commits.md`](.agents/skills/oig-tanstack-admin/references/git-commits.md)                       |

## 快速开始

> [!IMPORTANT]
> 当前仓库统一使用 `pnpm`，锁文件以 `pnpm-lock.yaml` 为准。项目及 `@oig/react-query-generator` 5.x 要求 Node.js `>=22.18.0`。

```bash
corepack enable
pnpm install
cp env.example.txt .env
pnpm dev
```

开发服务器默认监听 <http://localhost:3000>，不设置额外变量也可以启动；进入需要登录信息的 dashboard 仍依赖可访问的 SSO 后端。接入实际后端与 SSO 时，在 `.env` 中按 `env.example.txt` 配置：

- `APP_GATEWAY`：Vite 代理与 generated transport 的后端网关前缀
- `PROXY_URL`：Vite dev server 的代理目标；是否经过网关完全由该地址决定
- `DEV_MOCK_SSO`：设为 `true` 时仅在 Vite dev server mock 数字用户及全部已声明菜单权限；同时为无网关 context path 的后端移除 `APP_GATEWAY`，但不改变 `PROXY_URL`
- `OPENAPI_FETCH_URL`：可选的 OpenAPI 文档地址，仅供拉取命令使用
- `APP_BASE_PATH`：非根路径部署时的公共路径
- `VITE_APP_SSO_CLIENT_ID`、`VITE_APP_SSO_SERVICE_ID`、`VITE_APP_SSO_SERVICE_CODE`：共享 transport 注入的 SSO 服务头

当前项目使用 TypeScript 7 执行 `pnpm typecheck`。依赖 TypeScript Compiler API 的工具暂时通过 `@typescript/typescript6` 兼容包运行；待相关工具完成 API 迁移后再移除。

### 常用校验

```bash
pnpm check
pnpm format:check
pnpm build
```

需要验证真实 SSO 登录链路时，按 [`oig-sso-skill`](.agents/skills/oig-sso-skill/SKILL.md) 准备本地 ignored 凭据并运行其测试脚本。

## 部署

本项目为纯 SPA 架构，构建产物为静态文件：

```bash
pnpm build
pnpm preview
```

`dist/` 可部署到 Nginx、Vercel、Netlify、Cloudflare Pages 等静态文件服务器。使用子路径部署时，必须同时配置 `APP_BASE_PATH` 和静态服务器的 SPA fallback。

## 与 Next.js 版本的主要区别

| 概念     | Next.js                                 | 本项目（TanStack Router SPA）                    |
| -------- | --------------------------------------- | ------------------------------------------------ |
| 架构     | SSR / RSC                               | 纯 SPA（客户端路由）                             |
| 路由     | App Router (`app/`)                     | 基于文件的路由（`routes/`），类型安全参数        |
| 数据获取 | Server Components + `HydrationBoundary` | `useSuspenseQuery` + React Query                 |
| 布局     | `layout.tsx` 嵌套                       | 基于 `<Outlet />` 的布局路由                     |
| 构建工具 | Webpack / Turbopack                     | Vite                                             |
| 部署     | `next start`（Node 服务端）             | 静态文件（`dist/`），部署到任意静态服务器        |
| URL 状态 | nuqs                                    | TanStack Router `useSearch()` + `validateSearch` |
