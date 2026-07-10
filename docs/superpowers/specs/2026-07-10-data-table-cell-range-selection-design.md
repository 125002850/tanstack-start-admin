# DataTable 单元格区域选择设计

## 文档定位

这份文档是 **design spec**，用于评审 DataTable 的 Excel 式单元格区域选择语义、状态模型、虚拟化边界和回归要求；它不是 implementation plan。

设计通过后，再单独创建：

- `docs/plans/2026-07-10-data-table-cell-range-selection.md`

当前基线已在隔离工作树验证：

```text
pnpm test:unit src/components/ui/table/core/data-table.test.tsx
Test Files  1 passed (1)
Tests      70 passed (70)
```

## 背景

`src/components/ui/table/core/use-data-table-cell-selection.ts` 当前只维护一个 `activeCell`：

- 单击普通业务单元格后，仅该 cell 获得 `data-cell-selected="true"`
- `Cmd/Ctrl+C` 只复制当前 cell
- 行号列、操作列和固定列不可选
- 交互控件与浏览器原生文本框选不会被复制逻辑劫持

该模型无法表达锚点、活动端点和矩形范围，也无法在行/列虚拟化场景下支持跨视口选择。

## 目标

为 DataTable 增加连续矩形区域选择：

- 鼠标主键按下建立锚点，拖动经过其他 cell 时扩展矩形区域
- 单击仍得到一个单 cell 选区
- 方向键移动活动 cell；`Shift + 方向键` 从锚点扩展或收缩区域
- 拖动接近滚动视口边缘时，自动横向或纵向滚动并继续扩选
- `Cmd/Ctrl+C` 将选区复制为 TSV：列间使用 Tab，行间使用换行
- 继续优先使用列 `meta.copyValue`，保证金额、日期等业务值可正确复制
- 行/列虚拟化、排序、筛选、分页和列显隐后不产生幽灵选区
- 页面中多个 DataTable 仍保持单一 selection owner，互不同时高亮或响应复制

## 非目标

本期明确不包含：

- 填充柄、值复制填充、数字或日期序列推断
- Ctrl/Cmd 多块不连续选区及局部反选
- 单元格编辑、批量清空、粘贴和服务端写回
- 点击表头选择整列、点击行号选择整行
- 跨分页选择或选择未加载的服务端数据
- 移动端长按拖选与多指手势
- `Ctrl/Cmd + Shift + 方向键` 跳到数据区边缘
- 穿透 closed Shadow DOM 选择宿主内部 cell；当前 DataTable 自身不使用 Shadow DOM

## 社区交互基线

本设计参考 AG Grid 与 Handsontable 的共同语义：

- 选择由起始 cell 与结束 cell 定义，视觉结果始终是连续矩形
- 鼠标拖动创建区域；Shift 操作从既有焦点扩展区域
- 单块模式下，新一次普通拖选清理旧区域
- 复制区域数据时保持二维行列结构，便于粘贴进 Excel 或其他 grid
- 拖动选择期间抑制浏览器原生文本框选

本仓库首版采用“单连续区域”而不是完整 spreadsheet 多区域模型，降低与行选择、列拖拽和虚拟化的冲突面。

## 方案比较

### 方案 A：在状态中保存所有已选 cell ID

每次端点变化时遍历矩形，把全部 `cell.id` 写入 `Set<string>`。

优点：

- `isSelected` 是 O(1) 查询
- 直观，容易为小表格实现

缺点：

- 大选区每次 pointer move 都需要重建大集合
- 排序、筛选、列显隐后 ID 集合容易失效
- 与行/列虚拟化的未挂载 cell 协调较差

结论：不采用。

### 方案 B：保存锚点与活动端点，渲染时派生矩形

状态只保存 `anchor` 和 `focus` 两个逻辑坐标；基于当前 row/column order 归一化为上下左右边界。每个已渲染 cell 根据自身坐标判断是否位于范围内。

