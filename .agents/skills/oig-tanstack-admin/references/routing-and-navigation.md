# 路由、导航与 Workspace 规范

## 路由元数据

项目采用“route 文件本地定义元数据，运行时统一派生导航、breadcrumb 和 workspace 行为”的模式。每个 dashboard 路由通过 `defineRouteMeta()` 声明：

- 浏览器文档标题
- 侧边栏与 KBar 导航信息
- breadcrumb 标签
- workspace tabs 行为

标准写法：

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
  workspace: {
    refreshPolicy: 'query-invalidate'
  }
});

export const Route = createFileRoute('/dashboard/users')({
  ...meta,
  component: UsersPage
});
```

## 字段职责

### 顶层字段

- `label`：路由的人类可读名称，用于导航、breadcrumb fallback 和 workspace tab 标题。
- `title`：浏览器文档标题。`defineRouteMeta()` 自动生成 `head()`；未提供时回退到 `label`。
- `breadcrumb.label`：面包屑文案。
- `breadcrumb.to`：可选的自定义 breadcrumb 链接目标。

### `nav`

- `visible`：是否进入主导航。
- `group`：顶部分组，当前为 `overview | components | systemManagement | followWorkbench | riskSummary | account`。
- `order`：分组内排序权重，数值越小越靠前。
- `icon`：`Icons` 对象中的图标键。
- `shortcut`：KBar 快捷键。
- `kind: 'container'`：声明容器菜单。
- `parentId`：声明子菜单所属父级路由。
- `linkable: false`：节点仅作为容器或展示项，不可跳转。

### `workspace`

- `tagEnabled`：是否进入 workspace tabs；默认 true。
- `keepAlive`：是否保持页面实例。
- `closable`：是否允许关闭 workspace tab；默认除 dashboard home 外为 true。
- `instanceStrategy`：当前支持 `global | by-params`。
- `refreshPolicy`：当前支持 `query-invalidate`。

## 运行时消费

导航派生规则：

- 侧边栏和 KBar 从 Router 的 `routesById` 与 `staticData.nav` 派生。
- 禁止重新维护中心化导航配置。
- 容器菜单通过 `nav.kind === 'container'` 和 `nav.parentId` 建树，禁止通过 URL 前缀隐式推断。
- `linkable: false` 不生成 KBar action，也不渲染为侧边栏跳转链接。

页面标题规则：

- `defineRouteMeta().title` 只负责浏览器文档标题。
- `PageContainer` 当前不会自动读取 route `staticData.page`。
- 需要页面内标题、描述或 Infobar 时，显式传入 `PageContainer` 的 `pageTitle`、`pageDescription`、`infoContent`。
- 禁止依赖未实现的 route metadata → PageContainer 自动回退行为。
- dashboard route 禁止新增 `page` metadata；workspace keep-alive 页面可能同时挂载多个页面实例，页面内标题必须由对应 Screen 显式传给 `PageContainer`。

## Dashboard 与 Workspace 约束

- dashboard 路由新增菜单页时，必须声明 `nav.visible`、`nav.group`、`nav.order`。
- dashboard 业务页面默认接入 workspace tabs。
- 除重定向页、纯容器页或明确说明的不托管页面外，不要设置 `workspace.tagEnabled: false`。
- 新增标准实际内容页默认使用 `WorkspacePageRoute` 托管页面实例；该组件在 workspace 启用时自动套 `PageContainer`，禁用时直接渲染页面主体。
- `WorkspacePageRoute.render` 必须传入不包含 `PageContainer` 的 Management/page body 组件；需要标题、描述、Infobar 或 header action 时，通过 `pageContainerProps` 传给内部 `PageContainer`。
- `WorkspacePageBoundary` 只用于非标准布局或底层 workspace 集成；其 `render` 表示 workspace 启用时注册给 `ActivityHost` 的页面树，`renderWhenDisabled` 表示 workspace 禁用时由 route 直接渲染的页面树。
- `keepAlive`、`closable` 的新页面控制权统一写在 route metadata 的 `workspace` 字段中；`WorkspacePageBoundary` 同名 props 仅作为历史兼容 fallback，禁止新增业务路由依赖这些 props。
- `Activity mode="hidden"` 会保留页面 state，但会清理子树 Effects；workspace 页面中的 Effects 必须能被反复 cleanup / mount，不得依赖“隐藏但 effect 持续运行”的假设。
- `MAX_KEEPALIVE_TABS` 是全局 LRU 上限；调高前必须用重表格/表单页面压测内存和切换耗时。重页面优先通过 `workspace.keepAlive: false` 控制，页面级权重策略需单独设计。
- 关闭 tab 时必须在 route 文件旁通过注释或实现结构说明原因。
- 浏览器标题与页面内标题不同时，分别使用顶层 `title` 和 `PageContainer.pageTitle`。
- 外部链接使用普通 `<a href>`，禁止使用 TanStack Router `Link`。
- 特殊 `head()` 逻辑应在 route 文件中显式扩展，禁止反向修改通用消费端。
