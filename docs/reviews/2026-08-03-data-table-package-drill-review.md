# DataTable 抽包演练 Review

**Date:** 2026-08-03

**Decision:** `KEEP_INTERNAL`

## 1. 结论

五个业务公开模块已经足以支撑本地/树形表格、标准 DSL 服务端分页、审计列、Action、Editing、Toolbar 和内部加载骨架。编译 fixture 只消费这五个模块，并通过负向类型契约确认内部 DSL helper、Action 渲染器、旧审计 helper 和 Skeleton 未从公开入口泄漏。

当前不进入正式 package 迁移。主要原因不是 API 能力不足，而是 UI 运行时仍合理依赖当前应用的图标、Shadcn 源码、overlay portal、确认交互、中文消息、环境配置和主题 CSS。直接抽包会把这些应用集成误固化为 package 内核。

## 2. PR 3 公开面处理清单

### 删除

- `makeApiFilters` 实现与 `ApiFilters` 类型。
- `DataTableRouterLinkCell` 零消费者文件。
- `statusDeps`、`enableAdvancedFilter`、`isProductTableVirtualizationEnabled` 及对应 warning、测试和有效规范。
- `data-table-audit-columns` 旧业务入口。

### 移动

- `DataTableLinkButtonCell` 下沉为导出中心的 `ExportRecordLinkButtonCell`；共享目录不保留转发。
- React 依赖的列标题解析从 `src/lib/data-table/` 移入组件列层。
- 行操作列宽算法从组件层移入 `src/lib/data-table/row-actions.ts`。

### 内化

- 审计列由 `columnDsl.audit()` 展开，不再暴露独立 helper。
- `DataTableSkeleton` 仅由 `DataTable` 的 `isLoading + loadingSkeleton` 组合触发。
- `DataTableActionsBar`、`DataTableRowActions` 仅由 DataTable 渲染层消费。
- DSL request 构建与 variant/operator 校验只保留为 hook 同层实现和测试目标。

### 保留类型

- `@/types/data-table`：Action、RowAction、Editing、筛选、虚拟化及 TanStack meta 契约。
- `@/hooks/use-data-table`：两个 hook 的 Props/Result、DSL request/response 和 query factory 类型。
- 仓库扫描未发现已知仓库外消费者；后续若出现外部源码导入，由前端平台负责人维护迁移责任。

## 3. 公开模块传递依赖

### React / TanStack 必需依赖

- `react`、`react-dom`。
- `@tanstack/react-table`。
- `@tanstack/react-query` 仅属于 `useDslDataTable` adapter；基础 `useDataTable` 直接依赖图不包含 React Query 或 DataTable React 组件。

当前 `@/hooks/use-data-table` 同时导出两个 hook。仓库构建可以 tree-shake 未使用分支，但若未来成为独立 package，仍需决定 React Query 是 peer dependency，还是拆成独立 subpath export。

### UI、拖拽、虚拟化和日期依赖

- 当前仓库的 Shadcn UI 原语：Table、Button、DropdownMenu、Popover、Command、Calendar、ScrollArea、Tooltip、Skeleton、Tabs 等。
- `@dnd-kit/core`、`@dnd-kit/modifiers`、`@dnd-kit/sortable`、`@dnd-kit/utilities`。
- `@tanstack/react-virtual`。
- `date-fns`、`react-day-picker`、`@radix-ui/react-tooltip`、`sonner`。

### 可选集成依赖

- React Query：只服务 `useDslDataTable`。
- TanStack Router：最终五个公开模块没有传递依赖。
- `file-saver`：最终五个公开模块没有传递依赖；导出 Dialog 仍是内部扩展模块。

### 当前应用专属依赖

- `@/components/icons` 与 Tabler 图标集中出口。
- `@/config/env`、DataTable 配置和中文消息目录。
- `@/components/ui/use-overlay-portal-container` 与 workspace overlay 注册表。
- `useConfirmAction`、`useDebouncedInput`、应用 formatter 和 `cn()`。
- `src/styles/globals.css` 与 `src/styles/themes/*.css`。

## 4. 样式边界

### 表格运行必需样式

`src/styles/globals.css` 中以下规则属于 DataTable 运行时契约：

- `[data-component='data-table-header']`：表头背景、前景和边界。
- `[data-component='data-table-body']`：普通、斑马纹、hover、selected、expanded 与固定列 surface。
- `[data-slot='table-cell'][data-cell-*]`：选择范围、fill preview、服务端错误、edit-ready/editing 和复制闪烁。
- `@property --data-table-cell-copy-flash-primary-mix` 与两组 copy flash keyframes。

