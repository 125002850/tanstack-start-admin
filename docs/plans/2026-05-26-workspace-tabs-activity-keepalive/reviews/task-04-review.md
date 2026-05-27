# Task 04 Review

**Reviewer:** codex via smux
**Task:** Task 04
**Decision:** `approved`

## Checks

- [x] Acceptance criteria met
- [x] Verification ran
- [x] No obvious regression risk missed
- [x] Downstream handoff is sufficient

## Findings

- [x] `npx vitest run` 通过：2 test files, 27 tests passed
- [x] `npm run lint` 通过：0 errors（4 warnings 在 Task 03 文件中，非本任务范围）
- [x] `npm run build` 通过：9012 modules transformed
- [x] 现有 `useDataTable` 调用方无需修改也能通过编译 — `searchAdapter` 参数可选且默认行为不变
- [x] 契约测试覆盖了 pagination（只写 page）、pageSize（写 perPage + page 重置）、sort 序列化、filter 序列化与 key 保留
- [x] Round 2: subscribe 机制、production helper 提取、移除 parseSearchParams
- [x] Round 3: useEffect immediate sync on adapter identity change + 7 integration sync-cycle tests
- [x] 全量测试通过：8 files, 102 tests
- [x] React 组件测试 (tags-bar.test.tsx, smoke test) 正常通过（vitest.config.ts 已回退干净配置，无需 alias）

## Action

- [x] 评审通过，可交付下游

## Downstream Notes

- Task 05/06/07 可消费 `DataTableSearchAdapter` 和 `createStaticAdapter()` 来为各自 workspace screen 提供搜索状态管理。
- `WorkspaceRouteDefinition<TState>` 和 `WorkspaceScreenProps<TState>` 接口已就位，下游可在具体 feature 文件中实现 parse/stringify/buildHref/getPageChrome/refresh。
- `useDataTable` 的 `searchAdapter` 参数是可选的，不影响现有路由端的调用方。迁移到 adapter 模式时可以逐个路由渐进接入。
- `useDataTable` 的 adapter sync 行为通过 production helper 直接测试（exact same code path）+ adapter sync cycle 集成测试验证 subscribe/unsubscribe/immediate-sync 模式，与 hook 内部 useEffect 逻辑精确对应。
- pnpm 环境下 React 多实例问题（`useState` 为 null）是项目级环境问题，仅影响跨包 RTL 测试，不影响实际运行。`@testing-library/react` v16 + pnpm 的 peer dependency 隔离是已知问题，建议后续统一 pnpm overrides。
