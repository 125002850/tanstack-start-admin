# Task V2-04: Rollout、回归与 V1 退出主链路

**Depends on:** `Task V2-03`
**Blocks:** `none`
**Type:** `migration`

## Goal

完成 v2 workspace shell 的 feature flag rollout、浏览器级 smoke 与 v1 方向退出主链路，确保：

- flag-on 走 `轻壳 tags + Activity host + feature-local state`
- flag-off 退回“无 tags / 无 Activity host 的单页 dashboard 链路”，但页面内部继续使用 v2 feature-local state
- v1 的 `route-state / adapter / definition` 不再承担运行时关键路径

## Files

- Modify:
  - `src/config/workspace-tabs.ts`
  - `src/routes/dashboard.tsx`
  - `src/routes/dashboard/product/index.tsx`
  - `src/routes/dashboard/users.tsx`
  - `playwright.config.ts`
  - `e2e/workspace-tabs-smoke.spec.ts`
  - `docs/plans/2026-05-26-workspace-tabs-activity-keepalive/runtime/state.md`
  - `docs/plans/2026-05-26-workspace-tabs-activity-keepalive/runtime/task-08-log.md`
- Reference:
  - `src/lib/page-cache/*`
  - `docs/plans/2026-05-26-workspace-tabs-activity-keepalive/spec/*`

## Invariants

- feature flag 只能通过 `src/config/workspace-tabs.ts` 单点读取。
- flag-off 时必须彻底切断 tags / Activity host / route tag sync 的运行路径。
- flag-off 不得复活 v1 的 `route-state / adapter / definition`。
- `src/lib/page-cache/*` 仅做 inventory，不默认承担 rollback-only 角色。

## Constraints

- 不允许业务代码直接双读裸 `import.meta.env.VITE_ENABLE_WORKSPACE_TABS`。
- 不允许“UI 看起来关闭了，但 workspace store / sync hooks 还在跑”的半开状态。
- v1 抽象可以保留文件，但不得继续出现在 flag-on 主链路。

## Acceptance Criteria

- [ ] `bunx vitest run` 全部通过
- [ ] `bunx playwright test e2e/workspace-tabs-smoke.spec.ts --grep "@workspace-v2"` 通过
- [ ] `VITE_ENABLE_WORKSPACE_TABS=0 bunx playwright test e2e/workspace-tabs-smoke.spec.ts --grep "@workspace-v2-rollback"` 通过
- [ ] `bun run lint` 通过
- [ ] `bun run build` 通过
- [ ] runtime/state 明确记录 v1 已被 v2 supersede，旧 Task 08 不再是 release gate
- [ ] `@workspace-v2` smoke 至少覆盖一个详情/表单多实例场景和一个 dirty close guard 场景
- [ ] `@workspace-v2` smoke 自动覆盖“tag 切换后状态保留”和“`page.reload()` 后状态回默认”两条核心产品语义
- [ ] `@workspace-v2` smoke 自动覆盖“首次打开新详情/表单 tag 时无空白 viewport/闪空”
- [ ] `rg -n \"workspace-route-page|workspace-route-state|WorkspaceRouteDefinition|use-bridged-search-adapter|product-workspace-definition|users-workspace-definition\" src/features/workspace-tabs src/features/products src/features/users src/routes` 的结果只允许出现在明确标记 deprecated / inventory-only 的遗留文件内

## Release Gate Matrix

| Gate | Mode | Scenario | Expected Result |
|------|------|----------|-----------------|
| `@workspace-v2` | flag-on | 列表页切到其他 tag 再切回 | table/filter/pagination 仍保留在同一页面实例内 |
| `@workspace-v2` | flag-on | 当前页执行 `page.reload()` | 页面实例重建，table/form 状态回默认或 preference seed |
| `@workspace-v2` | flag-on | 首次打开新详情/表单实例 | host 在同一导航周期渲染非空内容，无空白 viewport/闪空 |
| `@workspace-v2` | flag-on | 打开两个不同详情/表单实例 | 生成两个独立 tag，彼此状态隔离 |
| `@workspace-v2` | flag-on | dirty page 执行 close current / close other / close all | 统一走 `closeGuard`，拒绝时中止并聚焦被拒绝 tab |
| `@workspace-v2-rollback` | flag-off | 进入 dashboard 任一列表/详情页 | 无 tags、无 Activity host，但页面仍按 v2 internal state 工作 |

## Verification Strategy

`migration` 任务使用全量自动回归 + 有边界的手工验收。核心功能和 flag 分叉必须自动化；仅把真实浏览器中的滚动手感和重型页面体验留给手工核对。

## Manual Verification Exception

- `Waiver Reason:` 所有 dashboard 页面默认 keepAlive 后，长列表滚动位置、重型页面隐藏恢复和脏状态交互手感仍需真实浏览器观察。
- `Automated Smoke Check:` `bunx vitest run && bunx playwright test e2e/workspace-tabs-smoke.spec.ts --grep "@workspace-v2" && VITE_ENABLE_WORKSPACE_TABS=0 bunx playwright test e2e/workspace-tabs-smoke.spec.ts --grep "@workspace-v2-rollback" && bun run lint && bun run build`
- `Manual Verification Steps:` 启动 `bun run dev`，在 flag-on 下依次打开 overview、products、users、至少一个详情/表单页；确认 tags 切换后页面实例仍在，`page.reload()` 后状态回默认，脏页面关闭时出现统一确认；再切到 flag-off，确认 dashboard 无 tags shell、无 Activity host，但列表页和详情页仍按 v2 local state 运行。
- `Expected Results:` flag-on 下保活的是完整页面实例；flag-off 下只关闭 workspace 壳，不复活 v1 URL-table-state 链路。
- `Follow-up Automation:` `not needed`，核心分叉路径已由 Playwright 覆盖，剩余内容是体验级观察。

## Execution Recipe

1. 收口 feature flag，使 dashboard layout、tags、Activity host、route sync 都通过单点开关统一控制。
2. 写死 flag-off 目标：只关闭 workspace 壳，不复活 v1 `route-state / adapter / definition`；必要时补单测或 smoke 断言防止回退走偏。
3. 改写 Playwright smoke，新增 `@workspace-v2` 与 `@workspace-v2-rollback` 两条路径，并在 v2 smoke 中覆盖状态保留、reload 重置、详情/表单多实例与 dirty close guard。
4. 处理 workspace 侧 legacy 文件 owner：
   - `src/features/workspace-tabs/components/workspace-route-page.tsx`
   - `src/features/workspace-tabs/lib/workspace-route-state.ts`
   - `src/features/workspace-tabs/lib/workspace-route-state.test.ts`
   要么删除，要么保留为 inventory-only，但不得再被 flag-on 或 flag-off 主链路引用。
5. 跑 `rg` 零 import gate，确认 flag-on 主链路与 flag-off 主链路都不再依赖 v1 route-state / adapter / definition。
6. 在 runtime/review 中记录 v1 superseded、inventory 与 rollout 决策。
7. 跑完全量验证并完成手工验收。

## Notes For Executor

- 如果旧 Task 08 已有部分 flag wiring 或 smoke 代码可复用，必须先确认它不再依赖 v1 的 URL-table-state 假设，再决定是否复用。
- `page-cache` 是否继续存在，必须先做 inventory；若确认 workspace 主链路与 flag-off 都不需要它，应在后续 cleanup 计划中直接清退。
