# Task 06：Anchor 生命周期与虚拟化回退

**Parent Design:** [DataTable 类型化单元格编辑器设计](../../2026-07-30-data-table-typed-cell-editors-design.md)

**Status:** COMPLETE（全仓基线失败已记录）

**Depends On:** Task 05

**Blocks:** Task 07

**Type:** lifecycle

## Goal

建立 session-aware editor anchor 生命周期，并实现 V1 虚拟化卸载的确定性 commit/revert fallback，完成 Phase 1 的 runtime 与交互基础设施出口。

## Files

- Modify: `src/hooks/use-data-table/use-data-table-editing.ts`
- Modify: `src/hooks/use-data-table/use-data-table-editing.test.tsx`
- Modify: `src/components/ui/table/cells/data-table-editable-value-cell.tsx`
- Modify: `src/components/ui/table/cells/data-table-editable-choice-cell.tsx`
- Modify: `src/components/ui/table/core/data-table-body.tsx`
- Modify: `src/components/ui/table/core/data-table.test.tsx`
- Modify: `src/components/ui/table/virtualization/use-data-table-virtualization.ts`
- Modify: `e2e/data-table-editing-example.smoke.spec.ts`

## Invariants

- anchor 注册、cleanup、finish 和 cancel 均携带 sessionId。
- 旧 anchor 的 cleanup 不得结束新 session。
- active draft 继续保存在 table store；cell local state 不能成为唯一真相源。
- V1 不修改 virtualizer 的 range extraction 或 pinning 算法。
- popup 已打开时先关闭 popup，再执行 detach commit/revert。
- 已卸载 anchor 不恢复焦点。

## Detach Contract

| Session 状态             | V1 行为                                           |
| ------------------------ | ------------------------------------------------- |
| valid + blur-commit      | `commitCandidate(reason='virtualization-detach')` |
| unparsed / invalid       | revert initial value                              |
| valid + explicit-confirm | revert initial value                              |
| popup open               | 先关闭 popup，再按上述规则处理                    |

revert 必须返回可观察的：

```ts
{
  status: 'reverted',
  reason: 'virtualization-detach'
}
```

## Out of Scope

- 不实现 active row/column pinning。
- 不引入 `rangeExtractor` 生产改动。
- 不实现新 editor。
- 不抽取尚未由 date/textarea 共同证明的过度通用 popup hook。

## Acceptance Criteria

- [x] valid blur-commit session 在真实虚拟行卸载时提交一次。
- [x] invalid/unparsed 和 explicit-confirm session 在卸载时 revert。
- [x] React StrictMode 瞬时 unmount/remount 不误提交。
- [x] microtask 检查发现同 session anchor 已重挂载时取消 detach 处理。
- [x] 旧 popup 的 `onOpenChange`、blur 或 cleanup 不结束新 session。
- [x] 横向滚动、纵向滚动和固定列不破坏当前 legacy editor。
- [x] Task 01–05 的目标测试全部通过。
- [ ] Phase 1 统一出口验证通过。

## Verification Profile

```bash
pnpm exec vitest run src/hooks/use-data-table/use-data-table-editing.test.tsx src/components/ui/table/cells/data-table-editable-value-cell.test.tsx src/components/ui/table/cells/data-table-editable-choice-cell.test.tsx src/components/ui/table/core/data-table.test.tsx
pnpm typecheck
pnpm lint
pnpm test:e2e:smoke e2e/data-table-editing-example.smoke.spec.ts --grep @workspace-v2
pnpm test:e2e:smoke e2e/data-table-cell-range-selection.smoke.spec.ts --grep @workspace-v2
```

Phase 1 出口：

```bash
pnpm check
pnpm build
```

## Execution Recipe

1. 先写 StrictMode、stale cleanup 和 detach 状态矩阵测试。
2. 为 runtime 和 cell 建立 session-aware anchor 注册契约。
3. 实现 microtask 重挂载检查和 V1 fallback。
4. 接入 popup close 与 focus restore 边界。
5. 在 500 行示例页验证真实虚拟卸载。
6. 执行 Phase 1 出口验证。
7. 完成统一 Review 与父设计状态回写。

## Review (2026-07-30)

### 实际完成项与任务定义的差异

- runtime 新增 session-aware `registerEditorAnchor()`；注册与 cleanup 使用独立 token，迟到的
  旧 session 注册和旧 token cleanup 都不能覆盖或结束新 session。
- keyboard shell 通过 layout lifecycle 注册 anchor；StrictMode 瞬时 cleanup 在 microtask
  内发现同 session 已重挂载时取消 detach，不再用无条件 unmount blur 结束编辑。
- `virtualization-detach` 已进入 change reason；valid blur-commit 走统一
  `commitCandidate()`，invalid / unparsed 与 explicit-confirm 均返回可观察的
  `reverted / virtualization-detach`，卸载后不恢复焦点。
- choice editor 的 open state 提升到 active editor owner，detach callback 先关闭 popup，再
  进入 runtime fallback；单测同时校验 close callback 早于 change event。
- 真实 500 行虚拟表 smoke 新增“保持 text draft 后直接滚出首行”的场景，首行回挂载后只看到
  一次提交后的领域值。
- 未修改 `DataTableBody`、virtualizer range extraction 或 pinning；anchor owner 的
  mount/unmount 已能直接覆盖真实行、列卸载，因此不需要向虚拟化算法增加旁路状态。
- 范围选择回归暴露出既有 focus 边界：拖拽区域的 focus cell 再获焦会把 anchor 重置为单格。
  已局部修正并补 3×2 Shift Arrow 单测，使规格要求的范围 E2E 通过。

### 阻塞项或未预期的技术债务

- Task 06 目标 4 个 Vitest 文件共 117 个测试通过，`pnpm typecheck`、`pnpm lint`、
  `pnpm build`、编辑示例 E2E（2/2）和范围选择 E2E（5/5）通过。
- Phase 1 `pnpm check` 的 lint 与 typecheck 通过，但全仓 unit 基线仍有两个与本任务文件
  无关、定向复跑可稳定复现的失败：
  `management-toolbar-contract.test.ts` 的 department tableActions 源码契约，以及
  `dictionary-management-page.test.tsx` 的“确认停用字典项”查询。相关生产/测试文件在本
  任务中均无 diff，按总览约束不通过修改无关业务代码掩盖。
- 全仓既有 41 个格式问题仍存在；本任务变更文件已通过定向 `oxfmt --check`。

### 后续行动项（Action Items）

- TODO (P0)：Task 07 的 longText popup 必须复用本 task 的 anchor contract，并覆盖
  explicit-confirm detach revert、textarea 内换行与 portal overlay。
- TODO (P1)：在独立修复中恢复上述两个全仓 unit 基线，再重新执行 `pnpm check`；不得混入
  typed editor 功能提交。
- TODO (P2)：在独立 chore 中清理全仓既有格式基线。
