# Task 06: 产品列表 Workspace 迁移

**Depends on:** `Task 04, Task 05`
**Blocks:** `Task 08`
**Type:** `behavior`

## Goal

把产品列表页的主链路从 `page-cache + route hooks` 迁移为 `WorkspaceRoutePage + ProductWorkspaceScreen`，并把刷新语义改为精确的 `query-invalidate`，同时保留旧链路所需组件以供 Task 08 挂 feature flag。

## Files

- Create: `src/features/products/components/product-workspace-screen.tsx`
- Create: `src/features/products/workspace/product-workspace-definition.ts`
- Create: `src/features/products/workspace/product-workspace-definition.test.ts`
- Modify: `src/routes/dashboard/product/index.tsx`
- Modify: `src/features/products/components/product-listing.tsx`
- Modify: `src/features/products/components/product-tables/index.tsx`
- Reference: `src/features/products/api/queries.ts`
- Reference: `src/components/layout/page-container.tsx`
- Reference: `src/lib/data-table-page-size.ts`

## Invariants

- 产品路由现有 `validateSearch` 与 `beforeLoad` 归一化逻辑必须保留。
- `perPage` 优先级仍然是 `URL 显式值 -> localStorage 偏好 -> DEFAULT_DATA_TABLE_PAGE_SIZE`。
- “新增产品”按钮位置和行为保持不变。

## Constraints

- 本任务完成后，产品列表的新 workspace 主链路中不得再依赖 `PageCacheProvider`、`usePageCacheSearch`、`usePageCacheScroll`；旧链路组件可暂时保留，供 Task 08 feature flag 回退使用。
- 产品 route metadata 必须显式 `workspace: { refreshPolicy: 'query-invalidate' }`。
- `product-workspace-definition.ts` 要用 `productKeys.list(currentFilters)` 实现刷新失效，不得使用粗暴的 `queryClient.invalidateQueries({ queryKey: ['products'] })`。

## Acceptance Criteria

- [ ] `bunx vitest run src/features/products/workspace/product-workspace-definition.test.ts` 通过
- [ ] `bun run build` 通过
- [ ] `rg -n "usePageCacheSearch|usePageCacheScroll|PageCacheProvider" src/features/products/components/product-listing.tsx src/features/products/components/product-tables/index.tsx` 无输出

## Verification Strategy

`behavior` 任务使用 definition 单测 + 受限手工浏览器回归。URL/state 互转与 query key 精度可自动化，表格滚动保留和 Activity 隐藏恢复需要真实 DOM 场景。

## Manual Verification Exception

- `Waiver Reason:` 产品表格滚动位置和 Suspense 恢复依赖 React 19 `<Activity>` 与真实浏览器 DOM，单测无法稳定验证。
- `Automated Smoke Check:` `bunx vitest run src/features/products/workspace/product-workspace-definition.test.ts && bun run build`
- `Manual Verification Steps:` 启动 `bun run dev`，访问 `/dashboard/product`；输入搜索词 `身体乳`，把 `perPage` 改为 `50`，将表格滚动到中间位置；左键切到 `/dashboard/overview`，再通过 tags 切回产品页。
- `Expected Results:` 搜索词、每页条数、当前页码和表格滚动位置全部保留；workspace 主链路不再依赖 `page-cache` 恢复逻辑。
- `Follow-up Automation:` `not needed`，核心状态与 query 逻辑已被单测覆盖，滚动保留会在 Task 08 的整体验收再次复核。

## Execution Recipe

1. 在 `product-workspace-definition.ts` 中实现产品列表的 `parse/search/stringify/buildHref/refresh/getPageChrome`。
2. 在 `product-workspace-definition.test.ts` 中覆盖：
   - URL -> state
   - state -> href
   - `perPage` 默认值回退
   - `refresh()` 精确失效 `productKeys.list(filters)`
3. 创建 `ProductWorkspaceScreen`，把 `PageContainer` 与 “新增产品”按钮移动到 screen 内。
4. 改写 `src/routes/dashboard/product/index.tsx` 为 workspace 主链路入口；允许把旧的 `PageCacheProvider + ProductPageCacheBindings` 结构抽成 fallback 组件，供 Task 08 接 feature flag。
5. 改写 `product-listing.tsx` 与 `product-tables/index.tsx`，通过 props/search adapter 接状态，不再直读 router 或 `page-cache`。
6. 运行 `bunx vitest run src/features/products/workspace/product-workspace-definition.test.ts`、`bun run build`，再执行手工回归。
7. 提交建议：`git commit -m "feat: migrate products list to workspace shell"`

## Notes For Executor

- 产品表格的 `scrollTargetId` 与 DataTable DOM 结构继续复用现有实现，新的保留机制来自 `<Activity>`，不是新的滚动缓存 hook。
- 如果你需要为 Task 08 预留 rollback 组件，请把旧链路收敛到单独的 fallback 组件里，而不是把新旧逻辑继续糅在同一个大组件中。
- 若 `ProductWorkspaceScreen` 需要从 route metadata 读 page chrome，请通过 definition 显式传入，不要在 screen 内回头调用 `useMatches()`。
