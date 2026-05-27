# Task V2-01: Workspace Shell 与最小 Lifecycle

**Depends on:** `none`
**Blocks:** `Task V2-02A, Task V2-02B, Task V2-03, Task V2-04`
**Type:** `behavior`

## Goal

把 v1 的 workspace 壳收敛成最小协议：

- `TagsBar`
- `Activity` host
- `WorkspacePageBoundary`
- `title / dirty / closeGuard` lifecycle

并移除主链路对 `WorkspaceRouteDefinition`、`workspace-definition`、`searchAdapter` 的依赖。

## Files

- Create:
  - `src/features/workspace-tabs/components/workspace-page-boundary.tsx`
  - `src/features/workspace-tabs/hooks/use-workspace-page.ts`
  - `src/features/workspace-tabs/hooks/use-workspace-page.test.tsx`
- Modify:
  - `src/features/workspace-tabs/types.ts`
  - `src/features/workspace-tabs/utils/store.ts`
  - `src/features/workspace-tabs/utils/store.test.ts`
  - `src/features/workspace-tabs/components/workspace-viewport.tsx`
  - `src/features/workspace-tabs/components/workspace-routing.integration.test.tsx`
  - `src/components/layout/header.tsx`
  - `src/components/layout/tags-bar.tsx`
  - `src/components/layout/tags-bar.test.tsx`
  - `src/routes/dashboard.tsx`
- Reference:
  - `src/features/workspace-tabs/components/activity.tsx`
  - `src/features/workspace-tabs/lib/workspace-devtools.ts`

## Invariants

- 所有 dashboard 页面默认 `keepAlive=true`。
- shell 只管理页面实例，不管理 table/search/filter/page 状态。
- `closeGuard` 必须支持“关闭当前 / 关闭其他 / 关闭全部”三类动作。
- flag-on 时页面实例只能由 `ActivityHost` 持有，不能出现 route 与 host 双挂载同一页面实例。
- flag-on + `keepAlive=false` 页面仍由 `ActivityHost` 持有，只是 deactive 后立即 unmount。

## Constraints

- 不允许在此任务中继续扩展 `WorkspaceRouteDefinition` 或其消费链。
- 不允许把 table/query 语义塞回 lifecycle 接口。
- 不允许通过 CSS 隐藏替代 `<Activity mode="hidden">` 的实例托管。
- 不允许通过“route 先渲染真实页面，再切换到 host”的方式规避注册时序问题。

## Host Ownership Contract

flag-on 的唯一允许模型：

1. route 只负责创建 `WorkspacePageDescriptor`
2. `WorkspacePageBoundary` 在 mount 时 register/update descriptor
3. `WorkspacePageBoundary` 自身返回 `null`
4. `WorkspaceViewport` 根据 active tab 解析 descriptor，并在 `ActivityHost` 内唯一 mount 页面实例
5. 页面运行时只通过 `useWorkspacePage()` 更新 `title / dirty / closeGuard`
6. route unmount 只释放 URL 命中关系，不负责最终释放 descriptor
7. tab 被成功关闭，或 workspace shell 被整体 reset 时，shell store 才最终 cleanup descriptor / lifecycle

slot error 与 descriptor 缺失策略：

- descriptor 缺失或 render error 时，ownership 仍归 `ActivityHost`
- `ActivityHost` 渲染 route 提供的 `errorFallback` 或通用 workspace fallback
- route 不回退为直接渲染页面实例

`keepAlive=false` 策略：

- flag-on 下仍走同一套 boundary/register/host ownership
- 该页面只渲染 active slot，不进入 hidden Activity 树
- 页面一旦 deactive 立即 unmount；下次激活时由 `ActivityHost` 重新 mount
- 不允许为 opt-out 页面额外回退成 route 直渲染，否则会重新引入双 owner 分叉

## Descriptor Lifetime Contract

- route boundary mount/unmount 只负责发现或刷新当前 URL 对应的 descriptor
- descriptor 一旦注册，就由 shell store 持有，直到 tab close 或 shell reset
- route unmatch 不能清理仍处于 opened tabs 中的 descriptor
- `useWorkspacePage()` 的 lifecycle channel 必须由 `ActivityHost` 注入的 store-backed context 提供，而不是依赖 route boundary 继续存活
- tab close 是唯一允许触发业务级最终 unregister/cleanup 的事件；flag-off / reload 则触发整壳 reset

## Interface Sketch

```ts
type WorkspacePageBoundaryProps = {
  tabId: string;
  initialTitle: string;
  keepAlive?: boolean;
  closable?: boolean;
  render: () => React.ReactNode;
  errorFallback?: React.ReactNode;
};

type WorkspacePageLifecyclePatch = {
  title?: string;
  dirty?: boolean;
  closeGuard?: (context: {
    tabId: string;
    reason: 'close-current' | 'close-other' | 'close-all';
  }) => boolean | Promise<boolean>;
};

type UseWorkspacePageResult = {
  tabId: string;
  updateLifecycle: (patch: WorkspacePageLifecyclePatch) => void;
};
```

