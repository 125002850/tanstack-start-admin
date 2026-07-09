# UI 组件开发规范

## Card 组件

### Padding 职责

- `<Card>` 负责外层统一 padding（`p-6`），所有四边间距由 Card 自身控制。
- `<CardHeader>`、`<CardContent>`、`<CardFooter>` 不自带 `px-6`，不负责横向 padding。
- 子元素间距由 Card 当前的 `flex flex-col gap-4` 控制。

外层 Card 统一管理盒子级 padding；子组件只负责自身内部布局。全宽表格等特殊需求由子组件通过 `className` 覆盖。

### 正确用法

```tsx
// 标准卡片
<Card>
  <CardHeader>
    <CardTitle>标题</CardTitle>
    <CardDescription>描述文本</CardDescription>
  </CardHeader>
  <CardContent>{/* 内容 */}</CardContent>
</Card>

// 全宽内容
<Card>
  <CardHeader>
    <CardTitle>标题</CardTitle>
  </CardHeader>
  <Separator />
  <CardContent className='px-0'>
    <DataTable table={table} />
  </CardContent>
</Card>

// 统计卡片
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

### 禁止用法

```tsx
// 禁止脱离 Card 直接组合 Header/Content
<>
  <CardHeader className='px-4 py-4'>...</CardHeader>
  <CardContent className='px-4'>...</CardContent>
</>

// 禁止用 div 模拟 Card
<div className='rounded-xl border bg-card'>
  <CardHeader>...</CardHeader>
  <CardContent>...</CardContent>
</div>

// 禁止在 Header/Content 上覆盖 Card 级 padding
<CardHeader className='px-4 py-4'>...</CardHeader>
<CardContent className='px-4 py-4'>...</CardContent>
```

## 图标

- 统一使用 `@/components/icons` 中的 `Icons` 对象。
- 必须通过 `className='size-4'` 等类显式声明尺寸。
- 禁止在组件内部直接导入或使用其他图标库。
- `components.json.iconLibrary` 必须与 `Icons` 的底层图标库保持一致；当前统一为 `tabler`。
- 从 shadcn registry 新增或更新组件后，必须把 registry 生成的图标 import 收敛到 `@/components/icons`。

## 本仓库对 shadcn upstream 的覆盖规则

本仓库组件已经针对后台系统做过本地化，以下规则优先于 vendored shadcn upstream 规则：

- Button 允许使用本仓库扩展的 `isLoading` 属性，保持提交中按钮零布局位移；新组件也可以复用该能力。
- 图标统一通过 `Icons` lookup 使用，而不是在业务组件内直接从图标库导入。
- 图标尺寸由调用点显式声明，例如 `className='size-4'`；Button 等基础组件仍可通过自身 CSS 给未声明尺寸的 svg 提供默认尺寸。
- Card padding 由 `<Card>` 统一管理，禁止恢复 upstream 默认的 Header/Content 横向 padding。

## 页面布局

- 页面必须使用 `PageContainer` 作为最外层容器。
- Dashboard 页面内嵌子区域优先使用 `Card`。
- 表格页面使用 `DataTable` + `Card`，表头和内容由 Card 统一管理间距。

## PageContainer 页面范式

新增标准业务页面遵循两层 route 结构：**WorkspacePageRoute → PageContainer → Management**。

```text
route.tsx
  └─ <WorkspacePageRoute render={() => <XXXManagementPage />} />
       └─ workspace on: <PageContainer>
            └─ <XXXManagementPage />
       └─ workspace off: <XXXManagementPage />
```

标准页面不再单独创建只承载 `PageContainer` 的 Screen 组件：

```tsx
import { WorkspacePageRoute } from '@/features/workspace-tabs/components/workspace-page-route';
import XxxManagementPage from './xxx-management-page';

export default function XxxRoutePage() {
  return <WorkspacePageRoute render={() => <XxxManagementPage />} />;
}
```

需要页面标题、描述、Infobar 或 header action 时，通过 `pageContainerProps` 传入：

```tsx
<WorkspacePageRoute
  render={() => <XxxManagementPage />}
  pageContainerProps={{ pageTitle: '页面标题' }}
/>
```

约束：

- `PageContainer` 提供 `flex flex-1`，负责 workspace viewport 内的拉伸和统一 padding。
- tabs 禁用时，页面通过 `<Outlet />` 渲染在 `SidebarInset` flex 列中，不额外套 `PageContainer`。
- 非标准布局页面（例如不应套 `PageContainer` 的全屏工具页）可以直接使用 `WorkspacePageBoundary`，但必须显式说明原因。
- Management 层禁止通过 `flex-1 w-full` 等样式补救外层布局。
- Management 层禁止导入或渲染 `PageContainer`；需要标题、描述、Infobar 时，在 `WorkspacePageRoute.pageContainerProps` 上显式传入 props。
