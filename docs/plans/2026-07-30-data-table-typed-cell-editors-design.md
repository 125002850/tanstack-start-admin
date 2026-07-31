# DataTable 类型化单元格编辑器设计

**Date:** 2026-07-30

**Status:** APPROVED — 首席架构师已于 2026-07-30 批准，按 task 拓扑实施

**Goal:** 在现有 `columnDsl.editableField()`、单元格编辑 session 和跨页草稿能力之上，增加 `number`、`money`、`percent`、`date`、`dateTime`、`longText/textarea` 编辑能力，并统一解析、校验、粘贴、键盘导航和浮层生命周期。

**Related:** [DataTable 可编辑选择列与跨页草稿 Implementation Plan](./2026-07-29-data-table-editable-choice-columns.md)

**Tasks:** [Implementation Task Specs](./2026-07-30-data-table-typed-cell-editors/spec/index.md)

**Architecture:** 六种业务类型收敛为 Numeric、Temporal、Large Text 三类编辑内核；列 `type` 决定领域值、展示格式和默认 editor adapter；table editing runtime 统一管理原始输入草稿、解析结果、校验状态和最终提交，业务页面不自行实现类型转换。

---

## 1. 背景

当前 DataTable 已经具备：

- `columnDsl.editableField()` 的 text input、choice combobox 和 switch editor。
- 单击选择、双击 / Enter / F2 编辑、Escape 取消、Enter / Tab / blur 完成的交互模型。
- 独立 editing session，旧 editor 的延迟事件不会结束新 session。
- table 级 active value、跨页草稿、`getSnapshot()`、`acceptChanges()` 和 `discardChanges()`。
- `number`、`int`、`decimal`、`money`、`percent`、`date`、`dateTime`、`longText` 的展示类型。
- `Calendar`、`Popover`、`InputGroup` 和 `Textarea` 等可复用 UI 基础设施。

相关实现：

- [列 DSL builder](../../src/components/ui/table/columns/data-table-column-builders.tsx)
- [列类型 registry](../../src/components/ui/table/columns/data-table-column-types.tsx)
- [编辑 runtime](../../src/hooks/use-data-table/use-data-table-editing.ts)
- [共享编辑类型](../../src/types/data-table.ts)
- [现有 input / switch editor](../../src/components/ui/table/cells/data-table-editable-value-cell.tsx)
- [现有 choice editor](../../src/components/ui/table/cells/data-table-editable-choice-cell.tsx)

当前缺口：

- text input 只允许 string 字段，无法向 number 字段写入类型安全的数值。
- `activeCell.value` 同时承担“用户原始输入”和“领域值”，无法表达 `-`、`1.`、未完成日期等合法编辑中间态。
- editor 完成时没有统一的 parse / validate 阶段。
- `finishEditing()` 不返回提交结果，Tab 导航无法判断校验是否阻止提交。
- 表格粘贴与 editor 输入没有共享类型解析器，容易把数值粘贴为字符串。
- dateTime 尚未定义 instant、local datetime 和时区转换边界。

---

## 2. 目标与非目标

### 2.1 目标

- 继续使用 `columnDsl.editableField()`，不新增平行的 editable column API。
- 业务列只声明领域类型和约束，不在页面中自行解析 DOM 字符串。
- row 草稿和 `DataTableCellChange<TData>` 中始终保存字段真实类型。
- editor、粘贴和程序化提交共享同一套 parse / validate 规则。
- 所有 editor 遵守现有 cell selection、editing session 和跨页草稿契约。
- popup editor 与 workspace overlay、虚拟化和焦点恢复正确协作。
- 键盘用户可以完成所有编辑、确认、取消和错误恢复操作。

### 2.2 非目标

- 不实现富文本、Markdown、文件上传、公式或嵌套对象 editor。
- 不在本阶段引入 full-row editing。
- 不把后端持久化或 mutation 生命周期下沉到 DataTable。
- 不在 cell editor 内执行异步业务校验；异步服务端校验继续由业务 mutation 处理。
- 不同时扩展 number / boolean 的服务端 DSL 筛选序列化。
- 不为不同业务页面复制 formatter、parser 或 timezone 转换逻辑。

---

## 3. 总体架构

### 3.1 三类编辑内核

| 业务 type                     | 编辑内核          | row 领域值                         | editor 草稿                   |
| ----------------------------- | ----------------- | ---------------------------------- | ----------------------------- |
| `number` / `int` / `decimal`  | Numeric Editor    | `number \| null`                   | 原始数字字符串                |
| `money`                       | Numeric Editor    | V1 为 `number \| null`             | 不带货币符号的数字字符串      |
| `percent`                     | Numeric Editor    | `number \| null`，默认按比例值存储 | 用户看到的百分数字符串        |
| `date`                        | Temporal Editor   | `YYYY-MM-DD \| null`               | 日期文本 + Calendar selection |
| `dateTime`                    | Temporal Editor   | instant 或 local datetime 字符串   | 本地日期时间结构              |
| `longText` + textarea control | Large Text Editor | `string \| null`                   | 多行字符串                    |

> **内核复用说明：** `money` 和 `percent` 不是独立的输入组件。它们复用
> Numeric Editor，不新增平行的输入状态机，只替换：

- `formatForEdit`
- `parse`
- prefix / suffix
- 默认 `maxFractionDigits` / step
- 展示 formatter

`date` 和 `dateTime` 复用 Temporal Editor 的 popup、焦点和日历逻辑，但提交条件不同：

- date 选中一天后可以立即提交。
- dateTime 还需要确认时间，必须显式完成。

### 3.2 类型决定默认 editor

推荐直接由 `type` 推导 editor：

```tsx
columnDsl.editableField('amount', '金额', {
  type: 'money',
  edit: {
    currency: 'CNY',
    min: 0,
    step: 0.01,
    maxFractionDigits: 2
  }
});
```

业务调用方不需要同时声明：

```tsx
// 不推荐：type 和 editor 可能产生冲突。
{
  type: 'money',
  editor: 'number'
}
```

`edit.control` 只用于同一 type 的合理变体，例如：

- `enum` 的 `combobox` / `switch`
- `longText` 的 `textarea`

`type` 不由 `editableField()` 内部的 `if / else` 分支直接映射 editor，而是通过
`EditableTypeAdapterRegistry` 解析。builder 只负责：

1. 按 type 查找已启用 adapter。
2. 合并 type 默认值与列级 `edit` 配置。
3. 创建 column-bound codec。
4. 将包含 column-bound codec 的 resolved editable-cell meta 写入
   `columnDef.meta.editableCell`。
5. 交给统一的 editable cell dispatcher 渲染。

### 3.3 EditableTypeAdapterRegistry

Phase 1 先建立全部规划 type 的内部类型骨架，但 public DSL 只暴露已经完整实现的
adapter：

```ts
export interface DataTableEditableTypeAdapter<
  TData,
  TValue,
  TEditOptions,
  TEditorKey extends string
> {
  editor: TEditorKey;
  createCodec(context: {
    edit: Readonly<TEditOptions>;
    tableTimeZone?: string;
    appTimeZone?: string;
  }): DataTableEditCodec<TData, TValue>;
  resolveMeta(context: {
    field: Extract<keyof TData, string>;
    title: string;
    edit: Readonly<TEditOptions>;
  }): Record<string, unknown>;
}

export interface DataTableResolvedEditableCell<TData, TValue> {
  type: string;
  editor: string;
  codec: DataTableEditCodec<TData, TValue>;
  invalidEditBehavior: DataTableInvalidEditBehavior;
  commitMode: 'blur' | 'explicit-confirm' | 'selection';
}

export type EditableTypeAdapterRegistry<TData> = Readonly<
  Record<string, DataTableEditableTypeAdapter<TData, unknown, unknown, string>>
>;
```

registry 的约束：

- adapter 以 column `type` 为 key，包含 editor key、codec factory 和 meta 构建规则。
- registry 保存 factory，不保存跨列共享的 codec 单例。`maxFractionDigits`、rounding、empty value、
  locale 和 timeZone 等配置必须绑定到具体列。
- `SupportedEditableType` 和 `EditableFieldOptions` 只能从已注册且可执行的 adapter key
  推导。
- planned-but-disabled type 即使已有内部 options 类型，也必须在 public
  `editableField()` 调用处产生 TypeScript 错误。
- 某个 type 只有在 editor、codec、runtime wiring 和测试全部完成后才能注册为
  supported。
