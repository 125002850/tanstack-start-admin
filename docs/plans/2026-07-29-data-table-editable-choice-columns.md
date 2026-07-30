# DataTable 可编辑选择列与跨页草稿 Implementation Plan

**Date:** 2026-07-29

**Status:** COMPLETE — V1 已实现并通过功能范围内的单元、类型、lint、格式与浏览器 smoke 验证

**Goal:** 为 `createDataTableColumnDsl<TData>()` 增加类型安全的可编辑选择列，为 `useDslDataTable()` 增加跨已加载分页的草稿快照能力，同时保持数据持久化策略由业务调用方决定。

**Architecture:** `columnDsl.editableField()` 声明列级编辑器；DataTable 只维护“服务端基准 + 字段草稿”并在编辑完成后触发 `editing.onChange`；`useDslDataTable()` 按稳定 row ID 缓存同一查询范围内已加载分页，`getSnapshot()` 返回全部已加载数据及其变化；业务可在 `onChange` 中自动保存，或通过 `getSnapshot()` 手动保存，并在成功后确认已持久化的 changes。
**Tech Stack:** React 19、TanStack Table 8、TanStack Query 5、Base UI / shadcn/ui、TypeScript、Vitest、Testing Library、Playwright。

---

## 1. 背景与现状

当前仓库已经具备：

- `createDataTableColumnDsl<TData>()` 的 `field`、`badge`、`actions`、`custom`。
- `type: 'enum'` 的展示能力，当前优先从 `filterOptions` 解析 label。
- `useDslDataTable()` 的服务端分页、筛选、排序、`keepPreviousData` 与刷新生命周期。
- 稳定 row ID 的统一解析入口 `resolveDataTableRowId()`。
- 单选 `SearchCombobox`、本地 `MultiSelectCombobox` 和远程状态 hook `useRemoteComboboxState()`。
- 支持虚拟化、单元格范围选择和复制的 DataTable body。

当前缺口：

- `columnDsl.editableField` 仅在规范中预留，尚无共享契约和实现。
- `select`、`remoteSelect` 尚未进入内置列 type registry。
- `SearchCombobox` 是单选受控组件；`MultiSelectCombobox` 目前只支持本地 `string[]` 选项。
- `useDslDataTable()` 只保留当前页映射结果，没有跨已访问分页的编辑草稿。
- 没有标准化的 cell 编辑开始、结束、取消、变化通知和虚拟化卸载语义。

本方案参考以下成熟库的职责划分：

