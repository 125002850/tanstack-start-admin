# Task 06：Anchor 生命周期与虚拟化回退

**Parent Design:** [DataTable 类型化单元格编辑器设计](../../2026-07-30-data-table-typed-cell-editors-design.md)

**Status:** DRAFT

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

- [ ] valid blur-commit session 在真实虚拟行卸载时提交一次。
- [ ] invalid/unparsed 和 explicit-confirm session 在卸载时 revert。
- [ ] React StrictMode 瞬时 unmount/remount 不误提交。
- [ ] microtask 检查发现同 session anchor 已重挂载时取消 detach 处理。
- [ ] 旧 popup 的 `onOpenChange`、blur 或 cleanup 不结束新 session。
- [ ] 横向滚动、纵向滚动和固定列不破坏当前 legacy editor。
- [ ] Task 01–05 的测试全部通过。
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