- 缺失 adapter 或 codec 时 fail closed，禁止回退成 text editor。

---

## 4. 统一编辑 session

### 4.1 问题

当前 runtime 会把 `activeCell.value` 直接合并进 display row。这个模型适合 text 和 choice，但不适合类型化输入。

例如用户准备输入 `-1.25` 时，编辑过程依次可能是：

```text
""
"-"
"-1"
"-1."
"-1.2"
"-1.25"
```

`"-"` 和 `"-1."` 是合理的输入中间态，但不是可以写入 `number` 字段的领域值。

### 4.2 推荐 session 模型

```ts
type DataTableActiveEditingParseState =
  | {
      parseState: 'unparsed';
      candidateValue?: never;
      validationErrors: [];
    }
  | {
      parseState: 'valid';
      candidateValue: unknown;
      validationErrors: [];
    }
  | {
      parseState: 'invalid';
      candidateValue?: unknown;
      validationErrors: string[];
    };

interface DataTableActiveEditingCellBase<TData> {
  sessionId: number;
  rowId: string;
  row: TData;
  columnId: string;
  field: Extract<keyof TData, string>;

  /** 编辑开始时的真实字段值。 */
  initialValue: unknown;

  /** editor 当前原始输入，可包含尚未完成的中间态。 */
  draftValue: unknown;

  /** session 启动时固化的 column-bound editable-cell meta。 */
  editableCell: DataTableResolvedEditableCell<TData, unknown>;
}

export type DataTableActiveEditingCell<TData> = DataTableActiveEditingCellBase<TData> &
  DataTableActiveEditingParseState;
```

active editor 的 DOM 展示 `draftValue`。

`candidateValue` 不能只用 optional 字段表示，因为 `undefined` 本身可能是合法领域值。
`parseState` 是唯一判别依据。`getDisplayRow()` 只能在 `parseState === 'valid'`
时向 active row 合并 `candidateValue`；`unparsed`、解析失败或同步校验失败的 draft
不得污染 row 类型。

active draft 继续保存在 table 级 store，不能退回 cell 局部 state 作为唯一真相源，否则虚拟行卸载会丢失输入。

Phase 1 一次性迁移现有 runtime、InputEditor、ChoiceEditor 和 Switch 通路。不让
`activeCell.value` 与新字段作为两套可写真相跨版本共存；如果未来确认旧结构属于
外部 public API，最多提供由新状态派生的只读 deprecated view。

### 4.3 Codec

内部为每个 resolved editable-cell meta 提供 column-bound codec：

```ts
export type DataTableEditParseResult<TValue> =
  | {
      status: 'valid';
      value: TValue;
    }
  | {
      status: 'invalid';
      errors: string[];
    };

export interface DataTableEditCodec<TData, TValue> {
  formatForEdit(value: TValue, row: TData): unknown;
  parse(draftValue: unknown, row: TData): DataTableEditParseResult<TValue>;
  validate(value: TValue, row: TData): string[];
}
```

Codec 是共享基础设施，不要求业务页面逐列传函数。内置 type 使用 adapter registry
中的标准 factory；只有经过复用证明的自定义 type 才能注册自定义 adapter。

绑定和发现规则：

- `data-table-edit-codecs.ts` 只提供纯 codec 和 codec factory。
- `EditableTypeAdapterRegistry` 持有 `createCodec()`，不维护另一份可能漂移的
  type → codec map。
- `createDataTableColumnDsl()` 合并列配置后创建 codec 实例，并把 resolved
  editable-cell meta 放入 `columnDef.meta.editableCell`。
- editor session 启动时固化该 editable-cell meta，避免编辑过程中配置引用变化。
- paste 和 programmatic 写入按 `columnId` 获取同一份
  `meta.editableCell.codec`，不在每次提交时重新执行 `resolveCodec(type)`。
- 同一 type 的不同列可以因 `maxFractionDigits`、empty value、locale 或 timeZone
  得到不同 codec 实例。

legacy adapter 的行为必须明确：

- text 的 `formatForEdit()` 与 `parse()` 保持 string identity；InputEditor 读写
  `draftValue`，parse 成功后同一个 string 成为 candidate。
- choice 的 `formatForEdit()` / `parse()` 保持现有单选值或多选数组，不做字符串
  转换；ChoiceEditor 从 `draftValue` 渲染选择态。
- text / choice 的 legacy validator 保持现有空值规则，不因新 codec 架构增加
  新的 block 行为。
- Switch 不进入 active session；它把新 boolean/enum typed candidate 直接提交。
- InputEditor、ChoiceEditor、`getDisplayRow()` 和 finish path 在 Phase 1 同时切换
  到新结构，不保留可写的 `activeCell.value` 兼容字段。

### 4.4 完成结果

`finishEditing()` 应返回可观察结果：

```ts
export type DataTableFinishEditingResult =
  | {
      status: 'committed';
    }
  | {
      status: 'unchanged';
    }
  | {
      status: 'blocked';
      errors: string[];
    }
  | {
      status: 'reverted';
      reason: 'invalid-edit' | 'virtualization-detach' | 'explicit-confirm-detach';
      errors?: string[];
    }
  | {
      status: 'stale-session';
    };
```

Tab 导航必须仅在 `committed` 或 `unchanged` 后发生。`blocked` 时 editor 和焦点保持不变，
`reverted` 不得被误判为成功提交。

### 4.5 统一提交管线

```text
进入编辑态
  domain value -> formatForEdit() -> draftValue -> parse() ─┐
                                                            │
原始外部输入                                                 │
  editor / paste / raw-programmatic -> parse() -> validate() ├─> commitCandidate()
                                                            │      -> commit transaction
已类型化内部输入                                             │      -> updateCell(TData[K])
  typed-programmatic candidate -----------------> validate() ┘      -> DataTableCellChange<TData>
```

`formatForEdit()` 只负责把已有领域值放入 editor，不是 paste 或所有 programmatic
入口的前置步骤。所有 raw 输入复用同一 parser 和 validator；typed candidate 可以跳过
parse，但不得跳过 validate。两条路径最终都进入同一个 `commitCandidate()` 和原子
commit transaction。

以下入口必须复用该管线：

- editor Enter / Tab / blur
- 单元格粘贴
- 选区粘贴
- 程序化提交
- 未来的 fill handle

Switch 不伪造 editing session，也不调用 `finishEditing()`。它把 typed candidate
直接交给 `commitCandidate(..., 'selection')`，与其他 editor 共享 validate、
update 和 change event；`finishEditing()` 只是 session parse、调用
`commitCandidate()` 和 session 收尾的上层编排。

---

## 5. 通用交互契约

### 5.1 开始编辑

- 单击 cell：只进入 selected。
- 双击 cell：直接进入 editing。
- selected cell 上按 Enter / F2：进入 editing。
- editor 自动聚焦，并把光标放到适合继续输入的位置。
- V1 不要求支持 printable key 直接覆盖输入；该能力作为后续增强。

### 5.2 完成、取消和导航

| 操作             | 默认行为                                                     |
| ---------------- | ------------------------------------------------------------ |
| Escape           | 取消 session，恢复 `initialValue`，焦点回到 cell             |
| Enter            | 解析并校验；成功后提交，焦点留在当前 cell                    |
| Tab              | 成功提交后移动到下一个 editable cell                         |
| Shift + Tab      | 成功提交后移动到上一个 editable cell                         |
| 点击其他 cell    | 尝试完成旧 session；失败时不得启动新 session                 |
| 点击 editor 外部 | 按 blur 尝试完成                                             |
| popup 关闭       | blur-commit 尝试完成；explicit-confirm 取消；Escape 始终取消 |

表中的 Enter 是 single-line 默认值，不是所有 editor 的硬编码行为。键盘逻辑收敛到
`DataTableEditorKeyboardShell`，由每类 editor 提供显式 keymap：

| keymap       | Enter                            | ArrowUp / ArrowDown             |
| ------------ | -------------------------------- | ------------------------------- |
| `singleLine` | 提交                             | editor 默认行为                 |
| `multiline`  | 换行；Ctrl/Cmd + Enter 提交      | 移动 caret                      |
| `numeric`    | 提交                             | 按 step 增减或显式 pass-through |
| `choice`     | 交给 listbox 选择                | 交给 listbox 导航               |
| `date`       | 交给 input / calendar 当前焦点项 | 交给 calendar 导航              |

