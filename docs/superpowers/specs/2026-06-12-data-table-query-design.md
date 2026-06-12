# DataTable Query 共享分页 DSL 设计

## 背景

当前项目里的共享表格能力已经比较完整：

- `useDataTable` 负责 TanStack Table 的内部状态、列宽持久化、行选择、行展开等共享行为
- `DataTable` 负责表格渲染、分页 UI、状态展示和工具栏插槽
- 各页面仍需要自己维护“表格状态 -> API 请求”的桥接逻辑，例如：
  - 本地 `request` / `apiFilters` state
  - `useDeferredValue`
  - `useEffect` 监听 `pagination / sorting / columnFilters`
  - 从响应里提取 `list / total`
  - 计算 `pageCount`

这部分逻辑是重复样板，且与具体数据源协议耦合，应该从消费层下沉。

## 已确认前提

本设计建立在以下后端契约已经统一的前提上：

1. 分页请求统一为分页 DSL，请求字段固定包含：
   - `pageNo`
   - `pageSize`
   - `dslVersion`
   - `condition`
   - `sort`
2. DSL 中的 `field` 命名统一为小写，并与响应数据 key 保持一致。
3. 分页响应统一为：

```ts
{
  list: T[]
  total: number
}
```

在这个前提下，前端不需要再维护 `field` 映射，也不需要为不同响应结构编写 `select` 归一化逻辑。

## 目标

引入一个面向消费层的共享 hook：`useDataTableQuery`，把分页 DSL 组装、请求触发、响应回填和分页计算全部内聚到内部，实现以下目标：

- 页面层只声明 `tableId`、`columns` 和 `queryOptions`
- 保留现有 `useDataTable` / `DataTable` 渲染链路，不重写表格核心
- 默认根据列定义自动生成分页 DSL 的 `condition` 与 `sort`
- 默认读取统一响应结构中的 `list / total`
- 分页页长偏好和分页状态处理完全内聚，不暴露给消费层

## 非目标

本设计明确不做以下事情：

- 不修改 `DataTable` 组件对外渲染 API
- 不引入全局数据源注册表
- 不让 `DataTable` 组件本体理解 DSL 协议
- 不为旧 demo 页面（如 products/users）做兼容性设计
- 不开放整段自定义 `requestBuilder`
- 不支持消费层覆盖分页字段名、响应字段名或 `field` 映射

## 推荐方案

采用“共享 query hook + 保持表格核心纯粹”的方案：

- `useDataTable` 继续只管理表格状态与共享列能力
- 新增 `useDataTableQuery`，负责：
  - 创建内部 `useDataTable(...)`
  - 读取 `pagination / sorting / columnFilters`
  - 组装统一分页 DSL request
  - 调用消费层传入的 `queryOptions(request)`
  - 从响应读取 `list / total`
  - 反算 `pageCount`
- 页面继续渲染现有 `DataTable`

不选择“页面自己拼 request”的原因是样板会持续扩散。  
不选择“全局注册表内聚 queryOptions”的原因是会把 `tableId` 升级成隐式数据源标识，降低可读性与可维护性。

## 消费层目标 API

### 页面层调用面

```tsx
import { DataTable } from '@/components/ui/table/data-table'
import { DataTableToolbar } from '@/components/ui/table/data-table-toolbar'
import { useDataTableQuery } from '@/hooks/use-data-table-query'
import { listGlobalTypesQueryOptions } from '@/lib/api/clients/service'
import { columns } from './columns'

export function GlobalTypesTable() {
  const { table, total, query } = useDataTableQuery({
    tableId: 'global-types',
    columns,
    queryOptions: listGlobalTypesQueryOptions,
  })

  return (
    <DataTable table={table} statusTotalCount={total}>
      <DataTableToolbar table={table} />
    </DataTable>
  )
}
```

### 列定义示例

```tsx
export const columns = [
  {
    accessorKey: 'dictTypeCode',
    header: '字典类型编码',
    enableColumnFilter: true,
    meta: { variant: 'text', label: '字典类型编码' },
  },
  {
    accessorKey: 'dictTypeName',
    header: '字典类型名称',
    enableColumnFilter: true,
    meta: { variant: 'text', label: '字典类型名称' },
  },
  {
    accessorKey: 'createTime',
    header: '创建时间',
    enableColumnFilter: true,
    meta: { variant: 'dateRange', label: '创建时间' },
  },
]
```

