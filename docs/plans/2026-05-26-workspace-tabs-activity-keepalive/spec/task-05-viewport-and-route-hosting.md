# Task 05: Viewport 与 Route Hosting

**Depends on:** `Task 03, Task 04`
**Blocks:** `Task 06, Task 07`
**Type:** `wiring`

## Goal

实现 workspace shell 的 descriptor registry、`WorkspaceViewport` 与 `WorkspaceRoutePage`，把 keep-alive 宿主从概念变成可复用的运行时边界。

## Files

- Create: `src/features/workspace-tabs/lib/workspace-registry.ts`
- Create: `src/features/workspace-tabs/components/workspace-slot-error-boundary.tsx`
- Create: `src/features/workspace-tabs/components/workspace-viewport.tsx`
- Create: `src/features/workspace-tabs/components/workspace-route-page.tsx`
- Create: `src/features/workspace-tabs/components/workspace-viewport.test.tsx`
- Create: `src/features/workspace-tabs/components/workspace-routing.integration.test.tsx`
- Modify: `src/features/workspace-tabs/types.ts`
- Modify: `src/features/workspace-tabs/utils/store.ts`
- Modify: `src/routes/dashboard.tsx`
- Reference: `src/lib/data-table-page-size.ts`
- Reference: `src/features/workspace-tabs/hooks/use-dashboard-route-tag-sync.ts`

## Invariants

- route 文件必须继续显式声明“当前 URL 对应哪个 screen”；不能退回 `return null` 的副作用路由。
- `WorkspaceViewport` 只渲染 `keepAlive !== false` 且已注册 descriptor 的 tabs。
- 非 keep-alive route 继续由 `<Outlet />` 渲染，不能被 viewport 劫持。
- 单个 keep-alive screen 崩溃不能带垮整个 viewport；slot 级错误必须被隔离。

## Constraints

- registry 只存 descriptor 和 serializable metadata；不把 React element 实例塞进 Zustand store。
- `WorkspaceRoutePage` 允许显式覆写 `instanceKey`，但默认按 route metadata 的 `instanceStrategy` 推导。
- `WorkspaceRoutePage` 只负责 descriptor 注册、route state 初始化与 inline fallback；tag 的 open/activate 必须继续由 `useDashboardRouteTagSync()` 负责，不能在两个入口重复写 store。
- 当前激活 route 的文档标题、Sidebar 高亮、Infobar 仍以 URL 为真相来源。
- `workspace-registry.ts` 必须导出 `reset()`，供测试 `afterEach` 清理模块级单例状态。
- slot 级 ErrorBoundary 的 fallback 必须退化为“停用该 tag 的 keep-alive host，并让当前 active route 走 `WorkspaceRoutePage` 的 inline fallback 渲染”，而不是仅显示空白报错块。

## Acceptance Criteria

- [ ] `bunx vitest run src/features/workspace-tabs/components/workspace-viewport.test.tsx` 通过
- [ ] `bunx vitest run src/features/workspace-tabs/components/workspace-routing.integration.test.tsx` 通过
- [ ] `bun run build` 通过
- [ ] `WorkspaceViewport` 在没有 descriptor 的情况下不渲染任何宿主 DOM
- [ ] Activity pre-check 明确验证 hidden/visible 切换下 DOM 保留和 Query 行为未出现立即性异常
- [ ] 单个 screen 抛错时，ErrorBoundary 只降级当前 tag，不影响其他 keep-alive slots

## Verification Strategy

`wiring` 任务使用集成测试 + 构建检查。核心风险是 viewport 是否只托管正确的 tags、hidden/visible 宿主是否与 URL 渲染路径分离，以及 `WorkspaceRoutePage` 与 `useDashboardRouteTagSync` 的协同时序。

## Manual Verification Exception

