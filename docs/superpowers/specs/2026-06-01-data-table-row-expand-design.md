# DataTable 行展开底部面板设计

## 概述

为 DataTable 增加行展开功能：点击表格行 → 底部弹出面板，面板内根据配置渲染 tabs，每个 tab pane 的内容由 render 函数生成并可访问当前行数据。主表与底部面板间有可拖拽分割线，两边有最小高度保护。

## 交互规格

| 行为 | 说明 |
|------|------|
| 默认状态 | 底部面板不渲染，表格占满容器 |
| 点击行 | 展开底部面板，显示对应行的 tab 内容。高亮色使用 `var(--accent)` 适配 theme |
| 再次点击同一行 | 无操作 |
| 点击其他行 | 切换面板内容到新行 |
| 关闭面板 | 点击 tab 栏右侧的 ✕ 按钮 |
| 拖拽分割线 | 调整主表与底部分区比例，丝滑拖动 |
| 最小高度 | 主表 ≥ 200px，底部面板 ≥ 150px |
| checkbox / action 点击 | 不触发行展开（click 事件的 stopPropagation 由各自 handler 处理，row onClick 为兜底） |

## 类型设计

### `src/types/data-table.ts` 新增

```typescript
export interface ExpandTab<TData, TId extends string = string> {
  /** tab 唯一标识 */
  id: TId
  /** tab 显示文本 */
  label: string
  /** tab 图标 */
  icon?: React.ReactNode
  /** 是否禁用，支持按行数据判断 */
  disabled?: boolean | ((row: TData) => boolean)
  /** 渲染 tab 内容，接收当前选中行数据 */
  render: (row: TData) => React.ReactNode
}

export interface ExpandConfig<
  TData,
  TTabs extends readonly ExpandTab<TData, string>[]
> {
  tabs: TTabs
  /** 默认激活的 tab id，类型自动约束为 tabs 中某个 tab 的 id */
  defaultTab?: TTabs[number]['id']
}

/** 辅助函数，利用 const 泛型保留 tab id 的字面量类型 */
export function defineExpandConfig<
  TData,
  const TTabs extends readonly ExpandTab<TData, string>[]
>(config: ExpandConfig<TData, TTabs>) {
  return config
}
```

### 使用示例

```typescript
const expandConfig = defineExpandConfig<User>({
  tabs: [
    { id: 'sub-table', label: '子表', render: (row) => <SubTable userId={row.id} /> },
    { id: 'form',     label: '表单', render: (row) => <UserForm user={row} /> },
  ],
  defaultTab: 'sub-table' // TS 自动推导为 'sub-table' | 'form'，写错编译报错
})
```

## Hook 变更

### `src/hooks/use-data-table.ts`

**新增参数：**

```typescript
interface UseDataTableProps<TData> {
  // ... 现有参数
  /** 行展开面板配置，传入后启用行点击展开功能 */
  expandConfig?: ExpandConfig<TData, any>;
}
```

**新增状态：**

```typescript
const [expandedRowId, setExpandedRowId] = React.useState<string | null>(null);
```

**新增返回值：**

```typescript
return {
  table, debounceMs, throttleMs, resetColumnSizing,
  expandedRowId,
  setExpandedRowId,
  expandConfig: props.expandConfig,
};
```

**边界处理 — 数据变化自动关闭：**

```typescript
// 当 data 变化导致 expandedRowId 对应的行不存在时，自动关闭面板
React.useEffect(() => {
  if (expandedRowId && !table.getRow(expandedRowId)) {
    setExpandedRowId(null);
  }
}, [table, expandedRowId]);
```

## 组件变更

### `DataTable` (`data-table.tsx`)

**新增 props：**

```typescript
interface DataTableProps<TData> {
  // ... 现有 props
  expandConfig?: ExpandConfig<TData, any>;
  expandedRowId?: string | null;
  onExpandedRowChange?: (rowId: string | null) => void;
}
```

