# Task 09：Date Editor

**Parent Design:** [DataTable 类型化单元格编辑器设计](../../2026-07-30-data-table-typed-cell-editors-design.md)

**Status:** DRAFT

**Depends On:** Task 08

**Blocks:** Task 10

**Type:** feature

## Goal

交付严格 `YYYY-MM-DD` 领域契约的 Date Editor，让手工输入和 Calendar 选择共用同一 draft、codec、约束和提交管线，并在完整可访问性及虚拟化验证后开放 `date` public gate。

## Files

- Create: `src/components/ui/table/cells/data-table-editable-date-cell.tsx`
- Create: `src/components/ui/table/cells/data-table-editable-date-cell.test.tsx`
- Modify: `src/components/ui/table/columns/data-table-edit-codecs.ts`
- Modify: `src/components/ui/table/columns/data-table-edit-codecs.test.ts`
- Modify: `src/components/ui/table/columns/data-table-edit-adapters.ts`
- Modify: `src/components/ui/table/columns/data-table-edit-adapters.test.ts`
- Modify: `src/components/ui/table/columns/data-table-column-builders.tsx`
- Modify: `src/components/ui/table/columns/data-table-column-factory.test.tsx`
- Modify: `src/types/data-table.ts`
- Modify: `src/features/elements/components/data-table-editable-choice-contract-page.tsx`
- Modify: `e2e/data-table-editing-example.smoke.spec.ts`

## Invariants

- row date 值是严格 `YYYY-MM-DD | null` 字符串。
- 不把 date 存为 `Date`。
- 不通过 UTC 午夜或 `new Date('YYYY-MM-DD')` round-trip。
- 手工输入与 Calendar 选择调用同一 codec 和 unavailable/min/max 校验。
- popup 复用现有 `Popover`、`Calendar` 和 workspace overlay container。
- Date Editor 接管整个 cell，不让 popup 被 table overflow 裁剪。

## Interaction Contract

- 双击、Enter、F2：进入编辑并聚焦文本输入。
- 默认不自动打开 Calendar。
- Calendar 按钮或 Alt+ArrowDown：打开日历。
- 选择合法日期：立即提交。
- 手工输入：Enter、Tab 或 blur 完成。
- Escape：取消整个 cell session。
- 关闭后焦点返回原 cell/editor。

## Out of Scope

- 不处理时间或时区。
- 不把 date 筛选 DSL 与 editable date 混为同一实现。
- 不抽象尚未由 DateTime 证明的过度通用 Temporal Editor。

## Acceptance Criteria

- [ ] 闰年、不存在日期、min/max 和 unavailable 规则通过。
- [ ] 输入和 Calendar 对相同日期产生相同领域值。
- [ ] `allowEmpty` 和 nullable 字段类型约束在编译期生效。
- [ ] Calendar roving tabindex、accessible name、错误描述和焦点恢复通过。
- [ ] popup 内点击/滚动不驱动 range selection。
- [ ] valid/invalid detach 和 stale popup session 通过。
- [ ] 全部 gate 条件通过后才公开 `date`。

## Verification Profile

```bash
pnpm exec vitest run src/components/ui/table/cells/data-table-editable-date-cell.test.tsx src/components/ui/table/columns/data-table-edit-codecs.test.ts src/components/ui/table/columns/data-table-edit-adapters.test.ts src/components/ui/table/columns/data-table-column-factory.test.tsx src/hooks/use-data-table/use-data-table-editing.test.tsx
pnpm typecheck
pnpm lint
pnpm test:e2e:smoke e2e/data-table-editing-example.smoke.spec.ts --grep @workspace-v2
```

## Execution Recipe

1. 先补严格 date parser、字段类型和 Calendar 交互失败测试。
2. 实现 date codec 和 adapter，保持 gate 关闭。
3. 实现手工输入与 Calendar 共用 draft 的 editor。
4. 接入 overlay、keyboard shell、anchor lifecycle 和可访问性。
5. 扩展示例页和 browser smoke。
6. 完成全部退出条件后打开 `date` gate。
7. 完成统一 Review 与父设计状态回写。
