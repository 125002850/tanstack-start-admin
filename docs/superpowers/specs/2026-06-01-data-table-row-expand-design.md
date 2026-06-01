# DataTable 行展开底部面板设计

## 文档定位

这份文档是 **design spec**，负责定义产品语义、技术边界和风险收敛结果；它不是 implementation plan。

配套的可执行计划单独存放于：

- `docs/plans/2026-06-01-data-table-row-expand.md`

这样做是刻意的企业级边界控制：

- spec 负责说明“为什么这样设计”
- plan 负责说明“按什么顺序改哪些文件、怎么验证”

## 目标

为通用 `DataTable` 增加一个 **显式 opt-in** 的行展开能力：

- 点击表格行后，在表格下方打开底部详情面板
- 面板通过 tabs 承载多块详情内容
- tab pane 内容由消费方传入 `render(row)` 生成
- 主表与底部面板之间支持垂直拖拽调整高度
- 在未启用该能力的页面上，现有 `DataTable` 的行为、视觉和布局保持零变化

## 非目标

本次设计 **不** 包含以下范围：

- 不在所有现有表格页面默认启用该能力
- 不内置任何服务端请求、缓存或详情数据加载协议
- 不把该能力改造成移动端 Drawer / Sheet 形态
- 不修改 TanStack Table 的 selection、sorting、pagination 语义

本轮收敛后，首个真实消费方固定为 `/dashboard/users`；同时，通用能力本身仍必须在“无消费方启用”时可安全合入。

## 交互规格

| 行为 | 说明 |
|------|------|
| 默认状态 | 底部面板不渲染，表格维持现有满高布局 |
| 点击普通数据单元格内容 | 展开底部面板，显示当前行详情 |
| 点击同一行 | 不重复切换，不重置拖拽高度 |
| 点击其他行 | 切换到新行；若当前激活 tab 在新行仍可用，则保持当前 tab，否则回退到 `defaultTab` 或首个可用 tab |
| 关闭面板 | 点击 tab 栏右侧关闭按钮 |
| 键盘 / 读屏入口 | 不把普通 `table row` 伪装成交互 row；键盘与读屏通过显式 disclosure button 完成展开 / 收起 |
| 数据变化 | 若当前 `expandedRowKey` 在当前页数据中不存在，则自动关闭面板 |
| 交互控件点击 | `button/link/input/checkbox/dropdown/menu item` 等交互元素不触发行展开 |
| 拖拽分割线 | 在容器高度允许时，支持丝滑拖拽调整上下区域高度 |
| 拖拽后的高度记忆 | 在同一 `DataTable` 挂载周期内，切行与关闭后重开都保持用户最后一次拖拽高度 |
| 窗口 / 容器 resize | 对当前 splitter 高度执行 clamp 到新的合法区间，不重置为默认值 |
| 路由重挂载 | 路由卸载或组件重挂载后，splitter 高度重置为默认值；本次不做 localStorage 持久化 |
| 最小高度 | 正常容器下主表最小 200px，底部面板最小 150px，handle 高度 8px |
| 极小容器回退 | 当可用高度 `< 358px` 时，不再强制双最小值；布局进入锁定回退态，拖拽禁用，两侧按剩余高度分配并各自滚动 |

## 关键架构决策

### 1. 展开态不再依赖 TanStack `row.id`

默认 `row.id` 在当前项目中没有稳定契约。服务端分页、排序、过滤下，TanStack 默认 index-based row id 会在不同请求中重用同一个 `"0" | "1" | ..."`，导致展开态可能指向错误数据而不自知。

因此，本设计采用 **业务主键驱动**：

- `ExpandConfig` 必须显式声明 `rowKey`
- hook 内部状态从 `expandedRowId` 改为 `expandedRowKey`
- 行定位基于 `row.original[rowKey]` 的稳定值，而不是 `row.id`

这条契约独立于 `getRowId` 是否配置。若消费方已经提供 `getRowId`，它应与 `rowKey` 保持语义一致，但展开能力不再依赖它作为唯一真相来源。

### 2. 行点击兜底采用 selector guard，而不是 `e.target !== e.currentTarget`

