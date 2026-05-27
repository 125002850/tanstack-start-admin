# Task V2-02A: Table Core Internal State 与 Page Size Preference

**Depends on:** `Task V2-01`
**Blocks:** `Task V2-02B, Task V2-03, Task V2-04`
**Type:** `behavior`

## Goal

把 `useDataTable` 的默认契约改成 internal-state first，并把 `perPage` 的“只做 preference 初始化”边界写实到共享实现，彻底脱离 v1 的 definition / adapter 验收路径。

## Files

- Modify:
  - `src/hooks/use-data-table.ts`
  - `src/hooks/use-data-table.search-adapter.test.tsx`
  - `src/lib/data-table-page-size.ts`
  - `src/lib/data-table-page-size.test.ts`
- Create:
  - `src/hooks/use-data-table.internal-state.test.tsx`
- Reference:
  - `src/config/data-table.ts`
  - `src/lib/parsers.ts`

## Invariants

- `useDataTable` 默认状态源必须是 hook 内部 state。
- `perPage` 只负责初始化 `pageSize`，之后由 table controller 自己维护。
- 共享 hook 不再把 router search 视作默认状态输入，也不默认回写 URL。

## Constraints

- 不允许把 `WorkspaceRouteDefinition`、`searchAdapter`、`workspace-definition` 重新引回共享 hook。
- 不允许把 URL 例外能力做成新的全局开关或新一代 adapter。
- 可以保留兼容输入，但必须明确 deprecated，且默认路径不能依赖它。

## Acceptance Criteria

- [ ] `useDataTable` 默认工作在 internal-state 模式
- [ ] `src/lib/data-table-page-size.ts` 明确支持“从 session/local preference 初始化 pageSize”
- [ ] `useDataTable` 默认路径不再依赖 router search 作为分页/筛选/排序状态源
- [ ] `bunx vitest run src/hooks/use-data-table.internal-state.test.tsx src/lib/data-table-page-size.test.ts` 通过
- [ ] `bun run build` 通过

## Verification Strategy

`behavior` 任务使用 hook 单测和 page-size utility 单测。验收只看 v2 internal-state 行为，不再借 v1 definition 测试间接背书。

## Execution Recipe

1. 先盘点 `useDataTable` 当前暴露的控制面，保留 `state snapshot + setPagination + setSorting + setColumnFilters + reset` 这类对 feature 有真实价值的 API。
2. 改写 `useDataTable` 默认初始化逻辑，使 pagination/sorting/filters 都从内部 state 起步，router search 只允许出现在明确标 deprecated 的兼容分支。
3. 修改 `src/lib/data-table-page-size.ts` 及测试，写死 `pageSize` 的来源与回写边界：启动时读 preference，交互后写回 preference，但不承担 URL 同步。
4. 新增 internal-state 单测，覆盖初始化、用户交互更新、reset，以及 page-size preference 种子值生效。
5. 保留或收敛旧 `search-adapter` 测试文件时，必须把它降级为兼容路径验证，不能再作为主验收命令的一部分。

## Notes For Executor

- 如果现有 `useDataTable.search-adapter.test.tsx` 仍保留，请在文件头或测试描述里明确它属于 deprecated compatibility path。
- 本任务不改 products/users 具体页面；只把共享 hook 和 page-size 工具改到位，为下一个任务提供稳定底座。