优点：

- 拖动更新是常量级状态更新，不随选区面积增长
- 正向、反向、跨行跨列拖动使用同一模型
- 虚拟化只渲染并判断当前窗口内 cell，未挂载 cell 不进入 React 状态
- TSV 复制时可直接从 TanStack 当前 row model 和 visible leaf columns 遍历范围

缺点：

- 必须明确 row/column order 变化后的失效规则
- 自动滚屏时需要用 pointer 坐标重新命中最新挂载的 cell

结论：**推荐采用。**

### 方案 C：建立独立 selection store 与命令系统

把焦点、范围、键盘命令、撤销和复制全部做成 DataTable 外部 store。

优点：适合未来完整 spreadsheet 编辑器。

缺点：当前没有编辑、粘贴、撤销和受控选择需求，会过早扩张共享 API 与架构面。

结论：本期不采用。

## 推荐架构

### 1. 逻辑坐标

新增内部类型，坐标使用稳定 ID，而不是只保存数组下标：

```ts
type DataTableCellCoordinate = {
  rowId: string;
  columnId: string;
};

type DataTableCellRange = {
  anchor: DataTableCellCoordinate;
  focus: DataTableCellCoordinate;
};
```

`anchor` 是开始选择的位置；`focus` 是当前活动端点。范围边界由当前可选 row ID 顺序和可选 column ID 顺序派生。

稳定 ID 的目的：

- 指针移动只更新 `focus`
- Shift 扩选始终保留 `anchor`
- 渲染时通过预建索引 Map 进行 O(1) 坐标定位
- 排序、筛选、分页或列集合变化时，可检测坐标是否仍存在

### 2. 可选行列快照

`DataTableBody` 向 selection hook 提供当前 TanStack row model 与 visible leaf columns。

可选列继续排除：

- `DATA_TABLE_ROW_NUMBER_COLUMN_ID`
- `DATA_TABLE_ACTIONS_COLUMN_ID`
- `column.getIsPinned()` 为真

选择范围不会跨过被排除列形成视觉空洞。边界只基于“可选列序列”计算，因此从第一个业务列拖到最后一个业务列时，矩形只包含其中可选的业务列。

row/column order 改变后，如果 `anchor` 与 `focus` 仍存在于当前模型，则基于新顺序重新派生矩形；不会因为排序或列重排本身无条件清空选区。

只有排序、筛选、分页、列显隐等操作导致 `anchor` 或 `focus` 不再属于当前已加载 row model / 可选列集合时才清空选区。首版不保留不可见的 stale range，也不跨分页缓存 selection：隐藏选区仍持有 copy owner 会让用户在没有视觉反馈时复制旧页数据，与仓库“当前已加载页”语义冲突。

### 3. 鼠标与指针状态机

内部阶段：

```text
idle -> pressing -> dragging -> idle
```

- `pointerdown`：仅响应主键；若目标允许选择，设置 `anchor = focus = 当前 cell`，取得 pointer capture，聚焦该 cell，并抑制原生文本框选
- `pointermove`：超过小幅移动阈值后进入 `dragging`；根据当前 pointer 坐标找到可选 cell，更新 `focus`
- `pointerup` / `pointercancel`：释放 capture、停止自动滚屏并结束拖动
- Shift + pointerdown：若已有有效 anchor，则只更新 focus；否则按普通 pointerdown 建立新 anchor

只有非 Shift 的 pointerdown 才重置 pointer 选择的 anchor。普通方向键移动则按键盘语义把 `anchor` 与 `focus` 一起移动到新 cell；之后 Shift + click/方向键自然从这个新 active cell 扩展，不需要记录 anchor 来自鼠标还是键盘。

命中策略按以下顺序执行：