## `useDataTableQuery` 输入与输出边界

### 输入

V1 只保留以下必需输入：

- `tableId`
- `columns`
- `queryOptions`

允许的可选输入只保留：

- `rowActions`
- `baseCondition`
- `defaultSort`

### 输出

V1 只返回：

- `table`
- `total`
- `query`

说明：

- `table`：直接喂给现有 `DataTable`
- `total`：给分页总数与空态判断使用
- `query`：原样暴露 React Query 结果，页面如需 `isFetching / error / refetch` 可直接取用

## 内部默认行为

### 分页

- `pageIndex -> pageNo = pageIndex + 1`
- `pageSize -> pageSize`
- `dslVersion` 由 hook 内部固定补齐
- 页长偏好根据 `tableId` 自动读取和持久化
- 消费层不再传 `pageSize`、`seedPageSize`、`onPageSizeChange`

### 排序

排序规则直接由 TanStack Table `sorting` 派生：

```ts
sort: [{ field: 'createTime', direction: 'DESC' }]
```

规则：

- 字段名优先取 `column.id`
- 没有 `id` 时取 `accessorKey`
- `accessorFn` 列若未显式提供 `id`，不参与 DSL 排序和筛选
- `enableSorting === false` 的列不进入 `sort`

### 条件节点

默认由 `columnFilters` 生成根节点为 `AND` 的 DSL：

```ts
condition: {
  nodeType: 'compose',
  logic: 'AND',
  children: [...]
}
```

没有任何筛选时省略 `condition`。

## `meta.variant` 到 DSL 的默认映射

V1 默认只自动支持以下 5 类：

### `text`

- 非空字符串 -> `CONTAINS`

```ts
{ nodeType: 'text', field: 'dictTypeName', op: 'CONTAINS', value: '支付' }
```

### `select`

- 单选值 -> `EQ`

```ts
{ nodeType: 'text', field: 'status', op: 'EQ', value: 'ENABLE' }
```

### `multiSelect`

- 多选数组 -> `IN`

```ts
{ nodeType: 'text', field: 'status', op: 'IN', values: ['ENABLE', 'DISABLE'] }
```

### `date`

- 单日筛选 -> `BETWEEN`
- 自动展开为当天开始与结束时间，避免错误翻译为精确时刻

```ts
{
  nodeType: 'dateTime',
  field: 'createTime',
  op: 'BETWEEN',
  start: '2026-06-12 00:00:00',
  end: '2026-06-12 23:59:59',
}
```

### `dateRange`

- `from + to` -> `BETWEEN`
- 只有 `from` -> `GTE`
- 只有 `to` -> `LTE`

## V1 刻意不自动支持的类型

以下 `variant` 在 V1 不做自动 DSL 生成：

- `number`
- `range`
- `boolean`

原因：

- 当前共享表格虽然已经有这些 UI 变体，但在没有真实业务页面约束前，直接进入默认 DSL 规则会让 hook 过早变厚
- 这些类型一旦进入默认规则，后续对操作符、空值、序列化格式的约束会更难收口

策略：

- V1 先不自动支持
- 有真实页面需要时，再按统一 DSL 协议增量补充

## 最小扩展点

为避免新的共享 hook 重新退化为“任意 request builder”，V1 只开放三个扩展点。

### `baseCondition`

用于声明固定业务前置条件，再与表格筛选通过 `AND` 合并。

适用场景：

- 当前租户
- 当前客户
- 当前业务上下文

### `defaultSort`

用于声明默认排序，不要求页面自己手写初始 `sorting` 状态。

### 列级少量 override

只允许通过列 `meta.query` 提供最小覆盖：

- `operator`
- `serialize`

示例：

```tsx
{
  accessorKey: 'status',
  enableColumnFilter: true,
  meta: {
    variant: 'text',
    label: '状态',
    query: { operator: 'EQ' },
  },
}
```

## 明确不开放的能力

为了维持消费层薄度和共享 hook 的可预测性，V1 明确不开放：