**布局切换逻辑：**

- `expandedRowId === null`：现有布局不变
- `expandedRowId !== null`：表格区域包裹进 `ResizablePanelGroup (direction=vertical)`：
  - `ResizablePanel`（表格，`defaultSize={60}`, `minSizePixels={200}`）
  - `ResizableHandle`
  - `ResizablePanel`（展开面板，`defaultSize={40}`, `minSizePixels={150}`）

表格区域的 `absolute inset-0` 在展开模式下改为 `h-full w-full`（因 ResizablePanel 提供 block 容器，不再需要 absolute 占满）。

**传递 onRowClick 给 DataTableBody：**

```tsx
<DataTableBody
  onRowClick={onExpandedRowChange ? (rowId) => onExpandedRowChange(rowId) : undefined}
  expandedRowId={expandedRowId}
  ...
/>
```

### `DataTableBody` (`data-table-body.tsx`)

**新增 props：**

```typescript
interface DataTableBodyProps<TData> {
  // ... 现有 props
  onRowClick?: (rowId: string) => void;
  expandedRowId?: string | null;
}
```

**Row click 绑定（虚拟滚动 & 非虚拟两个分支均需添加）：**

```tsx
<TableRow
  onClick={() => onRowClick?.(row.id)}
  className={cn(
    expandedRowId === row.id && 'bg-accent',
    onRowClick && 'cursor-pointer'
  )}
  ...
>
```

**高亮行：** 使用 `bg-accent` Tailwind class，自动适配 light/dark theme。

**优先级：** 利用 DOM 事件冒泡天然实现。checkbox / action / 未来任何 cell 内部 handler 只需 `e.stopPropagation()` 即不触发行展开。

### `DataTableExpandPanel` (`data-table-expand-panel.tsx`) — 新组件

```typescript
interface DataTableExpandPanelProps<TData> {
  row: TData;
  expandConfig: ExpandConfig<TData, any>;
  onClose: () => void;
}
```

**结构：**

```
div.flex.flex-col.h-full.border-t
  Tabs (defaultValue={expandConfig.defaultTab ?? expandConfig.tabs[0]?.id})
    div.flex.items-center.border-b.px-4
      TabsList
        tabs.map(tab =>
          TabsTrigger(value=tab.id disabled=resolveDisabled(tab, row))
            {tab.icon}
            {tab.label}
        )
      Button(ghost icon onClick=onClose className="ml-auto")
        Icons.x
    tabs.map(tab =>
      TabsContent(value=tab.id)
        {tab.render(row)}
    )
```

- 使用项目已有的 `@radix-ui/react-tabs` 封装（`src/components/ui/tabs.tsx`）
- Radix Tabs 默认用 `display: none` 隐藏非活跃 pane，DOM 保留，滚动位置不丢
- `resolveDisabled` 处理 `boolean | ((row) => boolean)` 两种形式
- 关闭按钮在 tab 栏最右侧

## 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `src/types/data-table.ts` | 修改 | 新增 `ExpandTab`, `ExpandConfig`, `defineExpandConfig` |
| `src/hooks/use-data-table.ts` | 修改 | 新增 `expandConfig` 参数 + `expandedRowId` 状态 + 数据变化自动关闭 |
| `src/components/ui/table/data-table.tsx` | 修改 | 新增 expand 相关 props + 条件渲染 ResizablePanelGroup |
| `src/components/ui/table/data-table-body.tsx` | 修改 | 新增 `onRowClick` / `expandedRowId` prop + row 高亮 + row click 绑定 |
| `src/components/ui/table/data-table-expand-panel.tsx` | **新增** | 底部面板组件 |

## 依赖

- `react-resizable-panels` — 已在 `src/components/ui/resizable.tsx` 封装，无需新增依赖
- `@radix-ui/react-tabs` — 已在 `src/components/ui/tabs.tsx` 封装，无需新增依赖