Shell 统一处理 sessionId 防陈旧、IME guard、卸载 lifecycle、Escape、Tab 和焦点恢复，
但只执行 keymap 策略，不猜测领域语义。Command、Calendar 等子控件已经消费的事件需要在
bubble 阶段检查 `defaultPrevented`，避免事件继续泄漏到 table hotkeys。Portal 内容也必须
覆盖该事件传播测试。

Tab 提交和导航由 cells/core 层共享 helper 处理：

```ts
finishEditingAndNavigate({
  runtime,
  sessionId,
  cell,
  direction
});
```

helper 依次执行 `finishEditing()`、检查结果，并且只在 `committed` 或 `unchanged`
后通过 microtask 聚焦相邻 editable cell。DOM 查询、logical coordinate 和未来 virtual
scroll 属于该 UI 导航层，不进入纯数据 editing runtime。

### 5.3 非法值处理

公共配置：

```ts
export type DataTableInvalidEditBehavior = 'block' | 'revert';
```

- `block`：editor 保持打开，错误修复或 Escape 取消前不能移动。
- `revert`：结束 editor 并恢复旧值。

建议：

- 新增类型化 editor 默认 `block`。
- 现有无同步校验的 text / choice 行为保持不变。
- 高频录入页面可以显式改为 `revert`。

错误反馈：

- control 设置 `aria-invalid='true'`。
- 错误文本通过 `aria-describedby` 与 control 关联。
- 错误展示锚定在 editor 附近，不使用只在 hover 时出现的 Tooltip。
- 不使用 toast 表达单元格格式错误。
- 多条错误按稳定顺序展示，首条作为紧凑视觉提示。

### 5.4 输入法

- `event.nativeEvent.isComposing` 为 true 时不提交、不执行快捷键。
- parser 不得阻止 IME 组合过程。
- compositionend 后再更新解析状态。

---

## 6. Number / Int / Decimal Editor

### 6.1 字段契约

```ts
type NumericFieldValue = number | null;
```

支持字段：

- `number`
- `number | null`
- `allowEmpty=true` 默认写入 `null`，因此字段类型必须包含 `null`
- `number | undefined` 只有显式声明 `emptyValue: undefined` 且字段类型允许时才支持

非法领域值：

- `NaN`
- `Infinity`
- `-Infinity`

### 6.2 默认配置

| type      |       默认 `maxFractionDigits` | 默认 step | 默认对齐 |
| --------- | -----------------------------: | --------- | -------- |
| `int`     |                            `0` | `1`       | right    |
| `number`  |                         不限制 | `any`     | right    |
| `decimal` | 与展示 registry 对齐，建议 `3` | `any`     | right    |

推荐 DSL：

```tsx
columnDsl.editableField('quantity', '数量', {
  type: 'int',
  edit: {
    min: 0,
    max: 9999,
    step: 1,
    allowEmpty: false
  }
});

columnDsl.editableField('weight', '重量', {
  type: 'decimal',
  edit: {
    min: 0,
    maxFractionDigits: 3,
    step: 0.001
  }
});
```

建议类型：

```ts
export interface DataTableNumericEditOptions {
  allowEmpty?: boolean;
  emptyValue?: null | undefined;
  min?: number;
  max?: number;
  step?: number | 'any';
  maxFractionDigits?: number;
  allowScientificNotation?: boolean;
  preventStepping?: boolean;
  showStepperButtons?: boolean;
  invalidEditBehavior?: DataTableInvalidEditBehavior;
}
```

### 6.3 输入控件

推荐使用：

```tsx
<input type='text' inputMode='decimal' />
```

不默认使用原生 `input type='number'`，原因：

- 原生 spinner 和滚轮行为容易误修改。
- 本地化小数点和格式化行为在浏览器间不一致。
- money / percent 需要稳定的 prefix / suffix 和光标行为。
- `1.`、`-` 等中间态需要由 editor 自己保留。

如果后续引入共享 NumberField primitive，必须继续遵守当前 codec 和 session 契约，不能让组件内部 state 变成独立真相源。

### 6.4 解析

编辑态不展示千分位，避免格式化导致 caret 跳动。

parser 至少处理：

- 前后空白。
- ASCII 正负号。
- 整数和小数。
- `allowScientificNotation` 开启后的指数。
- 粘贴值中的允许分组符。
- 全角数字是否标准化由共享 parser 一次性定义。

非法或未完成输入：

- `''`：`allowEmpty=true` 时解析为 `null`，否则报错。
- `'-'`、`'.'`、`'-.'`：编辑中允许，提交时失败。
- 多个小数点：失败。
- int 出现非零小数：失败，不静默取整。
- 声明 `maxFractionDigits` 后，标准化文本的小数位超过上限时失败，不静默修约。
- 小数位按用户输入的词法形式计算，尾随零也计入；例如上限为 `2` 时，`12.340`
  仍然失败。

`maxFractionDigits` 是输入约束，不是单纯的展示修饰。editor、paste 和 raw
programmatic 输入必须使用相同规则。只需要展示修约时，不设置
`edit.maxFractionDigits`，而是使用 type 展示 registry 或列级 `formatValue`。

### 6.5 步进与滚轮

- editor 聚焦时，ArrowUp / ArrowDown 按 step 增减。
- 箭头事件由 editor 消费，不触发表格上下导航。
- `preventStepping=true` 时箭头只用于光标或不执行数值步进。
- 默认禁用 wheel 改值。
- step 校验需要处理浮点误差，不能直接使用 `%` 判断小数步长。
- 接近 min / max 时 increment / decrement 应禁用或保持边界值。

---

## 7. Money Editor

### 7.1 V1 数据契约

当前仓库 `money` 展示类型接收 `number`，使用 zh-CN 千分位和固定两位小数，不显示币种符号。

为保持向后兼容，V1 建议继续采用：

```ts
type MoneyFieldValue = number | null;
```

这个契约适用于普通后台金额录入，不适用于要求严格十进制定点精度的账本、清结算或超大金额。

严格金融字段应在后续独立支持：

- 最小货币单位整数。
- 后端 decimal string。
- 专用 decimal 类型。

不能仅依赖 `maxFractionDigits: 2` 声称解决 JS 浮点精度问题。

### 7.2 DSL

```tsx
columnDsl.editableField('amount', '金额', {
  type: 'money',
  edit: {
    currency: 'CNY',
    min: 0,
    step: 0.01,
    maxFractionDigits: 2
  }
});
```

建议扩展：

```ts
export interface DataTableMoneyEditOptions extends DataTableNumericEditOptions {
  currency?: string;
  currencyDisplay?: 'symbol' | 'narrowSymbol' | 'code';
  accounting?: boolean;
}
```

为兼容现有无符号 money 展示：

- `currency` 在 V1 保持可选。
- 新业务列建议显式声明 ISO 4217 currency code。
- 未声明 currency 时继续按普通定点金额展示。

### 7.3 交互

- 使用 `InputGroup`，currency symbol / code 是不可编辑 addon。
- 用户只输入数字，不把 `¥`、`$` 或 `CNY` 写入 row。
- 编辑态不展示千分位。
- 展示态使用共享 `Intl.NumberFormat` formatter。
- 粘贴当前币种的分组文本可以标准化。
- 粘贴其他币种符号默认拒绝，防止货币单位被静默忽略。
- 是否允许负数只由 min / 业务 validator 决定。
- currency minor unit 可以提供默认 `maxFractionDigits`，列配置允许覆盖。

### 7.4 复制

- 继续复制原始领域值，例如 `1234.5`。
- 不复制展示文本 `¥1,234.50`。
- 选区 TSV 复制保持机器可再次解析的数字格式。

---

## 8. Percent Editor

### 8.1 领域语义

当前 `type: 'percent'` 的展示 formatter 会把领域值乘以 100：

```text
领域值 0.125
展示值 12.50%
```

建议将该语义固定为：

```ts
type PercentFieldValue = number | null;
```

其中 number 始终表示比例值，不在同一个 `percent` type 中同时支持 `12.5 === 12.5%` 的另一套语义。

如果业务接口使用百分数点值，应：

- 在 API adapter 中转为比例值；或
- 后续新增含义明确的 `percentagePoints` type。

不建议增加含义模糊的布尔配置切换两种存储方式。

### 8.2 DSL

```tsx
columnDsl.editableField('taxRate', '税率', {
  type: 'percent',
  edit: {
    min: 0,
    max: 1,
    step: 0.01,
    maxFractionDigits: 2
  }
});
```

配置使用领域值单位：

