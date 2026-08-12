# Workspace 页面切换性能 Review

**Date:** 2026-08-12

**Branch:** `perf/workspace-cache-switch`

**Decision:** `APPROVE_WITH_FOLLOW_UPS`

## 1. 结论

本分支可以合并到 `main`。改动能够减少 workspace keep-alive 页面在可见性切换时的页面树重建，并修复普通 Tabs 因 `aria-controls` 被误判为浮层而触发最长 500ms 等待的问题。URL 查询参数变化时，缓存页面能够更新 route props，同时保留既有组件实例和局部状态。

本次 Review 未发现由该分支引入的阻塞性回归。后续优化重点不应继续堆叠 DOM selector，而应收敛 Activity 生命周期契约和 overlay 所有权。

## 2. 已确认的优化效果

### 2.1 页面内容复用

`WorkspaceViewport` 按 descriptor 的 `render` 引用缓存页面 ReactNode。仅切换 `activeId` 时，不再为全部已挂载 keep-alive 页面重复执行 `descriptor.render()`。

该优化对重表格、复杂表单和图表页面有实际价值：Activity 仍负责 visible/hidden 切换和 Effect 生命周期，未变化的页面内容不再无条件进入一次新的页面树构造过程。

### 2.2 Context 按变化频率拆分

`active` 与 `{ tabId, updateLifecycle }` 分为两个 Context。只需要 lifecycle channel 的消费者可以使用 `useWorkspacePageLifecycle()`，避免因 tab 显示/隐藏而重渲染。

当前生产代码还没有该 hook 的实际消费者，因此这部分主要是后续页面接入能力，不应计入当前业务页面的已量化收益。

### 2.3 缓存 descriptor 随 URL 更新

descriptor 增加 `renderKey`，使用 pathname 与 search string 标识当前页面快照。查询参数变化时更新 render callback，React 通过相同组件类型和 key 协调页面树，保留局部 state。

### 2.4 移除普通 Tabs 的固定等待

overlay 清理不再扫描页面内所有 `[aria-controls]`。普通 tabpanel 即使持续挂载，也不会仅因被 Tabs trigger 控制而进入 overlay settle 等待。

原实现会把持续存在的 tabpanel 加入 pending target，并在元素始终 connected 时等待 500ms timeout。本分支在该场景直接返回 settled，是本次唯一可直接确定上限的延迟优化。

## 3. 验证结果

- workspace 专项测试：6 个文件、123 条用例通过；
- 全量单元测试：103 个文件、916 条用例通过；
- 架构契约：17 条用例通过；
- OxLint、TypeScript typecheck、生产构建、bundle budget、commitlint 通过；
- Playwright smoke：39 通过、1 跳过、1 失败；失败的 DataTable ready-trigger 断言在 `main` 上以相同方式稳定失败，属于主线既有测试与实现漂移，不是本分支回归；
- workspace tabs、staff keep-alive 和 overlay portal 相关真实浏览器用例均通过。

当前没有 React Profiler 或生产浏览器耗时基线。除普通 Tabs 的 500ms timeout 外，不应对整体切换耗时声明未经测量的百分比提升。

## 4. 风险与后续行动

### 4.1 P1：建立 Activity 生命周期契约

React Activity 在 hidden 状态下会保留 DOM 和组件 state、清理子树 Effects；hidden 子树收到新 props 时仍可能以较低优先级重渲染，恢复时会重新挂载 Effects。

风险包括：

- 事件监听、轮询、WebSocket、ResizeObserver 等缺少 cleanup；
- Effect cleanup 或 mount 不是幂等操作；
- `<video>`、`<audio>`、`<iframe>` 等 DOM 自身副作用在隐藏后仍持续；
- 页面依赖“隐藏时 Effect 继续运行”的错误假设。

**TODO P1**：为 workspace 页面增加 Activity visible → hidden → visible 契约测试，至少覆盖全局监听、定时任务、查询订阅、焦点和 portal cleanup。

**TODO P1**：在 workspace 专项测试中增加 `React.StrictMode` 覆盖，用重复 mount/cleanup 提前暴露不安全 Effect；是否全局启用 StrictMode 另行评估，不在本次性能提交中扩大范围。

