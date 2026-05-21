# 通用页面缓存提供者实施计划

> **给 Claude 的提示：** 使用 `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` 按任务逐一实施本计划。

**目标：** 构建一个通用的页面缓存能力，页面路由通过 `PageCacheProvider` 选择加入，并为搜索状态、滚动状态以及未来的表单草稿状态提供可复用的恢复/持久化支持。v1 阶段专注于搜索和滚动，同时为未来表单草稿保留清晰的扩展缝。

**架构：** 在 `src/lib/page-cache/` 下引入一个通用 page-cache 运行时，围绕带作用域的 React Provider、基于存储的快照仓库以及针对具体缓存域的可选 hook 构建。产品列表作为首个接入方，但该能力本身保持页面无关性：它仅缓存页面本地 UI 状态，而服务端返回数据继续由 TanStack Query 负责管理。搜索恢复必须在数据获取子树挂载之前完成，以便在应用缓存搜索参数之前不会触发浪费的首次请求。迁移完成后，`router.tsx` 回退到 TanStack Router 的通用滚动行为，而页面本地滚动恢复由 page-cache 运行时负责。

**技术栈：** React 19、TypeScript、TanStack Router、TanStack Query、Radix Scroll Area、`sessionStorage`

---

## 项目现状

- `src/lib/scroll-restoration.ts` 目前混杂了产品路由常量、路由搜索恢复决策、`sessionStorage` 持久化逻辑以及路由滚动 key 逻辑。
- `src/router.tsx` 在 `getScrollRestorationKey` 和 `scrollToTopSelectors` 中携带了针对产品的恢复分支。
- `src/routes/dashboard/product/index.tsx` 通过路由级别的 `useEffect` 持久化产品列表状态，并通过 `beforeLoad` 进行恢复。
- `src/features/products/components/product-tables/index.tsx` 和 `src/components/ui/table/data-table.tsx` 已通过 `data-scroll-restoration-id` 暴露了稳定的内部滚动目标。
- TanStack Query 已缓存获取到的列表数据。缺失的通用能力是页面本地 UI 状态的缓存与恢复，而非重复的服务端数据缓存。

## CTO 决策

上一版方向不对，原因是它只是在拆 `product` 特化代码的边界，而不是建设"通用 page cache 能力"。

本次改为下面这个方向：

- `PageCacheProvider` 是页面级作用域边界
- search / pagination / filters / sort / scroll / 未来 form draft 都通过通用运行时注册
- Product list 只是第一个 consumer，不再是架构中心
- router 全局层移除产品特化恢复分支
- page cache 只缓存"页面本地 UI 状态"，不缓存 React Query 服务端数据

## 公开 API 目标

首个接入页面的目标使用方式如下：

```tsx
function ProductPage() {
  return (
    <PageCacheProvider scope='dashboard.product.list'>
      <ProductPageCacheGate />
    </PageCacheProvider>
  )
}

function ProductPageCacheGate() {
  const { isReady } = useProductPageCacheBindings()

  if (!isReady) {
    return <PageCacheRestoringFallback />
  }

  return <ProductPageContent />
}
```

其中页面内通过 hook 注册具体缓存能力：

```tsx
function useProductPageCacheBindings() {
  const location = useLocation()
  const router = useRouter()
  const searchRestore = usePageCacheSearch({
    slot: 'search',
    location,
    shouldRestore: (current) => isDefaultProductListSearch(current.search),
    restore: (href) => router.navigate({ href, replace: true }),
  })

  usePageCacheScroll({
    slot: 'table-scroll',
    selector: PRODUCT_LIST_SCROLL_RESTORATION_SELECTOR,
    ready: searchRestore.isReady,
  })

  return {
    isReady: searchRestore.isReady,
  }
}
```

未来表单草稿能力的目标使用方式：

```tsx
usePageCacheFormDraft({
  slot: 'draft',
  values,
  restore: (draft) => form.setFieldValues(draft),
})
```

## 核心设计

### 作用域模型（Scope Model）

- `PageCacheProvider` 必须接收显式的 `scope`
- `scope` 由页面自己定义，例如 `dashboard.product.list`
- 如果未来同一路由下存在多实例页面缓存，由页面自己拼接路由参数，例如 `dashboard.product.edit:42`

### 快照模型（Snapshot Model）

建议快照结构：

```ts
type PageCacheSnapshot = {
  version: 1
  updatedAt: number
  slots: Record<string, unknown>
}
```

说明：

- `updatedAt` 在通用 page cache 里是有效的字段，因为它用于 TTL / 过期判断
- 这与当前 `scroll-restoration.ts` 中那个"只写不读"的死字段不同

### 存储模型（Storage Model）