- `Waiver Reason:` Task 05 是双通道渲染（`Outlet + WorkspaceViewport`）首次联调点，单测无法完整覆盖真实浏览器下 keep-alive route 走 Viewport、非 keep-alive route 走 Outlet 时的切换残影与布局冲突。
- `Automated Smoke Check:` `bunx vitest run src/features/workspace-tabs/components/workspace-viewport.test.tsx src/features/workspace-tabs/components/workspace-routing.integration.test.tsx && bun run build`
- `Manual Verification Steps:` 启动 `bun run dev`，先使用 Execution Recipe 第 1 步里的临时 pre-check harness 验证 hidden/visible 切换后 DOM 内容仍保留；再访问 `/dashboard/overview`，确认它继续只走 Outlet 渲染，没有残影或重复内容。
- `Expected Results:` pre-check harness 在切 hidden 后再 visible 时 DOM 内容仍在；`/dashboard/overview` 只显示一份页面内容，且不会被 Viewport 接管。
- `Follow-up Automation:` `not needed`，核心宿主选择逻辑由 `workspace-viewport.test.tsx` 保护，剩余部分是浏览器级集成验证。

## Execution Recipe

1. **Pre-check：** 在正式接入 route hosting 前，先在临时分支或临时代码路径里做一个最小原型：对单个测试 screen 硬编码 `visible/hidden` 切换，确认 `<Activity>` 在当前栈下能保留 DOM，且 TanStack Query/Suspense 没有立即性异常；若这里失败，暂停本任务并回写 `runtime/state.md` 触发 replan。这个 harness 必须在任务结束前删除，或严格收敛到不可默认开启的 DEV-only 路径，不能遗留到正式运行链路。
2. 在 `workspace-registry.ts` 中实现 descriptor 注册与读取 API，保持模块级单例但不跨刷新持久化，并导出 `reset()`。
3. 实现 `workspace-slot-error-boundary.tsx`，让单个 slot 出错时：
   - 记录开发态错误
   - 停用当前 tag 的 keep-alive host
   - 对 active route 退化为 `WorkspaceRoutePage` 的 inline fallback 渲染路径
4. 实现 `WorkspaceViewport`：
   - 遍历 store 中的 tags
   - 只渲染有 descriptor 的 keep-alive tags
   - 当前 tag 用 `<Activity mode='visible'>`，其余用 `<Activity mode='hidden'>`
   - 每个 slot 外层包 `WorkspaceSlotErrorBoundary`
5. 实现 `WorkspaceRoutePage`：
   - 从 route params/search 构造初始 state
   - 等待 `useDataTablePageSize()` ready 后再落首次 state
   - 调用 registry 注册当前 route 的 descriptor
   - 保留 inline fallback 渲染能力，供 feature flag 关闭或 slot error 降级时使用
6. 修改 `src/routes/dashboard.tsx`，把 `WorkspaceViewport` 放在 `<Outlet />` 同级，并保证非 keep-alive route 不受影响。
7. 在 `workspace-viewport.test.tsx` 中覆盖：
   - 没有 descriptor 时不渲染
   - active tag 可见、inactive tag hidden
   - 非 keep-alive tag 不进入 viewport
   - `afterEach` 调用 `workspaceRegistry.reset()`
8. 新建 `workspace-routing.integration.test.tsx`，用 router + store + registry 最小集成覆盖：
   - URL 快速切换时 `useDashboardRouteTagSync` 与 `WorkspaceRoutePage` 不重复开 tag
   - 浏览器 back/forward 时 activeTag 与 descriptor 注册状态一致
9. 运行 `bunx vitest run src/features/workspace-tabs/components/workspace-viewport.test.tsx src/features/workspace-tabs/components/workspace-routing.integration.test.tsx`、`bun run build`，再执行手工集成验证。
10. 提交建议：`git commit -m "feat: add workspace viewport and route hosting"`

## Notes For Executor

- 这里先把宿主和 descriptor contract 搭起来，不要在本任务里提前塞入产品/用户具体实现。
- `WorkspaceRoutePage` 的 props 设计要让后续 feature route 只需传 `definition` 和 `screen` 即可，不再重复写 URL 解析样板。
