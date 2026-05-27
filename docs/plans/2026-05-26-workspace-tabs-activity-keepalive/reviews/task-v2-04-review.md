# Task V2-04 Review

## Verdict

`changes_requested`

## Findings

1. `High` `playwright.config.ts` 的 project grep 仍然把 flag-on 与 rollback suites 混在一起，直接破坏了 `V2-04` 的 release gate 设计。[playwright.config.ts](/Users/youdingte/studys/tanstack-start-admin/playwright.config.ts:13) 现在用的是 `grep: /@workspace-v2/`，它会匹配 `@workspace-v2-rollback`。我 fresh 跑 acceptance 风格命令 `bunx playwright test e2e/workspace-tabs-smoke.spec.ts --grep "@workspace-v2"`，Playwright 明确打印 `Running 14 tests using 2 workers`，并同时调度了 `[default]` 和 `[rollback]` cases；同理，`VITE_ENABLE_WORKSPACE_TABS=0 bunx playwright test e2e/workspace-tabs-smoke.spec.ts --grep "@workspace-v2-rollback"` 也同时调度了 `default` 与 `rollback` projects。当前配置无法把两个发布 gate 正确隔离。

2. `High` smoke 断言与真实页面 DOM 契约不匹配，导致两条浏览器路径都存在真实失败，不是单纯环境问题。[e2e/workspace-tabs-smoke.spec.ts](/Users/youdingte/studys/tanstack-start-admin/e2e/workspace-tabs-smoke.spec.ts:8), [e2e/workspace-tabs-smoke.spec.ts](/Users/youdingte/studys/tanstack-start-admin/e2e/workspace-tabs-smoke.spec.ts:24), [e2e/workspace-tabs-smoke.spec.ts](/Users/youdingte/studys/tanstack-start-admin/e2e/workspace-tabs-smoke.spec.ts:114), [e2e/workspace-tabs-smoke.spec.ts](/Users/youdingte/studys/tanstack-start-admin/e2e/workspace-tabs-smoke.spec.ts:168), [e2e/workspace-tabs-smoke.spec.ts](/Users/youdingte/studys/tanstack-start-admin/e2e/workspace-tabs-smoke.spec.ts:197), [e2e/workspace-tabs-smoke.spec.ts](/Users/youdingte/studys/tanstack-start-admin/e2e/workspace-tabs-smoke.spec.ts:206) 多次假设页面存在 `Products/Users` heading；但实际 [product-workspace-screen.tsx](/Users/youdingte/studys/tanstack-start-admin/src/features/products/components/product-workspace-screen.tsx:8) 和 [users-workspace-screen.tsx](/Users/youdingte/studys/tanstack-start-admin/src/features/users/components/users-workspace-screen.tsx:5) 只渲染 `PageContainer + listing`，并没有这些 heading。对应 fresh 结果里，`bunx playwright test e2e/workspace-tabs-smoke.spec.ts --project default` 失败 `10/11`，`bunx playwright test e2e/workspace-tabs-smoke.spec.ts --project rollback` 失败 `2/3`，其中多条直接报 `heading` 或 `table tbody tr` 不存在。这说明 smoke 目前既不稳定，也不能代表真实产品语义。

3. `Medium` dirty close guard 的浏览器 smoke 仍没有覆盖任务要求的“拒绝关闭”用户路径。[e2e/workspace-tabs-smoke.spec.ts](/Users/youdingte/studys/tanstack-start-admin/e2e/workspace-tabs-smoke.spec.ts:151) 到 [e2e/workspace-tabs-smoke.spec.ts](/Users/youdingte/studys/tanstack-start-admin/e2e/workspace-tabs-smoke.spec.ts:179) 这条测试虽然名字叫 `close guard rejection preserves active tab and prevents close`，但注释已经写明它只验证 non-dirty close plumbing，完全没有真实 dirty page、没有 rejection、也没有保焦点断言。`V2-04` 的 release gate matrix 明确要求 `@workspace-v2` smoke 至少覆盖一个 dirty close guard 场景；当前仍未满足。

## Closed Since Round 1

- `src/routes/dashboard/product/index.tsx` 的 flag-off 路径已改为直接渲染 `ProductWorkspaceScreen`，不再回流到 `PageCacheProvider / ProductPageCacheBindings`。
- `rg -n "workspace-route-page|workspace-route-state|WorkspaceRouteDefinition|use-bridged-search-adapter|product-workspace-definition|users-workspace-definition" src/features/workspace-tabs src/features/products src/features/users src/routes` 的命中已收敛到显式 `deprecated / inventory-only` 文件或 `types.ts` 中明确标记的 V1 legacy type section。

## Verification

- `bun run lint` -> PASS（0 errors / 30 warnings）
- `bunx vitest run` -> PASS（18 files / 297 tests）
- `bun run build` -> PASS
- `bunx playwright test e2e/workspace-tabs-smoke.spec.ts --project default` -> FAIL（10 failed / 1 passed）
- `bunx playwright test e2e/workspace-tabs-smoke.spec.ts --project rollback` -> FAIL（2 failed / 1 passed）
- `bunx playwright test e2e/workspace-tabs-smoke.spec.ts --grep "@workspace-v2"` -> FAIL（`default` 与 `rollback` projects 混线）
- `VITE_ENABLE_WORKSPACE_TABS=0 bunx playwright test e2e/workspace-tabs-smoke.spec.ts --grep "@workspace-v2-rollback"` -> FAIL（`default` 与 `rollback` projects 混线）

## Update (2026-05-27 15:32)

- 该 review 文档记录的是二轮 `changes_requested` 历史，不再代表最新 gate 状态。
- 最新状态：
  - `Task V2-04` 已在 runtime log 中通过最终 review，并于 2026-05-27 15:32 完成一次 follow-up 审计。
  - 当前 `bunx playwright test e2e/workspace-tabs-smoke.spec.ts --project default` -> PASS（11 passed）
  - 当前 `bunx playwright test e2e/workspace-tabs-smoke.spec.ts --project rollback` -> PASS（3 passed）
  - `product/$productId` 的 dirty-form keepAlive 缺口已关闭，smoke 现明确验证 draft-preservation 语义。
