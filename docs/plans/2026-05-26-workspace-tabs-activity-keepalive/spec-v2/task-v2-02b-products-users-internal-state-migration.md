# Task V2-02B: Products / Users 列表迁移到 Feature-Local Internal State

**Depends on:** `Task V2-02A`
**Blocks:** `Task V2-03, Task V2-04`
**Type:** `behavior`

## Goal

在共享 hook 改造完成后，把 products/users 两条列表链路从 router search / adapter 驱动迁移到 feature-local internal state，让 page 只负责挂载 table。

## Files

- Modify:
  - `src/features/products/components/product-listing.tsx`
  - `src/features/products/components/product-tables/index.tsx`
  - `src/features/products/components/product-workspace-screen.tsx`
  - `src/features/users/components/user-listing.tsx`
  - `src/features/users/components/users-table/index.tsx`
  - `src/features/users/components/users-workspace-screen.tsx`
  - `src/routes/dashboard/product/index.tsx`
  - `src/routes/dashboard/users.tsx`
- Create:
  - `src/features/products/components/product-tables.internal-state.test.tsx`
  - `src/features/users/components/users-table.internal-state.test.tsx`
- Reference:
  - `src/features/products/workspace/product-workspace-definition.ts`
  - `src/features/users/workspace/users-workspace-definition.ts`
  - `src/features/products/api/queries.ts`
  - `src/features/users/api/queries.ts`

## Invariants

- products/users 主链路下的 table 状态必须来自 feature-local internal state。
- page 与 shell 都不再作为 table 通用状态宿主。
- 现有 workspace definition 文件若暂时保留，只能作为遗留资产，不能再作为 v2 主链路入口。

## Constraints

- 不允许引入新的通用 `searchAdapter` / `stateAdapter` 替代物。
- 不允许默认把 table 状态写回 router search。
- 不允许再用 v1 definition 测试作为 products/users 主验收依据。

## Acceptance Criteria

- [ ] products 列表在 workspace 主链路下不再依赖 router search 作为分页/筛选/排序状态源
- [ ] users 列表在 workspace 主链路下不再依赖 router search 作为分页/筛选/排序状态源
- [ ] products/users 的 workspace screen 不再承载 `searchAdapter` 主链路职责
- [ ] `rg -n \"product-workspace-definition|users-workspace-definition|use-bridged-search-adapter|searchAdapter\" src/routes/dashboard/product src/routes/dashboard/users src/features/products src/features/users` 的结果只允许出现在遗留 inventory 注释、deprecated 标记或专门保留的 legacy 文件中
- [ ] `bunx vitest run src/features/products/components/product-tables.internal-state.test.tsx src/features/users/components/users-table.internal-state.test.tsx` 通过
- [ ] `bun run build` 通过

## Verification Strategy

`behavior` 任务使用 feature-level targeted regression test，直接验证 products/users 在 v2 链路下的 internal-state 行为。

## Execution Recipe

1. 以 `Task V2-02A` 的 controller 契约为准，改写 products/users table 组件，让查询参数直接从 table internal state 导出。
2. 收敛 products/users workspace screen，删除与 `searchAdapter`、bridged adapter、route-state 映射相关的主链路逻辑。
3. 修改对应 route，使 page 只挂载 feature screen，不再承担 table 状态桥接。
4. 为 products/users 各自补 internal-state 回归测试，至少覆盖 page-size 种子值、筛选/排序更新、切换 tag 后实例状态由 Activity 自然保留。
5. 处理 feature 侧 legacy 文件 owner：
   - `product-workspace-definition.ts` / `.test.ts`
   - `users-workspace-definition.ts` / `.test.ts`
   - `use-bridged-search-adapter.ts` / `.test.ts`
   这些文件要么被删除，要么保留为明确的 deprecated / inventory-only 资产，但不得再被 products/users v2 主链路引用。
6. 跑 `rg` 零 import gate，证明 products/users 在 flag-on 主链路下已退出 definition / bridged adapter 依赖。

## Notes For Executor

- 这里可以引用 definition 文件做 inventory，但不能再让它们驱动 v2 页面渲染或测试 gate。
- 如果 products/users 某处仍需要 URL 例外能力，必须在 feature 内局部封装，不得倒灌回共享 table hook。