1. `document.elementsFromPoint(clientX, clientY)` 从顶层向下遍历，使用 `closest('[data-cell-id]')` 找到属于当前 DataTable owner 的可选 cell
2. 如果指针位于 scrollbar、虚拟化 gap 或 cell 间隙，基于当前已渲染可选 cell 的 bounding rect，选择与 pointer 最近且位于拖动方向上的行、列边界 cell
3. pointer 位于 DataTable 有效可见矩形外时，仅把 focus 夹紧到该方向的最后一个已渲染可选 cell，由自动滚屏挂载下一批 cell 后继续命中

使用 `pointermove + elementsFromPoint + 几何回退`，不依赖每个 cell 的 `mouseenter`。原因是自动滚屏和虚拟化会在指针静止时替换下方 DOM，新挂载 cell 不一定触发可靠的 enter 序列。当前组件树没有 Shadow DOM；不为不存在的 closed shadow root 引入穿透协议。

按钮、链接、输入控件、checkbox、菜单项和 contenteditable 继续复用现有 `shouldIgnoreTarget` 边界，不抢占它们的 pointer 行为。

### 4. 键盘模型

选区只暴露一个 roving tab stop：当前 `focus` cell 为 `tabIndex=0`，其他可选 cell 为 `tabIndex=-1`。不会把整张虚拟表格加入 Tab 顺序。

行为：

| 按键           | 结果                                                          |
| -------------- | ------------------------------------------------------------- |
| 方向键         | 将 anchor 与 focus 一起移动到相邻可选 cell，选区收敛为单 cell |
| Shift + 方向键 | anchor 不变，focus 向相邻可选 cell 移动，区域扩展或收缩       |
| 到达边界继续按 | 保持当前 focus，不循环到另一侧                                |
| Cmd/Ctrl+C     | 复制当前矩形选区                                              |
| Escape         | 清空选区并停止进行中的拖选/自动滚屏                           |

移动后调用目标 cell 的 `focus({ preventScroll: true })`，再通过滚动容器执行最小量滚动使目标可见。虚拟化目标尚未挂载时，先调用现有 row/column virtualizer 的滚动能力，再在布局完成后恢复焦点。

水平方向键使用视觉方向：读取 DataTable viewport 的 computed `direction`；LTR 下 ArrowLeft/ArrowRight 对应前一列/后一列，RTL 下反向映射。纵向方向不变。

### 5. 边缘自动滚屏

自动滚屏只在 `dragging` 阶段运行：

- 读取 `scrollViewportRef.current.getBoundingClientRect()`，再与会产生裁剪的滚动祖先 bounding rect 及 visual viewport 求交，得到 DataTable 的有效可见矩形
- 指针进入上下或左右边缘热区时启动一个 `requestAnimationFrame` 循环
- 根据指针进入热区的深度计算速度，越靠边速度越快
- 每帧用 `scrollBy({ left, top, behavior: 'auto' })` 更新视口
- 滚动后再次用最新 pointer 坐标执行 `elementFromPoint`，把 focus 更新到新挂载的 cell
- pointerup、pointercancel、Escape、组件卸载或视口无法继续滚动时立即停止 RAF

自动滚动目标始终是 `scrollViewportRef.current`。嵌套滚动容器只参与有效可见矩形裁剪，不进入链式滚动；否则 cell 拖选可能意外推动页面或外层 workspace。`clientX/clientY` 与 `getBoundingClientRect()` 本身都使用 viewport 坐标，nested scroll 不需要额外坐标换算。

初始参数由当前布局动态派生：

- 热区：优先取当前 focus cell 高度的 `0.75` 倍，并夹紧在 `24px` 到 `56px`
- 最大速度：优先取 focus cell 高度的 `0.5` 倍/帧，并夹紧在 `12px` 到 `32px`
- 最小速度：最大速度的 `20%`，至少 `3px`/帧
- 水平与垂直可同时滚动，支持对角线拖选

