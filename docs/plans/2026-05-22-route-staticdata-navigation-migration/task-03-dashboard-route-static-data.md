# Task 03: Dashboard Route StaticData Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this task and stop for review before continuing.

**Goal:** 为 dashboard 相关路由补齐 `staticData`，并把文档标题从分散字符串收口到 route-local 常量。

**Architecture:** 所有可见 dashboard 路由就地声明 `label`、`nav`、`breadcrumb` 与可选 `page` 字段；详情/重定向路由只声明自己需要的最小 metadata。`head().meta` 继续保留，但必须从 `staticData` 常量派生。

**Tech Stack:** TypeScript、TanStack Router v1、React 19

---

## 拓扑位置

- **Depends On:** `Task 02`
- **Unlocks:** `Task 04`
- **Parallel:** 不允许

## 资深架构师 Review Gate

- 本 task 完成并通过验证后，必须向资深架构师提交：
  - `git diff --stat`
  - `npm run build` 结果
  - `git diff -- src/routeTree.gen.ts` 结果
  - 路由 metadata 映射摘要
- 未获得“通过”结论前，不得开始 `Task 04`。

## Files

- Modify: `src/routes/dashboard.tsx`
- Modify: `src/routes/dashboard/index.tsx`
- Modify: `src/routes/dashboard/overview.tsx`
- Modify: `src/routes/dashboard/product/index.tsx`
- Modify: `src/routes/dashboard/product/$productId.tsx`
- Modify: `src/routes/dashboard/users.tsx`
- Modify: `src/routes/dashboard/kanban.tsx`
- Modify: `src/routes/dashboard/chat.tsx`
- Modify: `src/routes/dashboard/notifications.tsx`
- Modify: `src/routes/dashboard/react-query.tsx`
- Modify: `src/routes/dashboard/forms/index.tsx`
- Modify: `src/routes/dashboard/forms/basic.tsx`
- Modify: `src/routes/dashboard/forms/multi-step.tsx`
- Modify: `src/routes/dashboard/forms/sheet-form.tsx`
- Modify: `src/routes/dashboard/forms/advanced.tsx`
- Modify: `src/routes/dashboard/elements/icons.tsx`

## Step 1: 给 `/dashboard` 布局路由添加 breadcrumb 元数据

在 `src/routes/dashboard.tsx` 中添加：

```ts
const staticData = defineAppRouteStaticData({
  label: '控制台',
  breadcrumb: { label: '控制台' },
})
```

该路由不提供 `nav`。

## Step 2: 给所有可见页面路由补 `label` 与 `nav`

至少覆盖以下映射：

- `overview`: `group='overview'`, `order=10`, `icon='dashboard'`
- `product`: `group='overview'`, `order=20`, `icon='product'`
- `users`: `group='overview'`, `order=30`, `icon='teams'`
- `kanban`: `group='overview'`, `order=40`, `icon='kanban'`
- `chat`: `group='overview'`, `order=50`, `icon='chat'`
- `forms` 容器：`group='components'`, `order=10`, `kind='container'`, `icon='forms'`, `linkable=false`
- `react-query`: `group='components'`, `order=20`, `icon='code'`
- `icons`: `group='components'`, `order=30`, `icon='palette'`
- `notifications`: `group='account'`, `order=10`, `icon='notification'`

## Step 3: 给表单子路由补子项元数据

`basic` / `multi-step` / `sheet-form` / `advanced` 都应：

- 提供 `label`
- 提供 `nav.visible=true`
- 显式提供 `nav.parentId='/dashboard/forms'`
- 必要时允许 `shortcut`

示例：

```ts
nav: {
  visible: true,
  group: 'components',
  order: 11,
  parentId: '/dashboard/forms',
}
```

## Step 4: 给详情或重定向路由补“可见但不入菜单”语义

- `src/routes/dashboard/index.tsx` 仅保留重定向，不提供 `nav`
- `src/routes/dashboard/product/$productId.tsx` 提供 `label` / `documentTitle` / 可选 breadcrumb，但不提供 `nav`

示例：

```ts
breadcrumb: {
  label: '产品详情',
}
```

## Step 5: 用 `staticData` 常量回填 `head().meta`

每个已声明文档标题的 route 都按以下模式收口：

```ts
head: () => ({ meta: [{ title: staticData.documentTitle ?? staticData.label }] })
```

## Step 6: Run verification

Run: `npm run build`

Run: `git diff -- src/routeTree.gen.ts`

Expected:

- route files 全部通过类型检查
- `routeTree.gen.ts` 如有更新，应明确纳入本 task 提交
- 若 `routeTree.gen.ts` 未更新，记录原因

## Step 7: Commit

```bash
git add src/routes/dashboard.tsx src/routes/dashboard/index.tsx src/routes/dashboard/overview.tsx src/routes/dashboard/product/index.tsx src/routes/dashboard/product/\$productId.tsx src/routes/dashboard/users.tsx src/routes/dashboard/kanban.tsx src/routes/dashboard/chat.tsx src/routes/dashboard/notifications.tsx src/routes/dashboard/react-query.tsx src/routes/dashboard/forms/index.tsx src/routes/dashboard/forms/basic.tsx src/routes/dashboard/forms/multi-step.tsx src/routes/dashboard/forms/sheet-form.tsx src/routes/dashboard/forms/advanced.tsx src/routes/dashboard/elements/icons.tsx src/routeTree.gen.ts
git commit -m "refactor: add route staticData for dashboard navigation"
```

## Step 8: 请求资深架构师 Review

- 提交路由映射表、`routeTree.gen.ts` 状态和验证结果
- 仅在 review 明确通过后，才能进入 `Task 04`

---

## Review (2026-05-22)

**实际完成项与任务定义的差异：**

- 无

**阻塞项或未预期的技术债务：**

- `routeTree.gen.ts` 未变更，原因是 `staticData` 为 TanStack Router 运行时选项，不影响文件路由的生成结构

**后续行动项：**

- 无