- 默认使用 `sessionStorage`
- v1 统一使用单一 storage key，例如 `app-page-cache-v1`
- 该 key 下维护 `scope -> snapshot` 的映射
- v1 接受"单 key + scope map"的实现取舍，但存储适配器必须作为唯一的序列化边界，未来如需按 `scope` 分片为 `app-page-cache-v1:<scope>` 等 key，不得要求页面 hook API 做任何变更
- 过期清理不是可选项；v1 必须实现上限控制，例如"仅保留最近 20 个 scope，按 `updatedAt` 淘汰最旧项"
- Provider 未来可扩展 `storage='memory' | 'session'`，但首版只需实现 `session`
- 存储层必须定义容错规范：JSON 解析失败、配额超限、隐私模式下不可写时全部降级为 no-op，不得抛出致命错误

### 插槽模型（Slot Model）

- 每种缓存能力都注册到一个 `slot`
- `slot` 是页面作用域内的局部名字，例如 `search`、`table-scroll`、`draft`
- search / scroll / form-draft 都只是不同 slot 的读写策略

### 非目标（Non-Goal）

page cache 不负责：

- 缓存 React Query 返回的数据 payload
- 替代 TanStack Query
- 全局拦截所有页面行为
- 提供注册式插件系统

## 文件布局提案

### 新建

- `src/lib/page-cache/types.ts`
- `src/lib/page-cache/storage.ts`
- `src/lib/page-cache/provider.tsx`
- `src/lib/page-cache/use-page-cache.ts`
- `src/lib/page-cache/use-page-cache-slot.ts`
- `src/lib/page-cache/use-page-cache-search.ts`
- `src/lib/page-cache/use-page-cache-scroll.ts`
- `src/lib/page-cache/index.ts`

### 修改

- `src/router.tsx`
- `src/routes/dashboard/product/index.tsx`
- `src/features/products/components/product-tables/index.tsx`
- `src/components/ui/table/data-table.tsx`
- `src/lib/scroll-restoration.ts`，若无剩余通用消费者则删除整个文件

### 可选新建

- `src/features/products/components/product-page-cache-bindings.tsx`

## 任务 1：创建通用 Page Cache 运行时

**涉及文件：**
- 新建：`src/lib/page-cache/types.ts`
- 新建：`src/lib/page-cache/storage.ts`
- 新建：`src/lib/page-cache/provider.tsx`
- 新建：`src/lib/page-cache/use-page-cache.ts`
- 新建：`src/lib/page-cache/index.ts`

**步骤 1：定义核心类型**

为以下内容添加精确的类型定义：

- `PageCacheSnapshot`
- `PageCacheScope`
- `PageCacheStorageAdapter`
- `PageCacheProviderProps`

Provider 的 props 至少应包含：

```ts
type PageCacheProviderProps = {
  scope: string
  children: React.ReactNode
  storage?: 'session'
  maxAgeMs?: number
}
```

**步骤 2：实现存储适配器**

在 `src/lib/page-cache/storage.ts` 中实现：

- 对 `sessionStorage` 的安全访问
- `loadPageCacheScopes()`
- `savePageCacheScopes()`
- `loadPageCacheSnapshot(scope)`
- `savePageCacheSnapshot(scope, snapshot)`
- 基于 `updatedAt` 的强制过期快照清理
- 上限淘汰机制，例如"保留最近 20 个 scope"
- JSON 解析失败、写入失败、配额超限、`sessionStorage` 不可用时的容错降级规则

不得在此层放置任何产品特定逻辑。

v1 明确存储策略：

- 目前维持单 key 存储
- 通过强制淘汰机制控制增长上限
- 将序列化格式隔离在适配器内部，使未来的 scope 分片不需要修改公共 hook

**步骤 3：实现 Provider**

在 `provider.tsx` 中：

- 创建带当前 `scope` 的 React context
- 暴露稳定的 slot 读/写/删除 API
- 写入时更新 `updatedAt`
- 保持 API 页面无关性

**步骤 4：实现基础 hook**

在 `use-page-cache.ts` 中暴露 provider context，若在 `PageCacheProvider` 之外使用则给出明确的报错提示。

**步骤 5：从 page-cache 索引入口导出**

在 `src/lib/page-cache/index.ts` 中创建统一的 import 入口。

**步骤 6：验证静态完整性**

运行：`npm run build`

预期结果：

- TypeScript 编译通过
- 无 provider/context 导入错误

## 任务 2：实现通用插槽原语

**涉及文件：**
- 新建：`src/lib/page-cache/use-page-cache-slot.ts`

**步骤 1：创建插槽契约**

插槽 hook 应允许功能 hook 进行以下操作：

