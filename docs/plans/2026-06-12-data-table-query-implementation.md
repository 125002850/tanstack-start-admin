# DataTable Query 共享分页 DSL Implementation Plan

**Goal:** 引入共享 `useDataTableQuery`，把 TanStack Table 状态到分页 DSL 请求的桥接逻辑从消费层下沉，并在字典管理页的字典类型主列表完成首个真实接线，同时保持 `useDataTable` / `DataTable` 的核心职责不漂移。

**Architecture:** 本次实现分成四层推进：先把页长偏好解析收敛成 `tableId` 级别的稳定契约；再落纯函数 DSL 序列化层，锁定字段解析、空值归一化和默认操作符；然后用一个薄 `useDataTableQuery` 把 `useDataTable`、React Query 和服务端分页总数衔接起来，并补齐 `DataTablePagination` 的服务端 `total` 语义；最后只在字典类型左侧主列表完成首个接线，保留现有按钮式主从选择 UX，不额外扩大 `DataTable` 的行点击 API。

**Tech Stack:** React 19、TypeScript、@tanstack/react-table v8、@tanstack/react-query v5、Vitest、Testing Library

**Preconditions**

- 本计划以前置契约已经收敛为前提：分页 DSL `field` 使用小写并与响应 key 一致，`date` / `dateRange` 使用带显式时区偏移的 ISO 8601 字符串。
- 执行 Task 2 之前，必须先检查 `src/lib/api/clients/service/generated/model/globalDictTypeConditionNodeField.ts`；如果仍然导出 `DICT_TYPE_CODE` 这一类大写枚举，先执行 backend / OpenAPI 收敛与 `pnpm codegen`，本计划内**不得**在前端补临时 field 映射。

---

## File Structure

- **Create:** `src/hooks/use-data-table-query.dsl.ts`
- **Create:** `src/hooks/use-data-table-query.dsl.test.ts`
- **Create:** `src/hooks/use-data-table-query.ts`
- **Create:** `src/hooks/use-data-table-query.test.tsx`
- **Create:** `src/components/ui/table/data-table-pagination.test.tsx`
- **Create:** `src/features/dictionaries/components/dictionary-type-columns.tsx`
- **Modify:** `src/lib/data-table-page-size.ts`
- **Modify:** `src/lib/data-table-page-size.test.ts`
- **Modify:** `src/types/data-table.ts`
- **Modify:** `src/components/ui/table/data-table-pagination.tsx`
- **Modify:** `src/components/ui/table/data-table.tsx`
- **Modify:** `src/components/ui/table/data-table.test.tsx`
- **Modify:** `src/features/dictionaries/components/dictionary-management-page.tsx`
- **Modify:** `src/features/dictionaries/components/dictionary-type-list.tsx`
- **Modify:** `src/features/dictionaries/components/dictionary-management-page.test.tsx`
- **Modify:** `src/features/dictionaries/components/dictionary-management-page.render.test.tsx`
- **Reference:** `docs/superpowers/specs/2026-06-12-data-table-query-design.md`
- **Reference:** `src/lib/api/clients/service/generated/model/globalDictTypeDynamicListReqDTO.ts`
- **Reference:** `src/lib/api/clients/service/generated/model/globalDictTypeConditionNodeField.ts`

---

### Task 1: 收敛 `tableId` 级页长偏好与 SSR 降级

**Type:** `behavior`

**Files**

- Modify: `src/lib/data-table-page-size.ts`
- Modify: `src/lib/data-table-page-size.test.ts`

**Shared Runtime Contracts**

- `DataTable` 页长偏好存储键语义
- SSR 阶段与 hydration 后的默认页长解析顺序

**Invariants**

- 现有 `DATA_TABLE_PAGE_SIZE_OPTIONS` 与合法值校验规则保持不变
- localStorage 仍然是唯一持久化媒介，不新增 URL / Router / Zustand 同步
- 未传 `tableId` 的旧调用路径继续可用，products/users 等旧 demo 页不需要同步改造

