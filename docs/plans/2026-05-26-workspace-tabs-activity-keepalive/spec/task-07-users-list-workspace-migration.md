# Task 07: 用户列表 Workspace 迁移

**Depends on:** `Task 04, Task 05`
**Blocks:** `Task 08`
**Type:** `behavior`

## Goal

把用户列表页迁移到 workspace shell，并与产品页共享同一套 route definition / search adapter / `query-invalidate` 契约，同时保留旧 `PageContainer + UserListingPage` 路由渲染链路以供 Task 08 feature flag 回退。

## Files

- Create: `src/features/users/components/users-workspace-screen.tsx`
- Create: `src/features/users/workspace/users-workspace-definition.ts`
- Create: `src/features/users/workspace/users-workspace-definition.test.ts`
- Modify: `src/routes/dashboard/users.tsx`
- Modify: `src/features/users/components/user-listing.tsx`
- Modify: `src/features/users/components/users-table/index.tsx`
- Reference: `src/features/users/api/queries.ts`
- Reference: `src/components/layout/page-container.tsx`

## Invariants

- 用户路由现有 `validateSearch` / `beforeLoad` 行为必须保持不变。
- `UserFormSheetTrigger` 继续作为页面头部 action 呈现。
- `perPage` 继续复用全局 `useDataTablePageSize()` 偏好，不引入第二套存储。

## Constraints

- 用户 route metadata 必须显式 `workspace: { refreshPolicy: 'query-invalidate' }`。
- `users-workspace-definition.ts` 的刷新语义必须使用 `userKeys.list(currentFilters)`。
- 本任务不能重新引入 `page-cache`，也不能复制产品页 route-state helper 逻辑。
- 需要为 Task 08 预留 route 级 fallback 入口：flag 关闭时，用户页必须还能回到当前非-workspace 渲染链路。

## Acceptance Criteria

- [ ] `bunx vitest run src/features/users/workspace/users-workspace-definition.test.ts` 通过
- [ ] `bun run build` 通过
- [ ] 用户表格的 `useDataTable()` 调用完全通过 search adapter 或显式 props 驱动

## Verification Strategy

`behavior` 任务使用 definition 单测 + 构建回归。用户页的高风险点是 URL/search 与 query key 精度，而不是新的滚动缓存机制，因此自动化优先。

## Execution Recipe

1. 在 `users-workspace-definition.ts` 中实现用户列表的 `parse/search/stringify/buildHref/refresh/getPageChrome`。
2. 在 `users-workspace-definition.test.ts` 中覆盖：
   - URL -> state
   - state -> href
   - `perPage` 默认值回退
   - `refresh()` 精确失效 `userKeys.list(filters)`
3. 创建 `UsersWorkspaceScreen`，把 `PageContainer` 与 `UserFormSheetTrigger` 移入 screen。
4. 改写 `src/routes/dashboard/users.tsx` 为 workspace 主链路入口，并保留旧 `PageContainer + UserListingPage` 结构可被 Task 08 feature flag 重新启用。
5. 改写 `user-listing.tsx` 与 `users-table/index.tsx`，让表格不再直接读取 router search。
6. 运行 `bunx vitest run src/features/users/workspace/users-workspace-definition.test.ts`、`bun run build`。
7. 提交建议：`git commit -m "feat: migrate users list to workspace shell"`

## Notes For Executor

- 用户列表没有 `page-cache` 依赖，但它和产品页共享 `useDataTablePageSize()` 的 ready gating；迁移后仍要保留这个一致性。
- 用户页的滚动位置不做显式序列化；保活效果来自 `WorkspaceViewport` 中的 hidden Activity。
