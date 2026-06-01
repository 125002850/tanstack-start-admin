# Task 04: Sidebar KBar Switch Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this task and then move directly into Task 05 after review approval.

**Goal:** 让 sidebar 与 KBar 改为消费路由派生数据，并删除 `src/config/nav-config.ts`。

**Architecture:** 本 task 只切换消费方，不在这里处理回归修复策略；但实现必须为 Task 05 留下稳定的验证面。容器节点不再依赖 `'#'`，统一使用 `linkable !== false` 判定是否可跳转。

**Tech Stack:** React 19、TanStack Router v1、kbar

---

## 拓扑位置

- **Depends On:** `Task 03`
- **Unlocks:** `Task 05`
- **Parallel:** 不允许

## 资深架构师 Review Gate

- 本 task 完成并通过验证后，必须向资深架构师提交：
  - `git diff --stat`
  - `npm run build` 结果
  - `npm run lint` 结果
  - `rg -n "nav-config" src` 结果
- 本 task review 通过后必须立即进入 `Task 05`，不得插入其他 task。

## Files

- Modify: `src/components/layout/app-sidebar.tsx`
- Modify: `src/components/kbar/index.tsx`
- Delete: `src/config/nav-config.ts`

## Step 1: 侧边栏切换到 `useRouter()` + `buildNavGroupsFromRoutes()`

在 `app-sidebar.tsx` 中删除：

- `import { navGroups } from '@/config/nav-config'`

改为：

- 通过 `const router = useRouter()` 获取 `routesById`
- 通过 `buildNavGroupsFromRoutes(router.routesById)` 生成 `navGroups`
- 再交给 `useFilteredNavGroups()`

## Step 2: 明确三条渲染路径的 `linkable` 规则

- 叶子项路径：`hasChildren === false`
  - `linkable !== false` 时渲染 `<Link to={item.url}>`
  - `linkable === false` 时渲染纯文本内容，不生成 Link
- 折叠 flyout 路径：`isCollapsedDesktop === true`
  - 顶部 `DropdownMenuLabel` 始终显示容器标题
  - “前往当前页”这一条仅在 `linkable !== false` 时渲染
  - 子项仍按各自 `linkable` 判定是否生成 Link
- 展开 collapsible 路径
  - `CollapsibleTrigger` 只承担展开/收起职责，不承担导航
  - 子项按钮按 `linkable` 判定是否生成 Link

## Step 3: KBar 改用稳定 route-derived actions

在 `src/components/kbar/index.tsx` 中：

- 去掉 `nav-config` import
- 复用和 sidebar 相同的 `navGroups`
- `action.id` 改为 `navItem.id`
- 子项 `section` 使用容器标题或分组标题

目标写法：

```ts
id: navItem.id;
perform: () => router.navigate({ to: navItem.url });
```

仅在 `linkable !== false` 时生成 action。

## Step 4: 删除旧中心配置

删除：

- `src/config/nav-config.ts`

确认仓库内无残留引用：

Run: `rg -n "nav-config" src`

Expected:

- 无结果

## Step 5: Run verification

Run: `npm run build`

Run: `npm run lint`

Expected:

- 两条命令都退出 0
- 无 `linkable` 判定遗漏导致的 JSX/导航类型报错

## Step 6: Commit

```bash
git add src/components/layout/app-sidebar.tsx src/components/kbar/index.tsx src/config/nav-config.ts
git commit -m "refactor: drive sidebar and kbar from route metadata"
```

## Step 7: 请求资深架构师 Review

- 提交三条渲染路径的改法、删除 `nav-config.ts` 的证据和验证结果
- review 通过后，必须立即进入 `Task 05`

---

## Review (2026-05-22)

**实际完成项与任务定义的差异：**

- KBar 子项 action 首次提交遗漏了 `linkable` 过滤（仅顶层 base action 做了守卫），review 发现后补充了 `.filter(childItem => childItem.linkable !== false)`

**阻塞项或未预期的技术债务：**

- 无

**后续行动项：**

- 无