- `min: 0` 表示 `0%`。
- `max: 1` 表示 `100%`。
- `step: 0.01` 表示每次增加 1 个百分点。

`min`、`max`、`step` 始终使用 row 的领域比例单位，因为它们需要直接与
candidate、后端 schema 和 `DataTableCellChange` 比较。为减少配置时的换算错误，提供
单向 helper：

```ts
export function percentPoints(value: number): number {
  return value / 100;
}

columnDsl.editableField('taxRate', '税率', {
  type: 'percent',
  edit: {
    min: percentPoints(5),
    max: percentPoints(100),
    step: percentPoints(1),
    maxFractionDigits: 2
  }
});
```

不增加 `minPercent` / `maxPercent` 等平行 alias，避免同一约束出现冲突来源。

### 8.3 解析与展示

```text
用户输入 "12.5"
  -> draftValue "12.5"
  -> candidateValue 0.125
  -> row value 0.125
  -> display "12.50%"
```

- `%` 使用不可编辑 suffix。
- 用户不需要输入 `%`。
- paste parser 可以接受末尾 `%`，但必须删除后再按百分数点解析。
- 不默认限制在 0%–100%；负增长率和超过 100% 的比率由业务 min / max 决定。
- `maxFractionDigits` 表示用户所见百分数最多允许的小数位，而不是领域比例值的小数位。
- `maxFractionDigits=2` 时，`12.345`、`12.340` 和 `12.345%` 均解析失败；
  `12.34` 解析为领域值 `0.1234`。
- parser 不原样接受超精度值后再依赖展示修约，也不静默四舍五入。
- `formatForEdit()` 不得把已有超精度领域值预先修约成合法 draft。它必须生成可回读
  实际值的 canonical draft，并让初始 session 显示 invalid，直到用户修正或取消；
  打开、blur 或取消编辑不得偷偷改写原值。

---

## 9. Date Editor

### 9.1 领域契约

date 表示不带时间、不带时区的民用日期：

```ts
type DateFieldValue = `${number}-${number}-${number}` | null;
```

运行时实际要求严格 `YYYY-MM-DD`。

禁止：

- row 中保存 `Date` 作为标准 date 字段值。
- 把 date 转成 UTC 午夜。
- 通过 `new Date('YYYY-MM-DD')` 再取本地年月日进行 round-trip。

### 9.2 DSL

```tsx
columnDsl.editableField('effectiveDate', '生效日期', {
  type: 'date',
  edit: {
    min: '2026-01-01',
    max: '2026-12-31',
    allowEmpty: false
  }
});
```

建议配置：

```ts
export interface DataTableDateEditOptions {
  allowEmpty?: boolean;
  emptyValue?: null;
  min?: string;
  max?: string;
  isDateUnavailable?: (value: string, row: unknown) => boolean;
  invalidEditBehavior?: DataTableInvalidEditBehavior;
}
```

### 9.3 UI

Date Editor 接管整个 cell：

- 左侧为可输入的 `YYYY-MM-DD` 文本。
- 右侧为 Calendar 按钮。
- popup 使用仓库现有 `Popover` + `Calendar`。
- 手工输入和日历选择更新同一个 table-level draft。

进入编辑：

- 双击 / Enter / F2 聚焦文本输入。
- 默认不自动打开 Calendar，避免键盘录入时频繁弹层。
- 点击 Calendar 按钮或 Alt + ArrowDown 打开。

打开日历：

- 原值合法时聚焦原日期。
- 空值或非法输入时聚焦今天。
- Arrow keys 在 Calendar 内移动日期。
- Escape 关闭并取消整个 cell 编辑。
- 关闭后焦点回到原 cell 或 editor control。

完成：

- 日历选择一天后立即解析、校验、提交并关闭。
- 手工输入通过 Enter / Tab / blur 完成。
- `2026-02-30` 等不存在日期必须失败。
- min / max 和 unavailable date 必须同时作用于手工输入与 Calendar。
- `allowEmpty=true` 时允许清空，并提供明确清除入口。

---

## 10. DateTime Editor

### 10.1 必须区分 instant 与 local

dateTime 上线前必须确认字段语义：

```ts
export type DataTableDateTimeValueKind = 'instant' | 'local';
```

#### instant

表示时间线上的真实时刻，例如：

- 创建时间
- 执行时间
- 预约时间
- 发布开始时间

领域值使用带 `Z` 或 offset 的 ISO 8601 字符串。editor 根据明确时区展示本地日期时间，提交时再转换为 instant。

#### local

表示不绑定时区的墙上时间，例如：

- 排班模板
- 本地门店营业安排
- 业务规则中的本地日期时间

领域值不附加时区，也不调用 `toISOString()`。

### 10.2 DSL

```tsx
columnDsl.editableField('executeAt', '执行时间', {
  type: 'dateTime',
  edit: {
    valueKind: 'instant',
    timeZone: 'Asia/Shanghai',
    granularity: 'minute',
    step: 5
  }
});
```

```tsx
columnDsl.editableField('localStartsAt', '本地开始时间', {
  type: 'dateTime',
  edit: {
    valueKind: 'local',
    granularity: 'minute'
  }
});
```

建议配置：

```ts
export interface DataTableDateTimeEditOptions {
  valueKind: 'instant' | 'local';
  timeZone?: string;
  granularity?: 'minute' | 'second';
  step?: number;
  hourCycle?: 12 | 24;
  defaultTime?: 'now' | '00:00' | string;
  min?: string;
  max?: string;
  allowEmpty?: boolean;
  emptyValue?: null;
  invalidEditBehavior?: DataTableInvalidEditBehavior;
}
```

约束：

- `valueKind` 必填，禁止根据字符串形状或当前环境推断 `instant` / `local`。
- `valueKind='instant'` 时统一调用
  `resolveDataTableTimeZone({ column, table, app })`，严格按
  `column edit.timeZone → table.timeZone → app dataTable timeZone` 解析 IANA
  时区。
- resolver 返回 `{ timeZone, source }`，column-bound codec 创建时固定结果；展示、
  editor、paste 和 programmatic commit 必须使用同一结果。
- `valueKind='local'` 不读取上述时区链，也不做 instant 转换。
- 不允许 fallback 到服务器时区、浏览器时区或用户机器时区。
- 静态配置缺失或非法时，应尽早在 column/table 构建阶段发现。开发和测试环境抛出
  包含 tableId、columnId 与 fallback chain 的错误；生产环境 fail closed：保留
  display cell、禁用该列编辑并记录可观察错误，不能猜时区或让整张表崩溃。

```ts
interface DataTableResolvedTimeZone {
  timeZone: string;
  source: 'column' | 'table' | 'app';
}

function resolveDataTableTimeZone(input: {
  columnTimeZone?: string;
  tableTimeZone?: string;
  appTimeZone?: string;
}): DataTableResolvedTimeZone;
```

### 10.3 UI

popup 内容：

- Calendar
- 时间输入
- 确定
- 取消
- 可选清除

行为：

- 选择日期后不立即提交。
- 已有值时保留原时间。
- 空值第一次选日期时使用 `defaultTime`。
- 默认 granularity 为 minute。
- zh-CN 默认使用 24 小时制。
- Enter 在时间输入合法时确认。
- Escape 取消整个 session。
- 点击确定后统一 parse / validate / commit。
- 点击 popup 外部按 blur 策略处理。

### 10.4 时区和 DST

instant editor 必须处理：

- DST 春季跳过导致的不存在本地时间。
- DST 秋季回拨导致的重复本地时间。
- timeZone 改变后的显示转换。
- 后端返回 offset string 与 UTC `Z` string 的归一化。

不存在的本地时间必须报错，不能由 `Date` 构造器静默滚动到另一个时间。

重复时间需要统一 disambiguation 策略：

- `earlier`
- `later`
- 或在 UI 中展示 offset 让用户选择

V1 可以限制为项目明确支持的业务时区，但不能省略契约。

V1 默认不自动选择 `earlier` 或 `later`。当本地时间处于 DST overlap 且没有用户
明确选择 offset 时，parse 结果为 invalid；gap 同样 invalid。不得由 `Date`
构造器静默修正。

### 10.5 API 边界

如果后端返回 `YYYY-MM-DD HH:mm:ss` 等非规范字符串，应在共享 API adapter 或注册型 codec 中归一化。

禁止每个业务列自行：

```ts
new Date(rawValue);
```

因为没有 offset 的字符串在不同运行时可能产生不同解释。

---

