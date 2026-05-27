# Execution Log - Task V2-04

**Agent:** %15
**Started:** 2026-05-27
**Completed:** 2026-05-27

## Result

`done`

## Goal

- 完成 workspace shell v2 的 rollout、回归与 v1 退出主链路。
- 建立 flag-on / flag-off 自动化 smoke，并收口 v1 route-state / adapter / definition 的运行时引用。

## Handoff Notes

- `Task V2-03` 已通过，route-instance tags 与 closeGuard 已过 gate，可以进入 rollout / regression 阶段。
- 当前优先严格按 `task-v2-04-rollout-and-regression.md` 执行，重点看单点 feature flag、Playwright smoke、`rg` legacy-only gate、以及 `bun run lint` 是否需要仓库存量清理。

## Coordinator Review - 2026-05-27

- Fresh verification:
  - `bun run lint` -> PASS（0 errors / 30 warnings）
  - `bunx vitest run` -> PASS（18 files / 297 tests）
  - `bun run build` -> PASS
  - `rg -n "workspace-route-page|workspace-route-state|WorkspaceRouteDefinition|use-bridged-search-adapter|product-workspace-definition|users-workspace-definition" src/features/workspace-tabs src/features/products src/features/users src/routes` -> 仍命中非 inventory-only 文件
- Gate result: `changes_requested`
- Blocking findings:
  - `src/routes/dashboard/product/index.tsx` 的 flag-off 路径仍返回 `ProductPageLegacy`，继续依赖 `PageCacheProvider` 与 `ProductPageCacheBindings`，违反 `Task V2-04` 的 rollback 目标。
  - `e2e/workspace-tabs-smoke.spec.ts` 里的 `page.reload()` 与 `dirty close guard` 场景断言偏弱，尚未真正证明“修改状态后 reload 回默认”和“guard 拒绝会中止关闭并保留焦点”。
  - task 指定的 `rg` gate 仍命中 `src/features/workspace-tabs/hooks/use-bridged-search-adapter.ts`、`src/features/workspace-tabs/types.ts` 及相关测试文件，未收敛到明确标记 deprecated / inventory-only 的遗留文件。
- Verification gap:
  - Playwright gate 本轮未独立执行。当前已有 code/spec blockers，因此未继续投入双 dev server 启动与浏览器 smoke 运行。

## Coordinator Re-Review - 2026-05-27

- Closed blockers:
  - `src/routes/dashboard/product/index.tsx` 已改为 flag-off 直接渲染 `ProductWorkspaceScreen`，`page-cache` 回流问题已关闭。
  - `rg` 命中已收敛到显式 `deprecated / inventory-only` 文件或 `types.ts` 中明确标记的 V1 legacy type section。
- Fresh verification:
  - `bun run lint` -> PASS（0 errors / 30 warnings）
  - `bunx vitest run` -> PASS（18 files / 297 tests）
  - `bun run build` -> PASS
  - `bunx playwright test e2e/workspace-tabs-smoke.spec.ts --project default` -> FAIL（10 failed / 1 passed）
  - `bunx playwright test e2e/workspace-tabs-smoke.spec.ts --project rollback` -> FAIL（2 failed / 1 passed）
  - `bunx playwright test e2e/workspace-tabs-smoke.spec.ts --grep "@workspace-v2"` -> FAIL（`Running 14 tests using 2 workers`，错误把 rollback cases 一并选入）
  - `VITE_ENABLE_WORKSPACE_TABS=0 bunx playwright test e2e/workspace-tabs-smoke.spec.ts --grep "@workspace-v2-rollback"` -> FAIL（`default` 与 `rollback` projects 同时入选）
- Gate result: `changes_requested`
- New blocking findings:
  - `playwright.config.ts` 的 `default` project 使用 `grep: /@workspace-v2/`，会误匹配 `@workspace-v2-rollback`，导致 flag-on gate 与 rollback gate 混线。
  - smoke 断言与真实 DOM 契约不匹配：`ProductWorkspaceScreen` / `UsersWorkspaceScreen` 本身不渲染 `Products/Users` heading，但 smoke 多处使用 `getByRole('heading', { name: /产品|Users/ })`；rollback/default 两条路径都因此失败。
  - dirty close guard 的浏览器 smoke 仍只验证非 dirty close plumbing，没有覆盖真正的 closeGuard rejection 用户路径。

## Coordinator Final Review - 2026-05-27

- Closed blockers:
  - `playwright.config.ts` 的 project grep 已隔离 `@workspace-v2` 与 `@workspace-v2-rollback`，release gate 不再混线。
  - `scripts/playwright-workspace-tabs-servers.sh` 已解除 default / rollback 双 server 的生命周期耦合，单条 smoke 线不再被另一条 project 的子进程退出误杀。
  - `src/routes/dashboard.tsx` 已将 `QueryClientProvider` 上提到 `WorkspaceViewport + Outlet` 外层，flag-off rollback 路径不再因缺少 React Query context 触发 `No QueryClient set`。
  - `e2e/workspace-tabs-smoke.spec.ts` 已收紧为真实 DOM 契约；dirty close-other / close-all 继续验证“拒绝关闭后聚焦被拒绝 tab”的真实用户路径，rollback 列表断言与 default 一致。
- Fresh verification:
  - `bun run lint` -> PASS（0 errors / 30 warnings）
  - `bunx vitest run` -> PASS（18 files / 297 tests）
  - `bun run build` -> PASS
  - `rg -n "workspace-route-page|workspace-route-state|WorkspaceRouteDefinition|use-bridged-search-adapter|product-workspace-definition|users-workspace-definition" src/features/workspace-tabs src/features/products src/features/users src/routes` -> 仅命中 legacy / inventory-only 文件
  - `bunx playwright test e2e/workspace-tabs-smoke.spec.ts --project default` -> PASS（10 passed）
  - `bunx playwright test e2e/workspace-tabs-smoke.spec.ts --project rollback` -> PASS（3 passed）
  - `bunx playwright test e2e/workspace-tabs-smoke.spec.ts` -> PASS（13 passed）
- Gate result: `passed`
- Notes:
  - 最终收口由协调端完成，代码变更集中在 `scripts/playwright-workspace-tabs-servers.sh`、`src/routes/dashboard.tsx` 与 `e2e/workspace-tabs-smoke.spec.ts`。

## Coordinator Follow-up Review - 2026-05-27 15:32

- Why revisited:
  - `Task V2-04` 的 smoke gate 虽已通过，但协调端后续发现 `product/$productId keepAlive=false` 让 dirty closeGuard 只能保住 URL / tab identity，保不住真实 draft。
- Closed follow-up:
  - `product/$productId` 已恢复默认 keep-alive，并把 `ProductForm` 的 closeGuard 反馈与 smoke draft-preservation 断言补齐。
  - smoke selector 已改为只命中当前活动表单实例，避免 keep-alive 多实例留在 DOM 后误选隐藏节点。
- Fresh verification:
  - `bunx playwright test e2e/workspace-tabs-smoke.spec.ts --project default` -> PASS（11 passed）
  - `bunx playwright test e2e/workspace-tabs-smoke.spec.ts --project rollback` -> PASS（3 passed）
  - `bunx vitest run` -> PASS（18 files / 297 tests）
  - `bun run lint` -> PASS（0 errors / 28 warnings）
  - `bun run build` -> PASS
