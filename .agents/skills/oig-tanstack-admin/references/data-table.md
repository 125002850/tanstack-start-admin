# DataTable 开发规范

## Hook 选型

- 标准 DSL 服务端分页表格统一使用 `useDslDataTable`。
- `useDslDataTable` 负责 DSL request 组装、`useQuery` 生命周期、`keepPreviousData`、页长偏好和默认表格 UX 选项。
- `useDslDataTable` 默认启用斑马纹；仅在明确需要纯色表体时传 `enableZebraStriping: false`。`useDataTable` 不隐式启用斑马纹。
- `useDataTable` 只用于本地数组、非分页接口、多接口拼装、自定义卡片列表或 mock REST demo 等特殊场景。
- 非标准分页响应必须在 `useDslDataTable` 调用处显式传入 `mapQueryData`，禁止把适配逻辑散回页面。
- `useDataTable` 默认状态不得依赖 router search / URL search params；需要可分享 URL 的 route 必须单独设计 route-specific search adapter。

## 列定义 DSL

- 业务页面列定义统一使用 `createDataTableColumnDsl<T>()` 生成 `ColumnDef<T>`；页面层只直接使用 `columnDsl.field`、`columnDsl.badge`、`columnDsl.actions`、`columnDsl.custom`。
- 旧入口 `dataTableColumns.*`、`columnDsl.text`、`columnDsl.longText`、`columnDsl.filterableText` 已删除，禁止恢复 alias、兼容 adapter 或新旧双写。
- 普通字段列使用 `columnDsl.field('fieldName', '列标题', options)`；徽标语义使用 `columnDsl.badge`；行操作列使用 `columnDsl.actions`；一次性业务 cell 或复合 accessor 使用 `columnDsl.custom`。
- 多处复用的展示行为必须优先进入 `type` registry 或新增稳定 DSL 方法；`custom` 只用于一次性、交互特化、复合搜索或尚未证明可复用的 cell。
- `filter` 必须是扁平字段：`false | 'text' | 'select' | 'multiSelect' | 'date' | 'dateRange' | 'number' | 'numberRange' | 'boolean'`。禁止 `filter: { variant: 'text' }` 对象 API。
- `filterPlaceholder`、`filterOptions`、`filterMin`、`filterMax`、`filterUnit` 必须作为列 option 的扁平字段传入；后端字段名、operator、序列化函数不得塞进 filter option。
- 后端 DSL 查询语义只能放在 `dsl`：`filterField`、`sortField`、`filterOperator`、`serializeFilter`。禁止 `dsl.filter`、`serializeFilter: false`、`serializeSort: false`。
- `type` 负责默认展示组合：`text`、`longText`、`number`、`int`、`decimal`、`money`、`percent`、`date`、`dateTime`、`boolean`、`enum`、`fileSize`；`type` 不隐式开启筛选。
- DSL 的通用列宽优先直接传 `size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'`，factory 必须在生成 `ColumnDef` 前解析为数值；特殊布局可继续传精确数字，禁止为了套用预设改变既有视觉宽度。
- 自定义列类型只能通过 `createDataTableColumnDsl({ customTypes })` 注册，且不得覆盖内置 type key。无 `renderCell` 时统一走 `formatValue + text cell` fallback。
- `field` / `badge` / `custom` 默认进入列显示面板并允许面板内拖拽；`actions` 默认不进入列显示面板，且默认关闭 hiding / resizing / sorting / filtering。
- 列面板只额外读取 `columnPanelVisible` 与 `columnPanelReorder`。隐藏能力仍以 TanStack `getCanHide()` / `enableHiding` 为准，禁止新增 `capabilities.hide/sort/filter/resize` 这类重复 TanStack 原生字段。
- 预留但未实现的入口包括 `columnDsl.group`、`columnDsl.link`、`columnDsl.editableField`；需要新增时必须先补共享契约和测试。

## DSL 筛选契约

- `useDslDataTable` 自动序列化的筛选 variant 统一以 `DATA_TABLE_DSL_SUPPORTED_FILTER_VARIANTS` 为准：`text`、`select`、`multiSelect`、`date`、`dateRange`。
- `number`、`range`、`boolean` 仍可用于非 DSL / 本地 `useDataTable` 表格 UI，但不得被 `buildDataTableDslRequest()` 静默序列化为后端 DSL 请求。
- 标准 DSL 表格列使用不支持的 filter variant 时，开发环境必须按 `tableId + columnId + variant` 去重 warning，提示该 variant 不支持自动 DSL 序列化。
- 页面层禁止分散编写 DSL variant 兼容补丁；新增后端筛选能力必须先扩展共享 DSL 序列化测试。

## 页面组合

- 标准后台表格页面使用 `Card` + `DataTable` + `DataTableToolbar`。
- 数据层统一由 `useDslDataTable` 驱动。
- 页面侧至少优先消费 `table`、`queryState`、`total` 和 `refreshProps`。
- 服务端分页表格必须传入 `statusTotalCount={total}`。
- 刷新能力优先通过 `{...refreshProps}` 透传给 `DataTable`，不要重复包装刷新按钮或 `refetch`。
- Loading 状态可将 `queryState.isFetching` 传给 `DataTable` 的 `isLoading`。
- `DataTable` 的 loading / empty / error(status) 必须有稳定 DOM 兜底：普通空数据使用 `emptyMessage`，业务空态或错误态通过 `getStatusConfig` 返回 `DataTableStatus`，不得让表体空白。
- `getStatusConfig` 会收到 `{ rows, totalCount, hasFilters, isLoading }`；页面需要避免 loading 闪烁时，应基于 `isLoading` 延迟返回 empty/onboarding status，而不是在页面层替换表格主体。
- `DataTable` 会基于当前 table state 自动重新计算 `getStatusConfig`；`statusDeps` 已废弃，页面层禁止继续传入或依赖该 prop。

