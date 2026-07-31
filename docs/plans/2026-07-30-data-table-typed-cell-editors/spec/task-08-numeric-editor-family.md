# Task 08：Numeric Editor 家族

**Parent Design:** [DataTable 类型化单元格编辑器设计](../../2026-07-30-data-table-typed-cell-editors-design.md)

**Status:** COMPLETE

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

- [x] 五种 type 共用 Numeric Editor 和 keyboard profile。
- [x] editor、paste、raw programmatic 对相同文本得到相同结果。
- [x] typed programmatic 仍执行 validate。
- [x] 非 number 字段不能使用 numeric family。
- [x] nullable/emptyValue 字段约束在编译期生效。
- [x] 每个 type 的 codec、editor、runtime、类型和虚拟化用例分别通过。
- [x] public gate 按 `number → int → decimal → money → percent` 或实际完成顺序逐个打开，不成组提前暴露。

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

## Review (2026-07-30)

### 实际完成项与任务定义的差异

- 已交付单一 `DataTableEditableNumberCell` 与 `numeric` keyboard profile，
  `number`、`int`、`decimal`、`money`、`percent` 只通过 column-bound codec 和
  adornment / formatter 配置区分，没有新增平行状态机。
- shared parser 统一处理空值、ASCII / 全角数字、合法千分位、科学计数法 gate、
  词法小数位、币种装饰和 percent `%`；row、snapshot 与 change event 只接收有限
  `number | null | undefined` 领域值。
- 已实现 min / max / step 的领域单位校验、浮点容差、Arrow 与按钮步进边界、wheel
  不改值；money 使用 ISO currency 的 minor unit 作为默认小数位，外币符号 fail
  closed；percent 保持比例值并导出 `percentPoints()`。
- 已补齐 raw / typed programmatic、single-cell paste、无装饰 copy、连续 Tab、
  StrictMode、已有超精度 percent 和真实虚拟行卸载回归；为实现设计中的 public
  helper，额外修改了 column factory 聚合出口，并补充 hook runtime 测试。
- public capability gate 在五种 type 各自的 codec、adapter、editor、类型和 runtime
  覆盖完成后按 `number → int → decimal → money → percent` 顺序开放；未提前开放
  Task 09 的 temporal type。

### 验证结果

- `pnpm exec vitest run src/components/ui/table/cells/data-table-editable-number-cell.test.tsx src/components/ui/table/columns/data-table-edit-codecs.test.ts src/components/ui/table/columns/data-table-edit-adapters.test.ts src/components/ui/table/columns/data-table-column-factory.test.tsx src/components/ui/table/core/data-table.test.tsx src/hooks/use-data-table/use-data-table-editing.test.tsx`
  通过：6 个测试文件、156 个测试。
- `pnpm typecheck` 通过。
- `pnpm lint` 通过：0 warning、0 error。
- Task 08 目标文件 `oxfmt --check` 通过。
- `pnpm test:e2e:smoke e2e/data-table-editing-example.smoke.spec.ts --grep @workspace-v2`
  通过：2 个浏览器测试；其 pretest production build 同时通过。

### 阻塞项或未预期技术债务

- 无 Task 08 新增阻塞项。
- money V1 仍按批准设计使用 JavaScript `number`，不提供账本级定点精度保证。

### 后续行动项（Action Items）

- `TODO (P2)`：如出现清结算、超大金额或严格审计字段，单独设计 minor-unit integer
  或 decimal string 契约，不在当前 Numeric Editor 上宣称账本精度。
- `TODO (P2)`：在 Phase 6 的批量粘贴决策中复用本 task 的 column-bound numeric
  codec，不新增第二套 matrix 数值解析规则。

## Review (2026-07-31)

### 实际完成项与任务定义的差异

- 根据产品交互反馈，将 Numeric Editor 的步进按钮改为垂直排列：`+` 位于上方，
  `−` 位于下方；按钮仍复用原有 step、min/max、disabled 与 session 提交逻辑。
- 当前 shadcn registry 没有独立 Number Input，未引入第三方组件或升级依赖；实现复用
  已安装的 `InputGroup` 与纵向 `ButtonGroup`，保持现有 raw text draft 契约。

### 验证结果

- Numeric、Date、DateTime 编辑器定向 Vitest 通过：3 个测试文件、17 个测试。
- `pnpm typecheck`、`pnpm lint` 与目标文件 `oxfmt --check` 通过。
- 表格编辑与范围选择 Playwright 回归通过：11 个浏览器测试；production build 通过。
- 浏览器截图确认步进控件为上 `+`、下 `−` 的垂直布局。

### 阻塞项或未预期技术债务

- 无新增产品阻塞或依赖；shadcn 当前没有 standalone Number Input，由现有 primitives
  组合实现。

### 后续行动项（Action Items）

- `TODO (P2)`：若 shadcn 后续提供稳定的 Number Input，仅在不破坏 raw draft、
  keyboard profile 与领域 codec 契约的前提下评估替换。