`e.target !== e.currentTarget` 会把“点击单元格内文本、图片、badge、普通 div”一并判定为不可展开，实际会把“点击行展开”退化成“只能点到表格行空白处才能展开”，这不符合管理员表格的常规交互预期。

最终方案采用 **双层防线**：

- 共享组件层：已知交互控件主动 `stopPropagation()`，并标记 `data-row-expand-ignore`
- `DataTableBody` 层：通过 selector-based guard 识别交互元素或带忽略标记的祖先节点，阻断展开

这样既保留“点击普通 cell 内容可展开”，又避免把安全性建立在“所有业务方永远记得 stopPropagation”上。

### 3. 不采用 `react-resizable-panels` 作为该需求的主方案

架构 review 后，明确放弃原始 spec 中的 `react-resizable-panels` 路径，原因如下：

- 当前依赖版本只支持百分比 `minSize`，不支持像素级最小高度
- 原始产品语义写的是 `200px / 150px`，静默降级为“约等于某个比例”属于偷换语义
- 当前 `DataTable` 依赖 `absolute` overlay root 和表头列宽测量；为了百分比 split 去改布局，会把真实约束埋进运行时近似值

最终方案采用 **像素精确的自定义 vertical splitter**：

- 拖拽模型沿用现有 `data-table-column-resize-handle` 的 pointer 事件处理方式
- 把高度计算抽到纯函数工具中，单独测试
- `DataTable` 在 expanded 模式下只引入最小必要的局部布局状态，不推广为新的全局 resizable 基础设施

### 4. 可访问路径采用 disclosure button，而不是可交互 row 语义

ARIA 语义校验后，本设计明确不把普通 `table` / `grid` 的 row 伪装成携带 `aria-expanded` 的展开行。那种语义适用于 `treegrid`，不适用于这里的通用后台表格。

最终方案采用 **双轨交互**：

- pointer 用户：保持“点击整行任意普通数据区域可展开”
- keyboard / screen reader 用户：通过显式 disclosure button 展开 / 收起

这个 disclosure button 由 `DataTable` 在启用 `expandConfig` 时自动生成一列，不要求每个消费方自己补按钮。

### 5. spec 与 plan 分离，但 spec 必须补足执行前提

这份文档仍然是 design spec，不直接展开成任务 DAG；但为了避免“说了方向却无法执行”，spec 必须写清楚：

- 首次切片是否默认启用消费方
- 关键文件边界
- 共享运行时约束
- 不接受的语义退化

真正的任务拆分、验证命令和提交顺序在 companion plan 中定义。

## 类型设计

### `src/types/data-table.ts`

```typescript
type ExpandRowKeyField<TData> = Extract<
  {
    [K in keyof TData]-?: TData[K] extends string | number ? K : never
  }[keyof TData],
  string
>

export interface ExpandTab<TData, TId extends string = string> {
  id: TId
  label: string
  icon?: React.ReactNode
  disabled?: boolean | ((row: TData) => boolean)
  render: (row: TData) => React.ReactNode
}

export interface ExpandConfig<
  TData,
  TKey extends ExpandRowKeyField<TData>,
  TTabs extends readonly ExpandTab<TData, string>[]
> {
  /** 业务主键字段，必须唯一且跨请求稳定 */
  rowKey: TKey
  tabs: TTabs
  defaultTab?: TTabs[number]['id']
}

export interface ExpandTabEdge<TData> extends Omit<ExpandTab<TData, string>, 'id'> {
  id: string
}

/**
 * 用于 hook / 组件 props 的宽类型边界。
 * defineExpandConfig 在定义侧保留字面量推导，这里只承接运行时消费所需的稳定结构。
 */
export interface ExpandConfigEdge<TData> {
  rowKey: keyof TData & string
  tabs: readonly ExpandTabEdge<TData>[]
  defaultTab?: string
}

export function defineExpandConfig<
  TData,
  TKey extends ExpandRowKeyField<TData>,
  const TTabs extends readonly ExpandTab<TData, string>[]
>(config: ExpandConfig<TData, TKey, TTabs>) {
  return config
}
```

### 设计说明

- `defineExpandConfig()` 继续负责定义侧的字面量约束
- `ExpandConfigEdge<TData>` 负责消费侧传递，避免 `DataTable<TData, TTabs>` 之类的泛型爆炸
- `rowKey` 只允许 `string | number` 字段，避免把对象或数组作为运行时定位键

