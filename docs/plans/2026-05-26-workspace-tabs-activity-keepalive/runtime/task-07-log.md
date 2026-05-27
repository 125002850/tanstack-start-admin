# Execution Log - Task 07

**Agent:** %13
**Started:** 2026-05-26 14:08
**Completed:** 2026-05-26 14:32

## Result

`done`

## What Was Done

- 新建 `src/features/users/workspace/users-workspace-definition.ts`，实现 users 列表的 `parse / stringify / buildHref / getPageChrome / refresh`，刷新语义精确失效 `userKeys.list(filters)`。
- 新建 `src/features/users/workspace/users-workspace-definition.test.ts`，覆盖 URL/state 互转、默认 `perPage` 回退与精确 query invalidate。
- 新建 `src/features/users/components/users-workspace-screen.tsx`，将 `PageContainer + UserFormSheetTrigger` 放入 workspace screen。
- 改写 `src/routes/dashboard/users.tsx` 为 `WorkspaceRoutePage` 主链路，并保留旧 `PageContainer + UserListingPage` fallback 供 Task 08 feature flag 回退。
- 改写 `src/features/users/components/user-listing.tsx` 与 `src/features/users/components/users-table/index.tsx`，使表格支持可选 `searchAdapter` 驱动；未提供 adapter 时仍回退到 router search。
- 二轮修复：提取 `src/features/workspace-tabs/hooks/use-bridged-search-adapter.ts`，补齐外部 route state -> adapter subscriber 通知链，修复浏览器 back/forward 与外部导航时 `useDataTable` 可能读取 stale search 的问题。
- 新建 `src/features/workspace-tabs/hooks/use-bridged-search-adapter.test.ts`，增加 8 个回归测试保护 subscriber 通知与 consumer 读取最新 search 的场景。

## Verification Results

| Check | Status | Notes |
|------|--------|-------|
| `bunx vitest run src/features/users/workspace/users-workspace-definition.test.ts` | PASS | 18 tests passing |
| `bunx vitest run src/features/workspace-tabs/` | PASS | 8 files, 100 tests passing |
| `bun run build` | PASS | client + SSR build passed |

## Unfinished Work

- [ ] 在 Task 08 浏览器级回归中复核 users workspace 的 back/forward、tag 切换与隐藏恢复行为。

## Surprises

- `useDataTable` 的 adapter 消费契约不仅依赖 `setSearch()`，也依赖 `subscribe()` 在外部 state 变化时推送刷新；初版 users screen 只同步 `searchRef`，未通知 subscriber，导致浏览器历史导航场景存在真实同步缺口。

## Handoff Notes

- Task 08 需要验证 `workspace.refreshPolicy = 'query-invalidate'` 的元数据消费方是否真正落地；当前 `definition.refresh()` 已可用，但调度器尚未出现。
- Users 的 `gender` search 字段仍未进入 `UserFilters` 查询层，这是旧链路既有行为，不是本任务新增回归。
