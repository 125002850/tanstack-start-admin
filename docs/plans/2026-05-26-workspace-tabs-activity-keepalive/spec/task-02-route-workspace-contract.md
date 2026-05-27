# Task 02: Workspace 路由契约

**Depends on:** `none`
**Blocks:** `Task 03, Task 04, Task 05`
**Type:** `config`

## Goal

把 route static data 扩展为统一的 `workspace` 契约，落地首页 helper、标题推导和默认策略，同时显式让未迁移页面退出 keep-alive。

## Files

- Create: `src/lib/router/dashboard-home.ts`
- Create: `src/features/workspace-tabs/lib/route-workspace.ts`
- Create: `src/features/workspace-tabs/lib/route-workspace.test.ts`
- Create: `src/features/workspace-tabs/lib/dashboard-route-inventory.test.ts`
- Modify: `src/lib/router/app-route-meta.ts`
- Modify: `src/routes/index.tsx`
- Modify: `src/routes/dashboard.tsx`
- Modify: `src/routes/dashboard/index.tsx`
- Modify: `src/routes/dashboard/overview.tsx`
- Modify: `src/routes/dashboard/chat.tsx`
- Modify: `src/routes/dashboard/notifications.tsx`
- Modify: `src/routes/dashboard/react-query.tsx`
- Modify: `src/routes/dashboard/kanban.tsx`
- Modify: `src/routes/dashboard/forms/index.tsx`
- Modify: `src/routes/dashboard/forms/basic.tsx`
- Modify: `src/routes/dashboard/forms/multi-step.tsx`
- Modify: `src/routes/dashboard/forms/advanced.tsx`
- Modify: `src/routes/dashboard/forms/sheet-form.tsx`
- Modify: `src/routes/dashboard/elements/icons.tsx`
- Modify: `src/routes/dashboard/product/$productId.tsx`
- Reference: `README.md`

## Invariants

- `defineRouteMeta()` 现有 `label/title/nav/page/breadcrumb` 语义必须保持向后兼容。
- 根路由与 `/dashboard/` 的首页重定向目标必须继续是 `/dashboard/overview`。
- `staticData.title ?? staticData.label` 仍然是 TagsBar 的标题来源第一优先级。
- `keepAlive=true` 只代表 route 声明层意图；真正进入 keep-alive host 仍然要求 descriptor 已注册。

## Constraints

- 本任务只建立元数据和 helper 契约，不引入 tags UI，不修改列表页查询逻辑。
- 所有尚未 screen 化迁移的 dashboard 子页面都要显式写 `workspace: { keepAlive: false }`，避免后续 shell 接入时误进保活路径。
- `src/routes/dashboard.tsx` 作为 layout route 必须显式 `workspace: { tagEnabled: false, keepAlive: false }`。
- 需要新增一份 route inventory 测试，明确锁住当前 dashboard 子路由里只有 `/dashboard/product/` 和 `/dashboard/users` 保持 `keepAlive !== false`；以后新增路由若忘记显式标注，这个测试必须先失败。

## Acceptance Criteria

- [ ] `bunx vitest run src/features/workspace-tabs/lib/route-workspace.test.ts src/features/workspace-tabs/lib/dashboard-route-inventory.test.ts` 通过
- [ ] `bun run lint` 通过
- [ ] `bun run build` 通过
- [ ] `resolveDashboardHomeHref()` 被 `/` 与 `/dashboard/` 两个 redirect 入口共用
- [ ] route inventory 测试断言当前 dashboard routes 中仅 product/users 保持 `keepAlive !== false`

## Verification Strategy

`config` 任务使用构建 + 纯函数测试。默认值推导、标题回退、path-param 实例策略都是确定性逻辑，应该用单测锁住。

## Execution Recipe

1. 在 `src/lib/router/app-route-meta.ts` 中新增 `AppRouteWorkspaceData`，并保持 `getAppRouteStaticData()` 兼容旧 route。
2. 在 `src/features/workspace-tabs/lib/route-workspace.ts` 中实现：
   - `resolveRouteWorkspaceConfig(routePath, staticData)`
   - `resolveRouteTagTitle(staticData, routeId)`
3. 新建 `src/lib/router/dashboard-home.ts`，导出 `resolveDashboardHomeHref()` 与 `isDashboardHomeHref()`，并改写 `/` 与 `/dashboard/` redirect 入口。
4. 给所有未迁移 route 显式添加 `workspace: { keepAlive: false }`；给 layout route 添加 `tagEnabled: false`。
5. 在 `src/features/workspace-tabs/lib/route-workspace.test.ts` 中覆盖：
   - 默认 `tagEnabled=true`
   - 默认 `keepAlive=true`
   - path 参数 route 默认 `instanceStrategy='by-params'`
   - `title -> label -> page.title -> routeId` 回退顺序
6. 新建 `src/features/workspace-tabs/lib/dashboard-route-inventory.test.ts`，直接导入当前所有 dashboard route modules，断言：
   - `/dashboard/product/`、`/dashboard/users` 保持 `keepAlive !== false`
   - 其余 dashboard 子路由显式 `keepAlive === false`
7. 运行 `bunx vitest run src/features/workspace-tabs/lib/route-workspace.test.ts src/features/workspace-tabs/lib/dashboard-route-inventory.test.ts`、`bun run lint`、`bun run build`。
8. 提交建议：`git commit -m "config: add workspace route contract"`

## Notes For Executor

- `routePath` 使用 TanStack Router 的 route path 字符串本身，例如 `/dashboard/product/$productId`；不要用运行时 href 反推。
- 非迁移页面现在显式 `keepAlive: false` 是过渡策略，不是否定默认值模型。