- 读取已有插槽快照
- 写入新插槽快照
- 删除插槽快照
- 决定何时应执行恢复

目标接口：

```ts
type UsePageCacheSlotOptions<T> = {
  slot: string
  readCurrent: () => T
  restore: (snapshot: T) => void
  enabled?: boolean
  debounceMs?: number
}
```

**步骤 2：保持通用性**

不要在此 hook 中编码搜索、滚动或表单相关的假设。它仅是一个可复用的插槽读写原语。

**步骤 3：确保面向未来**

该 hook 应支持任意 JSON 可序列化的 payload，以便后续表单草稿状态能够复用。

**步骤 4：验证**

运行：`npm run build`

预期结果：

- 通用 hook 类型编译通过

## 任务 3：实现搜索状态缓存与恢复

**涉及文件：**
- 新建：`src/lib/page-cache/use-page-cache-search.ts`
- 修改：`src/routes/dashboard/product/index.tsx`
- 可选新建：`src/features/products/components/product-page-cache-bindings.tsx`

**步骤 1：定义搜索快照结构**

搜索缓存应持久化以下内容：

- `href`
- `pathname`
- `search`
- `searchStr`

这些是页面本地路由状态，而非服务端数据。

**步骤 2：定义通用 hook 契约**

该 hook 应接受：

```ts
type UsePageCacheSearchOptions = {
  slot?: string
  location: Pick<ParsedLocation, 'href' | 'pathname' | 'search' | 'searchStr'>
  shouldRestore: (
    current: Pick<ParsedLocation, 'href' | 'pathname' | 'search' | 'searchStr'>
  ) => boolean
  restore: (href: string) => void
}
```

`shouldRestore` 必须由页面提供，因为只有页面自身才知道当前搜索状态是否为"默认值且可安全覆盖"。

**步骤 3：实现"数据获取前恢复"行为**

该 hook 应：

- 在数据获取子树挂载之前读取缓存的 `search` 插槽
- 将其与当前 location 进行比对
- 若 `shouldRestore(current)` 为 `true` 且缓存的 href 与当前不同，则执行 `restore(cached.href)`
- 在恢复决策完成前，将消费页面保持在临时的"未就绪"状态

此恢复仍在客户端完成，因为需求是"页面级 provider 选择加入"，而非路由级 `beforeLoad`，但页面在决策完成前不得挂载其 `useSuspenseQuery` / 数据获取子树。这是 v1 避免重复请求的方式。

**步骤 4：暴露就绪状态契约**

返回如下轻量状态：

```ts
{ isReady: boolean; isRestoring: boolean }
```

这使得页面可以在搜索恢复完成前临时抑制其数据获取内容的渲染，同时避免可见的"先渲染再跳转"以及浪费的首次查询。

**步骤 5：在 location 变更时持久化**

恢复完成后，每当 location 发生变更时持久化最新的路由搜索快照。

**步骤 6：将产品列表接入为首个消费者**

将 `src/routes/dashboard/product/index.tsx` 中当前针对产品的 `beforeLoad + rememberPageState` 流程替换为：

- `PageCacheProvider`
- `usePageCacheSearch`
- 基于当前产品默认搜索语义的页面本地 `shouldRestore` 逻辑
- 一个就绪状态门控，使得 `ProductListingPage` 在 `usePageCacheSearch` 返回 `isReady === true` 之前不会被挂载

移除依赖 `src/lib/scroll-restoration.ts` 的现有 `beforeLoad` 重定向。

**步骤 7：验证**

运行：`npm run build`

预期结果：

- 产品路由编译通过
- 不再存在对产品搜索恢复的 `beforeLoad` 引用

## 任务 4：实现滚动缓存与恢复

**涉及文件：**
- 新建：`src/lib/page-cache/use-page-cache-scroll.ts`
- 修改：`src/components/ui/table/data-table.tsx`
- 修改：`src/features/products/components/product-tables/index.tsx`

**步骤 1：定义通用滚动 hook 契约**

通过插槽和目标定位器支持注册滚动目标：

```ts
type UsePageCacheScrollOptions = {
  slot: string
  selector?: string
  getTarget?: () => HTMLElement | null
  axis?: 'x' | 'y' | 'both'
  ready?: boolean
}
```

首个接入方可使用 `selector`；后续页面可使用 `getTarget`。

**步骤 2：持久化滚动位置**

至少存储：

- `scrollTop`
- `scrollLeft`

该 hook 应对写入操作做节流处理，避免在每次原始滚动事件时都写入 `sessionStorage`。

**步骤 3：在目标就绪时恢复，而非仅目标存在**

当目标元素变为可用且 `ready === true` 时，恢复其缓存的滚动位置。

