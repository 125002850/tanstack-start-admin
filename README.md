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

- **数据表格**，支持 React Query 路由加载、DSL 查询构建、列拖拽排序、列宽 / 排序 / 分页持久化、虚拟滚动、单元格复制反馈、搜索筛选与分页

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
├── routes/                        # TanStack Router 的文件路由
│   ├── __root.tsx                 # 根布局（providers、theme、HTML 文档壳）
│   ├── index.tsx                  # 首页（认证跳转）
│   ├── auth/                      # 认证页面（登录、注册）
│   ├── dashboard.tsx              # 控制台布局（侧边栏、头部、KBar）
│   └── dashboard/                 # 控制台页面
│       ├── overview.tsx           # 概览页，使用 Suspense 做分区加载
│       ├── kanban.tsx             # 任务看板页
│       ├── chat.tsx               # 聊天页面
│       ├── notifications.tsx      # 通知页面
│       ├── forms/                 # 表单示例
│       ├── elements/              # UI 展示页
│       └── system-management/     # 系统管理（字典管理、导出中心）
│
├── components/                    # 共享组件
│   ├── ui/                        # UI 基础组件（button、input、kanban 等）
│   ├── layout/                    # 布局组件（header、sidebar 等）
│   ├── themes/                    # 主题系统（selector、mode toggle、config）
│   └── kbar/                      # Command+K 命令面板
│
├── features/                      # 按功能组织的模块
│   ├── overview/                  # 控制台数据概览（图表、卡片）
│   ├── kanban/                    # 拖拽任务看板
│   ├── chat/                      # 聊天模块（会话、气泡、输入框）
│   ├── notifications/             # 通知中心与状态存储
│   ├── dictionaries/              # 字典管理（类型 + 字典项 CRUD）
│   ├── export-center/             # 导出中心（任务列表、下载、重试）
│   ├── workspace-tabs/            # 工作区页签系统（注册表、LRU 淘汰、拖拽排序）
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

## UI 组件开发规范

### Card 组件设计规范

**padding 职责分配：**

- **`<Card>`** 负责 **外层统一 padding**（`p-6`），所有四边间距一律由 Card 自身控制
- **`<CardHeader>`**、**`<CardContent>`**、**`<CardFooter>`** 不再自带 `px-6`，不负责横向 padding
- 子元素间距由 Card 的 **`flex flex-col gap-6`** 控制，通过 `gap` 实现 header/content/footer 之间的间距

**设计原则：**

- 盒子级的外 padding 统一收敛到最外层 `<Card>`，避免 padding 在多层级组件间分散导致视觉不一致
- 子组件只负责自身内部布局（如 CardHeader 的 `@container` grid 布局），不介入 Card 级别的间距
- 特殊需求（如全宽表格需要 `px-0`）通过子组件自身的 className 覆盖处理

**正确用法：**

```tsx
// 标准卡片
<Card>
  <CardHeader>
    <CardTitle>标题</CardTitle>
    <CardDescription>描述文本</CardDescription>
  </CardHeader>
  <CardContent>
    {/* 内容 */}
  </CardContent>
</Card>

// 全宽内容（如 DataTable）
<Card>
  <CardHeader>
    <CardTitle>标题</CardTitle>
  </CardHeader>
  <Separator />
  <CardContent className='px-0'>
    <DataTable table={table} />
  </CardContent>
</Card>

// 统计卡片（只用 Header + Footer）
<Card className='@container/card'>
  <CardHeader>
    <CardDescription>总收入</CardDescription>
    <CardTitle>$1,250.00</CardTitle>
    <CardAction>
      <Badge>+12.5%</Badge>
    </CardAction>
  </CardHeader>
  <CardFooter className='flex-col items-start gap-1.5 text-sm'>
    <div className='font-medium'>本月持续增长</div>
    <div className='text-muted-foreground'>过去 6 个月访客趋势</div>
  </CardFooter>
</Card>
```

**反例（不应出现）：**

```tsx
// ❌ 不用 Card 包裹，直接渲染 Header/Content 为兄弟节点
<>
  <CardHeader className='px-4 py-4'>...</CardHeader>
  <CardContent className='px-4'>...</CardContent>
</>

// ❌ 手动 div 模拟 Card 样式
<div className='rounded-xl border bg-card'>
  <CardHeader>...</CardHeader>
  <CardContent>...</CardContent>
</div>

// ❌ 在 Header/Content 上写 px/py 覆盖 padding
<CardHeader className='px-4 py-4'>...</CardHeader>
<CardContent className='px-4 py-4'>...</CardContent>
```

### 图标使用规范

- 统一使用 `@/components/icons` 中的 `Icons` 对象引用图标
- 图标尺寸必须显式声明 `className='size-4'` 等尺寸类
- 禁止在组件内部直接 import 或使用其他图标库

### 布局容器规范

- 页面必须使用 `PageContainer` 作为最外层容器；通过 `WorkspacePageRoute` 接入的 dashboard 页面由路由层统一包装，页面主体组件不要重复包裹
- Dashboard 页面内嵌子区域尽量使用 `Card` 组件包裹，保持视觉一致性
- 表格页面使用 `DataTable` + `Card`，表头和内容由 Card 统一管理间距

