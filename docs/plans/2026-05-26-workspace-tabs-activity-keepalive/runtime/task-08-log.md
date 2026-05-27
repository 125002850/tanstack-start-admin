# Execution Log - Task 08

**Agent:** %13
**Started:** 2026-05-26 14:56
**Completed:** -

## Result

`blocked`

## What Was Done

- 已完成实现前预案分析，确认 Task 08 不只是补 smoke，还需要补 feature flag wiring、dashboard layout gating 与 rollback 路由切换。
- 已识别高风险接缝：`TagsBar` / `WorkspaceViewport` / `useDashboardRouteTagSync` 的 flag-off 彻底切断、products/users route 在 rollback 模式下直接走 legacy fallback、禁止业务代码双读裸 `import.meta.env`。
- 已确定 Playwright 方向：默认 project 跑 `@workspace`，额外 rollback project 用 `VITE_ENABLE_WORKSPACE_TABS=0` 单独 build + serve，验证 `@workspace-rollback`。
- 产品约束在实现中途升级后，本任务已暂停：新的 v2 方案不再接受 `route-state / searchAdapter / workspace-definition` 作为主链路。
- `%14` 已完成首轮架构评审，评分 `61/100`；当前重点从“继续旧 Task 08”转为“把 `spec-v2/` 补到可安全执行级，再把 rollout gate 重映射到 `Task V2-04`”。
- `%14` 已完成二次架构评审，评分 `87/100`；当前重点继续收口 `keepAlive=false` owner model、首开无空白 gate、legacy file owner 与 zero-import gate。
- `%14` 已完成三次架构评审，评分 `95/100`；当前唯一剩余 blocker 是 descriptor / lifecycle 生命周期与 route unmount 的责任边界。
- 已在第四轮规格中补充：route boundary 只负责 URL descriptor 发现，descriptor 注册后由 shell store 持有，route unmatch 不清理 opened tab descriptor，tab close / shell reset 才最终 cleanup。
- `%14` 已完成最终复核，评分 `100/100`，确认 `spec-v2/` “可按企业级执行计划放行”。

## Unfinished Work

- [ ] 将旧 Task 08 正式重映射为 `Task V2-04 rollout / regression` 执行入口。
- [ ] 盘点 `%13` 当前工作树里哪些 flag / smoke 改动仍可复用，哪些必须丢弃。

## Surprises

- 当前仓库里的 `dashboard.tsx` 仍无条件渲染 `WorkspaceViewport`，而且 `useDashboardRouteTagSync` 也无条件运行；如果 Task 08 只在 route component 级别做 flag 判断，会出现“UI 已回退但 workspace store 仍在工作”的半开状态。
- 本任务的原始目标默认沿用 v1 的 URL-table-state 假设；该假设已被产品明确否决，因此原任务定义本身不再可继续收口。

## Handoff Notes

- 旧 Task 08 已不再是 release gate；真正的 rollout gate 将迁移到 `spec-v2/task-v2-04-rollout-and-regression.md`。
- `src/lib/page-cache/*` 不再默认视为 rollback-only 资产；需要先做 inventory，再决定是临时保留还是进入后续 cleanup 计划。
- `spec-v2/` 已获 `%14` 最终放行；下一步应解锁 `Task V2-01` 到 `Task V2-04` 的执行排程，而不是恢复旧 Task 08。