该 hook 不得将"DOM 节点存在"等同于"内容已就绪"。

对于产品列表，最简单有效的策略是：

- 在 `ProductListingPage` 之前挂载搜索恢复绑定
- 在数据已加载的 table 子树内部挂载 `usePageCacheScroll`，或仅在 table 内容已携带解析后的查询数据完成渲染后才传入 `ready`

**步骤 4：保持共享 table 组件的通用性**

`DataTable` 可以继续暴露可选的 DOM 标记 prop，但不得直接导入 page-cache 逻辑。

其角色仅限于为消费页面提供稳定的滚动目标标识符。

**步骤 5：将产品 table 接入为首个采纳方**

保留产品 table 的稳定目标 id，但将恢复逻辑的所有权从 router 配置移至 `usePageCacheScroll`。

**步骤 6：验证**

运行：`npm run build`

预期结果：

- 无 DOM 类型问题
- 共享通用 table 渲染内部无产品特定逻辑

## 任务 5：将表单草稿 Hook 推迟到未来阶段

**涉及文件：**
- 预计无代码变更

**步骤 1：显式保留扩展缝，但不在 v1 中实现 hook**

插槽原语即为扩展缝。不要在没有真实消费者的情况下在 v1 中添加 `usePageCacheFormDraft`。

**步骤 2：仅在文档中记录未来契约**

将未来目标 API 保留在计划叙述中，但将实际实现移至 Future Phase，或到后续有真实消费者（如产品创建/编辑表单草稿恢复）时再实施。

## 任务 6：从全局 Router 中移除产品特定的恢复逻辑

**涉及文件：**
- 修改：`src/router.tsx`
- 修改或删除：`src/lib/scroll-restoration.ts`

**步骤 1：以明确的通用行为替换产品特定的 Router 行为**

`src/router.tsx` 应停止导入：

- 产品特定的滚动恢复选择器
- 产品特定的滚动 key 逻辑

替换行为必须在计划中明确写出，而非描述为"回退到通用行为"。

v1 目标：

- 保留 `scrollRestoration: true`
- 移除自定义 `getScrollRestorationKey`
- 移除自定义 `scrollToTopSelectors`
- 让 TanStack Router 以其默认行为处理路由进入时的滚动
- 让 page-cache 运行时负责页面本地搜索和内部滚动恢复

**步骤 2：确定 `src/lib/scroll-restoration.ts` 的去留**

若迁移后无剩余通用消费者：

- 删除该文件

若某些通用回退辅助函数仍有有效消费者：

- 将其缩减为仅包含真正通用的代码

在任何情况下都不得保留产品页面状态逻辑。

**步骤 3：验证**

运行：`npm run build`

预期结果：

- router 不再了解产品 page cache 的内部细节

## 任务 7：验证产品列表作为首个接入方

**涉及文件：**
- 预计无新代码

**步骤 1：运行静态验证**

运行：`npm run format:check`

预期结果：

- 通过，或仅报告与本次改动无关的已有问题

运行：`npm run build`

预期结果：

- 通过

**步骤 2：手动验证清单**

1. 打开 `/dashboard/product`
2. 切换页码、每页条数、搜索关键词、分类和排序
3. 滚动 table 视口
4. 打开一个产品详情页
5. 返回
6. 确认：
   - 相同的查询参数被恢复
   - table 视口滚动位置被恢复
   - TanStack Query 复用了缓存的列表数据
   - 在缓存的搜索恢复完成之前没有触发浪费的首次请求

**步骤 3：刷新路径验证**

1. 打开 `/dashboard/product`
2. 让 provider 恢复缓存的默认搜索状态
3. 刷新页面
4. 确认恢复行为仍然遵循页面的 `shouldRestore` 规则，不会覆盖显式的深层链接搜索状态

**步骤 4：回归验证**

确认：

- 未包裹 `PageCacheProvider` 的页面行为正常
- 产品页面不再依赖 `beforeLoad` 重定向进行缓存恢复
- `router.tsx` 中不再存在产品特定逻辑

## 未来阶段

若此通用运行在产品列表上运行良好，下一个接入候选包括：

- 产品创建/编辑表单草稿恢复
- 用户表格搜索和滚动恢复
- 任何具有多个滚动插槽的多标签页或多面板页面
- 若单 key map 在实践中过大，进行存储分片

本阶段不实现以上内容。

---

计划已完成并保存至 `docs/plans/2026-05-21-generic-page-cache-provider.md`。两种执行方式可选：

1. **子代理驱动（本会话）** — 每个任务分派一个全新子代理，任务间进行评审，快速迭代

2. **并行会话（独立会话）** — 开启新会话并加载 executing-plans，按检查点批量执行

选择哪种方式？