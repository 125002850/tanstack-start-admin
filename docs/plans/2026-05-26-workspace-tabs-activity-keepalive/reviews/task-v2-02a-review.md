# Task V2-02A Review

**Reviewer:** codex
**Task:** Task V2-02A
**Decision:** `approved`

## Checks

- [x] `bunx vitest run src/hooks/use-data-table.internal-state.test.tsx src/lib/data-table-page-size.test.ts` 由协调端独立执行并通过
- [x] `bunx vitest run src/hooks/use-data-table.internal-state.test.tsx src/hooks/use-data-table.search-adapter.test.tsx src/lib/data-table-page-size.test.ts` 由协调端独立执行并通过
- [x] `bunx vitest run src/features/workspace-tabs/ src/components/layout/tags-bar.test.tsx src/hooks/use-data-table.internal-state.test.tsx src/hooks/use-data-table.search-adapter.test.tsx src/lib/data-table-page-size.test.ts` 由协调端独立执行并通过
- [x] `bun run build` 由协调端独立执行并通过
- [x] internal-state 默认路径与 page-size preference 边界已按 v2 方向落盘
- [x] hook 调用顺序风险已消除
- [x] hook-order 风险存在对应的自动化回归保护
- [x] compat 路径已补 `useSyncExternalStore` 的 SSR-safe `getServerSnapshot`
- [x] identity-switch 回归测试已直接断言切换后首个 render 的渲染值来自新 adapter

## Resolution Update

- 五轮修复后，前四轮提出的 10 个 blocker 已全部关闭，本轮未发现新的 blocking finding。
- `src/hooks/use-data-table.ts` 现已在 compat 路径使用 `useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)`，关闭了 server-rendered content blocker。
- `src/hooks/use-data-table.search-adapter.test.tsx` 现已直接断言 adapter identity 切换后的首个 render 显示 `page=5 / perPage=100`，不再只是验证 `getSearch()` 被调用。
- `bun run lint` 仍失败，但当前 hard errors 位于 `workspace-page-boundary.tsx` 等仓库存量文件，不属于 V2-02A 变更范围，因此不作为本任务 release gate blocker。

## Findings

1. `src/hooks/use-data-table.ts` 当前通过 `if (searchAdapter) return useDataTableWithAdapter(...)` 条件分支调用自定义 hook。只要 `searchAdapter` 在组件生命周期里发生 falsy/truthy 切换，就会改变 `useDataTable` 的 hook 调用顺序。这不是测试缺口，而是实现级风险，不能放行。
2. 现有 `src/hooks/use-data-table.internal-state.test.tsx` 与 `src/hooks/use-data-table.search-adapter.test.tsx` 都没有覆盖 mode 切换或等价的 hook-order 安全性场景，因此这类回归现在无法被自动化捕获。
3. 当前验收可以确认 internal-state 默认行为、page-size preference 合同与 build 都正常；问题集中在 compat 分支的封装方式，而不是 v2 主链路行为本身。
4. 二轮返工后，条件 custom hook 调用已被移除，mode-switch 回归测试也已补上；但 compat 实现仍在 render phase 里执行 `setLocalSearch(...)`，这一点不能作为稳定 contract 接受。
5. 二轮返工后的 `setLocalSearch((prev) => { ... searchAdapter.setSearch(() => next) ... })` 仍把 adapter 写入副作用放在 React state updater 内，破坏 updater 纯度。只要 React 在开发模式、StrictMode 或未来重放语义下重复执行 updater，就可能把一次用户交互放大成多次 adapter 写入或多次订阅通知。
6. 新增的 mode-switch 测试主要覆盖“不抛错”，还没有覆盖“单次交互只触发一次 adapter 更新/订阅通知”的确定性语义，因此第二轮仍不能放行。
7. 三轮返工后，render-phase `setLocalSearch(...)` 与 updater 内副作用都已去除，这两项 blocker 已关闭；但 compat 分支改成 `useEffect` 在 commit 后同步新的 adapter snapshot，导致 adapter identity 切换时的首个 render 仍消费旧 `localSearch`。这会产生一帧旧 pagination/sort/filter；在真实页面里，可能进一步触发错误 query key、多余请求或 UI 闪旧状态。
8. `src/hooks/use-data-table.search-adapter.test.tsx` 里的 identity switch 测试当前仍只证明“最终 effect 跑完会变对”，不能证明“首个 render 就是新 adapter snapshot”。RTL 的 `rerender`/`act` 会把 effect 一并 flush 掉，因此不足以为这个 contract 背书。
9. 四轮返工后，compat 分支改成 `useSyncExternalStore`，首帧旧 snapshot 风险方向上是对的；但实现当前只传了 `subscribe` 与 `getSnapshot`，缺失 `getServerSnapshot`。我已用最小 SSR 复现实证：`renderToString` + `useSyncExternalStore` 缺第三参会直接输出 `Missing getServerSnapshot, which is required for server-rendered content. Will revert to client rendering.`。本项目存在 SSR 链路，这属于 release blocker。
10. 当前 identity-switch 测试仍偏弱。`src/hooks/use-data-table.search-adapter.test.tsx` 只验证 `adapterB.getSearch()` 被调用，但没有直接断言切换后的首个 render 显示的是 adapterB 的 pagination/pageSize/sort。因此它证明了 `getSnapshot` 参与渲染，但还没有把“首帧渲染值正确”锁死成回归保护。

## Action

- [x] 要求 `%15` 在 `Task V2-02A` 文件范围内重构 compat 路径，确保 `useDataTable` 在不同模式间保持稳定 hook 顺序。
- [x] 要求 `%15` 补回归测试，并在回执中明确说明为何现在是 hook-safe。
- [x] `Task V2-02B` 维持 blocked，不允许提前启动 products/users 迁移编码。
- [x] 二轮要求 `%15` 去掉 render-phase `setLocalSearch(...)`，改成纯 React 语义安全的 adapter 同步方案。
- [x] 二轮要求 `%15` 把 `searchAdapter.setSearch` 移出 React state updater，并补“单次交互只触发一次 adapter 更新/通知”的回归测试。
- [x] 三轮要求 `%15` 把 compat 分支进一步收敛成 render 期即可安全读取当前 adapter snapshot 的方案，建议 `useSyncExternalStore` 或等价实现，不接受再回到 render-phase setState。
- [x] 三轮要求 `%15` 补能真正卡住“adapter identity 切换时首帧不得渲染旧 search”的回归测试。
- [x] 四轮要求 `%15` 给 `useSyncExternalStore` 补 SSR-safe 的 `getServerSnapshot`，确保 compat 分支不会在 server-rendered content 下报错/降级。
- [x] 四轮要求 `%15` 增强 identity-switch 测试，直接断言切换后首个 render 的渲染值来自新 adapter。
- [x] 五轮复核通过，`Task V2-02A` 关闭 review gate。
- [x] 已解锁 `%16` 启动 `Task V2-02B`，products/users 迁移可正式开始。

## Downstream Notes

- `Task V2-02A` 已于五轮验收后升级为 `done`；下游 `Task V2-02B` 已正式解锁。
- `%16` 现在应按 `task-v2-02b-products-users-internal-state-migration.md` 进入实现，不再停留在只读待命状态。