实现时序要求：

- `register` 发生在 boundary mount
- `updateDescriptor` 只处理 descriptor 变更，不重建已保活的页面实例
- `updateLifecycle` 可多次调用，但只能更新 lifecycle snapshot
- route unmatch 不能触发最终 unregister；它只能结束“当前 URL 命中”关系
- 最终 unregister 只允许发生在 tab close 成功后，或 shell reset 时
- active route 首次命中时，`WorkspaceViewport` 必须在同一导航周期渲染页面实例或非空 pending fallback；不允许出现空白 viewport

## Acceptance Criteria

- [ ] `WorkspacePageBoundary` 可注册完整页面实例，并默认按 `pathname` 建立 `tabId`
- [ ] page 可在运行期更新 `title`
- [ ] page 可声明 `dirty` 与 `closeGuard`
- [ ] flag-on 主链路不存在 route 直渲染与 `ActivityHost` 双挂载同一页面实例的窗口
- [ ] flag-on + `keepAlive=false` 页面仍由 `ActivityHost` 唯一持有，并在 deactive 后立即 unmount
- [ ] route unmatch 不会清理仍处于 opened tabs 中的 descriptor / lifecycle snapshot
- [ ] tab close 或 shell reset 才会触发最终 descriptor cleanup
- [ ] descriptor 缺失或页面 render error 时，由 `ActivityHost` 接管 fallback，route 不回退直渲染
- [ ] 首次进入 active route 或首次打开新 tag 时，integration test 可证明 host 在同一导航周期渲染非空内容，不出现空白 viewport
- [ ] `bunx vitest run src/features/workspace-tabs/ src/components/layout/tags-bar.test.tsx` 通过
- [ ] `bun run build` 通过

## Verification Strategy

`behavior` 任务使用 hooks/store 单测 + workspace routing integration test，验证 shell 是否只托管页面实例、`keepAlive=false` opt-out 是否仍保持单 owner、route unmatch 是否仍保留 opened descriptor，以及首屏/首开新 tag 是否无空白窗口。

## Execution Recipe

1. 收敛 `src/features/workspace-tabs/types.ts`，删除 v1 的 `WorkspaceRouteDefinition` / `DataTableSearchAdapter` 主链路类型，新增最小 page lifecycle 与 boundary props。
2. 新建 `WorkspacePageBoundary` 与 `useWorkspacePage`，建立页面到 shell 的最小注册协议。
3. 先落地 host ownership contract：flag-on 下 route 只注册 boundary 并返回 `null`，最终实例只由 `ActivityHost` 托管；flag-off 下 route 直接走单页链路。
4. 修改 store / viewport / tags-bar，使其只围绕 page 实例、title、dirty、closeGuard 运作，并为 slot error 保留 host 级 fallback。
5. 更新 dashboard layout，使 shell 只保留 tags、Activity host 与统一编排能力。
6. 扩充 store / routing / lifecycle 测试，覆盖 title 更新、dirty close guard、keep-alive 页面实例切换、route unmatch 保留 opened descriptor、`keepAlive=false` deactive unmount、slot fallback，以及首屏/首开新 tag 无空白窗口约束。

## Notes For Executor

- 若现有 `workspace-viewport.tsx` 名称不会增加歧义，优先保留文件名，避免非必要重命名。
- `useWorkspaceDevtools()` 若保留，只允许观察实例与生命周期事件，不得回看 table 内部状态。

## Review (2026-05-27)

- 实际完成项与任务定义的差异：
  - 实现保持了任务验收里“默认按 `pathname` 建立 `tabId`”的行为，但方式不是把 `pathname` 放进 `useWorkspacePage()` channel，而是仅在 `WorkspacePageBoundary` 省略 `tabId` 时作为 boundary 级缺省值；lifecycle channel 仍严格由 `ActivityHost` 注入的 store-backed context 提供。
- 阻塞项或未预期的技术债务：
  - 无阻塞。遗留的 v1 `WorkspaceRouteDefinition` / `workspace-definition` / `page-cache` 资产仍在仓库内保留，但已退出本任务主链路，后续由 `Task V2-04` 做零引用 gate 和退役清理。
- Action Items：
  - `DEPRECATED P2`：在 `Task V2-04` 中清点并退役仍未被主链路消费的 v1 workspace assets，保留 inventory-only 说明。
  - `TODO P1`：在 `Task V2-03` / `Task V2-04` 中继续用 integration / Playwright gate 覆盖 tags close guard 与首开新 tag 无空白窗口，防止后续任务回归破坏 `ActivityHost` 单 owner 合同。