比例与上下限集中定义为 auto-scroll hook 的内部 tuning constants，并通过纯函数测试覆盖；本期不扩展 DataTable 公共 props。浏览器缩放使用 CSS pixel，动态读取 cell 尺寸可同时适配字体、density 与 zoom 变化。

RTL 下通过内部 scroll normalization helper 把“视觉向左/向右”转换为 viewport 的实际滚动 delta，隔离不同浏览器对 RTL `scrollLeft` 的表示差异；范围边界使用逻辑方向，不直接把数据列前后等同于 CSS left/right。

### 6. TSV 复制

复制按归一化范围逐行逐列生成：

```text
row 1 col 1\trow 1 col 2
row 2 col 1\trow 2 col 2
```

取值优先级：

1. `cell.column.columnDef.meta.copyValue(cell.getValue(), row.original)`
2. 当前 cell 已挂载时读取规范化后的 `innerText`
3. 未挂载的虚拟 cell 回退到规范化后的 `cell.getValue()`

该回退保证跨视口选区仍可复制；复杂展示列若希望复制格式化值，必须继续通过既有 `meta.copyValue` 显式声明。

复制成功反馈作用于整个已渲染选区，而不是只闪烁 focus cell。仍使用 a/b run 切换保证连续复制可重新触发动画。

## React 性能边界

- pointer 位置、dragging 标记、RAF ID 使用 ref 保存，避免每个 pointermove 都触发无关 render
- React state 只保存可观察的 `range` 与复制反馈 run
- row/column index 使用 `Map<string, number>`，避免每个 cell render 执行线性查找
- `isCellInRange` 只比较四个整数边界，不创建选中 ID 集合
- 自动滚屏由单一 RAF 循环驱动；组件卸载时必须清理
- 不新增 document 级 pointer listener 的重复实例；每个 DataTable 只在真实拖选期间绑定

## DOM 与视觉契约

保留现有：

- `data-cell-id`
- `data-cell-selected="true"`
- `data-cell-copy-flash`
- `data-cell-copy-flash-run`

新增稳定钩子：

- `data-cell-row-id`
- `data-cell-column-id`
- `data-cell-range-anchor="true"`
- `data-cell-range-focus="true"`
- `data-cell-range-edge="block-start inline-end block-end inline-start"`，仅输出该 cell 实际所在逻辑边

视觉要求：

- 区域内部使用低透明度 primary 背景，不覆盖 row selected 与 pinned 背景的可读性
- 外边界使用 primary outline/box-shadow，内部 cell 不重复画粗边框
- focus cell 有比区域边界更明确但不过度抢眼的 focus ring
- 区域边界样式使用 CSS logical properties，在 LTR/RTL 下保持相同语义
- `prefers-reduced-motion` 下复制反馈保持 1ms 动画
- 拖选期间对表体临时设置 `user-select: none`，结束后恢复，不永久禁用文本选择

## 多表实例与生命周期

沿用现有 selection owner 广播：

- 新表格开始选择时，其他 DataTable 立即清空 range 与复制反馈
- 只有 owner 响应 document copy
- owner 卸载、数据模型失效或 Escape 时释放 owner
- window blur、pointercancel 时结束拖动与自动滚屏，但保留已经完成的 range；Escape 才清空

## 可访问性

- 仅 focus cell 进入 Tab 顺序，避免大量 cell 成为 tab stop
- cell 聚焦时保留原生 table cell 语义，不伪造 row selection
- `data-cell-selected` 只用于视觉与测试，不设置 `aria-selected`，避免和现有 `<tr aria-selected>` 行选择语义冲突
- 键盘路径与鼠标路径共享同一 range reducer，避免两套状态漂移
- 交互控件获得焦点时，方向键和复制继续归控件自身处理

## 文件边界

预计运行时代码：

