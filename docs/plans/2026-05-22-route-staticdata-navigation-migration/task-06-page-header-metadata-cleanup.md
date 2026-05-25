# Task 06: Page Header Metadata Cleanup Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this task as an optional parallel branch after Task 05 approval.

**Goal:** 把页面头部标题、描述、`infoContent` 的默认来源进一步收口到 route metadata，减少 `PageContainer` 与 feature 组件中的重复声明。

**Architecture:** `PageContainer` 读取当前激活 route 的 `staticData.page` 作为默认值；调用方显式传入时仍优先显式参数。这个 task 是第二阶段清理，不阻塞 `nav-config.ts` 的删除，但属于整体迁移收尾。

**Tech Stack:** React 19、TanStack Router v1、TypeScript

---

## 拓扑位置

- **Depends On:** `Task 05`
- **Unlocks:** 无
- **Parallel:** 允许，与 `Task 07` 并行

## 资深架构师 Review Gate

- 本 task 完成并通过验证后，必须向资深架构师提交：
  - `git diff --stat`
  - `npm run build` 结果
  - `npm run lint` 结果
  - 页面头部回填策略说明
- 本 task 即使通过，也不能单独关闭总计划；仍需等待 `Task 07` 一并通过。

## Files

- Modify: `src/components/layout/page-container.tsx`
- Modify: `src/routes/dashboard/users.tsx`
- Modify: `src/routes/dashboard/react-query.tsx`
- Modify: `src/routes/dashboard/forms/basic.tsx`
- Modify: `src/routes/dashboard/forms/multi-step.tsx`
- Modify: `src/routes/dashboard/forms/sheet-form.tsx`
- Modify: `src/routes/dashboard/forms/advanced.tsx`
- Modify: `src/features/notifications/components/notifications-page.tsx`
- Modify: `src/features/elements/components/icons-view-page.tsx`
- Modify: `src/features/kanban/components/kanban-view-page.tsx`

## Step 1: 让 `PageContainer` 支持从当前 route 读取默认 page meta

实现思路：

- 在 `PageContainer` 内部读取当前激活 route 的 `staticData.page`
- 当调用方未显式传 `pageTitle` / `pageDescription` / `infoContent` 时，自动回退到 route meta

目标逻辑：

```ts
const routePageMeta = currentRouteStaticData?.page
const resolvedTitle = pageTitle ?? routePageMeta?.title ?? ''
```

## Step 2: 把 route 层能声明的页面头部信息迁回 route

至少迁移：

- `users`
- `react-query`
- 四个 forms 页面

这些路由本来就在 route 文件里传 `PageContainer` props，迁移成本最低。

## Step 3: 清理 feature 组件内部的重复标题

对 `notifications-page.tsx`、`icons-view-page.tsx`、`kanban-view-page.tsx`：

- 删除硬编码 `pageTitle` / `pageDescription`
- 改为依赖 route meta 回填

## Step 4: Run verification

Run: `npm run build`

Run: `npm run lint`

手动检查：

- 页面头部标题与描述未丢失
- Info button 内容正常

## Step 5: Commit

```bash
git add src/components/layout/page-container.tsx src/routes/dashboard/users.tsx src/routes/dashboard/react-query.tsx src/routes/dashboard/forms/basic.tsx src/routes/dashboard/forms/multi-step.tsx src/routes/dashboard/forms/sheet-form.tsx src/routes/dashboard/forms/advanced.tsx src/features/notifications/components/notifications-page.tsx src/features/elements/components/icons-view-page.tsx src/features/kanban/components/kanban-view-page.tsx
git commit -m "refactor: read page header metadata from routes"
```

## Step 6: 请求资深架构师 Review

- 提交默认回填策略、验证结果和可能的兼容性风险
- 等待 review 通过，同时等待 `Task 07` 也通过后，才能关闭总计划

---

## Review (2026-05-25)

**实际完成项与任务定义的差异：**

- `AppPageData` 额外补充了 `infoContent`，并把 `users` / `react-query` 的 info button 内容也一并迁入 route `staticData.page`，不再只迁移标题与描述
- `PageContainer` 没有继续直接读取 `match.staticData`，而是改为通过 `router.routesById[match.routeId]` 调用 `getAppRouteStaticData()`，复用单一的运行时收口 helper

**阻塞项或未预期的技术债务：**

- `react-query` 页面在独立浏览器抽查时仍可能触发 `Cannot read properties of undefined (reading 'isDehydrated')` 的既有 hydration 问题；这不是本 task 引入的，但影响该页面的稳定性判断

**后续行动项：**

- `FIXME P1`：排查 `react-query` 页面在独立打开时的 hydration 错误，确认是 TanStack Query SSR 集成问题还是 demo 页面自身数据流问题