## 11. Long Text / Textarea Editor

### 11.1 字段与 DSL

`longText` 继续表示展示类型，通过 `edit.control='textarea'` 生成 Large Text Editor：

```tsx
columnDsl.editableField('remark', '备注', {
  type: 'longText',
  edit: {
    control: 'textarea',
    maxLength: 500,
    rows: 6
  }
});
```

建议配置：

```ts
export interface DataTableTextareaEditOptions {
  control: 'textarea';
  allowEmpty?: boolean;
  emptyValue?: '' | null;
  minLength?: number;
  maxLength?: number;
  rows?: number;
  cols?: number;
  invalidEditBehavior?: DataTableInvalidEditBehavior;
}
```

### 11.2 popup

不在 cell 内扩高 row。Large Text Editor 以非模态 popup 形式显示：

- 宽度至少覆盖原 cell。
- 默认宽度建议 360–480px。
- 默认 6 行。
- 最大高度受 DataTable viewport 和 workspace viewport 限制。
- 使用现有 `Popover` 和 `Textarea` / `InputGroupTextarea`。
- portal container 和焦点恢复复用 choice editor 模式。

### 11.3 键盘

| 操作                       | 行为                             |
| -------------------------- | -------------------------------- |
| Enter                      | 插入换行                         |
| Ctrl + Enter / Cmd + Enter | 提交                             |
| Tab                        | 提交并移动到下一个 editable cell |
| Shift + Tab                | 提交并移动到上一个 editable cell |
| Escape                     | 取消                             |

默认不在 textarea 内插入 Tab 字符，保持 DataTable 键盘导航一致。

### 11.4 文本规范

- 不默认 `trim()`，避免静默改变用户内容。
- 提交时统一 CRLF 为 LF。
- text / longText 的空文本默认写入 `''`，保持现有 string 字段与 editor 行为。
- 只有显式配置 `emptyValue: null` 且 `TData[K]` 包含 `null` 时才写入 `null`；
  DSL 必须在编译期拒绝非 nullable string 字段的该配置。
- choice 保持单选清空为 `null`、多选清空为 `[]`；numeric / date / dateTime
  的 `allowEmpty` 默认写入 `null`，对应字段类型必须包含 `null`。
- `DataTableCellChange<TData>.value` 继续保持为 `TData[K]`，不为所有列全局附加
  `| null`。
- maxLength 必须在输入中限制，并在 popup 中显示字符计数。
- 展示 cell 保持固定高度和截断，不展开完整多行内容。
- 完整内容通过 tooltip、详情面板或进入编辑查看。

---

## 12. Popup、Portal 与虚拟化

### 12.1 Portal

date、dateTime 和 textarea popup 必须：

- 使用仓库统一 Popover。
- 透传正确 overlay container。
- 点击 popup 内部不得被 DataTable 识别为 cell 外部点击。
- 关闭时只完成创建 popup 的 session。
- 旧 popup 的 onOpenChange / blur 不得结束新 session。
- `onCloseAutoFocus` 返回原 cell 或 editor control。

### 12.2 虚拟行卸载

active draft 保存在 table store 只是必要条件。V1 不修改 virtualizer，anchor
detached 时采用确定性的 fallback：

| session 状态                           | V1 行为                                                    |
| -------------------------------------- | ---------------------------------------------------------- |
| valid，且 editor 使用 blur-commit      | 调用 `commitCandidate(reason='virtualization-detach')`     |
| unparsed 或 invalid                    | revert 到 initialValue，清理 session                       |
| valid，但 editor 使用 explicit-confirm | revert 到 initialValue，清理 session                       |
| popup 已打开                           | 先关闭 popup、禁止向已卸载 anchor 恢复焦点，再执行以上规则 |

- revert 必须返回
  `{ status: 'reverted', reason: 'virtualization-detach' }`，供埋点、日志或测试观察。
- anchor 注册、卸载和 finish 均携带 sessionId；旧 anchor 的 cleanup 不能结束新
  session。
- React StrictMode 或同一虚拟项快速重挂载时，先在 microtask 检查相同 session
  的 anchor 是否已重新注册，再判定 detached，避免瞬时 unmount 误提交。
- Phase 6 再 spike `rangeExtractor` 保留 active row，以及列虚拟化下 pin active
  column 的可行性；只有 row/column anchor 和 overlay lifecycle 都能稳定保留时，
  才用 pinning 取代 V1 fallback。

### 12.3 滚动

- popup editor 不应被 table overflow 裁剪。
- table 横向或纵向滚动时，popup 应跟随 anchor 或按明确规则关闭。
- wheel 事件在 Numeric Editor 中不得误修改数值。
- Calendar 和 textarea 内部滚动不得驱动 DataTable range selection。

---

## 13. 粘贴、复制与程序化写入

### 13.1 粘贴

typed parser 必须进入 column meta，使 cell selection paste 可以按列解析：

```text
clipboard text
  -> preparePaste()
  -> columnDef.meta.editableCell.codec.parse()
  -> codec.validate()
  -> PastePlan
  -> applyPaste(plan, policy)
```

规则：

- number 粘贴 `"123.5"` 写入 `123.5`。
- money 粘贴 `"1,234.50"` 写入 `1234.5`。
- percent 粘贴 `"12.5%"` 写入 `0.125`。
- date 粘贴 `"2026-07-30"` 写入 ISO date string。
- dateTime 粘贴必须符合该列 valueKind 和 timezone 契约。
- textarea 在 active editor 内粘贴保留换行。
- 选区矩阵粘贴中的换行继续表示行分隔，不能被 textarea 列单独吞掉。

矩阵粘贴采用 prepare / apply 两阶段，避免“部分写入后再回滚”：

```ts
interface DataTablePastePlan<TData> {
  validChanges: DataTableCellChange<TData>[];
  failures: DataTablePasteFailure[];
  skipped: DataTableCellCoordinate[];
}

type DataTablePastePolicy = 'atomic' | 'valid-cells';
```

- `preparePaste()` 是纯规划步骤：拆分矩阵、映射坐标、跳过 readonly / 越界
  cell，并通过各列同一份 column-bound codec 执行 parse / validate。
- `applyPaste(plan, 'atomic')` 在存在 failure 时不写入任何 change。
- `applyPaste(plan, 'valid-cells')` 一次性批量写入 `validChanges`，同时返回完整
  failure / skipped 清单；它不是先写再回滚。
- Phase 1–5 不开放 typed matrix paste；Phase 6 结合真实 Excel 样本、批处理与
  审计语义决定默认 policy。文档当前不预设 atomic 或 valid-cells。

### 13.2 复制

- number / money / percent 复制领域原始值或标准机器文本，不复制装饰符。
- date 复制 `YYYY-MM-DD`。
- instant dateTime 复制规范 ISO instant。
- local dateTime 复制规范 local string。
- textarea 复制完整原始文本；选区 TSV 必须继续执行转义或规范化策略。

### 13.3 程序化写入

程序化写入必须用可辨识入口，不能让一个 `unknown` 参数暗示调用方意图：

```ts
type DataTableProgrammaticEditInput<TValue> =
  | { kind: 'raw-draft'; value: unknown }
  | { kind: 'typed-candidate'; value: TValue };
```

- `raw-draft` 走 column-bound codec 的 `parse → validate → commitCandidate`。
- `typed-candidate` 跳过 parse，但仍走同一 codec 的
  `validate → commitCandidate`。
- 两条路径都从 `columnDef.meta.editableCell.codec` 解析 codec；缺失 adapter /
  codec 时 fail closed，不提交。
- 公共 API 不提供绕过 validate 的“可信 typed”捷径。

---

## 14. 可访问性

- cell selection 与 editor focus 必须继续区分。
- editor control 必须有来自列标题的 accessible name，例如“编辑金额”。
- 非法 control 使用 `aria-invalid`。
- 错误文本通过 `aria-describedby` 关联。
- popup 打开后焦点进入实际交互 control。
- popup 关闭后焦点返回原 cell。
- Calendar 遵循 roving tabindex，只保留一个日期按钮进入 Tab sequence。
- Numeric stepper 按钮需要本地化的增减 aria-label。
- money prefix 和 percent suffix 为装饰时设置 `aria-hidden`，accessible name 中说明单位。
- Textarea popup 需要让屏幕阅读器知道 Ctrl/Cmd + Enter 的提交方式。
- 不为 native table 零散增加不完整的 ARIA grid 属性。

---

## 15. DSL 类型安全

