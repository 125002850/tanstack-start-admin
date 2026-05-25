# Task 02: Route Nav Runtime Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this task and stop for review before continuing.

**Goal:** 实现从 Router 运行时派生菜单树的能力，替代中心化 `nav-config.ts` 的数据来源。

**Architecture:** 运行时通过 `router.routesById` 收集 `staticData.nav.visible=true` 的 route，用显式 `nav.parentId` 构造菜单父子关系，并通过统一排序规则输出 `NavGroup[]`。本 task 不切换 UI 消费方，只实现派生层。

**Tech Stack:** TypeScript、TanStack Router v1

---

## 拓扑位置

- **Depends On:** `Task 01`
- **Unlocks:** `Task 03`
- **Parallel:** 不允许

## 资深架构师 Review Gate

- 本 task 完成并通过验证后，必须向资深架构师提交：
  - `git diff --stat`
  - `npm run build` 结果
  - `buildNavGroupsFromRoutes()` 的父子算法摘要
- 未获得“通过”结论前，不得开始 `Task 03`。

## Files

- Create: `src/lib/router/route-nav.ts`
- Modify: `src/hooks/use-nav.ts`

## Step 1: 在 `route-nav.ts` 中实现路由筛选

实现：

```ts
export function buildNavGroupsFromRoutes(
  routesById: Record<string, AnyRoute>,
): NavGroup[] {
  // ...
}
```

筛选规则：

- 只处理 `fullPath` 以 `/dashboard` 开头的路由
- 只处理带 `staticData.nav` 且 `visible=true` 的路由
- 容器路由保留为顶层/子层节点
- `NavItem.url` 一律使用真实 route `fullPath`
- 是否生成跳转行为由 `linkable` 决定，而不是 `url` 是否存在

## Step 2: 明确父子关系算法

实现以下逻辑：

- 先遍历 `routesById`，通过 `getAppRouteStaticData(route)` 收集所有 `nav.visible=true` 的 route
- 建立 `visibleRoutesByFullPath` 映射，key 使用 route `fullPath`
- 对每个可见 route 读取 `nav.parentId`
- 若 `nav.parentId` 存在，则把该 route 归到对应容器；若目标容器不存在或不是 `kind='container'`，直接抛显式错误
- 若 `nav.parentId` 不存在，则作为顶层项挂载到所属 `group`
- 明确禁止使用裸 `startsWith()` 前缀匹配来推导容器关系

推荐实现骨架：

```ts
for (const route of visibleRoutes) {
  const meta = getAppRouteStaticData(route)!
  const parentId = meta.nav?.parentId

  if (parentId) {
    const parent = visibleRoutesByFullPath.get(parentId)
    invariant(parent && getAppRouteStaticData(parent)?.nav?.kind === 'container')
    attachChild(parent, route)
    continue
  }

  attachTopLevel(route)
}
```

说明：

- 当前项目不能依赖 `route.parentRoute` 来实现“表单”菜单树，因为生成的 route tree 中 `basic/multi-step/...` 的父节点是 `dashboard`，不是 `/dashboard/forms/`
- `route.parentRoute` 仍可用于“筛选 dashboard 子树”或辅助调试，但不能承担菜单容器归并职责

## Step 3: 在 `use-nav.ts` 中切换到稳定 id 过滤

当前 `useFilteredNavGroups()` 用标题做去重键。改为：

- 使用 `item.id` 作为稳定 identity
- 不再依赖 `title` 去重

## Step 4: Run verification

Run: `npm run build`

Expected:

- `route-nav.ts` 无类型错误
- `use-nav.ts` 对新 `NavItem` 结构兼容

## Step 5: Commit

```bash
git add src/lib/router/route-nav.ts src/hooks/use-nav.ts
git commit -m "refactor: derive nav groups from router metadata"
```

## Step 6: 请求资深架构师 Review

- 提交派生算法、invariant 规则、验证结果
- 仅在 review 明确通过后，才能进入 `Task 03`

---

## Review (2026-05-22)

**实际完成项与任务定义的差异：**

- 新增 `normalizePath()` helper 以处理 TanStack Router 生成的 fullPath 尾斜杠差异（如 `/dashboard/forms/` vs `/dashboard/forms`），在 Map 查找时统一规范化，NavItem.url 仍保留真实 fullPath

**阻塞项或未预期的技术债务：**

- 无

**后续行动项：**

- 无