- 修改 `src/components/ui/table/core/use-data-table-cell-selection.ts`
- 修改 `src/components/ui/table/core/data-table-body.tsx`
- 新增 `src/components/ui/table/core/data-table-cell-range.ts`
- 新增 `src/components/ui/table/core/use-data-table-cell-auto-scroll.ts`
- 修改 `src/styles/globals.css`

预计测试：

- 修改 `src/components/ui/table/core/data-table.test.tsx`
- 新增 `src/components/ui/table/core/data-table-cell-range.test.ts`
- 新增 `e2e/data-table-cell-range-selection.smoke.spec.ts`

公共 `DataTableProps` 不新增配置项，页面调用方不需要迁移。

## 测试矩阵

### 纯函数单元测试

- 正向、反向与对角线范围归一化
- 排除不可选列后的边界计算
- 方向键移动与边界夹紧
- LTR/RTL 水平方向键映射与逻辑 range edge
- TSV 行列顺序、换行规范化和 `copyValue` 优先级
- row/column ID 失效时返回空范围
- 自动滚屏热区、速度曲线、祖先裁剪求交与 RTL scroll normalization

### React 交互测试

- 单击仍只选择一个 cell
- pointerdown 后跨行跨列拖动形成矩形
- 反向拖动得到相同矩形
- scrollbar、虚拟化 gap 与 cell 间隙命中时使用最近边界 cell
- Shift + click 从 anchor 扩展
- 普通方向键移动后，Shift + click 从新的 active cell 扩展
- 普通方向键移动单 cell；Shift + 方向键扩展/收缩
- Escape 清空选区并停止拖动
- 按钮、checkbox、行号、操作列、固定列不开始选择
- 复制输出 TSV，并给当前已渲染范围添加反馈
- 两个 DataTable 的 owner 互斥
- pointercancel、window blur 和 unmount 清理 listener / RAF

### 浏览器回归

- 普通表格拖选与键盘扩选
- 纵向虚拟化下拖到底部热区持续滚动并扩选
- 列虚拟化下拖到右侧热区持续滚动并扩选
- 对角线靠边时横纵同时滚动
- 嵌套滚动容器裁剪下只滚动 DataTable viewport，不推动外层页面
- RTL 下左右方向键、逻辑边框与水平自动滚屏方向正确
- 释放鼠标后滚动立即停止
- 复制跨视口范围后，粘贴文本的行列结构正确
- 不影响列宽拖拽、列排序拖拽、行展开、行 checkbox 与 pinned cell

浏览器回归继续挂在仓库既有命令：

```bash
pnpm test:e2e:smoke e2e/data-table-cell-range-selection.smoke.spec.ts --grep @workspace-v2
```

## 分阶段交付

设计批准后建议按以下顺序实现，每阶段保持可测试：

1. 纯 range 坐标模型与 TSV 序列化
2. pointer 矩形拖选与多表 owner
3. roving focus、方向键移动与 Shift 扩选
4. 边缘自动滚屏及行/列虚拟化协调
5. 视觉样式、浏览器回归与两个长期分支验证

## 验收标准

以下条件必须全部成立：

1. 用户可从任意可选业务 cell 向四个方向拖出连续矩形区域。
2. 单击、方向键、Shift 扩选与 Escape 的行为符合本文键盘模型。
3. 拖到视口四边可持续自动滚屏，释放或取消后不会残留 RAF 或 listener。
4. 行/列虚拟化下可跨当前 DOM 窗口选取并复制已加载数据。
5. 复制文本保持二维 TSV 结构，并继续尊重 `meta.copyValue`。
6. 行号、操作列、固定列和交互控件不被范围选择劫持。
7. 现有行选择、列拖拽、列宽调整、行展开与多表实例行为不回归。
8. 不新增公共 props，不引入依赖升级，不实现填充柄或数据写回。

## 评审结论入口

建议批准 **方案 B：锚点 + 活动端点的坐标区间模型**，并按五阶段顺序实施。评审通过后再生成具体到文件、测试名称、提交边界和验证命令的 implementation plan。