### DataTable 开发规范

- 新增表格列优先使用 `createDataTableColumnDsl()`，统一声明字段类型、筛选类型、展示格式、复制值和列面板行为。
- DSL 查询优先通过 `useDslDataTable()` 构建；仅 `text`、`select`、`multiSelect`、`date`、`dateRange` 会自动序列化为后端 DSL 条件，不支持的筛选类型只作为前端 UI 状态。
- 表格状态统一由 `src/lib/data-table-state-persistence.ts` 管理，覆盖列宽、列顺序、排序和每页条数；不要再新增独立的 localStorage key。
- `src/components/ui/table/*` 的旧 flat 导入路径保留为兼容转发，新代码优先使用分层路径，例如 `core/`、`columns/`、`cells/`、`toolbar/`。

## 路由元数据规范

当前项目采用“**route 文件本地定义元数据，运行时统一派生导航与页面头部**”的模式。每个 dashboard 路由应通过 `defineRouteMeta()` 同时声明：

- 文档标题（浏览器标签页）
- 页面头部标题、描述、`infoContent`
- 侧边栏 / KBar 导航信息
- breadcrumb 标签

### 标准写法

```tsx
import { createFileRoute } from '@tanstack/react-router';
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import { defineRouteMeta } from '@/lib/router/app-route-meta';

const meta = defineRouteMeta({
  label: '字典管理',
  title: '系统管理：字典管理',
  nav: {
    visible: true,
    group: 'systemManagement',
    order: 10,
    menuKey: 'dict-management',
    icon: 'databaseCog',
    shortcut: ['d', 'm']
  },
  workspace: {
    refreshPolicy: 'query-invalidate'
  }
});

export const Route = createFileRoute('/dashboard/system-management/dictionaries')({
  ...meta,
  component: DictionariesPage
});

function DictionariesPage() {
  return <WorkspacePageRoute render={() => <DictionariesManagementPage />} />;
}
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
  顶部分组键，当前固定为 `overview | components | iam | systemManagement | account`。
- `order`
  当前分组内的排序权重，数值越小越靠前。
- `menuKey`
  可选菜单权限键。声明后侧边栏和 KBar 会使用 IAM 菜单树节点的 `menuKey/menuCode/code` 过滤该菜单；未声明 `menuKey` 的菜单默认显示。
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
- 声明 `nav.menuKey` 的节点会根据 IAM 菜单树过滤；无 `menuKey` 的框架、示例或公共页面不受权限过滤影响。

#### WorkspacePageRoute

- 标准 dashboard 内容页优先使用 `WorkspacePageRoute`，由它统一处理 workspace tabs 注册和 `PageContainer` 包装。
- 页面主体组件应只输出页面内容，不再自行包裹 `PageContainer`；若组件仍需要单独直接渲染，可以保留默认 Screen 包装并额外导出主体组件。
- 像聊天这类全屏自定义布局可以继续直接使用 `WorkspacePageBoundary`，并在 route 文件中说明原因。

### 约束

- dashboard 路由新增菜单页时，必须补 `nav.visible/group/order`。
- dashboard 业务页面默认接入 workspace tabs。除重定向页、纯容器页或明确说明的不托管页面外，不要显式设置 `workspace.tagEnabled: false`。
- 新增实际内容页时，应默认按 workspace 页面接入；若页面需要参与多页签管理，route 侧保持默认 `workspace` 配置，并使用 `WorkspacePageRoute` 托管页面主体。
- 只有明确不需要标签页承载时，才允许关闭 tab；关闭时必须在对应 route 文件旁用注释或实现结构说明原因，避免把业务页面误排除在页签体系外。
- 如果页面需要浏览器标题和页面头部标题不同，使用顶层 `title` 与 `page.title` 分离声明。
- 外部链接按钮不要使用 TanStack Router `Link`；应使用普通 `<a href>`。
- `defineRouteMeta()` 适用于“静态 route metadata + 默认 head”场景。若页面需要特殊 `head()` 逻辑，应在 route 文件中显式扩展，而不是反向修改消费端。

## 配置中心规范

### 架构

```
src/config/
├── index.ts           # barrel：统一导出所有配置
├── env.ts             # ★ 唯一读取 import.meta.env.VITE_* 的地方
├── data-table.ts      # 特性配置（表格操作符、虚拟滚动等）
└── workspace-tabs.ts  # 特性配置（页签保活上限、开关等）
```

### 核心原则

1. **`env.ts` 是环境变量的唯一入口** — 禁止其他文件直接读取 `import.meta.env.VITE_*`
2. **特性配置从 `env.ts` 取值** — 不自己绕开 env 层访问环境变量
3. **`index.ts` 为对外唯一导出** — 消费者统一 `import { ... } from '@/config'`
4. **每个环境变量必须在 `env.example.txt` 中有文档** — 含用途说明和默认值

### 与 vite.config.ts 的边界

`vite.config.ts` 和 `src/config/env.ts` 服务于不同层面，互不替代：

|          | `vite.config.ts`                      | `src/config/env.ts`                       |
| -------- | ------------------------------------- | ----------------------------------------- |
| 运行环境 | Node.js（构建时 / dev server）        | 浏览器（应用运行时）                      |
| 读取方式 | `loadEnv()` 读 `.env`                 | `import.meta.env.VITE_*`（Vite 静态替换） |
| 管辖变量 | `APP_GATEWAY`、`PROXY_URL`、`ANALYZE` | `VITE_ENABLE_WORKSPACE_TABS` 等           |
| 用途     | dev server 代理、构建工具开关         | 客户端特性开关                            |

`vite.config.ts` 是构建工具自身配置，不属于应用配置层，不纳入 `src/config/` 管辖。

### env.ts 写入规范

```ts
// src/config/env.ts
import { env } from '@/config';