**Constraints**

- 必须支持 `tableId` 级别的存储 key，避免所有列表共用一个页长偏好
- `useDataTablePageSize` 需要显式支持 `tableId`，但要保留无参调用的向后兼容语义
- SSR 只能使用 `defaultPageSize -> 内置兜底常量`，不能在服务端碰 `window`
- 不得把 `queryOptions`、路由 search 或其它外部来源纳入默认页长优先级链

**Acceptance Criteria**

- [ ] `profile: task-1-page-size-contract` 通过
- [ ] 同一个浏览器里两个不同 `tableId` 能持久化不同页长偏好
- [ ] 无 `tableId` 的旧调用仍回落到兼容 key，不破坏现有 demo 页测试
- [ ] SSR / `window` 不可用场景下读取函数稳定返回 `null` 或默认值，不抛异常

**Verification Profile**

- `profile: task-1-page-size-contract`
  - `pnpm exec vitest run src/lib/data-table-page-size.test.ts`
- `Expected Signals:` 新增 `tableId` 作用域与 SSR 降级用例通过，现有无参兼容用例保持全绿

**Verification Strategy**

- `regression guard`

**Browser Gate Role**

- `none`

- [ ] Step 1: 在 `src/lib/data-table-page-size.test.ts` 先补 `tableId` 作用域、无参兼容、SSR 降级三个用例组
- [ ] Step 2: 在 `src/lib/data-table-page-size.ts` 引入按 `tableId` 派生 storage key 的读写函数，并让 `useDataTablePageSize` 支持 `tableId`
- [ ] Step 3: 确认 `searchPerPage` 兼容路径仍存在，但不把它扩散到新 hook 主路径
- [ ] Step 4: Run `profile: task-1-page-size-contract`
- [ ] Step 5: Commit `feat: scope data-table page size by table id`

---

### Task 2: 落地纯函数 DSL 序列化层

**Type:** `behavior`

**Files**

- Create: `src/hooks/use-data-table-query.dsl.ts`
- Create: `src/hooks/use-data-table-query.dsl.test.ts`
- Modify: `src/types/data-table.ts`

**Shared Runtime Contracts**

- `column.id / accessorKey -> DSL field` 解析规则
- `meta.variant` 到默认 DSL operator 的派生规则
- 各筛选 variant 的空值归一化契约

**Invariants**

- V1 只自动支持 `text`、`select`、`multiSelect`、`date`、`dateRange`
- 空筛选必须直接省略节点，不生成 payloadValid=false 的脏请求
- 默认 `condition` 根节点逻辑固定为 `AND`
- `baseCondition` 仅与表格筛选合并，不改写消费层传入对象

**Constraints**

- 禁止在共享层引入 feature-specific 的 `field` 映射表
- 禁止为了兼容旧 OpenAPI 枚举而输出大写 `field`
- `accessorFn` 列若没有显式 `id`，该列排序/筛选必须被跳过，不能猜字段名
- `meta.query.operator` 仅允许覆盖到当前 `variant` 可接受的 operator；非法组合必须降级为 warn + fallback，而不是静默发错请求
- `date` / `dateRange` 只能输出带显式时区偏移的 ISO 8601 字符串；若契约未收敛，不得偷偷回退到 `yyyy-MM-dd HH:mm:ss`

**Acceptance Criteria**

- [ ] `profile: task-2-dsl-serializer` 通过
- [ ] `pageIndex/pageSize/sorting/columnFilters` 能稳定序列化成统一分页 DSL request
- [ ] `text/select/multiSelect/date/dateRange` 的空值归一化规则都有独立断言
- [ ] `meta.query.operator` 的兼容覆盖与非法组合降级行为有测试保护
- [ ] 纯函数层不依赖 React、Router 或具体业务组件

**Verification Profile**

- `profile: task-2-dsl-serializer`
  - `pnpm exec vitest run src/hooks/use-data-table-query.dsl.test.ts`
  - `pnpm exec tsc --noEmit`