- [MUI X Column Definition](https://mui.com/x/react-data-grid/column-definition/)：选择列定义 option value/label 与单选、多选值形状。
- [MUI X Editing Persistence](https://mui.com/x/react-data-grid/editing/persistence/)：编辑结束后产生 row update，持久化由调用方回调完成。
- [AG Grid Rich Select](https://www.ag-grid.com/react-data-grid/provided-cell-editors-rich-select/)：同一选择器家族支持复杂选项、搜索、多选和自定义展示。
- [AG Grid Async Rich Select](https://www.ag-grid.com/react-data-grid/provided-cell-editors-rich-select-async/)：异步搜索、分页、loading 与 Promise 数据源。
- [TanStack Table Meta](https://tanstack.com/table/latest/docs/api/core/table)：通过 table meta 注入可编辑数据更新能力，表格核心不绑定具体后端。

---

## 2. 已确认的设计决策

### 2.1 V1 可编辑列类型

V1 只实现选择器家族：

```ts
type DataTableEditableChoiceType = 'enum' | 'select' | 'remoteSelect';
```

语义：

- `enum`：封闭、稳定的领域枚举。
- `select`：调用方提供的本地自定义选项。
- `remoteSelect`：需要远程搜索或分页加载的选项。

三者属于同一个 choice editor 家族，但 option 来源和具体 UI 不同：

| type           | option 来源   | 单选 editor                                 | 多选 editor                                               |
| -------------- | ------------- | ------------------------------------------- | --------------------------------------------------------- |
| `enum`         | 本地固定      | `Select`                                    | `MultiSelectCombobox`                                     |
| `select`       | 本地自定义    | `SearchCombobox`                            | `MultiSelectCombobox`                                     |
| `remoteSelect` | 远程搜索/分页 | `SearchCombobox` + `useRemoteComboboxState` | 扩展后的 `MultiSelectCombobox` + `useRemoteComboboxState` |

V1 不包含 text、number、date、boolean 等输入编辑器；后续复用同一草稿引擎扩展。

### 2.2 单选与多选

选择数量放在 `edit.selectionMode`：

```ts
type DataTableChoiceEditOptions =
  | {
      selectionMode?: 'single';
    }
  | {
      selectionMode: 'multiple';
      maxSelected?: number;
    };
```

约束：

- `single` 字段值为 `TValue | null`。
- `multiple` 字段值为 `TValue[]`。
- 单选清空后写入 `null`。
- 多选清空后写入 `[]`。
- `maxSelected` 未传时不限制。
- 多选值按 value 去重，并保留用户选择顺序。
- 远程多选只能选择当前已经加载的 option；搜索或加载下一页时，已有选择不丢失。
- V1 不提供“选择全部远程数据”；未来如增加全选，只表示当前已加载 option。

### 2.3 Option 结构

V1 统一要求调用方在边界处转换为标准 Option，不提供 `getOptionValue` / `getOptionLabel` / `getOptionKey`：

```ts
export type DataTableChoiceValue = string | number;

export interface DataTableChoiceOption<TValue extends DataTableChoiceValue = string> {
  value: TValue;
  label: string;
  disabled?: boolean;
}
```

业务接口返回 `{ id, name }` 时由调用方转换：

```ts
const options = response.list.map((item) => ({
  value: item.id,
  label: item.name
}));
```

不得把完整 Option 对象写入 row 字段；row 只存 value 或 value 数组。

现有 `Option` 和 `filterOptions` 契约必须保持向后兼容；是否复用或新增 `DataTableChoiceOption` 由 Task 0 的类型测试决定，禁止直接破坏现有 `Option.value: string` 使用方。

### 2.4 Option 配置位置

展示、编辑和筛选都可能需要 value-label 映射，所以 option source 属于列级配置，不放进 `edit`。

静态类型：

```ts
columnDsl.editableField('status', '状态', {
  type: 'enum',
  valueOptions: [
    { value: 'ENABLED', label: '启用' },
    { value: 'DISABLED', label: '停用' }
  ],
  edit: {
    selectionMode: 'single'
  }
});
```

远程类型：

```ts
columnDsl.editableField('roleIds', '角色', {
  type: 'remoteSelect',
  remoteOptions: {
    loadOptions: async ({ keyword, pageNo, pageSize, signal }) => ({
      items: await loadRoleOptions({ keyword, pageNo, pageSize, signal }),
      total: 100
    }),
    resolveOptions: async ({ values, signal }) => {
      return resolveRoleOptions(values, signal);
    }
  },
  edit: {
    selectionMode: 'multiple'
  }
});
```

静态 `valueOptions` 在以下条件下可作为 `filterOptions` 默认值：

- `filter` 是 `'select'` 或 `'multiSelect'`。
- 调用方没有显式传入 `filterOptions`。

`remoteSelect` 不隐式创建远程筛选器。V1 如需筛选，必须继续显式提供当前 DSL 支持的 `filter` 和 `filterOptions`；远程筛选 UI 不在本次范围。

### 2.5 展示规则

- 单选展示匹配 option 的 label。
- 多选默认展示 `label[]`，使用 `、` 连接。
- 展示继续复用 `renderDataTableTextCell()` 的截断和 tooltip。
- 调用方可继续使用既有 `format` / `formatValue` 覆盖默认展示。
- option 中找不到 value 时展示原始 value。
- remote label 首次解析时展示稳定尺寸的 `Skeleton`。
- 已有缓存 label 时，后台刷新不得切回 loading。
- remote label 解析失败时展示原始 value；错误不得让 cell 空白。

### 2.6 行级编辑权限

使用 `editableField` 表达“该列具备编辑器”，使用 table 级 predicate 表达动态权限：

```ts
useDslDataTable({
  rowId: 'id',
  editing: {
    isCellEditable: ({ rowId, row, columnId }) => {
      return editableRowIds.has(rowId) && row.status === 'DRAFT';
    },
    onChange
  }
});
```

有效条件：

```text
列由 editableField 创建
&& editing.isCellEditable(context) !== false
```

禁止新增独立 `edit.rowKey` 或复制一套 row ID 解析逻辑。跨页编辑必须显式提供稳定 `rowId` 或 `getRowId`；index fallback 不满足契约。

---

## 3. Remote Option 契约

```ts
export interface DataTableRemoteOptionPage<TValue extends DataTableChoiceValue> {
  items: DataTableChoiceOption<TValue>[];
  total?: number;
}

export interface DataTableRemoteOptions<TValue extends DataTableChoiceValue> {
  loadOptions(params: {
    keyword: string;
    pageNo: number;
    pageSize: number;
    signal: AbortSignal;
  }): Promise<DataTableRemoteOptionPage<TValue>>;

  resolveOptions?(params: {
    values: readonly TValue[];
    signal: AbortSignal;
  }): Promise<DataTableChoiceOption<TValue>[]>;

  debounceMs?: number;
  pageSize?: number;
}
```

约束：

- 必须传加载函数，禁止在列定义阶段创建裸 `Promise<Option[]>`。
- 内部必须通过 React Query 和 `useRemoteComboboxState` 管理请求，不允许 cell 自行 `useEffect(fetch)`。
- query key 至少包含 `tableId + columnId + keyword + pageNo + pageSize`。
- 请求必须支持取消、搜索防抖、分页追加、按 value 去重和错误状态。
- `resolveOptions` 用于根据 row 中已有 value 批量补齐 label。
- 当前页多个 cell 的待解析 value 必须按 column 聚合、去重后批量解析，禁止每个 cell 独立发请求造成 N+1。
- V1 的远程 option domain 是列级共享的，不支持根据不同行动态改变远程数据源。
- `resolveOptions` 未提供或解析失败时允许回退为原始 value。

---

## 4. 编辑事件与快照契约

### 4.1 Change

```ts
export type DataTableCellChange<TData> = {
  [K in Extract<keyof TData, string>]: {
    rowId: string;
    field: K;
    previousValue: TData[K];
    value: TData[K];
  };
}[Extract<keyof TData, string>];
```

### 4.2 Snapshot

```ts
export interface DataTableEditSnapshot<TData> {
  /** 当前查询范围内所有已加载分页，合并草稿并按 rowId 去重。 */
  rows: TData[];

  /** 相对服务端基准发生变化的行。 */
  changedRows: TData[];

  /** 字段级变化。 */
  changes: DataTableCellChange<TData>[];

  /** 已加载页码，升序排列。 */
  loadedPages: number[];
}
```

快照顺序：

- `rows` 按 pageNo 升序排列。
- 每页内部保持服务端返回顺序。
- 同一 row ID 重复出现时只保留最新加载版本，并重新叠加草稿。
- `changedRows` 按它在 `rows` 中的顺序输出。

### 4.3 `onChange`

```ts
export interface DataTableEditChangeEvent<TData> {
  changes: DataTableCellChange<TData>[];
  snapshot: DataTableEditSnapshot<TData>;
  reason: 'blur' | 'enter' | 'tab' | 'selection' | 'paste' | 'programmatic';
}

export interface DataTableEditingOptions<TData> {
  isCellEditable?: (context: DataTableCellEditableContext<TData>) => boolean;
  onChange?: (event: DataTableEditChangeEvent<TData>) => void;
}
```

语义：

- `onChange` 是“编辑行为完成且值实际变化”的通知，不是输入框逐字符事件。
- 一次操作可能产生多个 changes，必须用数组承载粘贴、清除选区等未来行为。
- DataTable 不把 `onChange` 的返回值解释为持久化事务。
- 业务需要自动保存时，在 `onChange` 中调用 `mutation.mutate(...)`。
- 异步错误必须由业务 mutation 或显式 catch 处理，禁止产生未处理 Promise rejection。

### 4.4 Controller

```ts
export interface DataTableEditingController<TData> {
  getSnapshot(): DataTableEditSnapshot<TData>;
  hasChanges(): boolean;
  acceptChanges(
    changes: readonly DataTableCellChange<TData>[],
    serverRows?: readonly TData[]
  ): void;
  discardChanges(): void;
}
```

`hasChanges()` 是 `baseRows` 与 `draftRows` 在可编辑字段上的派生比较结果，不维护独立 dirty 真相源。

自动保存：

```ts
editing: {
  onChange: ({ changes }) => {
    updateMutation.mutate(changes, {
      onSuccess: (serverRows) => editing.acceptChanges(changes, serverRows)
    });
  };
}
```

手动保存：

```ts
const snapshot = editing.getSnapshot();
const serverRows = await save(snapshot.changedRows);

editing.acceptChanges(snapshot.changes, serverRows);
await queryState.refetch();
```

`acceptChanges()` 必须只确认传入 change 描述的值：

- 如果保存期间同一字段再次被修改，新值不得被旧响应覆盖或清除。
- `serverRows` 存在时，以服务端规范化后的值更新基准。
- `serverRows` 不存在时，以已提交 change 的 value 推进基准，再允许后台 invalidate/refetch。

---

## 5. 跨页草稿模型

内部建议模型：

```ts
baseRowsById: Map<string, TData>;
draftRowsById: Map<string, TData>;
loadedPageRowIds: Map<number, string[]>;
editableFields: Set<string>;
```

规则：

- 加载新分页时，将服务端 row 写入 `baseRowsById`。
- 当前页展示数据由最新 base row 叠加对应 draft 字段得到。
- 切换分页不清除 draft。
- 回到已访问分页时继续展示草稿值。
- `getSnapshot()` 返回当前查询范围内所有已加载分页，而不是只返回当前页。
- `hasChanges()` 只比较 editable fields。
- 多选数组按 value 顺序逐项比较；顺序不同视为变化。
- date 等未来编辑类型必须通过类型 registry 提供语义比较器，不得依赖 `JSON.stringify`。

后台 refetch 合并：

```text
用户修改过的字段：draft 优先
用户未修改的字段：最新 server row 优先
```

修改字段可以在 refetch 前通过旧 base 与 draft 的语义比较推导，不需要独立 dirty boolean。

### 查询范围

V1 的跨页定义为同一查询范围：

```text
相同 filter
相同 sorting
相同 baseCondition
相同 pageSize
仅 pageNo 改变
```

filter、sorting、baseCondition 或 pageSize 改变时视为新 scope。V1 不混合不同 scope 的 loaded rows；存在草稿时，页面必须先通过 `hasChanges()` 提示保存或放弃，再切换 scope。

跨页编辑开启后，仅 refetch 当前页不足以推进全部基准，所以提交成功后必须：

- 对已提交 changes 调用 `acceptChanges()`；并且
- 根据业务需要 invalidate/refetch 相关查询。

---

## 6. Cell 编辑生命周期

现有 DataTable 已有范围选择和键盘焦点，V1 采用以下编辑入口避免冲突：

- 双击 editable cell 进入编辑。
- 聚焦 editable cell 后按 Enter 或 F2 进入编辑。
- 普通单击继续服务于现有 cell range selection。

退出规则：

- text 类未来 editor：焦点真正离开 cell/editor overlay 时完成编辑。
- `Select`：选择完成或浮层关闭时完成编辑。
- 多选：浮层关闭、Enter 或 Tab 时完成编辑。
- Enter：完成编辑。
- Tab：完成编辑并移动到下一个可编辑 cell。
- Escape：取消当前 editor draft，不产生 change。

不得把所有 editor 的 DOM `blur` 直接等同于编辑完成。Select/Combobox 使用 Portal，trigger、搜索输入和选项之间的焦点转移属于 editor 内部交互。

底层统一成：

```ts
finishEditing({
  reason: 'blur' | 'enter' | 'tab' | 'selection'
});
```

虚拟化约束：

- active editor 的 draft 必须同步进入 table 级编辑 store，不得只保存在会被虚拟化卸载的 cell component 中。
- active row/cell 因滚动卸载时不得丢失已输入值。
- 编辑器打开时，范围选择、复制和行展开不能重复响应同一 pointer/keyboard 事件。
- 交互控件必须保持明确的 aria label、错误状态和关闭后焦点恢复。

---

## 7. 向后兼容与非目标

### 向后兼容

- 保留 `columnDsl.field()`、现有 `type: 'enum'` 和 `filterOptions` 行为。
- 不删除、不重命名现有 DataTable props。
- 不改变现有 filter 的扁平 DSL。
- 不改变默认 page-scoped row selection 语义；编辑草稿跨页不代表 row selection 跨页。
- 不覆盖既有 custom type key 或改变 type registry fallback。
- 优先扩展现有 `SearchCombobox`、`MultiSelectCombobox` 与 `useRemoteComboboxState`，禁止复制一套浮层、搜索和分页组件。

### V1 非目标

- text、number、date、boolean inline editor。
- 跨不同 filter/sort/baseCondition/pageSize scope 的草稿聚合。
- 远程 filter UI。
- 全量远程 option 全选。
- 协同编辑、版本冲突合并和服务端锁。
- undo/redo、批量粘贴写入、fill handle。
- 自定义任意 option object mapper。
- 行级 full-row editor。

---

## 8. 目标文件结构

- Modify: `src/types/data-table.ts`
- Modify: `src/components/ui/table/columns/data-table-column-builders.tsx`
- Modify: `src/components/ui/table/columns/data-table-column-options.ts`
- Modify: `src/components/ui/table/columns/data-table-column-types.tsx`
- Modify: `src/components/ui/table/columns/data-table-column-rendering.tsx`
- Modify: `src/components/ui/table/columns/data-table-column-factory.test.tsx`
- Create: `src/components/ui/table/cells/data-table-editable-choice-cell.tsx`
- Create: `src/components/ui/table/cells/data-table-editable-choice-cell.test.tsx`
- Modify: `src/components/ui/search-combobox.tsx`
- Modify: `src/components/ui/multi-select-combobox.tsx`
- Modify: `src/components/ui/multi-select-combobox.test.tsx`
- Modify: `src/hooks/use-remote-combobox-state.ts`
- Create: `src/hooks/use-data-table/use-data-table-editing.ts`
- Create: `src/hooks/use-data-table/use-data-table-editing.test.tsx`
- Modify: `src/hooks/use-data-table/types.ts`
- Modify: `src/hooks/use-data-table/index.ts`
- Modify: `src/hooks/use-dsl-data-table.ts`
- Modify: `src/hooks/use-dsl-data-table.test.tsx`
- Modify: `src/components/ui/table/core/data-table-body.tsx`
- Modify: `src/components/ui/table/core/use-data-table-cell-selection.ts`
- Modify: `src/components/ui/table/core/data-table.test.tsx`
- Create: `e2e/data-table-editable-choice-columns.smoke.spec.ts`
- Modify after implementation: `.agents/skills/oig-tanstack-admin/references/data-table.md`
- Modify after implementation: `.agents/skills/oig-tanstack-admin/references/forms.md`
- Modify after implementation: `README.md`

具体实现前必须重新确认上述文件是否仍是当前真实入口；允许因职责拆分调整新文件名，但禁止把逻辑散回业务页面。

---

## 9. 实施任务

### Task 0：冻结 API 契约和类型测试

**Files**

- Modify: `src/types/data-table.ts`
- Modify: `src/components/ui/table/columns/data-table-column-builders.tsx`
- Modify: `src/components/ui/table/columns/data-table-column-factory.test.tsx`

**Acceptance Criteria**

- [ ] `columnDsl.editableField()` 进入公开返回值。
- [ ] `enum`、`select`、`remoteSelect` 的 option 配置形成可辨识联合类型。
- [ ] single 只接受标量/null 字段，multiple 只接受数组字段。
- [ ] `maxSelected` 只允许出现在 multiple 配置，且运行时拒绝非正整数。
- [ ] 不影响现有 `field`、`enum + filterOptions` 和 custom types。
- [ ] 使用 `@ts-expect-error` 固化非法字段和 selectionMode 组合。

**Verification**

```bash
pnpm test:unit src/components/ui/table/columns/data-table-column-factory.test.tsx
pnpm typecheck
```

### Task 1：实现纯编辑草稿模型

**Files**

- Create: `src/hooks/use-data-table/use-data-table-editing.ts`
- Create: `src/hooks/use-data-table/use-data-table-editing.test.tsx`
- Modify: `src/hooks/use-data-table/types.ts`
- Modify: `src/hooks/use-data-table/index.ts`

**Acceptance Criteria**

- [ ] base/draft 按稳定 row ID 管理。
- [ ] `hasChanges()` 通过 editable fields 语义比较派生。
- [ ] `getSnapshot()` 返回 rows、changedRows、changes 和 loadedPages。
- [ ] `acceptChanges()` 不清除保存期间产生的更新值。
- [ ] `discardChanges()` 恢复全部已加载分页的 base。
- [ ] 同一 row 重复加载时按 row ID 去重。
- [ ] 无稳定 row ID 时，开发环境 warning 且不允许启用跨页编辑。

**Verification**

```bash
pnpm test:unit src/hooks/use-data-table/use-data-table-editing.test.tsx
pnpm typecheck
```

### Task 2：实现静态 enum/select 编辑器

**Files**

- Create: `src/components/ui/table/cells/data-table-editable-choice-cell.tsx`
- Create: `src/components/ui/table/cells/data-table-editable-choice-cell.test.tsx`
- Modify: `src/components/ui/table/columns/data-table-column-types.tsx`
- Modify: `src/components/ui/table/columns/data-table-column-rendering.tsx`
- Modify: `src/components/ui/multi-select-combobox.tsx`
- Modify: `src/components/ui/multi-select-combobox.test.tsx`

**Acceptance Criteria**

- [ ] enum/select 单选和多选都能进入、完成、取消编辑。
- [ ] `maxSelected` 未传时不限，达到限制后未选 option 禁用。
- [ ] 多选按 value 去重并保留选择顺序。
- [ ] 多选 cell 默认使用 `、` 连接 label，并复用 overflow tooltip。
- [ ] 未知 value 回退显示原始值。
- [ ] `valueOptions` 可在未显式配置时派生静态 `filterOptions`。
- [ ] Escape、Enter、Tab、overlay close 和焦点恢复有组件测试。

**Verification**

```bash
pnpm test:unit \
  src/components/ui/table/cells/data-table-editable-choice-cell.test.tsx \
  src/components/ui/multi-select-combobox.test.tsx \
  src/components/ui/table/columns/data-table-column-factory.test.tsx
```

### Task 3：实现 remoteSelect 与 label hydration

**Files**

- Modify: `src/components/ui/search-combobox.tsx`
- Modify: `src/components/ui/multi-select-combobox.tsx`
- Modify: `src/hooks/use-remote-combobox-state.ts`
- Modify: `src/components/ui/table/cells/data-table-editable-choice-cell.tsx`
- Modify: `src/components/ui/table/cells/data-table-editable-choice-cell.test.tsx`

**Acceptance Criteria**

- [ ] 远程单选、多选支持防抖搜索和分页追加。
- [ ] query 只在 editor 打开且未禁用时启用。
- [ ] 搜索变化重置 option page，但不清空已选 value。
- [ ] option 按 value 去重。
- [ ] 当前加载 option 范围之外的数据不可被“全选”。
- [ ] 当前页待显示 value 按 column 批量 resolve，避免 cell N+1。
- [ ] 首次 label resolve 展示 Skeleton；失败展示原始值；缓存存在时后台刷新保留 label。
- [ ] loading、empty、error、load more 文案可区分。

**Verification**

```bash
pnpm test:unit \
  src/components/ui/table/cells/data-table-editable-choice-cell.test.tsx \
  src/components/ui/multi-select-combobox.test.tsx
pnpm typecheck
```

### Task 4：接入 `useDslDataTable` 跨页缓存和 refetch 合并

**Files**

- Modify: `src/hooks/use-dsl-data-table.ts`
- Modify: `src/hooks/use-dsl-data-table.test.tsx`

**Acceptance Criteria**

- [ ] 同一 scope 翻页会累积 loadedPages，不清除 draft。
- [ ] 当前页 DataTable 仍只渲染当前页 rows。
- [ ] `getSnapshot().rows` 返回所有已加载分页。
- [ ] 返回已访问页时恢复草稿。
- [ ] refetch 更新未修改字段，但不覆盖修改字段。
- [ ] `acceptChanges()` 后所有已提交分页的基准正确推进。
- [ ] filter/sort/baseCondition/pageSize scope 改变时不混入旧 scope loaded rows。
- [ ] `queryState`、`total`、`refreshProps` 和现有 keepPreviousData 行为保持兼容。

**Verification**

```bash
pnpm test:unit src/hooks/use-dsl-data-table.test.tsx
pnpm test:unit src/hooks/use-dsl-data-table.dsl.test.ts
pnpm typecheck
```

### Task 5：接入 DataTable cell 生命周期、范围选择和虚拟化

**Files**

- Modify: `src/components/ui/table/core/data-table-body.tsx`
- Modify: `src/components/ui/table/core/use-data-table-cell-selection.ts`
- Modify: `src/components/ui/table/core/data-table.test.tsx`

**Acceptance Criteria**

- [ ] 双击、Enter、F2 可以进入编辑。
- [ ] 普通单击范围选择保持兼容。
- [ ] 编辑器内部 pointer/keyboard 不触发行展开、范围选择或复制双重动作。
- [ ] active editor 被虚拟化卸载后，draft 不丢失。
- [ ] 点击外部提交按钮前，cell 完成编辑并写入最新 snapshot。
- [ ] Select/Combobox Portal 内焦点移动不会提前结束编辑。
- [ ] Escape 取消不触发 `onChange`。
- [ ] 相同值完成编辑不触发 `onChange`。

**Verification**

```bash
pnpm test:unit \
  src/components/ui/table/core/data-table.test.tsx \
  src/components/ui/table/core/data-table-cell-range.test.ts
```

### Task 6：回归、浏览器验证和规范同步

**Files**

- Create: `e2e/data-table-editable-choice-columns.smoke.spec.ts`
- Modify: `.agents/skills/oig-tanstack-admin/references/data-table.md`
- Modify: `.agents/skills/oig-tanstack-admin/references/forms.md`
- Modify: `README.md`

**Acceptance Criteria**

- [ ] 浏览器用例覆盖静态单选、多选、远程搜索分页、跨页草稿、返回页恢复、手动 snapshot 和 refetch 合并。
- [ ] 浏览器用例覆盖 Escape、Enter、Tab、外部按钮提交前 blur，以及虚拟化滚动后草稿不丢。
- [ ] 规范明确 `editableField`、choice type、跨页编辑 stable row ID 和 `onChange/getSnapshot` 契约。
- [ ] 不混入依赖升级或无关格式化。
- [ ] 现有 DataTable、SearchCombobox、MultiSelectCombobox 测试保持通过。

**Verification**

```bash
pnpm test:unit
pnpm lint
pnpm typecheck
pnpm format:check
pnpm test:e2e:smoke e2e/data-table-editable-choice-columns.smoke.spec.ts
git diff --check
```

---

## 10. 风险与防护

| 风险                 | 防护                                                                   |
| -------------------- | ---------------------------------------------------------------------- |
| 跨页缓存无界增长     | V1 只缓存当前 query scope 中用户实际访问的页；scope 切换清理无草稿缓存 |
| refetch 覆盖草稿     | 通过旧 base 与 draft 推导修改字段，新 base 只覆盖未修改字段            |
| 保存响应覆盖更新值   | `acceptChanges()` 只确认当前值仍等于已提交 change.value 的字段         |
| remote cell N+1      | column 级聚合 distinct values 后批量 `resolveOptions`                  |
| Portal blur 误提交   | 由 editor lifecycle 判断“真正离开 editor”，不直接绑定 trigger blur     |
| 虚拟化卸载丢值       | draft 进入 table 级 store，cell component 不作为唯一真相源             |
| 与范围选择冲突       | 保留单击选择；双击/Enter/F2 才进入编辑；交互 target 显式排除           |
| Option API 破坏兼容  | 新契约通过类型测试保护现有 `Option`、`filterOptions` 和 enum 展示      |
| 不同查询范围数据混合 | snapshot 只覆盖一个 filter/sort/baseCondition/pageSize scope           |

---

## 11. 完成定义

满足以下条件后，V1 才视为完成：

- `editableField` 和 choice type API 具有编译期字段值约束。
- enum/select/remoteSelect 的单选和多选都具备完整键盘、焦点和 loading/error 行为。
- 跨页草稿能在同一 query scope 内稳定恢复，快照覆盖全部已加载分页。
- refetch 不丢草稿，保存确认不吞掉并发的新修改。
- DataTable 不绑定具体 mutation，仅通过 `onChange` 通知和 controller 暴露当前编辑状态。
- 现有筛选、选择、复制、虚拟化、展开和列 DSL 行为无回归。
- 单元测试、类型检查、lint、格式检查和浏览器 smoke 全部通过。

### Update (2026-07-29)

- **实现状态：** COMPLETE。`editableField`、静态/远程单选与多选、批量 label hydration、DataTable 编辑生命周期、跨页草稿 controller、refetch 合并与并发保存确认均已落地。
- **依赖关系：** 未新增或升级依赖；继续复用 TanStack Query、TanStack Table、Radix/Base UI、`SearchCombobox`、`MultiSelectCombobox` 与 `useRemoteComboboxState`。
- **验证状态：** 功能范围内组件/hook 测试、`pnpm lint`、`pnpm typecheck`、本次文件 Oxfmt、目标 Playwright smoke、生产构建及 `git diff --check` 均通过。
- **仓库基线：** 全量单测为 678/680，通过；剩余失败是未修改的 IAM 部门工具栏源码契约和字典项状态切换测试。全仓 Oxfmt 仍报告 42 个本次范围外文件，未为通过检查而格式化无关代码或用户文档。
- **实现补充：** 增加隐藏的开发契约页 `/dashboard/elements/data-table-editable-choice`，为 Playwright 提供无外部后端依赖的静态、远程、跨页、refetch 和虚拟化验收场景。

### Update (2026-07-30)

- **实现状态：** COMPLETE。编辑交互收敛为单击选中、双击或 Enter/F2 进入编辑、Escape 取消或 blur 完成后进入待编辑；切换 cell 会直接完成旧 session 并清除旧待编辑态，通过 session ID 隔离过期 blur/selection 事件。编辑中的值只参与当前页展示，完成后才进入 snapshot；虚拟化卸载会以 blur 完成当前 session。
- **依赖关系：** 未新增或升级依赖；状态机继续复用现有 DataTable 范围选择、编辑 runtime 与 choice/input editor。