参考：[React Activity](https://react.dev/reference/react/Activity)。

### 4.2 P1：用显式 overlay 所有权替代 DOM fallback

当前 `page-overlays.ts` 通过 `data-slot`、`data-state`、ARIA selector 和模拟 click/Escape/pointerleave 关闭浮层。它适合作为兼容 fallback，但不适合作为长期唯一机制。

主要隐患：

- Radix、Base UI 或 Shadcn 升级后 DOM contract 变化；
- `[aria-expanded='true']` 和 `[data-slot$='-trigger'][data-state='open']` 仍可能误判 Accordion、Collapsible 或行展开控件；
- document 级扫描可能关闭不属于当前 workspace 页面的全局浮层；
- 新增自定义 overlay 时容易漏补 selector；
- 退出动画只能依赖 DOM 轮询和 timeout，无法表达真实完成时机。

**TODO P1**：设计 `WorkspaceOverlayProvider` 或 page-scoped overlay registry。通用 overlay wrapper 注册受控 `close()`，页面失活时由 workspace 边界统一 `closeAll()`。

**TODO P1**：优先使用 Radix/Base UI 的 `open`、`onOpenChange` 与自定义 Portal `container`，让 portal 归属当前页面；Base UI 场景可使用 `onOpenChangeComplete` 等显式完成信号等待退出动画。

**TODO P2**：显式 overlay 迁移完成前保留 DOM fallback，并增加 Accordion、DataTable expand、全局 header overlay 与退出动画中的回归测试。

参考：[Radix Popover](https://www.radix-ui.com/primitives/docs/components/popover)、[Base UI Popover](https://base-ui.com/react/components/popover)。

### 4.3 P2：收紧 Router 订阅

`WorkspacePageBoundary` 当前通过 `select: (state) => state.location` 订阅完整 location。hash、history state 等无关字段变化也可能触发 Boundary 重渲染和 descriptor 计算。

**TODO P2**：改为分别订阅 `location.pathname` 和 `location.searchStr` 等 primitive，或使用启用 structural sharing 的细粒度 selector；变更前补充 render-count 回归测试。

参考：[TanStack Router Render Optimizations](https://tanstack.com/router/v1/docs/guide/render-optimizations)。

### 4.4 P2：让 descriptor 更新条件显式化

`hasCommittedRef.current` 会使 Boundary 首次提交后的 descriptor 变化都写入 registry。当前 route 层重渲染频率较低，但父层若未来频繁更新，内联 `render` 引用变化可能导致 registry 和 viewport 无意义更新。

**TODO P2**：评估显式 `renderRevision`/page revision contract，使 URL、route props 或页面配置发生语义变化时才刷新 descriptor；不得以冻结 render ref 的方式重新引入 search props 过期问题。

### 4.5 P2：把 `useMemo` 严格限制为性能优化

`useMemo(() => render(), [render])` 当前只影响是否跳过额外工作，缓存失效不会改变页面正确性。这个边界必须保持。

约束：

- `render()` 必须保持纯函数，只构造 ReactNode；
- 禁止在 render callback 内直接调用 Hooks 或执行副作用；
- 页面正确性、请求去重和生命周期不得依赖 `useMemo` 永不失效；
- 若该边界后续复杂化，优先评估抽取 `React.memo` 页面内容组件，而不是继续增加手工缓存状态。

参考：[React useMemo](https://react.dev/reference/react/useMemo)。

### 4.6 P2：建立 keep-alive 内存与切换基线

Activity 会保留 DOM、React state、表格草稿及页面内缓存。Effect 被清理不代表内存被释放，`MAX_KEEPALIVE_TABS` 不能只按普通页面数量评估。

**TODO P2**：在生产构建下记录重表格、复杂表单和图表组合的 tab 切换 p50/p95、React commit 时间、JS heap 和 DOM node 数量。

**TODO P2**：继续对重页面使用 route metadata `workspace.keepAlive: false`；调高全局 LRU 上限前必须先完成内存压测。

## 5. 推荐实施顺序

1. 先补 Activity + StrictMode 生命周期契约测试；
2. 设计 page-scoped overlay registry 和 Portal container，保留 DOM fallback 渐进迁移；
3. 收紧 Router selector，并以 render-count 测试保护 descriptor 更新；
4. 建立生产构建性能与内存基线，再决定是否需要进一步缓存或调整 LRU；
5. 单独修复主线 DataTable E2E ready-trigger 过期断言，不与 workspace 性能代码混入同一提交。

以上行动均属于独立后续任务，不阻塞 `perf/workspace-cache-switch` 合并。
