# Task 05: Navigation Regression Verification Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this task and stop for review before opening any parallel branch.

**Goal:** 完成菜单相关行为验证，并把 Task 04 切换带来的 UI/交互回归修复干净。

**Architecture:** 这是 Task 04 的连续执行波次，负责验证与修补，不再做新的架构迁移。完成并 review 通过后，才允许打开 `Task 06` / `Task 07` 并行分支。

**Tech Stack:** React 19、TanStack Router v1、kbar

---

## 拓扑位置

- **Depends On:** `Task 04`
- **Unlocks:** `Task 06`、`Task 07`
- **Parallel:** 不允许；这是并行分支前的最后串行闸门

## 资深架构师 Review Gate

- 本 task 完成并通过验证后，必须向资深架构师提交：
  - `git diff --stat`
  - 导航结构验证结果
  - KBar 行为验证结果
  - 若有修复，说明修复点与回归原因
- 只有 review 通过后，才允许开始 `Task 06` / `Task 07`。

## Files

- Modify: `src/components/layout/app-sidebar.tsx`（如发现交互回归）
- Modify: `src/components/kbar/index.tsx`（如发现 action 分组或快捷键回归）

## Step 1: 本地启动应用

Run: `npm run dev`

Expected:

- 开发服务器正常启动

## Step 2: 手动验证侧边栏结构

依次检查：

- “概览”分组下包含 `仪表盘 / 产品 / 用户 / 看板 / 聊天`
- “组件”分组下包含容器“表单”，其子项为四个表单页面；并有 `React Query / 图标`
- “账户”分组下包含 `通知`
- 当前路由高亮逻辑与迁移前一致

## Step 3: 手动验证 KBar

验证：

- `Cmd/Ctrl + K` 可打开
- 输入“产品”“用户”“通知”能命中对应 action
- `shortcut` 行为未回退
- 不会为无链接容器节点生成可执行 action

## Step 4: 修复发现的问题并复跑验证

如发现以下问题，直接在本 task 内修复：

- 容器节点被错误渲染为链接
- KBar 出现重复 action
- 同组排序不稳定
- 折叠菜单下 flyout 丢失子项

## Step 5: Commit

```bash
git add src/components/layout/app-sidebar.tsx src/components/kbar/index.tsx
git commit -m "fix: stabilize route metadata navigation behavior"
```

## Step 6: 请求资深架构师 Review

- 提交验证结论、必要的修复 diff、以及“允许打开并行分支”的建议
- 仅在 review 明确通过后，才允许开始 `Task 06` 与 `Task 07`

---

## Review (2026-05-25)

**实际完成项与任务定义的差异：**

- 除了 sidebar / KBar 行为核对，还额外修复了 `getAppRouteStaticData()` 的运行时读取边界：TanStack Router v1 实际把 `staticData` 放在 `route.options.staticData`，此前只读 `route.staticData` 导致运行时导航树为空
- 侧边栏与 KBar 的最终验证不是停留在代码 trace，而是补充了真实浏览器验证，确认菜单分组、容器展开与命令面板 action 都能正常工作

**阻塞项或未预期的技术债务：**

- 无

**后续行动项：**

- 无