## Hook 设计

### `src/hooks/use-data-table.ts`

新增参数：

```typescript
interface UseDataTableProps<TData> {
  expandConfig?: ExpandConfigEdge<TData>
}
```

新增状态：

```typescript
const [expandedRowKey, setExpandedRowKey] = React.useState<string | null>(null)
```

新增运行时解析：

```typescript
const expandedRow =
  !expandConfig || !expandedRowKey
    ? null
    : table
        .getRowModel()
        .rows.find(
          (row) => String(row.original[expandConfig.rowKey as keyof TData]) === expandedRowKey
        )?.original ?? null
```

性能声明：

- 当前实现是针对“当前 row model”的线性查找
- 首版不额外维护 `rowKey -> row` 索引 map，避免为尚未证明的热点引入状态复杂度
- 这里故意不包 `useMemo`：`useReactTable()` 返回稳定 table instance，而 row model 会在分页、排序、过滤和数据变化时独立更新；若只依赖 `table` 对象，容易产生失效不完整的 memo
- 在当前产品页的数据规模和交互频率下，这个成本可接受；若后续 expand consumer 在 profiling 中证明这里成为热点，再升级为索引缓存

自动关闭逻辑：

```typescript
React.useEffect(() => {
  if (expandedRowKey && !expandedRow) {
    setExpandedRowKey(null)
  }
}, [expandedRow, expandedRowKey])
```

返回值：

```typescript
return {
  table,
  debounceMs,
  throttleMs,
  resetColumnSizing,
  expandConfig: props.expandConfig,
  expandedRowKey,
  setExpandedRowKey,
  expandedRow
}
```

### Hook 不变式

- 未传 `expandConfig` 时，`useDataTable` 的现有行为完全不变
- `expandedRowKey` 仅表示当前页数据中的业务主键，不承诺跨页保活
- 当过滤、排序、分页让当前行离开当前页时，自动关闭详情面板，不尝试跨页追踪

## 组件设计

### `DataTableBody` (`src/components/ui/table/data-table-body.tsx`)

新增 props：

```typescript
interface DataTableBodyProps<TData> {
  onRowClick?: (rowKey: string) => void
  expandedRowKey?: string | null
  getExpandRowKey?: (row: TData) => string
}
```

新增 ignore selector 工具：

```typescript
const ROW_EXPAND_IGNORE_SELECTOR = [
  '[data-row-expand-ignore]',
  'button',
  'a[href]',
  'input',
  'select',
  'textarea',
  '[role="button"]',
  '[role="menuitem"]',
  '[role="checkbox"]'
].join(',')
```

行点击逻辑：

```tsx
const handleRowClick = (event: React.MouseEvent<HTMLTableRowElement>, row: Row<TData>) => {
  const target = event.target as HTMLElement | null
  if (target?.closest(ROW_EXPAND_IGNORE_SELECTOR)) return

  const rowKey = getExpandRowKey?.(row.original)
  if (!rowKey) return

  onRowClick?.(rowKey)
}
```

高亮逻辑：

```tsx
className={cn(
  expandedRowKey === getExpandRowKey?.(row.original) && 'bg-accent',
  onRowClick && 'cursor-pointer'
)}
```

### `DataTableRowActions` (`src/components/ui/table/data-table-row-action.tsx`)

这是共享组件层的第一层防线。最终要求：

- 行内 action 按钮点击时必须 `stopPropagation()`
- dropdown trigger 与 menu item 点击时也必须阻断冒泡
- 根容器标记 `data-row-expand-ignore`

这让 DataTable 自己的 row expand 行为，不会与行内 action 产生双触发竞争。

### `DataTableExpandTrigger` (`src/components/ui/table/data-table-expand-trigger.tsx`)

这是 keyboard / screen reader 的正式入口。职责如下：

- 对应的 generated utility column id 固定为 `__rowExpand`
- 渲染一个窄列中的 disclosure `<button>`
- button 持有 `aria-expanded` 与 `aria-controls`
- `Enter` / `Space` 通过原生 button 语义触发展开
- 点击 button 时 `stopPropagation()`，避免与整行 pointer click 双触发

`aria-controls` 目标 id 约定：