## 分页、选择与虚拟化

- 页面层一般不要手写虚拟化 gate。
- `DataTable` 默认按内部阈值尝试虚拟化；仅在必要时通过 `virtualization={false}` 关闭，或传入配置对象覆盖。
- 虚拟化内部职责统一收敛在 `useDataTableVirtualization`；页面层只通过 `virtualization` 配置调整阈值、overscan 或显式关闭。
- 浏览器级虚拟化回归必须覆盖 `e2e/data-table-regression.smoke.spec.ts --grep @workspace-v2`，验证首屏非空、横向/纵向滚动、固定列可见和 header/body 基础对齐。
- 分页响应、总数字段映射等差异必须收敛在 `mapQueryData`。
- 非 DSL 场景直接使用 `useDataTable` 接入服务端分页时，优先传 `totalCount`，不要手算 `pageCount`。
- 页面层一般不要显式传 `selectedRowCount`。
- 仅在跨页批量操作等全量计数场景传 `selectedRowCount`；此时分母自动切换为 `statusTotalCount`。
- 默认选择语义是当前已加载页：`selectedRows`、`selectedRowIds` 和 `getSelectedRows()` 都不得表达跨页全量选择。
- 启用 `showSelectColumn` 时必须优先提供稳定 `rowId` / `getRowId`；开发环境检测到 index fallback row id 时必须 warning，提示当前选择是 page-scoped 且不适合跨页批量。
- `rowId` key、`rowId` function、`getRowId` 的优先级和解析必须复用 `resolveDataTableRowId()`，禁止页面层复制 row id 解析逻辑。
- 展开分屏生命周期和尺寸逻辑统一收敛在 `useDataTableExpandPanel`；列拖拽状态和 handler 统一收敛在 `useDataTableColumnDnd`，新 hook 只供 `DataTable` 内部装配。

## 表格操作

- 依赖行选择的操作必须声明为 `DataTableSelectionAction`，通过 `kind: 'selection'` 表达语义。
- 选择态操作由 `DataTableActionsBar` 统一在未选中行时隐藏；页面禁止重复编写 `selectedRows.length === 0` 显隐判断。
- 顶层选择态操作由共享组件稳定排列在常规操作之后；页面只负责组合操作，不得依赖数组拼接顺序实现排序。
- 选择态操作存在额外业务前置条件时必须使用 `disabled`，不得通过 `hidden` 隐藏。例如仅特定状态可执行的批量操作，应在选中一条数据后显示但按状态禁用。

## 可访问性语义

- sortable header 必须在 `<th>` 暴露 `aria-sort`，按排序状态输出 `none`、`ascending` 或 `descending`。
- selected data row 必须在数据行 `<tr>` 暴露 `aria-selected="true"`；未选中行不得伪造 selected 状态。
- 选择列控件继续使用 checkbox 语义：`role="checkbox"` + `aria-checked`，全选半选态使用 `aria-checked="mixed"`。
- 可展开行的点击边界必须排除 checkbox、button、link、input、select、textarea、menuitem 等行内交互控件；键盘等价路径不得触发行内控件双重动作。
- 不得为了虚拟化把所有行强行加入 tab order；键盘 tab stop 只覆盖可交互 / 可展开行或明确的行内控件。

## 高级筛选开关

- `enableAdvancedFilter` 当前已暂停使用并标记 `@deprecated`；传入该 prop 时开发环境必须去重 warning。
- `enableAdvancedFilter={true}` 不得阻止普通 `columnFilters` 更新。
- 在完整高级筛选 UI、operator 体系和后端 DSL 契约落地前，禁止扩大 `dataTableConfig.operators` 或 `FilterItemSchema` 的使用面。

## 回归测试

新增服务端表格 feature 至少补一组页面级回归测试，覆盖以下项目中的核心路径：

- 总数文案
- 空态
- 关键筛选
- 关键操作

## 审计字段列

所有包含 `createTime`、`createBy`、`updateTime`、`updateBy` 的表格列定义，必须使用 `auditColumns`，禁止手写内联列：

```tsx
import { auditColumns } from "@/components/ui/table/columns/data-table-audit-columns";

export const xxxColumns: ColumnDef<XxxRecord>[] = [
  // ...其他列
  ...auditColumns<XxxRecord>(),
];
```

`auditColumns` 返回 `创建信息`、`更新信息` 两列：

- 人员在上，使用 `text-muted-foreground`。
- 时间在下。
- 整列使用 `text-xs`。
- 列 ID 固定为 `createInfo` 和 `updateInfo`。

记录类型必须满足：

```ts
interface AuditFields {
  createBy?: number | null;
  createTime?: string | null;
  updateBy?: number | null;
  updateTime?: string | null;
}
```
