# Task 15：Server Validation Error 回写 Cell 状态

**Parent Decision:** [Phase 6 决策](../reviews/phase-6-decision.md)

**Status:** COMPLETE

**Depends On:** Task 11

**Blocks:** None

**Type:** runtime

## Goal

为业务保存失败提供统一的 server validation error 回写入口，把 rowId、field 和结构化错误
绑定到 cell 状态；后续成功编辑、accept/discard、服务端刷新和 scope 切换按明确规则清理。

## Files

- Modify: `src/hooks/use-data-table/use-data-table-editing.ts`
- Modify: `src/hooks/use-data-table/use-data-table-editing.test.tsx`
- Modify: `src/types/data-table.ts`
- Modify: `src/components/ui/table/core/data-table-body.tsx`
- Modify: `src/components/ui/table/core/data-table.test.tsx`
- Modify: `src/features/iam/components/staff-management-page.tsx`
- Modify: `e2e/data-table-editing-example.smoke.spec.ts`

## Invariants

- DataTable 不解释业务错误码，只保存调用方提供的结构化 cell error。
- error key 使用稳定 `rowId + field`，不绑定易变化的 row index。
- error 不改写领域值、draft 或 change history。
- 新 session 启动时可展示 server error；本地成功提交该 cell 后按规则清除。
- accept/discard、scope 切换、row 删除与服务端确认值必须清理过期 error。
- stale mutation response 不得覆盖更新 session 或更新 revision 的 cell 状态。

## Acceptance Criteria

- [x] controller 提供批量 set / clear server cell errors 的类型化 API。
- [x] cell 具备可访问 invalid 状态、错误描述和非颜色提示。
- [x] 部分保存失败能只标记失败 cell，成功 cell 正常 accept。
- [x] stale response、分页、刷新、scope 切换和虚拟卸载通过。
- [x] 重新编辑并成功提交后 error 清理规则通过。
- [x] 不新增业务 API、mutation 或错误码耦合。

## Verification Profile

```bash
pnpm exec vitest run src/hooks/use-data-table/use-data-table-editing.test.tsx src/components/ui/table/core/data-table.test.tsx
pnpm typecheck
pnpm lint
pnpm test:e2e:smoke e2e/data-table-editing-example.smoke.spec.ts --grep @workspace-v2
```

## Execution Recipe

1. 冻结 server error key、revision 和清理生命周期。
2. 扩展 controller/runtime 类型化入口。
3. 接入 cell 渲染与可访问错误描述。
4. 用员工页部分保存失败验证业务适配边界。
5. 完成虚拟化、stale response 与 Review。

## Review (2026-07-31)

### 实际完成项与任务定义的差异

- controller 新增 `getRevision()`、批量 `setServerCellErrors()` /
  `clearServerCellErrors()` 与只读 `getServerCellErrors()`；错误保持 rowId + typed field、
  messages、可选 code 和请求 revision。
- stale 防护采用 per-cell revision，而不是全局 revision 一刀切：其他 cell 更新不会误丢
  当前响应；同一 cell 的新 session、新提交或新 server refresh 会拒绝旧响应。
- local successful commit、revision-aware accept、discard、reset、scope 切换、row 删除和
  server refresh 已按契约清理错误；分页切换和虚拟卸载保留错误。
- cell 增加 `aria-invalid`、`aria-describedby`、live error description 和可见 `!`
  marker；server error 不修改领域值、draft 或 change history。
- 员工页保留现有 mutation/API：同批成功字段按 revision accept，失败字段回滚后写入
  typed cell error；部分失败不立即刷新覆盖错误，全成功继续执行原刷新逻辑。
- 原 task 未列出 selection hook、全局样式和示例页；实际为复用现有 cell prop
  pipeline，局部修改这些文件并增加浏览器可操作的 server error fixture。runtime 的
  `getServerCellError` 设为 optional，保持既有手写 runtime mock 向后兼容。

### 阻塞项或未预期的技术债务

- 无剩余阻塞项。
- server cell error 是当前 table scope 内存状态，不跨页面重载持久化；这与 draft
  controller 的生命周期一致。
- DataTable 只展示调用方提供的 messages / code，不解释 HTTP 状态或业务错误码；
  不同 API 的 field-error 映射仍由各业务适配层负责。
- 相同值的“刷新”只有通过真实 `loadPage()` / accept 生命周期才能视为服务端确认；
  单纯组件自身 rerender 不会错误清除标记。

### 后续行动项（Action Items）

- `TODO (P1)`：服务端统一 field-error envelope 稳定后，可提供业务层映射 helper，
  但不得把错误码解释下沉到 DataTable。
- `TODO (P2)`：如需跨浏览器刷新保留 server error，另行设计持久化与过期策略。

### 验证结果

- `pnpm lint`：通过。
- `pnpm typecheck`：通过。
- 规格目标 Vitest：2 files、133 tests 全部通过。
- 加入 IAM 业务适配回归：3 files、139 tests 全部通过。
- `pnpm exec oxfmt --check ...`：11 个 Task 15 文件全部通过。
- `git diff --check`：通过。
- `data-table-editing-example.smoke.spec.ts`：3 / 3 通过，包含 production build。