- 优先使用 `data-table-expand-panel-{tableId}`
- 若当前 `DataTable` 未配置 `tableId`，则退回稳定的组件实例 id，例如 `data-table-expand-panel-{instanceId}`
- `instanceId` 必须来自 `React.useId()` 一类 SSR / hydration 稳定来源，不允许使用模块级自增计数器或时间戳
- button 与 panel 必须共享同一套 id 生成规则，避免无障碍关联漂移

稳定 selector / automation hook 契约：

- expand trigger button 暴露 `data-slot="data-table-expand-trigger"`
- expand panel 根节点暴露 `data-slot="data-table-expand-panel"`
- expand panel close button 暴露 `data-slot="data-table-expand-panel-close"`
- splitter handle 暴露 `data-slot="data-table-expand-split-handle"`

这些 hook 属于稳定的非视觉契约，用于 Playwright / RTL / 调试自动化；后续样式重构不得随意移除。

推荐列顺序：

- 行号列
- 选择列（若存在）
- expand trigger 列
- 数据列
- actions 列

pinning 契约：

- `__rowExpand` 作为 generated utility column id，参与所有 pinning / alignment / column-order 相关断言
- expand trigger 列属于 utility control 列，启用 expand 时默认参与左侧 pinning
- 左侧固定顺序为：`row number -> select -> expand trigger -> actions(仅当 actionColumnPin='left') -> user-defined left columns`
- 当 `actionColumnPin='right'` 时，expand trigger 仍保留在左侧 utility group，不跟随 actions 一起移动到右侧
- 若消费方提供 `initialState.columnOrder`，hook 必须像现有 row number 列那样对 generated utility column 做归一化，把 `__rowExpand` 插入到 `select` 之后、普通数据列之前；不能依赖 TanStack 对“缺失 column id”的默认追加行为

### 行内 checkbox 包装器

当前 repo 中已知的选择列包装器位于：

- `src/features/users/components/users-table/columns.tsx`

该文件中的点击包装器必须：

- `event.stopPropagation()`
- 标记 `data-row-expand-ignore`

这是对现有已知消费方的显式修复，不等待未来 bug 再补。

### `DataTableExpandPanel` (`src/components/ui/table/data-table-expand-panel.tsx`)

```typescript
interface DataTableExpandPanelProps<TData> {
  row: TData
  expandConfig: ExpandConfigEdge<TData>
  activeTab: string
  onActiveTabChange: (tabId: string) => void
  onClose: () => void
}
```

职责：

- 只负责 tabs 与内容渲染
- 不自己持有“当前行”状态
- 不自己管理拖拽
- 根节点承担 `aria-controls` 目标与稳定 `data-slot` hook

tab 切换规则：

- 初次打开：使用 `defaultTab`，若未声明则使用首个可用 tab
- 切换行：优先保留当前 tab；若该 tab 不存在或被新行禁用，则回退到 `defaultTab` 或首个可用 tab
- 关闭面板：清空 activeTab 的瞬时状态；下次重新打开重新走默认解析

## 像素精确的 split 布局

### 方案

在 `expanded` 模式下，`DataTable` 不再使用单层 `absolute inset-0` 容器承载整个表格，而是切换到两个 panel 的局部布局：

- 上半区：现有 ScrollArea + Table
- 中间：8px drag handle
- 下半区：`DataTableExpandPanel`

### 纯函数边界

新增一个纯函数工具模块，例如：

- `src/lib/data-table-expand-split.ts`

职责：

- 计算 `minTop = 200`
- 计算 `minBottom = 150`
- 计算 `handle = 8`
- 根据容器高度求初始 top 高度
- 在拖拽中 `clamp(topPx, minTop, hostHeight - handle - minBottom)`
- 当 `hostHeight` 因窗口或容器 resize 变化时，对现有 `topPx` 做重新 clamp，而不是重置为默认值
- 当容器高度不足 358px 时，输出“锁定回退态”的推荐高度与 `dragEnabled = false`

### 回退规则

当 `hostHeight >= 358px`：

- 精确执行 `200 / 150 / 8` 约束
- 允许拖拽

当 `hostHeight < 358px`：

- 不再谎称“仍然满足 200 / 150”
- 进入锁定回退态
- 顶部和底部都允许内部滚动
- 拖拽禁用

