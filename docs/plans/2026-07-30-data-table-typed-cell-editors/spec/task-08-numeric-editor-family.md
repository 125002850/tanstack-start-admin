# Task 08：Numeric Editor 家族

**Parent Design:** [DataTable 类型化单元格编辑器设计](../../2026-07-30-data-table-typed-cell-editors-design.md)

**Status:** DRAFT

**Depends On:** Task 07

**Blocks:** Task 09

**Type:** feature

## Goal

使用一个 Numeric Editor 内核交付 `number`、`int`、`decimal`、`money` 和 `percent`，统一 raw draft、严格解析、约束校验、步进、复制、单 cell paste 和 programmatic write，并按 type 分别开放 public gate。

## Files

- Create: `src/components/ui/table/cells/data-table-editable-number-cell.tsx`
- Create: `src/components/ui/table/cells/data-table-editable-number-cell.test.tsx`
- Modify: `src/components/ui/table/columns/data-table-edit-codecs.ts`
- Modify: `src/components/ui/table/columns/data-table-edit-codecs.test.ts`
- Modify: `src/components/ui/table/columns/data-table-edit-adapters.ts`
- Modify: `src/components/ui/table/columns/data-table-edit-adapters.test.ts`
- Modify: `src/components/ui/table/columns/data-table-column-builders.tsx`
- Modify: `src/components/ui/table/columns/data-table-column-factory.test.tsx`
- Modify: `src/types/data-table.ts`
- Modify: `src/components/ui/table/core/data-table.test.tsx`
- Modify: `src/features/elements/components/data-table-editable-choice-contract-page.tsx`
- Modify: `e2e/data-table-editing-example.smoke.spec.ts`

## Invariants

- 使用 `<input type='text' inputMode='decimal'>`，保留 `-`、`1.` 等中间 draft。
- row 领域值为 `number | null`，禁止 `NaN` 和无穷值。
- `maxFractionDigits` 是 raw input 约束，超限时失败，不静默修约。
- int 遇到非零小数失败，不取整。
- money V1 使用 number，不宣称满足账本或严格十进制定点精度。
- percent 领域值固定为比例；`0.125 === 12.5%`。
- min/max/step 使用领域单位；percent 的 `maxFractionDigits` 使用展示百分数单位。
- money prefix 和 percent suffix 不进入领域值。
- 不新增独立 money/percent 输入状态机。

## Required Coverage

- 空值、正负号、小数、科学计数法 gate、全角/分组符规范。
- min、max、step、浮点误差和边界按钮状态。
- money currency、minor unit 和外币符号拒绝。
- percent raw input、带 `%` paste 和领域值换算。
- copy 使用机器可解析文本，不复制装饰符。
- wheel 不改值；ArrowUp/Down 仅按配置步进。
- 已有超精度 percent 值打开编辑时不被偷偷修约。

## Out of Scope

- 不引入 decimal library。
- 不支持最小货币单位整数或 decimal string。
- 不扩展 number 服务端筛选 DSL。
- 不实现 matrix paste。

## Acceptance Criteria

- [ ] 五种 type 共用 Numeric Editor 和 keyboard profile。
- [ ] editor、paste、raw programmatic 对相同文本得到相同结果。
- [ ] typed programmatic 仍执行 validate。
- [ ] 非 number 字段不能使用 numeric family。
- [ ] nullable/emptyValue 字段约束在编译期生效。
- [ ] 每个 type 的 codec、editor、runtime、类型和虚拟化用例分别通过。
- [ ] public gate 按 `number → int → decimal → money → percent` 或实际完成顺序逐个打开，不成组提前暴露。

## Verification Profile

```bash
pnpm exec vitest run src/components/ui/table/cells/data-table-editable-number-cell.test.tsx src/components/ui/table/columns/data-table-edit-codecs.test.ts src/components/ui/table/columns/data-table-edit-adapters.test.ts src/components/ui/table/columns/data-table-column-factory.test.tsx src/components/ui/table/core/data-table.test.tsx src/hooks/use-data-table/use-data-table-editing.test.tsx
pnpm typecheck
pnpm lint
pnpm test:e2e:smoke e2e/data-table-editing-example.smoke.spec.ts --grep @workspace-v2
```

## Execution Recipe

1. 为 numeric shared parser 和五种 type 的领域差异补失败测试。
2. 实现 Numeric Editor 与 column-bound codecs，先保持 gates 关闭。
3. 接入 step、copy、single-cell paste 和 programmatic write。
4. 扩展示例页，覆盖连续 Tab 和虚拟化卸载。
5. 按 type 验证并逐个打开 public gate。
6. 完成统一 Review 与父设计状态回写。