这些选择器依赖组件输出的 `data-component` / `data-slot` / `data-cell-*` 属性，正式抽包时必须随 package 提供基础 stylesheet 或等价 layer。

### 当前项目主题覆盖

- `mono.css`、`vercel.css`、`claude.css`、`supabase.css`、`zen.css` 提供 header、selected、expanded 等 token 覆盖。
- `astro-vista.css`、`whatsapp.css` 额外覆盖固定列、选择控件和筛选浮层。
- 主题覆盖不是 DataTable 正确运行的前提；缺失时由 `globals.css` 的语义 token fallback 保证基本表现。

## 5. 公开 API 形状审计

| API                    |               显式布尔项 | 结论       | 说明                                                                                                         |
| ---------------------- | -----------------------: | ---------- | ------------------------------------------------------------------------------------------------------------ |
| `UseDataTableProps`    |               4 个公开项 | 分组重构   | 状态、持久化、工具列、选择、展开、编辑职责较多；后续按 `persistence`、`utilityColumns`、`selection` 分组评估 |
| `UseDslDataTableProps` | 在基础 Props 上新增 1 个 | 保持扁平   | DSL 查询适配职责集中，当前没有 mode 膨胀                                                                     |
| `DataTableProps`       |                     2 个 | 分组重构   | loading 已分组；refresh 和受控 expand props 可在后续专项形成稳定对象契约                                     |
| `ColumnMeta`           |                     4 个 | 转内部契约 | 普通业务应只经列 DSL 生成；保留 TanStack augmentation 仅供共享运行时传递                                     |
| `TableMeta`            |                     1 个 | 转内部契约 | 全部字段由 hook 与渲染层装配，业务不应直接拼装                                                               |

`TODO P1`：另建 DataTable API 形状专项计划，验证分组后的类型推断、引用稳定性和迁移成本；不得在当前治理计划中直接重构形状。

## 6. DSL 命名与协议定位

保留 `useDslDataTable`。当前 DSL 明确定义 compose/text/date-time condition、操作符兼容矩阵和服务端 request 结构，已经是准备长期维护的协议概念，不只是泛化的“远程表格”。在没有新的仓库外通用 adapter 消费者前，不改名为 `useServerDataTable`，也不增加双名称 alias。

## 7. 后续解除条件

只有同时满足以下条件，才升级为 `READY_FOR_PACKAGE_PLAN`：

- 为图标、消息、overlay 和确认交互建立注入边界。
- 明确 React Query subpath 或 peer dependency 策略。
- 提供独立基础 stylesheet，并把项目主题覆盖留在应用侧。
- 至少出现第二个真实仓库消费者，验证公开 API 不依赖当前应用偶然结构。

## 8. 公开契约收口迁移说明

本次收口是 TypeScript 破坏性变更；仓库扫描未发现受影响的仓库内或已知仓库外消费者。接入方按以下规则迁移：

- 删除 `history`、`debounceMs`、`throttleMs`、`clearOnDefault`、`scroll`、`startTransition`。这些配置此前未参与运行时行为，不需要替代项。
- 删除 `editingPageNo`、`editingScopeKey`、`requireExplicitEditingRowId`。它们是 `useDslDataTable` 的内部编辑上下文，改由内部 runtime channel 传递，业务调用方不得设置。
- 不再向 `UseDataTableProps` 透传 `meta`、`defaultColumn`、`state`、状态回调、row model factory、`manual*` 等 runtime-owned TanStack option。斑马纹使用 `enableZebraStriping`（DSL），列默认行为改为 DSL 或具体列定义；其他需求应新增显式的稳定公共配置，不绕过 runtime 所有权。
- TanStack option 透传改为白名单，目前仅支持 `getSubRows` 与 `enableSorting`；树表无需再传 `getExpandedRowModel`，由 runtime 统一装配。删除公开 `getRowId`，字段或函数形式统一迁移到 `rowId`。`initialState` 仅保留共享状态机支持的切片，不再接受 `columnSizingInfo`、`globalFilter`、`grouping`、`rowPinning`。
- `useDslDataTable` 不再接受 `pageCount`、`totalCount`、`pageSize`、`onPageSizeChange`，也不接受 `initialState.pagination.pageSize`。总量来自查询响应，分页大小由 `tableId` 对应的页大小持久化状态管理；`initialState.pagination.pageIndex` 仍保留，用于指定首次服务端请求页码。
- 删除 `DataTable.statusTotalCount`。`useDataTable`/`useDslDataTable` 会把服务端 `totalCount` 写入 TanStack Table 的 `rowCount`；分页总数、状态配置和跨页选择分母统一读取 `table.getRowCount()`，页面不再重复传递接口总数。