- `Expected Signals:` DSL builder 单测覆盖空值、排序、日期、operator override；TypeScript 无新增错误

**Verification Strategy**

- `TDD`

**Browser Gate Role**

- `none`

- [ ] Step 1: 在 `src/hooks/use-data-table-query.dsl.test.ts` 先写纯函数用例，覆盖字段解析、空值归一化、默认 sort、`baseCondition` 合并、日期序列化与非法 override 告警
- [ ] Step 2: 在 `src/types/data-table.ts` 为列元数据补充最小 `query.operator` 覆盖口子，不扩大到整段 `requestBuilder`
- [ ] Step 3: 新建 `src/hooks/use-data-table-query.dsl.ts`，实现 `PaginatedResponse`、`DataTableDslPageRequestBase`、`QueryOptionsFactory` 与 request builder
- [ ] Step 4: 显式读取 `src/lib/api/clients/service/generated/model/globalDictTypeConditionNodeField.ts`；若仍是大写枚举，停止继续实现并先完成 OpenAPI 收敛
- [ ] Step 5: Run `profile: task-2-dsl-serializer`
- [ ] Step 6: Commit `feat: add shared data-table dsl serializer`

---

### Task 3: 组装 `useDataTableQuery` 并补齐服务端分页总数语义

**Type:** `wiring`

**Files**

- Create: `src/hooks/use-data-table-query.ts`
- Create: `src/hooks/use-data-table-query.test.tsx`
- Create: `src/components/ui/table/data-table-pagination.test.tsx`
- Modify: `src/components/ui/table/data-table-pagination.tsx`
- Modify: `src/components/ui/table/data-table.tsx`
- Modify: `src/components/ui/table/data-table.test.tsx`

**Shared Runtime Contracts**

- `useDataTable` 状态与 React Query request lifecycle 的桥接
- `queryKey` 完整 request 语义与 `keepPreviousData` 叠加策略
- `DataTablePagination` 在服务端分页下的总数展示契约

**Invariants**

- `useDataTable` 对外 API 保持不变；新能力通过 `useDataTableQuery` 增加，不反向污染旧 hook
- `DataTable` 对外 render API 不新增必填 prop
- `query.data` 继续暴露原始 `{ list, total }`，`total` 只是便利用值
- 旧的纯客户端表格在未传服务端总数时，分页底部文案仍回退到当前行数

**Constraints**

- `queryOptions(request)` 产出的 `queryKey` 必须完整覆盖 `pageNo/pageSize/dslVersion/condition/sort`
- `useDataTableQuery` 必须默认叠加 `placeholderData: keepPreviousData`，但不得破坏原 factory 上的其它 query 选项
- `TanStackQueryOptionsLike` 需要在实现中落成当前项目真实可消费的类型边界，禁止保留伪占位类型
- `DataTablePagination` 的服务端总数必须复用已有 `statusTotalCount` 语义向下传递，避免为了这次需求再扩一层新的外部必传 prop
- 对 `accessorFn + enableColumnFilter/enableSorting + 缺少 id` 的列，仅允许 dev warn，不允许悄悄拼错请求

**Acceptance Criteria**

- [ ] `profile: task-3-query-hook` 通过
- [ ] hook 能基于 `tableId + columns + queryOptions` 输出 `table / total / query`
- [ ] hook 会根据 `pagination/sorting/columnFilters` 自动触发请求，并把 `list/total` 回填到 table/pageCount
- [ ] 快速切页或改筛选时，旧数据会保留到新请求完成，不出现表格区域清空闪烁
- [ ] `DataTablePagination` 在 `statusTotalCount` 存在时显示服务端总数，不再误报当前页条数为总条数

**Verification Profile**

- `profile: task-3-query-hook`
  - `pnpm exec vitest run src/hooks/use-data-table-query.test.tsx src/components/ui/table/data-table-pagination.test.tsx src/components/ui/table/data-table.test.tsx`
  - `pnpm exec tsc --noEmit`