Phase 1 一次性建立全部计划类型的内部类型骨架，但 public DSL 只暴露已通过退出条件的
类型：

```ts
type PlannedEditableType =
  | 'text'
  | 'enum'
  | 'select'
  | 'remoteSelect'
  | 'longText'
  | 'number'
  | 'int'
  | 'decimal'
  | 'money'
  | 'percent'
  | 'date'
  | 'dateTime';

type SupportedEditableType = keyof typeof enabledEditableTypeAdapters;
```

- `PlannedEditableType`、各 type 的 edit options 和内部 overload 骨架在 Phase 1
  一次性定义，后续阶段不反复改 builder 的分发架构。
- `SupportedEditableType` 是 public capability gate。只有 codec、editor、
  runtime、类型与虚拟化测试全部通过后，该 type 才注册进公开集合。
- DSL 收到缺失 adapter / codec 的类型必须 fail closed；不能出现“编译通过、运行时
  回退到 text editor”。

建议增加字段 key 约束：

```ts
type NumericFieldKey<TData> = Extract<
  {
    [K in keyof TData]-?: Exclude<TData[K], null | undefined> extends number ? K : never;
  }[keyof TData],
  string
>;

type DateStringFieldKey<TData> = Extract<
  {
    [K in keyof TData]-?: Exclude<TData[K], null | undefined> extends string ? K : never;
  }[keyof TData],
  string
>;
```

overload 至少保证：

- number / int / decimal / money / percent 不能用于 string 字段。
- date / dateTime 不能用于 number 字段。
- longText textarea 不能用于 number 字段。
- multiple choice 继续只允许数组字段。
- 不合法 `edit` option 在编译期失败。

类型级测试需要包含：

```ts
// Phase 3 gate 打开后 valid
columnDsl.editableField('amount', '金额', { type: 'money' });

// @ts-expect-error money editor cannot target string
columnDsl.editableField('name', '名称', { type: 'money' });

// @ts-expect-error textarea cannot target number
columnDsl.editableField('amount', '金额', {
  type: 'longText',
  edit: { control: 'textarea' }
});

// Phase 2 gate 打开前
// @ts-expect-error planned type is not publicly supported yet
columnDsl.editableField('remark', '备注', {
  type: 'longText',
  edit: { control: 'textarea' }
});
```

---

## 16. 组件与文件建议

建议局部扩展现有结构：

```text
src/components/ui/table/
├── cells/
│   ├── data-table-editable-choice-cell.tsx
│   ├── data-table-editable-value-cell.tsx
│   ├── data-table-editable-number-cell.tsx
│   ├── data-table-editable-date-cell.tsx
│   ├── data-table-editable-textarea-cell.tsx
│   └── data-table-editor-keyboard-shell.tsx
├── columns/
│   ├── data-table-column-builders.tsx
│   ├── data-table-column-types.tsx
│   ├── data-table-edit-codecs.ts
│   └── data-table-edit-adapters.ts
└── core/
    └── data-table-editor-navigation.ts

src/hooks/use-data-table/
├── use-data-table-editing.ts
└── use-data-table-editing.test.tsx

src/types/
└── data-table.ts
```

约束：

- `data-table-edit-codecs.ts` 只放 codec interface、parse result 与纯 factory，
  不持有全局可变实例。
- `data-table-edit-adapters.ts` 持有 `EditableTypeAdapterRegistry`、editor
  renderer 和 codec factory；每列构建独立 bound codec。
- `data-table-column-builders.tsx` 只调用 registry 分发并把 resolved editable-cell meta
  放入 `columnDef.meta.editableCell`，不为每种 type 堆叠条件分支。
- session / result 等跨层公共类型继续放在 `src/types/data-table.ts`，不在
  columns 目录重复定义。
- React cell 组件只负责各 editor 的 UI、draft 变化和特有动作。
- `DataTableEditorKeyboardShell` 统一处理 Enter / Escape / Tab、IME、popup
  边界和 `defaultPrevented`；numeric step、textarea 换行、Calendar 内键盘由
  各 editor 的 keymap profile 声明。
- `finishEditingAndNavigate()` 是共享 UI helper；editing runtime 返回结构化
  result，但不直接操作 DOM。
- session、stale event、commit result 继续集中在 editing runtime。
- 不为每种 type 复制 Enter / Escape / Tab 处理。
- popup lifecycle 抽取共享 hook 的前提是 date / textarea 已证明行为一致，避免过早抽象。

---

## 17. 测试策略

### 17.1 Codec 单元测试

Phase 1 / 通用：

- legacy text / choice identity codec 契约：format、parse、validate 均保持旧值。
- 相同 type 的不同 column 配置产生不同 bound codec，不共享可变配置。
- editor、single-cell paste、raw-programmatic 对同一 raw 输入产生一致的
  parse / validate 结果。
- typed-programmatic 跳过 parse，但不能绕过 validate。
- 缺失 adapter / codec 时 fail closed，不写入 change。
- longText codec 覆盖 valid / invalid，runtime 另行覆盖 unparsed session，作为
  Phase 2 基础管线验收。

Number：

- 空值、负数、小数、非法字符、NaN / Infinity。
- min / max / step / maxFractionDigits。
- int 拒绝小数。
- 超过 maxFractionDigits 的 raw draft 严格失败，不静默四舍五入。
- 浮点 step 误差。

Money：

- currency addon 不进入值。
- 分组文本粘贴。
- 非当前币种符号拒绝。
- JPY 等不同 minor unit。

Percent：

- `"12.5"` -> `0.125`。
- `"12.5%"` paste -> `0.125`。
- negative 和超过 100%。
- maxFractionDigits 使用展示百分数单位；min / max / step 使用领域比例单位。
- `formatForEdit()` 对已有超精度值不修约。

Date：

- 闰年。
- 不存在日期。
- min / max。
- 手工输入和 Calendar 结果一致。

DateTime：

- instant / local round-trip。
- timezone conversion。
- DST gap / overlap。
- minute / second granularity。

Textarea：

- CRLF -> LF。
- maxLength。
- 不默认 trim。

### 17.2 Runtime 测试

- Phase 1 旧 activeCell.value 写入与新 session 的迁移对照测试；迁移后生产消费点
  中旧 `activeCell.value` 为零。
- text / choice / switch 行为与迁移前契约一致；Switch 单击通过 typed
  candidate 直提交并执行 validate。
- draftValue 不污染 row 领域类型。
- parse 成功后 candidateValue 更新。
- unparsed 时 `getDisplayRow()` 不合并 draft；只有 valid candidate 可合并。
- invalid Enter 返回 blocked。
- blocked Tab 不移动。
- committed / unchanged 后 Tab 才移动。
- Escape 恢复 initialValue。
- virtualization-detach 的 blur-commit、invalid/unparsed revert、
  explicit-confirm revert 和 popup-close 顺序。
- stale session finish / blur 无效。
- popup 延迟关闭不结束新 session。
- snapshot 不包含未完成 active draft。
- 成功 commit 后 snapshot 包含 typed value。
- acceptChanges 不覆盖保存期间的新编辑。

### 17.3 组件测试

- 双击、Enter、F2 开始。
- Escape、Enter、Tab、Shift + Tab。
- IME composing 不提交。
- keyboard shell 尊重 editor 内的 `defaultPrevented`，Portal 事件不被重复处理。
- Numeric ArrowUp / ArrowDown。
- date popup focus 和关闭恢复。
- dateTime 确定 / 取消。
- textarea Enter 换行、Ctrl/Cmd + Enter 提交。
- aria-invalid 和错误描述。

### 17.4 浏览器 smoke

- 真实 Popover portal 内点击不触发旧 cell blur。
- 每个 type 覆盖 anchor detach：有效 blur-commit、无效 revert、explicit-confirm
  revert；旧 popup 事件不能关闭新 session。
- 横向滚动和固定列不破坏 popup anchor。
- 500 行页面下 editor 输入无明显卡顿。
- 键盘从 number -> date -> choice -> textarea 连续 Tab。
- workspace tab 切换或关闭后 overlay 正确清理。

---

## 18. 实施阶段

### Phase 0：契约冻结

- 记录第 20 节已决策事项，冻结 ratio、number money、空值、时区和
  maxFractionDigits 语义。
- typed matrix paste policy 明确留在 Phase 6 决策门，不阻塞单 cell editor。

### Phase 1：架构骨架与存量迁移

