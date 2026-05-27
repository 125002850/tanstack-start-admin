# Task 04: Route State 与 DataTable Adapter

**Depends on:** `Task 01, Task 02`
**Blocks:** `Task 05, Task 06, Task 07`
**Type:** `refactor`

## Goal

把 `useDataTable` 从 router 强绑定改造成“默认兼容 router、可选接入 workspace search adapter”的双模结构，并定义 route state/route definition 的通用接口。

## Files

- Create: `src/features/workspace-tabs/lib/workspace-route-state.ts`
- Create: `src/features/workspace-tabs/lib/workspace-route-state.test.ts`
- Create: `src/hooks/use-data-table.search-adapter.test.tsx`
- Modify: `src/features/workspace-tabs/types.ts`
- Modify: `src/hooks/use-data-table.ts`
- Reference: `src/lib/data-table-page-size.ts`
- Reference: `src/lib/parsers.ts`

## Invariants

- 不传 adapter 时，`useDataTable` 必须保持现有 URL search 驱动行为。
- `perPage` 只有页大小真正变化时才写回 search；普通翻页只改 `page`。
- 现有产品/用户列表 route schema 的 URL 兼容性不能在本任务里改变。

## Constraints

- 本任务不迁移任何具体页面；只建立通用接口和回归测试。
- 新增的 route state helper 必须是纯函数，不得读取 React hooks。
- `useDataTable` 的新参数必须可选，禁止破坏现有调用方编译。

## Acceptance Criteria

- [ ] `bunx vitest run src/features/workspace-tabs/lib/workspace-route-state.test.ts src/hooks/use-data-table.search-adapter.test.tsx` 通过
- [ ] `bun run build` 通过
- [ ] 现有 `useDataTable` 调用方无需修改也能通过编译

## Verification Strategy

`refactor` 任务使用“先锁行为，再改实现”的策略。search adapter、`perPage` 写回时机和 serializer 都是稳定逻辑，适合用回归测试保护。

## Execution Recipe

1. 在 `src/features/workspace-tabs/types.ts` 中补齐以下接口：
   - `WorkspaceRouteDefinition<TState>`
   - `WorkspaceScreenProps<TState>`
   - `DataTableSearchAdapter`
2. 在 `workspace-route-state.ts` 中实现 URL <-> typed state 的纯函数 helper，包括 `asSearchReducer()`、默认 state 回退和 href 组装工具。
3. 改造 `use-data-table.ts`：
   - 新增可选 `searchAdapter`
   - 未传时继续用 `useSearch/useNavigate`
   - 传入时改为读写 adapter
4. 在 `use-data-table.search-adapter.test.tsx` 中验证：
   - 翻页只改 `page`
   - 改页大小时才写 `perPage`
   - filter/sort 更新继续保留现有序列化规则
5. 在 `workspace-route-state.test.ts` 中验证默认值、排序序列化和 URL 还原。
6. 运行 `bunx vitest run src/features/workspace-tabs/lib/workspace-route-state.test.ts src/hooks/use-data-table.search-adapter.test.tsx`、`bun run build`。
7. 提交建议：`git commit -m "refactor: add workspace route state and table adapter"`

## Notes For Executor

- `WorkspaceRouteDefinition<TState>` 至少要包含：`parse(search, params)`, `stringify(state)`, `buildHref(state)`, `getPageChrome()`, `refresh()`.
- 这里不要提前引入产品/用户 feature 细节，具体 definition 在后续任务各自实现。