- `Expected Signals:` hook 测试断言 request 组装与 keepPreviousData 生效；分页组件与 DataTable 回归测试全绿

**Verification Strategy**

- `integration smoke`

**Browser Gate Role**

- `none`

- [ ] Step 1: 先在 `src/hooks/use-data-table-query.test.tsx` 写请求组装、`pageNo = pageIndex + 1`、`keepPreviousData`、`query.data` 语义与 dev warn 用例
- [ ] Step 2: 在 `src/components/ui/table/data-table-pagination.test.tsx` 写“服务端 total 优先 / 无 total 回退当前页长度”用例；必要时补 `src/components/ui/table/data-table.test.tsx` 回归断言
- [ ] Step 3: 新建 `src/hooks/use-data-table-query.ts`，内部组合 `useDataTable`、`useDataTablePageSize({ tableId })` 与 `useQuery`
- [ ] Step 4: 在 `src/components/ui/table/data-table-pagination.tsx` / `src/components/ui/table/data-table.tsx` 接上服务端总数文案传递，但不改现有消费方调用面
- [ ] Step 5: Run `profile: task-3-query-hook`
- [ ] Step 6: Commit `feat: add shared data-table query hook`

---

### Task 4: 在字典类型主列表完成首个真实接线

**Type:** `behavior`

**Files**

- Create: `src/features/dictionaries/components/dictionary-type-columns.tsx`
- Modify: `src/features/dictionaries/components/dictionary-management-page.tsx`
- Modify: `src/features/dictionaries/components/dictionary-type-list.tsx`
- Modify: `src/features/dictionaries/components/dictionary-management-page.test.tsx`
- Modify: `src/features/dictionaries/components/dictionary-management-page.render.test.tsx`

**Shared Runtime Contracts**

- 字典类型主从列表的选中回退规则
- `useDataTableQuery` 在真实页面中的筛选、分页与 query 触发路径

**Invariants**

- 字典项右侧面板、增删改 mutation 和 `selectedType` 驱动逻辑保持不变
- 左侧主列表继续保留当前按钮式单选交互，不强行替换成通用表格 row selection / checkbox UX
- 过滤条件改为服务端 DSL 后，不再保留旧的本地 `keyword` 二次过滤
- 当当前筛选页不包含 `requestedTypeCode` 时，仍回退到当前页第一条或 `null`

**Constraints**

- V1 不为字典类型主列表额外扩大 `DataTable` 的 `onRowClick` 或单选 API
- `DictionaryTypeList` 可以复用 `DataTableToolbar` / `DataTablePagination` 与 `table` 状态，但要保留当前卡片式 master-detail 视觉结构
- `listGlobalTypesQueryOptions` 不再使用固定 `{ pageNo: 1, pageSize: 200 }`
- 若后端/生成客户端的日期契约尚未完成收敛，`dictionary-type-columns.tsx` 中不得先接入 `createTime` 的 `dateRange` filter；先只启用已收敛的文本筛选列

**Acceptance Criteria**

- [ ] `profile: task-4-dictionaries-integration` 通过
- [ ] 字典类型左侧搜索由 `table` 过滤状态驱动，并转成分页 DSL 请求
- [ ] 左侧分页控件能驱动 `pageNo/pageSize`，不再一次性拉 200 条
- [ ] 页面现有选中、详情、字典项加载与新增类型按钮行为保持可用
- [ ] render 回归测试不出现最大更新深度错误
- [ ] 全量构建通过

**Verification Profile**

- `profile: task-4-dictionaries-integration`
  - `pnpm exec vitest run src/features/dictionaries/components/dictionary-management-page.test.tsx src/features/dictionaries/components/dictionary-management-page.render.test.tsx`
  - `pnpm run build`
- `Expected Signals:` 页面测试断言新的 query request 形状、筛选分页触发路径与主从选择回退逻辑；`vite build` 无新增类型或运行时打包错误

**Verification Strategy**

- `integration smoke`

**Browser Gate Role**

- `none`

