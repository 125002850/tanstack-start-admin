# Task 01: App Route StaticData Contract Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this task and stop for review before continuing.

**Goal:** 建立统一的 `AppRouteStaticData` 契约、缩窄 helper 与 `NavItem` 类型边界，为后续所有路由 metadata 与菜单派生任务提供稳定底座。

**Architecture:** 本 task 只做类型与 helper，不碰具体页面路由实现。关键是保留 TanStack Router 现有的 `Register { router }` 声明，同时增加显式 narrowing helper，避免在 `router.routesById` 上游走 `any`。

**Tech Stack:** TypeScript、TanStack Router v1

---

## 拓扑位置

- **Depends On:** 无
- **Unlocks:** `Task 02`
- **Parallel:** 不允许

## 资深架构师 Review Gate

- 本 task 完成并通过验证后，必须向资深架构师提交：
  - `git diff --stat`
  - `npm run build` 结果
  - 新增类型与 helper 的摘要说明
- 未获得“通过”结论前，不得开始 `Task 02`。

## Files

- Create: `src/lib/router/app-route-meta.ts`
- Modify: `src/router.tsx`
- Modify: `src/types/index.ts`

## Step 1: 创建 `AppRouteStaticData` 类型与 helper

在 `src/lib/router/app-route-meta.ts` 中定义：

- `AppNavGroupKey`
- `AppRouteStaticData`
- `defineAppRouteStaticData()`
- `isAppRouteStaticData()`
- `getAppRouteStaticData()`
- `NAV_GROUP_META`

目标结构：

```ts
export const NAV_GROUP_META = {
  overview: { label: '概览', order: 10 },
  components: { label: '组件', order: 20 },
  account: { label: '账户', order: 30 },
} as const
```

## Step 2: 收紧导航类型

修改 `src/types/index.ts`：

- 给 `NavItem` 增加稳定 `id: string`
- 保留 `url: string` 作为真实目标地址，不再使用 `'#'` 哨兵值
- 增加 `linkable?: boolean`
- 将 `isActive` 从持久字段改为纯运行时计算，不再要求配置提供
- 保留 `icon`、`shortcut`、`items`

建议目标结构：

```ts
export interface NavItem {
  id: string
  title: string
  url: string
  linkable?: boolean
  shortcut?: [string, string]
  icon?: keyof typeof Icons
  items?: NavItem[]
}
```

## Step 3: 明确 Router 类型接入边界

`src/router.tsx` 已有：

```ts
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
```

本 task 的要求：

- 保持这段声明不丢失
- 不要发明不存在的 `Register.staticData` 扩展
- 对 `router.routesById` 遍历场景统一使用 `getAppRouteStaticData()` narrowing helper

## Step 4: Run verification

Run: `npm run build`

Expected:

- 构建成功
- 新增类型文件可被现有 imports 解析

## Step 5: Commit

```bash
git add src/lib/router/app-route-meta.ts src/router.tsx src/types/index.ts
git commit -m "refactor: define app route static data contract"
```

## Step 6: 请求资深架构师 Review

- 整理本 task 的 diff 与验证结果
- 发起 review
- 仅在 review 明确通过后，才能进入 `Task 02`

---

## Review (2026-05-22)

**实际完成项与任务定义的差异：**

- 额外修改了 `src/components/kbar/index.tsx`（review 中发现的 blocker）：`url !== '#'` 哨兵检查替换为 `linkable !== false`，KBar action id 改用 `navItem.id` / `childItem.id`
- `AppRouteStaticData` 在第一版使用了扁平字段（`title`/`navGroup`/`navOrder`），review 指出与下游 Task 02/03 的 `label`/`documentTitle`/`breadcrumb`/`nav`/`page` 嵌套结构不匹配，第二轮修正对齐

**阻塞项或未预期的技术债务：**

- 无

**后续行动项：**

- 无

