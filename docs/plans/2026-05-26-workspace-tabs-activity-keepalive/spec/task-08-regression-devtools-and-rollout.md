# Task 08: 浏览器级 Smoke、Devtools 与 Rollout

**Depends on:** `Task 06, Task 07`
**Blocks:** `none`
**Type:** `migration`

## Goal

完成 workspace 功能的浏览器级 smoke、开发态观测层和 feature-flag rollout，使新旧链路可切换，并把 `page-cache` 留作一版回滚兜底而不是立即物理删除。

## Files

- Create: `src/config/workspace-tabs.ts`
- Create: `src/features/workspace-tabs/lib/workspace-devtools.ts`
- Modify: `env.example.txt`
- Modify: `playwright.config.ts`
- Modify: `e2e/workspace-tabs-smoke.spec.ts`
- Modify: `src/routes/dashboard.tsx`
- Modify: `src/routes/dashboard/product/index.tsx`
- Modify: `src/routes/dashboard/users.tsx`
- Modify: `src/features/workspace-tabs/utils/store.ts`
- Modify: `src/features/workspace-tabs/hooks/use-workspace-tags.ts`
- Reference: `src/features/products/components/product-page-cache-bindings.tsx`
- Test: `src/features/workspace-tabs/utils/store.test.ts`
- Test: `src/features/workspace-tabs/components/workspace-routing.integration.test.tsx`
- Test: `src/features/products/workspace/product-workspace-definition.test.ts`
- Test: `src/features/users/workspace/users-workspace-definition.test.ts`
- Reference: `src/lib/page-cache/*`

## Invariants

- devtools 只能在开发环境挂载，不能把任何调试 UI 带进生产 bundle 可见路径。
- feature flag 关闭时，dashboard 必须完全回到旧链路：无 `TagsBar`、无 `WorkspaceViewport`、产品页继续可用 `page-cache`、用户页继续走旧 `PageContainer + UserListingPage`。
- 所有 dashboard 页面当前 URL 仍然是浏览器标题、Sidebar 高亮和 Infobar 的真相来源。

## Constraints

- 本任务不物理删除 `src/lib/page-cache/*`；只允许把它们标注为 rollback-only / deprecated。
- feature flag 必须是单点入口，例如 `src/config/workspace-tabs.ts` 中的 `isWorkspaceTabsEnabled()`；业务代码不得各自读取裸 `import.meta.env`。
- 浏览器级 smoke 只扩到两条关键路径：
  - `@workspace`：flag-on 下打开两个 tags、切换、确认 DOM 保留与 hard refresh 重建
  - `@workspace-rollback`：flag-off 下确认 dashboard 完全退回旧链路，产品/用户列表继续可用

## Acceptance Criteria

- [ ] `bunx vitest run` 全部通过
- [ ] `bunx playwright test e2e/workspace-tabs-smoke.spec.ts --grep "@workspace"` 通过
- [ ] `VITE_ENABLE_WORKSPACE_TABS=0 bunx playwright test e2e/workspace-tabs-smoke.spec.ts --grep "@workspace-rollback"` 通过
- [ ] `bun run lint` 通过
- [ ] `bun run build` 通过
- [ ] 关闭 feature flag 时，产品/用户列表继续走旧链路且功能不丢

## Verification Strategy

`migration` 任务使用全量自动回归 + 有边界的手工验收。这里已经有 Playwright smoke，因此手工部分只保留那些必须观察布局和真实滚动手感的路径。

## Manual Verification Exception

- `Waiver Reason:` tags 横向滚动手感、ContextMenu 定位、表格长列表滚动位置在真实浏览器中的体验细节仍不适合完全自动化。
- `Automated Smoke Check:` `bunx vitest run && bunx playwright test e2e/workspace-tabs-smoke.spec.ts --grep "@workspace" && VITE_ENABLE_WORKSPACE_TABS=0 bunx playwright test e2e/workspace-tabs-smoke.spec.ts --grep "@workspace-rollback" && bun run lint && bun run build`
- `Manual Verification Steps:` 启动 `bun run dev`，按顺序执行：
  1. 设 `VITE_ENABLE_WORKSPACE_TABS=1`，访问 `/dashboard/product`，输入 `身体乳`，设 `perPage=50`，滚动表格到中段。
  2. 打开 `/dashboard/users`，选择任意角色筛选并翻到第 2 页。
  3. 左键在产品/用户/概览 tags 间切换，确认各自状态保持。
  4. 右键用户 tag 验证“刷新 / 关闭其他 / 关闭所有”。
  5. 把 `VITE_ENABLE_WORKSPACE_TABS=0` 后重启 dev server，再访问产品/用户列表，确认旧链路可用。
- `Expected Results:` workspace 打开时，产品/用户状态保持且右键动作正常；workspace 关闭时，应用完全退回旧路由渲染链路；`page-cache` 文件仍存在但只承担 rollback 角色。
- `Follow-up Automation:` `not needed`，关键路径已由 Playwright 覆盖，剩余内容是布局/交互体验级验证。

## Execution Recipe

1. 新建 `src/config/workspace-tabs.ts`，统一读取 `VITE_ENABLE_WORKSPACE_TABS`，并提供 `isWorkspaceTabsEnabled()`。
2. 修改 `dashboard.tsx`、产品 route、用户 route：当 flag 关闭时走旧链路；打开时走 workspace shell。
3. 在 `workspace-devtools.ts` 中实现开发态调试面板或 console bridge，并从 store/viewport 收集最近事件。
4. 扩展 `e2e/workspace-tabs-smoke.spec.ts`，新增 `@workspace` smoke：
   - 打开产品页和用户页两个 tags
   - 切换后断言上一个列表 DOM 未丢
   - 刷新当前页后断言 URL 可重建状态
5. 在同一 `e2e/workspace-tabs-smoke.spec.ts` 中新增 `@workspace-rollback` smoke，并在 CI/命令行通过 `VITE_ENABLE_WORKSPACE_TABS=0` 运行，断言：
   - dashboard 不渲染 `TagsBar` / `WorkspaceViewport`
   - 产品列表仍走旧 `page-cache` 链路并可正常搜索/翻页
   - 用户列表仍走旧 `PageContainer + UserListingPage` 链路并可正常翻页
6. 不修改 `src/lib/page-cache/*` 的行为代码；只在 runtime/review 中记录它与 `ProductPageCacheBindings` 当前仅承担 rollback 角色，下一版再做物理删除计划。
7. 运行 `bunx vitest run`、`bunx playwright test e2e/workspace-tabs-smoke.spec.ts --grep "@workspace"`、`VITE_ENABLE_WORKSPACE_TABS=0 bunx playwright test e2e/workspace-tabs-smoke.spec.ts --grep "@workspace-rollback"`、`bun run lint`、`bun run build`。
8. 完成手工验收清单，并把结果记录进 `runtime/task-08-log.md` 与对应 review。
9. 提交建议：`git commit -m "feat: add workspace rollout guard and smoke coverage"`

## Notes For Executor

- feature flag 默认值可以是 `1`，但必须允许通过环境变量一键关闭；是否在生产默认打开由发布阶段决定，不在本任务里写死。
- `page-cache` 的物理删除应在下一版独立 cleanup plan 中完成，不与首次 rollout 绑在一起。
