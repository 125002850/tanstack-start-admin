# Task 07: Breadcrumb README Cleanup Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this task as an optional parallel branch after Task 05 approval.

**Goal:** 清理无效 breadcrumb 逻辑与 README 中过期的导航配置说明，使文档和运行时结构一致。

**Architecture:** 本 task 不再触碰菜单派生主链，只清理未被消费的 breadcrumb hook 和文档描述。若保留 breadcrumb hook，则实现必须基于 `useMatches()` + `staticData.breadcrumb`。

**Tech Stack:** React 19、TanStack Router v1、TypeScript、Markdown

---

## 拓扑位置

- **Depends On:** `Task 05`
- **Unlocks:** 无
- **Parallel:** 允许，与 `Task 06` 并行

## 资深架构师 Review Gate

- 本 task 完成并通过验证后，必须向资深架构师提交：
  - `git diff --stat`
  - `npm run build` 结果
  - `npm run lint` 结果
  - `npm run format:check` 结果
- 本 task 即使通过，也不能单独关闭总计划；仍需等待 `Task 06` 一并通过。

## Files

- Modify: `src/hooks/use-breadcrumbs.tsx`
- Modify: `README.md`

## Step 1: 处理 breadcrumb hook

由于 `useBreadcrumbs()` 当前无调用方，二选一：

- 若本轮想保留：改为基于 `useMatches()` + `match.staticData.breadcrumb`
- 若本轮不保留：删除该 hook，并确认仓库内无引用

推荐本轮保留，但实现为最小版本：

```ts
const breadcrumbs = useMatches({
  select: (matches) =>
    matches
      .filter((m) => !m.staticData?.breadcrumb?.hide)
      .map((m) => ({
        title: m.staticData?.breadcrumb?.label ?? m.staticData?.label,
        link: m.pathname,
      })),
})
```

## Step 2: 更新 README 中的配置描述

更新 `README.md` 中关于 `src/config/` 的说明，删除“navigation 配置”表述，避免文档与真实结构不一致。

## Step 3: Run verification

Run: `npm run build`

Run: `npm run lint`

Run: `npm run format:check`

Run: `git diff -- src/routeTree.gen.ts`

Expected:

- 所有命令退出 0
- `src/routeTree.gen.ts` 状态已确认并按需提交
- README 与代码结构一致

## Step 4: Commit

```bash
git add src/hooks/use-breadcrumbs.tsx README.md
git commit -m "docs: align route metadata navigation documentation"
```

## Step 5: 请求资深架构师 Review

- 提交 breadcrumb 处理策略、文档更新点与验证结果
- 等待 review 通过，同时等待 `Task 06` 也通过后，才能关闭总计划

---

## Review (2026-05-25)

**实际完成项与任务定义的差异：**

- `useBreadcrumbs()` 选择了“保留最小实现”路径，但没有继续扩展 task 示例里提到的 `breadcrumb.hide` 语义，因为共享 route 契约里并不存在该字段；最终实现只消费 `breadcrumb.label` / `breadcrumb.to`
- `README.md` 的语义改动只有 `src/config/` 描述修正，但由于 `oxfmt` 会重排 Markdown 表格，对整份 README 产生了格式化噪声 diff

**阻塞项或未预期的技术债务：**

- 仓库级 `npm run format:check` 仍受大量无关既有文件的格式基线影响，不能仅凭本 task 清零

**后续行动项：**

- `TODO P2`：在独立清理批次中收敛仓库级 Markdown / 文档格式基线，再恢复 `npm run format:check` 作为全量 gate