// 新增环境变量开关只需在 env 对象加一行：
export const env = {
  // ... 已有变量 ...
  /** 是否启用 XXX 功能（默认关闭） */
  xxxEnabled: getEnvBool('VITE_ENABLE_XXX', false)
} as const;
```

辅助函数：

- `getEnvVar(name, defaultValue)` — 读取字符串型环境变量
- `getEnvBool(name, defaultValue)` — 读取布尔型环境变量（`'1'` / `'true'` 为 true）

### 特性配置规范

特性配置分为两类：

**A. 纯常量**（不依赖环境变量）— 直接定义即可：

```ts
// src/config/workspace-tabs.ts
export const MAX_KEEPALIVE_TABS = 15;
```

**B. 依赖开关的派生值** — 从 `env.ts` import：

```ts
// src/config/data-table.ts
import { env } from './env';

export function isDataTableVirtualizationEnabled(): boolean {
  if (!env.dataTableVirtualization) return false;
  return isBrowserSupportedForVirtualization(); // 额外的运行时检测
}
```

### 约束

- 新增 `VITE_*` 环境变量时，必须先在 `env.ts` 注册，再在 `env.example.txt` 补文档
- 特性 config 文件只 import `./env`（相对路径），不 import `@/config/env`（避免循环）
- 消费者统一 `import { env } from '@/config'`，禁止绕过 barrel 直接 import 特性 config 内部文件
- `env.ts` 内不做业务逻辑判断，只负责"读取 + 默认值"
- 编译时不可变：纯 SPA 下 `VITE_*` 在构建时静态替换，不可运行时修改
- `VITE_ENABLE_DATA_TABLE_VIRTUALIZATION` 是通用 DataTable 虚拟滚动开关；历史变量 `VITE_ENABLE_PRODUCT_TABLE_VIRTUALIZATION` 仅作为未设置新变量时的兼容 fallback。

### 请求与登录态

本地 IAM 运行链路由 `src/lib/api/iam/` 和共享 transport 维护：

- `src/lib/api/transport.ts`：统一创建请求实例、注入 `Authorization`、处理 401 刷新与登出跳转。
- `src/lib/api/iam/session.ts`：维护 access token、refresh token、改密后 token 更新和登出清理。
- `src/lib/api/iam/queries.ts`：维护 `iam/me` 查询、当前账号信息归一化和权限快照缓存。

OpenAPI client 当前仍保留在 `src/lib/api/clients/service/`，后续可在后端框架抽离完成后重新生成干净 client。

### 超级管理员约束

- 系统内置超级管理员角色编码固定为 `SUPER_ADMIN`，全系统有且只有一个内置超级管理员账号。
- `SUPER_ADMIN` 不得出现在新增员工、编辑员工或分配员工角色的可选角色中，也不得通过普通员工管理流程授予其他账号。
- 内置超级管理员禁止编辑基础资料、重新分配角色、切换状态或删除；仅允许本人按既有权限重置自己的密码。
- 前端限制只负责交互防护，后端必须继续校验上述唯一性和不可变约束，禁止把安全边界仅建立在 UI 隐藏上。

## 快速开始

> [!NOTE]
> 这个后台管理框架基于 **TanStack Router**、**React 19**、**Vite 8.1** 和 **Shadcn UI** 构建，采用纯 SPA 架构。可按以下步骤在本地运行：

克隆仓库：

```bash
git clone https://github.com/125002850/tanstack-start-admin.git
cd tanstack-start-admin
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
> 当前仓库统一使用 `pnpm`，锁文件以 `pnpm-lock.yaml` 为准，不再维护 `bun.lock`。Vite 8 要求 Node.js `^20.19.0 || >=22.12.0`。

> [!NOTE]
> 当前项目使用 TypeScript 7 执行 `pnpm typecheck`。由于 TypeScript 7.0 尚未提供程序化 Compiler API，依赖该 API 的代码生成和配置加载工具暂时通过官方 `@typescript/typescript6` 兼容包运行；`package.json` 中的 `@typescript/native` 提供 TypeScript 7 的 `tsc`，`typescript` 别名提供 TypeScript 6 API。待 TypeScript 7.1 及相关工具完成 API 迁移后再移除兼容包。

## 部署

本项目为纯 SPA 架构，构建产物为静态文件，可部署到任意静态文件服务器。

### 构建与启动

```bash
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