- [ ] Step 1: 新建 `dictionary-type-columns.tsx`，只声明已收敛契约下可安全启用的筛选列元数据
- [ ] Step 2: 在 `dictionary-management-page.tsx` 用 `useDataTableQuery` 替换本地 `keyword + 固定 200 条查询` 逻辑，并用 `query.data?.list ?? []` 驱动当前页类型列表
- [ ] Step 3: 在 `dictionary-type-list.tsx` 中复用 `DataTableToolbar` 与 `DataTablePagination`，保留现有卡片按钮列表和新增按钮
- [ ] Step 4: 更新两个字典页测试，重点覆盖 request 形状、筛选输入、分页跳转、选中回退和无更新循环
- [ ] Step 5: Run `profile: task-4-dictionaries-integration`
- [ ] Step 6: Commit `feat: wire dictionary types to data-table query hook`

---

### Task 4 Execution

- Result: pass
- Files changed: `src/features/dictionaries/components/dictionary-management-page.test.tsx`, `src/features/dictionaries/components/dictionary-management-page.render.test.tsx`
- Verification: `profile: task-4-dictionaries-integration` -> PASS (`pnpm exec vitest run src/features/dictionaries/components/dictionary-management-page.test.tsx src/features/dictionaries/components/dictionary-management-page.render.test.tsx`; `pnpm run build`)
- Verification: `pnpm exec tsc --noEmit` -> PASS
- Notes: 将字典管理页测试改为真实 `useDataTableQuery` 路径下的 API query/mutation options mock，覆盖分页 DSL 请求形状、左侧筛选与分页触发、当前页缺失选中类型时回退到首条，以及 render 回归不出现更新循环。测试中仍会看到 `DictionaryItemsPanel` 因切换 `tableId` 打出的既有 dev warn，但不影响本次 profile 和构建结果。

### Task 4 Follow-up Execution

- Result: pass
- Files changed: `src/features/dictionaries/components/dictionary-items-panel.tsx`, `src/features/dictionaries/components/dictionary-management-page.test.tsx`, `src/features/dictionaries/components/dictionary-management-page.render.test.tsx`
- Verification: `pnpm exec vitest run src/features/dictionaries/components/dictionary-management-page.test.tsx -t "drives dictionary type requests from table state and falls back selection on page changes"` -> PASS
- Verification: `pnpm exec vitest run src/features/dictionaries/components/dictionary-management-page.test.tsx src/features/dictionaries/components/dictionary-management-page.render.test.tsx` -> PASS
- Verification: `pnpm exec tsc --noEmit` -> PASS
- Notes: 将字典项列表 `tableId` 收敛为稳定的 `dictionary-items`，消除切换字典类型时的开发期 `tableId changed` 告警，并避免列宽持久化读写 key 在运行时漂移。补回 `dictionary-management-page.render.test.tsx`，防止 render 回归保护丢失。

### Update (2026-06-15)

- 实现状态：左侧字典类别主列表已按最新产品决策切换为非分页模式，不再走分页 DSL；查询改为 `/api/mdm/dict/global/types/list-all` 对应的 `listAllGlobalTypesQueryOptions`，请求仅保留 `keyword`。
- 实现状态：`DictionaryTypeList` 已移除分页控件，保留单个 `keyword` 输入，并与“新增字典类型”按钮保持同一行。
- 实现状态：字典类别 `keyword` 查询切换为保留上一帧数据的策略，避免每次输入触发新 query 时整页退回 `DictionaryManagementFallback` 造成闪烁。
- 实现状态：`useDataTable` 新增 `rowSelectionScopeKey`，当数据上下文 key 变化时自动清空当前选中；字典项表格已将该 key 绑定到当前 `dictTypeCode`，并显式使用 `row.id` 作为稳定行标识。
- 验证状态：`pnpm exec vitest run src/features/dictionaries/components/dictionary-management-page.test.tsx`、`pnpm exec tsc --noEmit`、`pnpm run build` 均已通过。
