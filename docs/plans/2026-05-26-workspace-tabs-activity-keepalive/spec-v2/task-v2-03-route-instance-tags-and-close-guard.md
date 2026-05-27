# Task V2-03: 路由实例 Tags 与 Dirty Close Guard

**Depends on:** `Task V2-01, Task V2-02B`
**Blocks:** `Task V2-04`
**Type:** `behavior`

## Goal

让所有 dashboard 页面都能以“完整路由实例”进入 workspace tags，并支持统一的脏状态关闭确认。

## Files

- Modify:
  - `src/routes/dashboard/index.tsx`
  - `src/routes/dashboard/overview.tsx`
  - `src/routes/dashboard/chat.tsx`
  - `src/routes/dashboard/notifications.tsx`
  - `src/routes/dashboard/react-query.tsx`
  - `src/routes/dashboard/kanban.tsx`
  - `src/routes/dashboard/forms/index.tsx`
  - `src/routes/dashboard/forms/basic.tsx`
  - `src/routes/dashboard/forms/multi-step.tsx`
  - `src/routes/dashboard/forms/advanced.tsx`
  - `src/routes/dashboard/forms/sheet-form.tsx`
  - `src/routes/dashboard/elements/icons.tsx`
  - `src/routes/dashboard/product/index.tsx`
  - `src/routes/dashboard/product/$productId.tsx`
  - `src/routes/dashboard/users.tsx`
  - `src/features/workspace-tabs/components/workspace-routing.integration.test.tsx`
- Reference:
  - `src/lib/router/app-route-meta.ts`
  - `src/lib/router/dashboard-home.ts`

## Invariants

- 所有 dashboard 页面默认进入 tags + Activity shell。
- 详情页 / 新建页按完整路由实例开新 tag。
- 浏览器硬刷新后不恢复旧 tags，只保留当前 URL 对应页面。

## Constraints

- 不允许把 `dirty` / `closeGuard` 扩展成通用页面状态存储器。
- 不允许把“关闭确认”散落到 header、tags-bar、route 之间各自实现。
- 对确实不适合保活的页面，只允许显式 `keepAlive=false` opt-out，并在 review 记录原因；opt-out 页面在 flag-on 下仍由 `ActivityHost` 渲染，只是 deactive 后立即 unmount。

## CloseGuard Algorithm

统一关闭算法必须是确定性的，不能依赖 UI 事件时序碰运气：

常量与数据来源写死如下：

- `closeGuardTimeoutMs = 1500`
- 批量关闭的“视觉顺序”取 `TagsBar` 实际渲染顺序；v2 首轮该顺序等于 store 保存的 `openedOrder` / `tabs` 顺序，不做额外排序

1. `close-current`
   - 目标集合只包含当前 active tab。
   - 若 `dirty=false` 或无 `closeGuard`，直接关闭。
   - 若存在 `closeGuard`，`await closeGuard({ tabId, reason: 'close-current' })`；返回 `true` 才关闭。
2. `close-other`
   - 先按当前 tags 视觉顺序生成目标集合，排除 active tab。
   - 依次从左到右执行 guard。
   - 任一 guard 返回 `false`、throw、reject 或超时，都立即中止批量关闭，并把焦点切回该 tab。
3. `close-all`
   - 先按当前 tags 视觉顺序生成目标集合，包含 active tab。
   - 同样按左到右执行 guard。
   - 任一 guard 返回 `false`、throw、reject 或超时，都立即中止并聚焦被拒绝 tab。

guard 异常处理：

- `throw` / rejected promise 视为“拒绝关闭”
- 超时视为“拒绝关闭”；timeout 固定为 `1500ms`，必须在代码与测试中写死
- shell 只消费布尔结果，不理解业务文案；具体提示由页面自己的 guard 控制

## Acceptance Criteria

- [ ] `/dashboard/product/new`、`/dashboard/product/:id` 等详情实例可独立开新 tag
- [ ] page 可更新运行期 title
- [ ] 脏状态页面在关闭当前 / 关闭其他 / 关闭全部时都会统一走 `closeGuard`
- [ ] 批量关闭被某个 `closeGuard` 拒绝时，会中止该批量操作并把焦点切回被拒绝页面
- [ ] `closeGuard` 的左到右遍历顺序、reject/throw/timeout 处理都有自动化保护
- [ ] `bunx vitest run src/features/workspace-tabs/components/workspace-routing.integration.test.tsx src/features/workspace-tabs/hooks/use-workspace-page.test.tsx` 通过
- [ ] `bun run build` 通过

## Verification Strategy

`behavior` 任务使用 integration tests 验证 route-instance tag、title 更新和 close guard。这里不依赖 Playwright，避免把核心交互保护全部放到 E2E。

## Execution Recipe

1. 为所有 dashboard routes 接入 `WorkspacePageBoundary`，默认开启 keep-alive。
2. 为详情页 / 新建页建立按完整路由实例开新 tag 的策略。
3. 统一实现 `dirty` / `closeGuard` 在 tags close action 中的调用顺序和回退行为，覆盖当前关闭、关闭其他、关闭全部三类动作，并写死 batch 遍历顺序。
4. 为 route-instance、多实例详情页、close-guard 批量拒绝、reject/throw/timeout 场景补集成测试。

## Notes For Executor

- 如果某些页面标题在加载后才可确定，应先用 route metadata 作为 `initialTitle`，再由 page 运行期更新。
- `closeGuard` 可以返回同步布尔值或异步结果，但 tags 层必须统一 await。

## Review (2026-05-27)

- 实际完成项与任务定义的差异
  - route-instance tags 与 `closeGuard` 算法已按任务落地，并补齐 integration coverage。
  - keep-alive 策略经历一轮收敛：首版实现把多数 dashboard 页面都降级成 `keepAlive=false`，复审后已改回“默认 keep-alive”，仅保留三个允许例外。
  - 最终保留的例外是 `/dashboard/` 重定向路由、`/dashboard/forms/` 重定向路由、以及 `product/$productId` 详情实例页。

- 阻塞项或未预期的技术债务
  - `product/$productId` 仍显式 opt-out keep-alive，当前以“避免详情实例累积带来的内存风险”为理由接受，但没有在本任务内解决更细粒度的实例回收策略。

- Action Items
  - `RESOLVED P1 (2026-05-27 15:32)` `product/$productId` 已恢复默认 keep-alive；dirty form 的 tag switch / close guard 语义现由自动化保护，不再需要以“有限实例缓存”作为当前正确性的前置条件。
  - `TODO P2` 若后续新增 dashboard 详情/向导类页面，评审时必须先证明不能默认 keep-alive，才能新增 `keepAlive=false` 例外。

### Update (2026-05-27 15:32)

- 实际收口：
  - `product/$productId` 已移出 keepAlive=false 例外集合，当前只剩 `/dashboard/` 与 `/dashboard/forms/` 两个重定向路由显式 opt-out。
  - `ProductForm` 的 dirty closeGuard 现在会给出页面侧 warning 反馈；workspace smoke 也已覆盖“切 tab 后 draft 仍在”“close current / close other / close all 被拒绝后 draft 仍在”。

- 技术债务变化：
  - 本任务原先接受的 `product/$productId keepAlive=false` 取舍已撤销，后续如需做实例数量/内存优化，必须新开性能或 cleanup 专题，不能再以牺牲 dirty-form 正确性为代价。