- `field` 映射
- 自定义分页字段名
- 自定义响应 `select`
- 整段自定义 `requestBuilder`
- 页面自行拼装 `condition` / `sort` 后再塞回主路径

这些能力一旦开放，消费层很容易重新长回：

- `useState(request)`
- `useDeferredValue(request)`
- `useEffect(() => setRequest(...))`
- 页面级 request 序列化逻辑

这会直接削弱共享 hook 的价值。

## 兼容与迁移策略

### 对现有共享表格核心的影响

- `useDataTable` 保持现有职责边界
- `DataTable` 保持现有渲染 API
- `DataTableToolbar` 保持现有基于 `meta.variant` 的筛选 UI 渲染方式

### 对消费页的影响

从页面层删除以下重复样板：

- request / apiFilters state
- `useDeferredValue`
- request 同步 `useEffect`
- 手动响应提取 `list / total`
- 手动 `pageCount` 计算
- 手动分页页长注入

消费页只保留：

- `tableId`
- `columns`
- `queryOptions`
- 必要的 `rowActions`

## 错误处理与加载态

V1 不新增一套独立的加载/错误 UI 机制。

策略：

- hook 返回原始 `query`
- 页面如需读取 `query.isFetching`、`query.error`、`query.refetch`，直接使用返回值
- 现有 `DataTable` 状态展示链路继续复用

这样可以避免共享 query hook 再包装出第二套状态抽象。

## 建议文件边界

V1 的实现边界建议如下：

- Create: `src/hooks/use-data-table-query.ts`
- Reuse: `src/hooks/use-data-table.ts`
- Reuse: `src/components/ui/table/data-table.tsx`
- Reuse: `src/components/ui/table/data-table-toolbar.tsx`
- Optional update: `src/types/data-table.ts`（若需要为列 `meta.query` 增加类型）

原则：

- 尽量不改 `DataTable` / `useDataTable` 主体职责
- 新逻辑尽量集中到一个 query bridge hook 内

## 测试策略

V1 至少覆盖以下行为：

1. `pageIndex/pageSize -> pageNo/pageSize` 转换正确
2. `sorting -> sort[]` 转换正确
3. `text/select/multiSelect/date/dateRange -> condition` 转换正确
4. 空筛选时省略 `condition`
5. `baseCondition` 与用户筛选正确按 `AND` 合并
6. 统一响应 `{ list, total }` 能正确驱动 `data` 与 `pageCount`
7. `tableId` 对应的页长偏好能正确读取与回写
8. `accessorFn` 且未声明 `id` 的列不会进入 DSL

## 风险与约束

### 风险 1：列定义不规范

若业务列使用 `accessorFn` 但未显式声明 `id`，则无法稳定参与排序和筛选。

约束：

- 凡需要参与 DSL 的 `accessorFn` 列，必须显式提供 `id`

### 风险 2：日期序列化不一致

若不同页面对日期格式理解不一致，可能导致 DSL 查询语义偏差。

约束：

- `date` / `dateRange` 的时间展开与格式化必须统一由共享 hook 负责

### 风险 3：扩展口膨胀

如果过早开放过多 override，hook 会重新演化成一套新的 request builder。

约束：

- V1 只保留 `baseCondition`、`defaultSort`、列级少量 override

## 验收标准

当以下条件全部满足时，认为该设计达标：

1. 页面层调用面只保留 `tableId`、`columns`、`queryOptions`
2. 消费层不再自行处理分页、DSL request 组装和 `pageCount`
3. 默认 DSL 规则可覆盖 `text/select/multiSelect/date/dateRange`
4. 不需要 `field` 映射
5. 不需要响应 `select`
6. 不引入全局注册表或隐式数据源绑定

## 结论

在“后端统一分页 DSL + `field` 命名统一 + 响应统一 `{ list, total }`”的前提下，最佳方案不是改造 `DataTable` 本体，而是在现有表格核心之上增加一层极薄的共享 query hook：

- 对外：`useDataTableQuery`
- 对内：集中处理 DSL request 与统一响应

这样可以最大化复用现有表格能力，同时把重复的分页查询样板从消费页移除，而不引入新的全局耦合点。