- 建立 `EditableTypeAdapterRegistry`，重构 `editableField()` 为 registry 分发。
- 一次性增加全部 planned type 的内部 DSL/edit-options/overload 骨架；public
  capability gate 仅保留当前已支持类型。
- 将 session 一次性迁移为 draft / parseState / candidate / validationErrors，
  不保留双 store 或旧字段的长期兼容层。
- 用 identity codec / legacy adapter 一次性迁移 text、choice；Switch 走 typed
  candidate 直提交。
- 落地三条入口管线、结构化 finish result、`DataTableEditorKeyboardShell` 与
  `finishEditingAndNavigate()`。
- 落地 anchor-detached V1 fallback 与 session-aware anchor lifecycle。
- 单 cell paste / raw-programmatic 接入同一 bound codec；typed-programmatic
  强制 validate。矩阵 paste 仍关闭。

退出条件：

- legacy identity codec 契约、迁移对照和 Switch 直提交测试通过。
- 全部现有编辑测试绿色；生产代码中旧 `activeCell.value` 消费点归零。
- registry、缺失 adapter fail-closed、多列配置隔离与统一解析测试通过。

### Phase 2：Large Text

- 用 longText 先验证 draft → parse → candidate 基础管线。
- 完成 textarea popup、字符计数、键盘、overlay 和虚拟化卸载测试。
- codec、editor、runtime、类型与 browser smoke 全部通过后，才将 `longText`
  注册到 public `SupportedEditableType`。

### Phase 3：Numeric 家族

- number / int / decimal / money / percent 共用 Numeric Editor。
- 完成严格 parse、maxFractionDigits、step、copy / single-cell paste 与
  programmatic 测试。
- 各 type 的 codec、editor、runtime、类型与虚拟化用例通过后，逐个打开 public
  gate；不能以 numeric 家族为单位一次性暴露未完成成员。

### Phase 4：Date

- 手工输入。
- Calendar popup。
- min / max / unavailable。
- 可访问性和焦点恢复。
- codec、editor、runtime、类型与虚拟化用例通过后打开 `date` public gate。

### Phase 5：DateTime

- instant / local adapter。
- timeZone 和 DST。
- time input 与显式确认。
- API 边界规范化。
- resolver、缺失时区 fail-closed、codec、editor、runtime、类型与虚拟化用例
  通过后打开 `dateTime` public gate。

### Phase 6：增强

- 执行 typed matrix paste 决策门，落地 `preparePaste()` /
  `applyPaste(plan, policy)` 和错误清单交互。
- spike virtualizer `rangeExtractor` 的 active row 保留与 column virtualizer
  pinning；评估后再决定是否替代 V1 detach fallback。
- printable key 开始编辑。
- Delete / Backspace 清空。
- fill handle。
- server validation error 回写 cell 状态。

---

## 19. 风险

### 19.1 session 模型改动影响现有 editor

风险：text / choice / switch 回归。

控制：

- 先用现有测试固定旧行为。
- Phase 1 用 identity adapter 一次性迁移，不让新旧 store 结构共存。
- 迁移对照、Switch 直提交和全量回归作为退出门。
- 保持 `editing.onChange` 和 snapshot 外部结构兼容。

### 19.2 money 浮点精度

风险：使用 number 被误认为适合账本。

控制：

- 文档明确 V1 边界。
- 后续 decimal / minor-unit contract 独立设计。
- 不在 formatter 中掩盖领域误差。

### 19.3 percent 双重语义

风险：部分接口存比例，部分接口存百分数点。

控制：

- `percent` 固定为比例值。
- percentPoints helper 只负责把配置中的百分数点显式换成领域比例值。
- maxFractionDigits 在展示百分数单位严格校验；min / max / step 保持领域比例
  单位。

### 19.4 dateTime 时区漂移

风险：无 offset 字符串经过 `new Date()` 后被不同环境解释。

控制：

- valueKind 必填。
- instant 按 column → table → app 解析明确 IANA timeZone。
- 缺失或非法时区 fail closed，不使用环境默认值。
- 禁止业务页面自由转换。
- 增加 DST 测试。

### 19.5 popup 与虚拟化

风险：anchor 卸载、focus 丢失、旧 blur 提交新 session。

控制：

- V1 使用确定性的 commit / revert fallback。
- 所有 finish / cancel 带 sessionId。
- browser smoke 覆盖真实 portal 和虚拟滚动。
- Phase 6 独立评估 row/column pinning，不把不完整 rangeExtractor 当作 V1 前提。

---

## 20. 已决策事项与 Phase 6 决策门

### 20.1 已决策

1. `percent` 始终保存领域比例值，`0.125 === 12.5%`；配置需要百分数点时使用
   `percentPoints(n)` 显式换算。
2. V1 `money` 使用 `number`，decimal / minor-unit contract 另案设计。
3. 新 typed editor 的 `invalidEditBehavior` 默认 `block`；legacy text / choice
   在 identity migration 中保持现状。
4. `dateTime.valueKind` 必填。
5. instant timeZone 按 column → table → app 解析；统一使用
   `resolveDataTableTimeZone()`，缺失或非法时 fail closed。
6. text / longText 清空默认 `''`；nullable string 可显式配置
   `emptyValue: null`。choice 单选 / 多选保持 `null` / `[]`，numeric / date /
   dateTime 的 allowEmpty 为 `null` 且要求 nullable 字段。
7. `precision` 统一命名为 `maxFractionDigits`，在 number / percent raw parse
   阶段严格校验；不得静默修约。percent 的该配置使用展示百分数单位。
8. V1 virtualization detach 按 session 状态执行明确 commit / revert，popup
   先关闭；Phase 6 才评估 row/column pinning。
9. codec 由 adapter factory 创建为 column-bound 实例，并固定在
   `columnDef.meta.editableCell`；editor、paste 与 programmatic 共享该实例。
10. 全部 planned type 在 Phase 1 建内部类型骨架，各 type 只在完成退出条件后
    进入 public `SupportedEditableType`。

### 20.2 Phase 6 唯一决策门

typed matrix paste 的默认 policy 在 `atomic` 与 `valid-cells` 之间待定。决策前必须
用真实 Excel 多行多列样本验证：

- failure / skipped 坐标是否足以帮助用户定位错误。
- 业务批处理、审计、撤销和保存 API 是否允许部分成功。
- 大批量 parse / validate 的性能与错误呈现。
- readonly、越界、跨 pinned column 和 textarea 换行的期望行为。

无论最终 policy 为何，都复用 `preparePaste()` 生成完整 `PastePlan`，再由
`applyPaste()` 单次应用，不做“先写成功 cell、失败后回滚”的实现。

---

## 21. 外部参考