这是对物理约束的显式表达，不把无法满足的条件伪装成“近似满足”。

### Handle 的键盘语义

custom splitter handle 需要同时提供 pointer 与 keyboard 两种调节路径：

- `tabIndex={0}`
- `role="separator"`
- `aria-orientation="horizontal"`
- `ArrowUp` / `ArrowDown` 以固定步长调整
- `Home` / `End` 直接跳到最小 / 最大可用高度
- 暴露稳定 selector：`data-slot="data-table-expand-split-handle"`

这部分语义属于 handle，而不是 row。

## 首次落地策略

首个真实消费方固定为：

- `/dashboard/users`

选择理由：

- 同时覆盖 row selection、row actions、Sheet action、普通文本点击这几个最容易互相干扰的交互面
- 不依赖产品页的 virtualization 开关才能形成真实用户价值
- 适合用简单静态 tabs 做首版详情面板，不额外引入新的服务端依赖

## 文件边界

### 预计新增

- `src/components/ui/table/data-table-expand-panel.tsx`
- `src/components/ui/table/data-table-expand-trigger.tsx`
- `src/lib/data-table-expand-split.ts`
- `src/lib/data-table-expand-split.test.ts`
- `src/features/users/components/users-table/expand-config.tsx`
- `e2e/data-table-row-expand.smoke.spec.ts`

### 预计修改

- `src/types/data-table.ts`
- `src/hooks/use-data-table.ts`
- `src/components/ui/table/data-table.tsx`
- `src/components/ui/table/data-table-body.tsx`
- `src/components/ui/table/data-table-row-action.tsx`
- `src/features/users/components/users-table/columns.tsx`
- `src/features/users/components/users-table/index.tsx`
- `src/components/ui/table/data-table.test.tsx`
- `src/hooks/use-data-table.internal-state.test.tsx`

## 共享运行时约束

本需求会同时触碰以下共享运行时表面：

- DataTable 行点击与 row selection 的事件边界
- DataTable 收起态与展开态之间的布局切换
- 虚拟滚动与非虚拟滚动两个 row 渲染分支
- pointer row click 与 disclosure button 双轨入口的一致性
- 列宽 overlay root 与 expanded 布局共存

因此实现阶段必须有一次跨任务 audit，确保：

- 收起模式零回归
- virtual / non-virtual 两个分支都能正确高亮与点击
- 行内 action、checkbox、dropdown 不会意外展开

## Implementation Prerequisites

在进入实现前，执行者必须先接受以下前提：

1. 这份 spec 的 companion implementation plan 位于 `docs/plans/2026-06-01-data-table-row-expand.md`
2. 本次能力默认不要求在所有现有页面启用；首个真实消费方固定为 `/dashboard/users`
3. 两个明确禁止的退化：
   - 禁止把 row expand 兜底写成 `e.target !== e.currentTarget`
   - 禁止把像素最小高度偷换成“近似百分比”
4. 关键回归命令必须至少覆盖：
   - `pnpm exec vitest run src/hooks/use-data-table.internal-state.test.tsx`
   - `pnpm exec vitest run src/components/ui/table/data-table.test.tsx`
   - `pnpm exec vitest run src/lib/data-table-expand-split.test.ts`
   - `pnpm run test:e2e:smoke -- e2e/data-table-row-expand.smoke.spec.ts`
   - `pnpm exec tsc --noEmit`
5. 最终实现必须满足：
   - 未启用 `expandConfig` 的表格零视觉回归
   - 启用后点击普通数据内容可展开
   - 启用后 disclosure button 可通过键盘和读屏语义完成展开 / 收起
   - 点击 action / checkbox / menu 不展开
   - 像素最小高度在正常容器中精确生效

## 结论

review 收敛后的最终设计结论是：

- 采用 `rowKey + expandedRowKey`，不再依赖 `row.id`
- 采用 selector-based row click guard，而不是 `e.target !== e.currentTarget`
- 采用像素精确的自定义 vertical splitter，而不是百分比近似 panel
- 保留 `defineExpandConfig()` 的定义侧类型安全，并通过 `ExpandConfigEdge` 控制消费侧复杂度
- spec 与 plan 分离，但两者都必须完整、可执行、可验证
