# Task V2-03 Review

## Verdict

`approved`

## Findings

未发现新的 blocking findings。

## Acceptance Notes

- route-instance tags 保护仍然成立：`/dashboard/product/new`、`/dashboard/product/:id` 多实例场景保持独立 tag。
- closeGuard 统一关闭算法未回退：`close-current / close-other / close-all` 仍按左到右遍历，`throw / reject / timeout` 继续视为拒绝关闭。
- `keepAlive=false` 已收敛到三处允许例外：
  - [src/routes/dashboard/index.tsx](/Users/youdingte/studys/tanstack-start-admin/src/routes/dashboard/index.tsx:7)：重定向路由，不渲染真实 dashboard 页面实例。
  - [src/routes/dashboard/forms/index.tsx](/Users/youdingte/studys/tanstack-start-admin/src/routes/dashboard/forms/index.tsx:6)：容器重定向路由，不渲染真实表单页面实例。
  - [src/routes/dashboard/product/$productId.tsx](/Users/youdingte/studys/tanstack-start-admin/src/routes/dashboard/product/$productId.tsx:13) 和 [src/routes/dashboard/product/$productId.tsx](/Users/youdingte/studys/tanstack-start-admin/src/routes/dashboard/product/$productId.tsx:36)：详情实例页当前显式 opt-out，代码中已注明“按 productId 开独立 tag 时不保活全部实例，以避免实例累积带来的内存风险”。
- 其余 dashboard 真实页面已恢复默认 keep-alive，重新满足 `Task V2-03` 的“默认进入 tags + Activity shell”约束。

## Verification

- `bunx vitest run src/features/workspace-tabs/components/workspace-routing.integration.test.tsx src/features/workspace-tabs/hooks/use-workspace-page.test.tsx` -> PASS（2 files / 49 tests）
- `bunx vitest run --exclude 'e2e'` -> PASS（18 files / 297 tests）
- `bun run build` -> PASS

## Residual Risk

- `product/$productId` 仍是显式 `keepAlive=false` 例外；这轮接受了“避免详情实例累积导致内存风险”的取舍，但是否需要更细粒度的实例回收策略，后续可在 cleanup/性能专题中单独评估。

## Update (2026-05-27 15:32)

- `product/$productId` 不再是 `keepAlive=false` 例外；当前显式 opt-out 只剩 `dashboard/index` 与 `forms/index` 两个重定向路由。
- `ProductForm` 的 dirty closeGuard 现在会给出页面侧 warning，且 browser smoke 已覆盖：
  - dirty new product tab 切到其他 tag 再切回，draft 仍在
  - close current / close other / close all 被拒绝后，焦点回到原 tab 且 draft 仍在
- 上述 residual risk 已关闭。若未来要做 detail 实例内存优化，应作为单独性能专题处理，而不是回退当前 keep-alive/closeGuard 语义。