- [AG Grid — Cell Editing](https://www.ag-grid.com/react-data-grid/cell-editing/)
- [AG Grid — Start/Stop Cell Editing](https://www.ag-grid.com/react-data-grid/cell-editing-start-stop/)
- [AG Grid — Cell Editors](https://www.ag-grid.com/react-data-grid/cell-editors/)
- [AG Grid — Number Cell Editor](https://www.ag-grid.com/react-data-grid/provided-cell-editors-number/)
- [AG Grid — Date Cell Editors](https://www.ag-grid.com/react-data-grid/provided-cell-editors-date/)
- [AG Grid — Large Text Cell Editor](https://www.ag-grid.com/react-data-grid/provided-cell-editors-large-text/)
- [AG Grid — Cell Editing Validation](https://www.ag-grid.com/react-data-grid/cell-editing-validation/)
- [React Aria — NumberField](https://react-aria.adobe.com/NumberField/useNumberField)
- [React Spectrum — DatePicker](https://react-spectrum.adobe.com/DatePicker)
- [WAI-ARIA APG — Date Picker Dialog Example](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/examples/datepicker-dialog/)
- [WAI-ARIA APG — Grid Pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/)
- [MDN — input type=number](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/number)
- [MDN — input type=date](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/date)
- [MDN — input type=datetime-local](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/input/datetime-local)
- [MDN — textarea](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/textarea)
- [MDN — Intl.NumberFormat](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/NumberFormat/NumberFormat)

### Update (2026-07-30)

- 实现状态：架构已批准；Task 01 契约冻结与回归基线已完成，未修改生产行为。
- 依赖关系：Task 01 的目标 Vitest、类型检查和 lint 已通过，Task 02 已解除前置依赖。
- 实现状态：Task 02 已完成 column-bound codec、adapter registry 与 public capability
  gate；legacy public editable type 和服务端筛选 DSL 保持不变。
- 依赖关系：Task 02 验证已通过，Task 03 已解除前置依赖。
- 实现状态：Task 03 已完成 editing session 单一状态模型、结构化 finish result 与统一
  `commitCandidate()`；text、choice、switch 已迁移且外部 change / snapshot 契约保持兼容。
- 依赖关系：Task 03 目标回归、类型检查和 lint 已通过，Task 04 已解除前置依赖。
- 实现状态：Task 04 已完成共享 keyboard shell、结果感知的前后导航、IME 与 portal
  事件边界；text 和 choice 已移除重复键盘 lifecycle。
- 依赖关系：Task 04 的 unit、typecheck、lint、build 和浏览器 smoke 已通过，Task 05
  已解除前置依赖。
- 实现状态：Task 05 已完成 raw / typed programmatic write、single-cell paste 与统一
  validated commit transaction；matrix paste 继续 fail-closed。
- 依赖关系：Task 05 目标回归、类型检查和 lint 已通过，Task 06 已解除前置依赖。
- 实现状态：Task 06 已完成 session-aware anchor lifecycle、StrictMode 重挂载保护和
  virtualization detach commit / revert fallback；未修改 virtualizer range / pinning。
- 依赖关系：Task 06 目标 unit、typecheck、lint、build 与两组浏览器 smoke 已通过，
  Task 07 已解除前置依赖；Phase 1 全仓 `pnpm check` 仍受两个无关既有 unit 基线失败阻塞。
- 实现状态：Task 07 已完成 longText codec、textarea popup、字符限制、类型约束和真实
  虚拟卸载回退，并已开放 `longText` public capability gate。
- 依赖关系：Task 07 的目标 unit、typecheck、lint、build 与浏览器 smoke 已通过，
  Task 08 已解除前置依赖。
- 实现状态：Task 08 已完成共享 Numeric Editor、严格数值 codec、领域单位约束、
  step / copy / paste / programmatic write、money currency 与 percent 比例换算；
  `number`、`int`、`decimal`、`money`、`percent` public capability gate 已按顺序开放。
- 依赖关系：Task 08 的目标 unit、typecheck、lint、build 与浏览器 smoke 已通过，
  Task 09 已解除前置依赖；money V1 的 `number` 精度边界保持不变。
- 实现状态：Task 09 已完成严格 `YYYY-MM-DD` Date Editor、civil date codec、
  Calendar / 手工输入统一提交、nullable 类型约束、overlay 可访问性与虚拟卸载回退；
  `date` public capability gate 已开放。
- 依赖关系：Task 09 的目标 unit、typecheck、lint、build 与浏览器 smoke 已通过，
  Task 10 已解除前置依赖；DateTime 仍须通过显式时区与 DST dependency gate。
- 实现状态：Task 10 已完成 instant / local DateTime Editor、column → table → app
  IANA 时区解析、DST gap / overlap fail-closed、offset / Z 规范化、minute / second
  约束与 explicit-confirm 生命周期；`dateTime` public capability gate 已开放。
- 依赖关系：Task 10 的目标 unit、typecheck、lint、build 与两组浏览器 smoke 已通过，
  Task 11 已解除前置依赖；V1 全仓检查仅保留两个已记录的无关 unit 基线失败。

### Update (2026-07-31)

- 实现状态：Task 11 已完成 Phase 6 能力审计、性能证据、架构裁决和二次拆分；matrix
  paste 使用 `atomic`，virtualizer pinning 为 `no-go`。
- 依赖关系：首席架构师批准使用带 provenance 的合成 Excel-compatible E01–E03
  fixture 替代本次真实 Excel clipboard 采样；Task 12 已解除前置依赖，Task 13 /
  Task 14 依赖 Task 12，Task 15 依赖 Task 11。
- 实现状态：Task 12 已完成 atomic matrix paste parser、immutable plan、editing batch
  transaction、失败坐标反馈、10k 上限 / 分块取消与 V1 editor domain round-trip。
- 依赖关系：Task 12 的目标 unit、typecheck、lint、format、build 和浏览器 smoke
  已通过；Task 13、Task 14 已解除前置依赖。
- 实现状态：Task 13 已完成 printable key 首字符 draft 与 atomic Delete / Backspace；
  required、readonly 和 active session 失败保持零写入，键盘焦点与选区保持稳定。
- 依赖关系：Task 13 的目标 unit、typecheck、lint、format 与区域选择浏览器 smoke
  已通过；Task 14 仍依赖已完成的 Task 12，Task 15 仍依赖已完成的 Task 11。
- 实现状态：Task 14 已完成 accessible fill handle、单值 / 规则矩形重复、四向填充、
  atomic typed revalidation 与虚拟表 auto-scroll；numeric / date sequence 未开放。
- 依赖关系：Task 14 的目标 unit、typecheck、lint、format、build 与区域选择浏览器
  smoke 已通过；Task 15 仍依赖已完成的 Task 11。
- 实现状态：Task 15 已完成 typed server cell error 批量入口、per-cell revision stale
  response 防护、可访问 cell 状态与员工页 partial-save 适配；未新增业务 API。
- 依赖关系：Task 15 的目标 unit、typecheck、lint、format、build 与编辑示例浏览器
  smoke 已通过；Task 01–15 全部完成，无剩余实现依赖。
- 实现状态：Task 09/10 后续格式收口已完成；Date 保持 `YYYY-MM-DD`，DateTime 的
  编辑、展示与复制统一为 `YYYY-MM-DD HH:mm:ss`，界面不再展示时区来源，领域存储
  与 DST 校验语义保持不变。
- 依赖关系：本次格式收口未新增依赖、未重新打开 capability gate，也未改变
  Task 01–15 的完成状态与依赖拓扑。
- 实现状态：2026-07-31 code review follow-up 已将 `explicit-confirm` 收紧为 blur、
  切换 cell、popup close 与 virtualization detach 均回滚；Enter、Ctrl/Cmd+Enter 与
  Tab 仍属于主动键盘确认，消除第 5.2、10.3 与 12 节之间的歧义。
- 实现状态：列虚拟化启用时，Tab 完成编辑后不再通过已挂载 DOM 推断逻辑相邻列，
  而是 fail closed 保持当前焦点；普通表格与连续行虚拟窗口仍保留 DOM 邻接导航。
- 实现状态：numeric `maxFractionDigits` 改为对有限数值的规范化文本校验，忽略无语义的
  尾随零；例如上限为 2 时 `12.340` 归一化为 `12.34` 后通过，但 `12.345` 仍失败，
  且不会静默四舍五入。此 Update 覆盖第 20.1.7 条的 raw lexical trailing-zero 口径。
- 实现状态：临时 React Profiler 在 500 行、关闭虚拟化的测试夹具中测得单字符 draft
  更新触发一次完整 update commit，jsdom `actualDuration` 为 60.29ms；临时探针已删除，
  当前未改变 draft 持久化与 session 架构。
- 依赖关系：按键重渲染优化列为独立 `P1` 后续项，须先设计 editor 级订阅边界并保持
  virtualization detach 不丢 draft；adapter 两阶段 side-channel 列为 `P1` 重构，
  percent 配置单位显式命名与 edit-ready AT 审计列为 `P2`，均不重新打开 Task 01–15。
- 实现状态：Task 08 数字步进器已改为上 `+`、下 `−` 的垂直 `ButtonGroup`；Task 09
  纯 Date 编辑已改为进入编辑即打开 Calendar，并移除日历顶部 Date 文本输入。
- 实现状态：Task 09/10 的 Calendar 已统一为标题两侧导航与整宽七列布局；Date 仍选日
  立即提交；DateTime 已移除顶部完整日期时间文本 Input，保留 Calendar、时间控件与
  显式确认。
- 依赖关系：本次交互收口仅复用既有 shadcn `InputGroup`、`ButtonGroup`、`Calendar`
  与 `Popover`，未新增或升级依赖，也未改变 capability gate 与任务依赖拓扑。

### Update (2026-07-31)

- 实现状态：Task 02/05/09/10/12/14 的用户可见校验与批量操作错误已切换到类型化
  `zh-CN` DataTable 消息目录；共享 Calendar 的 selected modifier 现在直接约束日期
  按钮，选中背景在 hover/focus 下保持主色。
- 依赖关系：本次只复用锁定的 `react-day-picker@9.14.0` 与现有 shadcn Calendar，
  未新增或升级依赖，未改变 Task 01–15 的 capability gate 和依赖拓扑。
