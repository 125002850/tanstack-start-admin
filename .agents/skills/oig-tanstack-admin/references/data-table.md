# DataTable 开发规范

## 目录

- [目录与依赖边界](#目录与依赖边界)
- [团队代码风格](#团队代码风格)
- [Hook 选型](#hook-选型)
- [列定义 DSL](#列定义-dsl)
- [可编辑单元格](#可编辑单元格)
- [跨页草稿与持久化](#跨页草稿与持久化)
- [DSL 筛选契约](#dsl-筛选契约)
- [表头本地列值筛选](#表头本地列值筛选)
- [页面组合](#页面组合)
- [分页、选择与虚拟化](#分页选择与虚拟化)
- [表格操作](#表格操作)
- [可访问性语义](#可访问性语义)
- [回归测试](#回归测试)
- [审计字段列](#审计字段列)

## 目录与依赖边界

- 完整目录图与组件归属规则见 [项目结构与组件归属](project-structure.md)。
- Shadcn Table 原语固定保留在 `src/components/ui/table.tsx`；完整 DataTable 子系统固定放在 `src/components/data-table/`。
- DataTable 内部按职责使用 `actions/`、`cells/`、`columns/`、`core/`、`dnd/`、`expand/`、`export/`、`feedback/`、`filters/`、`toolbar/`、`virtualization/`。
- 跨目录引用使用 `@/components/data-table/<layer>/<file>`；同目录实现与测试可以使用相对路径。禁止新增 flat barrel、旧路径 alias、兼容转发或新旧路径双写。
- 共享状态编排和服务端 DSL 查询组合统一放在 `src/hooks/use-data-table/`，并从 `@/hooks/use-data-table` 公开；跨层类型放在 `src/types/data-table.ts`，特性配置放在 `src/config/data-table*.ts`，无 UI 算法和持久化放在 `src/lib/data-table/`。
- 禁止 `src/components/data-table/` 反向导入 `src/features/`。只服务单一业务域的 cell、操作或详情组件必须留在对应 feature。
- `src/features/` 和 `src/routes/` 中的业务表格必须统一组合共享 `DataTable`，禁止直接导入 `@/components/ui/table`、调用 `useReactTable()` 或渲染原生 `<table>` / 自建 `<Table>`。
- 允许创建 `XxxDataTable` 这类 feature 业务包装组件，但内部必须通过列 DSL、`useDataTable()` / `useDslDataTable()` 和共享 `DataTable` 完成装配；禁止复制表头、表体、分页、选择、状态或虚拟化运行时形成平行实现。
- 共享 `DataTable` 暂不支持的业务表格能力必须先扩展共享契约和测试，禁止通过 lint disable、局部白名单或新建 `SimpleDataTable` / `BasicDataTable` 等替代实现绕过边界。

## 团队代码风格

- 业务页面只通过列 DSL、`useDataTable()` / `useDslDataTable()` 和公开组件组合 DataTable；禁止直接写 `ColumnMeta`、`TableMeta` 或复制内部状态机。
- 新增行为先确定唯一职责层：列声明进 `columns`，展示/编辑进 `cells`，表格生命周期进 `core` 或 hook，纯算法进 `lib`；禁止以“方便”为由跨层堆入 `data-table.tsx`。
- 优先扩展既有稳定契约。只有多处复用且语义稳定时才扩展 DSL、type registry 或 runtime；一次性业务行为留在 feature 的 `custom` cell。
- 使用判别联合、typed key 和显式状态表达语义；禁止依赖展示字符串、DOM 顺序或隐式 truthy/falsy 区分业务状态。
- 保持用户输入、候选值、已提交草稿和服务端数据边界清晰；任何自动归一化都必须有测试，禁止静默四舍五入或改变领域单位。
- 将性能成本收敛到使用点：候选值、虚拟列表和派生数据按需计算；禁止在关闭的浮层或未启用的能力上执行全量扫描。
- 测试与实现同层放置；纯算法优先单测，跨 hook/组件状态补集成测试，虚拟化、焦点、Popover 和真实指针竞争补 Playwright 回归。

## Hook 选型

- 标准 DSL 服务端分页表格统一使用 `useDslDataTable`。
- `useDslDataTable` 负责 DSL request 组装、`useQuery` 生命周期、`keepPreviousData`、页长偏好和默认表格 UX 选项。
- `useDslDataTable` 默认启用斑马纹；仅在明确需要纯色表体时传 `enableZebraStriping: false`。`useDataTable` 不隐式启用斑马纹。
- `useDataTable` 只用于本地数组、非分页接口、多接口拼装、自定义卡片列表或 mock REST demo 等特殊场景。
- 非标准分页响应必须在 `useDslDataTable` 调用处显式传入 `mapQueryData`，禁止把适配逻辑散回页面。
- `useDataTable` 默认状态不得依赖 router search / URL search params；需要可分享 URL 的 route 必须单独设计 route-specific search adapter。

## 列定义 DSL

- 业务页面列定义统一使用 `createDataTableColumnDsl<T>()` 生成 `ColumnDef<T>`；页面层只直接使用 `columnDsl.field`、`columnDsl.editableField`、`columnDsl.badge`、`columnDsl.actions`、`columnDsl.custom`。
- 旧入口 `dataTableColumns.*`、`columnDsl.text`、`columnDsl.longText`、`columnDsl.filterableText` 已删除，禁止恢复 alias、兼容 adapter 或新旧双写。
- 普通字段列使用 `columnDsl.field('fieldName', '列标题', options)`；徽标语义使用 `columnDsl.badge`；行操作列使用 `columnDsl.actions`；一次性业务 cell 或复合 accessor 使用 `columnDsl.custom`。
- 多处复用的展示行为必须优先进入 `type` registry 或新增稳定 DSL 方法；`custom` 只用于一次性、交互特化、复合搜索或尚未证明可复用的 cell。
- `filter` 必须是扁平字段：`false | 'text' | 'select' | 'multiSelect' | 'date' | 'dateRange' | 'number' | 'numberRange' | 'boolean'`。禁止 `filter: { variant: 'text' }` 对象 API。
- `filterPlaceholder`、`filterOptions`、`filterMin`、`filterMax`、`filterUnit` 必须作为列 option 的扁平字段传入；后端字段名、operator、序列化函数不得塞进 filter option。
- 后端 DSL 查询语义只能放在 `dsl`：`filterField`、`sortField`、`filterOperator`、`serializeFilter`。禁止 `dsl.filter`、`serializeFilter: false`、`serializeSort: false`。
- `type` 负责默认展示组合：`text`、`longText`、`number`、`int`、`decimal`、`money`、`percent`、`date`、`dateTime`、`boolean`、`enum`、`select`、`remoteSelect`、`fileSize`；`type` 不隐式开启筛选。
- DSL 的通用列宽优先直接传 `size: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | 'xxl'`，factory 必须在生成 `ColumnDef` 前解析为数值；特殊布局可继续传精确数字，禁止为了套用预设改变既有视觉宽度。
- 自定义列类型只能通过 `createDataTableColumnDsl({ customTypes })` 注册，且不得覆盖内置 type key。无 `renderCell` 时统一走 `formatValue + text cell` fallback。
- `field` / `badge` / `custom` 默认进入列显示面板并允许面板内拖拽；`actions` 默认不进入列显示面板，且默认关闭 hiding / resizing / sorting / filtering。
- 列面板只额外读取 `columnPanelVisible` 与 `columnPanelReorder`。隐藏能力仍以 TanStack `getCanHide()` / `enableHiding` 为准，禁止新增 `capabilities.hide/sort/filter/resize` 这类重复 TanStack 原生字段。
- 预留但未实现的入口包括 `columnDsl.group`、`columnDsl.link`；需要新增时必须先补共享契约和测试。

## 可编辑单元格

- `columnDsl.editableField()` 支持 `text`、`enum`、`select`、`remoteSelect`。`text` 默认生成 input editor；`enum` / `select` 必须提供标准化的 `valueOptions: { value, label, disabled? }[]`；`remoteSelect` 必须提供 `remoteOptions.loadOptions`。
- 静态单选可通过 `edit: { control: 'switch', checkedValue, uncheckedValue }` 生成二态 Switch。Switch 直接点击或在选中 cell 上按 Enter/F2 即提交 `selection` 变更，不进入浮层编辑态；label 默认复用 `valueOptions`。
- 单选字段值只能是 `string | number | null`；多选字段值只能是 `Array<string | number>`，并显式传 `edit: { selectionMode: 'multiple', maxSelected? }`。`edit.allowEmpty` 默认 `true`；设为 `false` 时必须隐藏清除入口，并同时阻止单选清空和多选移除最后一项。row 只保存 value，禁止保存完整 Option。
- `maxSelected` 仅属于多选且必须是正整数。多选值按选择顺序去重；静态 option 找不到 value、远程解析缺失或失败时必须展示原始 value。
- `remoteOptions.loadOptions` 和 `resolveOptions` 都必须消费 `AbortSignal`。远程查询统一经 React Query 与 `useRemoteComboboxState` 管理；query key 必须包含 `tableId + columnId + keyword + pageNo + pageSize`。
- `resolveOptions` 按当前页和列聚合 value 后批量加载，禁止每个 cell 单独请求。首次解析显示 Skeleton；已有缓存时后台刷新保留 label；失败回退原始 value。
- 普通单击仍用于范围选择；input/choice 通过双击、Enter、F2 进入编辑，单选 choice editor 进入编辑态时自动展开选项。Escape 取消，Enter 完成，Tab 完成后再尝试移动到相邻可编辑 cell。
- `commitMode: 'blur'` 在失焦或选择其他 cell 时提交合法值；`commitMode: 'selection'` 只由有效选择动作提交；`commitMode: 'explicit-confirm'` 只能由 Enter、Ctrl/Cmd+Enter 或 Tab 主动提交，blur、点击其他 cell、浮层关闭和虚拟卸载都必须回滚且不得触发业务 `onChange`。
- 普通单击只进入 `selected`；无论 cell 原本是否选中，双击都直接进入 `editing`。Escape 取消或 blur 完成/回滚后进入该 cell 唯一的 `edit-ready`；选择其他 cell 必须结束旧 session 并清除旧 `edit-ready`。同一表格在任一时刻只能有一个 range focus、一个 `edit-ready` 或一个 `editing` 目标，三种交互态对当前目标互斥。
- 每次 `editing` 必须拥有独立 session。editor 的完成、取消、blur 和浮层关闭只能作用于创建它的 session，旧 editor 的延迟事件不得结束或取消新 editor。
- Tab 导航只能基于确定的相邻 editable cell 执行；列虚拟化启用时必须 fail-closed，提交仍可完成，但禁止通过当前 DOM 猜测或跳过未渲染列。
- choice editor 进入编辑态后必须接管完整 cell：cell 取消 padding、切换为 `background` 表面并提供克制的编辑外阴影；trigger 使用轻微圆角、主色边框和 focus ring，禁止保留独立表单控件的默认阴影和外层间距。
- editor 的 active value 必须同步进入 table 级 store。禁止把 cell 局部 state 作为唯一草稿源，否则虚拟行卸载会丢值；active value 只用于当前表格展示，不得在完成编辑前进入业务 `getSnapshot()` / `hasChanges()`。
- 数值 `maxFractionDigits` 必须对 canonical 数值结果计数：允许 `12.340` 在两位精度下归一化为 `12.34`，拒绝 `12.345`，且禁止为了通过校验自动四舍五入。

## 跨页草稿与持久化

- `useDslDataTable()` 使用可编辑列时必须显式提供稳定 `rowId` 或 `getRowId`；index fallback 会在开发环境 warning 并关闭编辑。
- 同一 filter、sorting、baseCondition、pageSize 组成一个编辑 scope；仅 pageNo 改变时累积已加载页。scope 改变前，业务页面负责通过 `editing.hasChanges()` 提示保存或放弃。
- hook 返回的 `editing.getSnapshot()` 包含按页排序的 `rows`、`changedRows`、字段级 `changes` 和 `loadedPages`。refetch 只更新未修改字段，草稿字段优先。
- DataTable 不执行持久化。自动保存由 `editing.onChange` 发起 mutation，成功后调用 `editing.acceptChanges(changes, serverRows?)`；手动保存先读取 snapshot，成功后确认 changes。
- `acceptChanges()` 只确认传入 change 的已提交值。保存期间同一字段产生的新编辑不得被旧响应覆盖；放弃当前 scope 全部草稿使用 `editing.discardChanges()`。

## DSL 筛选契约

- `useDslDataTable` 自动序列化的筛选 variant 统一以 `DATA_TABLE_DSL_SUPPORTED_FILTER_VARIANTS` 为准：`text`、`select`、`multiSelect`、`date`、`dateRange`。
- `number`、`range`、`boolean` 仍可用于非 DSL / 本地 `useDataTable` 表格 UI，但不得被 `buildDataTableDslRequest()` 静默序列化为后端 DSL 请求。
- 标准 DSL 表格列使用不支持的 filter variant 时，开发环境必须按 `tableId + columnId + variant` 去重 warning，提示该 variant 不支持自动 DSL 序列化。
- 页面层禁止分散编写 DSL variant 兼容补丁；新增后端筛选能力必须先扩展共享 DSL 序列化测试。

## 表头本地列值筛选

- `filter*` 只描述 DataTableToolbar / 服务端 DSL 筛选；`localFilter*` 只描述表头对当前已加载数据的 Set Filter。两套状态必须隔离，表头筛选不得写入 TanStack `columnFilters` 或后端 request。
- `field`、`editableField` 和 `badge` 由 column type 推导默认 `localFilter`；业务只在需要覆盖候选项或单独关闭时传 `localFilterOptions` 或 `localFilter: false`，禁止直接手写 `meta.localFilter`。
- 本地筛选只消费当前浏览器已加载且已合并编辑草稿的数据；pagination、sorting、服务端 `columnFilters` 或 editing scope 改变时必须清空本地条件，禁止让旧页选择静默污染新 scope。
- 候选项必须按原始类型生成 typed key；字符串 `"1"`、数字 `1`、boolean、Date 和空白值不得合并。数组 cell 按任一元素命中，空数组按空白处理。
- 多列条件使用 AND；计算某列候选项时应用其他列条件但排除本列条件，使级联候选保持可恢复。`undefined` 表示全选/未筛选，空 `selectedKeys` 是有效条件并表示不匹配任何行。
- 搜索框只收窄候选列表，不直接修改表格数据；勾选立即生效，全选只作用于当前可见候选，搜索后 Enter 使用当前匹配项替换该列选择。
- 候选值只在 Popover 打开时收集，长列表必须虚拟化。禁止在每次表格 render 或浮层关闭时扫描整列、创建全部 option DOM。
- 表头漏斗入口必须独立于排序/隐藏菜单，使用固定尺寸且不得挤压标题到不可读；active 状态必须同时提供视觉提示和 `aria-pressed`。

## 页面组合

- 标准后台表格页面使用 `Card` + `DataTable` + `DataTableToolbar`。
- 数据层统一由 `useDslDataTable` 驱动。
- 页面侧至少优先消费 `table`、`queryState`、`total` 和 `refreshProps`。
- 服务端分页表格必须传入 `statusTotalCount={total}`。
- 刷新能力优先通过 `{...refreshProps}` 透传给 `DataTable`，不要重复包装刷新按钮或 `refetch`。
- Loading 状态可将 `queryState.isFetching` 传给 `DataTable` 的 `isLoading`。
- `DataTable` 的 loading / empty / error(status) 必须有稳定 DOM 兜底：普通空数据使用 `emptyMessage`，业务空态或错误态通过 `getStatusConfig` 返回 `DataTableStatus`，不得让表体空白。
- `getStatusConfig` 会收到 `{ rows, totalCount, hasFilters, isLoading }`；页面需要避免 loading 闪烁时，应基于 `isLoading` 延迟返回 empty/onboarding status，而不是在页面层替换表格主体。
- `DataTable` 会基于当前 table state 自动重新计算 `getStatusConfig`，页面层不需要额外维护状态依赖数组。

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

## 回归测试

新增或修改 DataTable 能力时按职责选择验证层：

- `columns` / codec / adapter / 纯算法必须补同目录单测。
- hook 状态、scope reset、跨页草稿和本地筛选必须补 `src/hooks/use-data-table/` 测试。
- 表头、Popover、键盘焦点、虚拟化和 pointer 竞争必须补真实浏览器测试；禁止仅凭 jsdom 判断交互已正确。
- 迁移目录或公共入口后至少运行 `pnpm lint`、`pnpm typecheck`、`pnpm vitest run src/components/data-table src/hooks/use-data-table` 和 `pnpm build`。

新增服务端表格 feature 还必须至少补一组页面级回归测试，覆盖以下项目中的核心路径：

- 总数文案
- 空态
- 关键筛选
- 关键操作

## 审计字段列

所有包含 `createTime`、`createBy`、`updateTime`、`updateBy` 的表格列定义，必须使用列 DSL 的 `audit()` 宏，禁止手写内联列：

```tsx
import { createDataTableColumnDsl } from '@/components/data-table/columns/data-table-column-factory';

const columnDsl = createDataTableColumnDsl<XxxRecord>();

export const xxxColumns: ColumnDef<XxxRecord>[] = [
  // ...其他列
  ...columnDsl.audit(),
];
```

`columnDsl.audit()` 返回 `创建信息`、`更新信息` 两列：

- 人员在上，使用 `text-muted-foreground`。
- 时间在下。
- 整列使用 `text-xs`。
- 列 ID 固定为 `createInfo` 和 `updateInfo`。

记录类型必须满足：

```ts
interface AuditFields {
  createBy?: string | number | null;
  createTime?: string | null;
  updateBy?: string | number | null;
  updateTime?: string | null;
}
```

SSO OpenAPI DTO 中审计人字段通常生成为用户名 `string`，其他接口可能仍返回数字 ID；共享审计列同时接受两种稳定标识，调用点禁止用类型断言掩盖其他字段差异。
