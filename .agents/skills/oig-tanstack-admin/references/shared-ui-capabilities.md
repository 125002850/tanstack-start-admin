# 共享 UI 能力

本文件补充共享组件公共契约；基础表格、表单和 workspace 约束分别见 [DataTable](data-table.md)、[表单](forms.md)与[路由和 workspace](routing-and-navigation.md)。

## 日期和空值筛选

- 日期快捷筛选使用 `GTE 当天零点 AND LT 次日零点`，覆盖结束日的小数秒。只有结束日期时使用 `LT`；只有开始日期时保持 `GTE`。
- 个人查询方案保存日期控件的 `filterValue`，恢复时重新构建并核对条件。旧版本使用当天 `23:59:59` 的完整日期方案继续兼容；非法日期拒绝恢复。
- 列声明 `filterEmptyOption: { label: '未设置' }` 后，`select / multiSelect / remoteSelect` 才显示查询 NULL 的选项，默认文案为“空值”。固定、远程和树形候选均支持。
- 默认使用 `dsl.filterField` 对应字段的 `text.IS_NULL`；必须先确认后端支持该字段。关联关系缺失等业务语义通过 `dsl.emptyFilterCondition` 显式声明，不能对虚拟列 ID 发送 NULL 查询。当前不对 enum 节点开放该选项。
- 同一字段的普通选项与 NULL 使用 OR，其他字段及 `baseCondition` 继续按 AND 组合。清除筛选表示不限制字段；NULL 不表示空字符串、空数组或没有关联记录。
- 空值选项是服务端查询能力，不修改表头当前页候选。UI 标记由共享层管理，不得作为业务值或发送给后端；个人方案恢复时继续核对条件。

```tsx
columnDsl.field('categoryCode', '分类', {
  filter: 'multiSelect',
  filterOptions: categoryOptions,
  filterEmptyOption: { label: '未设置' }
});
```

## 列序缓存和首次分页

- `useDataTable / useDslDataTable` 的 `columnOrderVersion` 默认为 `0`。需要调整已有列的默认位置时提升该值，只使旧版本列序缓存失效；列宽、排序和页长偏好保持独立。
- 普通新增列继续使用已有的列序回填机制，不需要提升版本。
- `useDataTablePageSize` 在首次渲染恢复本表页长，查询直接使用保存值；`tableId` 仍用于隔离偏好。

## 轻量明细表格

`DataTableContent` 位于 `components/data-table/core/data-table-content`，复用标准表头和表体，不提供工具栏和分页。默认 `virtualization={false}` 并自然撑高；大名单可显式开启虚拟化，并通过 `className` 提供受约束的滚动高度。支持转发 viewport 的 DOM 属性和 ref。

```tsx
<DataTableContent
  table={table}
  label='对象明细'
  className='h-72'
  virtualization={{ mode: 'on' }}
/>
```

## 选择器头部操作

`SingleChoiceCombobox / MultipleChoiceCombobox` 的 `header` 位于搜索框之后、候选列表之前，适合注入由调用方控制的选择操作；`children` 继续表示底部操作区。嵌入控件自行处理按键，Escape 和 Tab 保留浮层行为。搜索空态按真实候选数量判断，不受“清除选择”操作影响。

## 表单错误定位

`useFormErrorNavigation` 位于 `hooks/use-form-error-navigation`。`fields` 按实际展示顺序声明字段路径和可选 `section`，`onActivateSection` 打开错误字段所在步骤或分区，`onFocus` 聚焦真实输入控件。

只有显式调用 `navigateToFirstError()` 才导航；重新校验只更新 `sectionErrorCounts`，不抢占编辑焦点。异步挂载期间可用 `enabled` 暂缓聚焦，关闭表单时可用 `cancelNavigation()` 清理待执行导航。

## 未保存离开保护

`useWorkspaceDirtyGuard(dirty)` 位于 `features/workspace-tabs/hooks/use-workspace-dirty-guard`，复用现有 `dirty / closeGuard` 生命周期协议，覆盖路由离开、浏览器离开和页签关闭、刷新。确认状态由 `WorkspaceDirtyGuardDialog` 展示，业务通过 `subject` 提供对象名称。

- 取消确认保留表单和页签，不追加“无法关闭”的警告通知。
- 保存成功后先更新业务脏状态基线；需要立即程序化跳转时可调用 `release()` 解除当前保护。
- 关闭其他或全部页签继续由 workspace 逐个询问 guard；该 hook 不代替业务保存和草稿管理。

## 图片和附件预览

`ImagePreview` 位于 `components/image-preview`，基于按需加载的 PhotoSwipe，外层 Dialog 负责模态、焦点和 Escape。`images` 用 `useMemo` 保持稳定，每项提供唯一 `id`，以及 `src` 或 `load(signal): Promise<Blob>` 之一；已知尺寸可传 `width / height`。

- 仅读取当前图片；切图、关闭或 workspace 页面失活时取消读取，忽略迟到结果并释放组件创建的 Blob URL。
- `index / onIndexChange` 支持受控切图，`actions` 注入下载等操作。鉴权和 API 参数由调用方处理，组件不依赖登录类型或业务 DTO。
- `lib/browser/attachment-preview` 负责 MIME 和扩展名识别；预览失败不等于浏览器支持该图片格式，可由业务提供下载操作。
- `FilePreview` 的图片缩略图按可用图片分组预览，上传中的项不能打开，删除不触发预览。

## 文本和 JSON 差异

`TextDiff` 位于 `components/text-diff/text-diff`，支持行号、增删和 token 高亮、未变化内容折叠。`language='json'` 提供 JSON 词法展示，不自动承担业务 Schema 比较。

已有结构标识的文档可通过 `lib/text-diff` 的 `buildKeyedTextDiff` 生成差异行，再使用 `TextDiffView` 展示。结构顺序和字段语义由调用方决定。

## 浏览器回归

`pnpm test:e2e:shared-ui` 使用独立 Vite 测试入口验证真实共享组件，覆盖选择器头部操作、图片缩放和切图、嵌套 Escape 与焦点、错误导航、未保存路由确认，以及明细表行列虚拟化。测试入口位于 `src/test/fixtures/`，不进入生产路由和生产构建。

## 共享画布

画布工具位于 `src/components/canvas/`。`useCanvas` 提供 React Flow 的滚动、缩放默认配置，以及可选的全屏状态；节点、连线、布局和持久化由调用方负责。调用方在 `ReactFlowProvider` 内使用 hook，将 `flowProps` 传给 `ReactFlow`，并加载 `@xyflow/react/dist/style.css`。

- `CanvasFullscreen` 消费 `fullscreen`，移动同一个内容容器，保留节点状态、缩放和画布中心。标题、说明由调用方传入；关闭时恢复触发按钮焦点，工作区失活时复用既有浮层清理。
- `CanvasToolbar`、`CanvasViewportControls`、`CanvasExpandButton` 组合缩放、适配和全屏操作。将 `onViewportTransition` 同时传给视口控件，等待缩放完成后再切换全屏。
- `CanvasElementToolbar` 用于节点或连线操作，阻止操作事件触发画布拖动。`CanvasMiniMap` 仅在视口移动时显示。
- 浮层挂载容器按当前 DOM 解析；不能缓存画布全屏前的 Sheet/Dialog 容器。无 View Transition 或偏好减少动画时直接切换。

完整组合与真实浏览器输入示例见 [共享基础组件示例](../../../../src/test/fixtures/shared-foundation-examples.tsx)。

## 条件编辑器

通用能力位于 `src/components/condition-editor/`，不依赖生成 API、IAM/SSO 或具体业务 feature。调用方控制 `condition`、`catalog`、`issues` 和 `onChange`；纯模型、结构校验、树操作与撤销历史位于该目录的 `model/`、`lib/`。

- `components/condition-tree-editor` 的 `ConditionTreeEditor` 编辑嵌套 AND/OR 条件，主要读写 `leftValue/rightValue` 双输入，支持文本、数字、日期、集合和动态表达式原文。`renderOperand` 可接入调用方自己的表达式输入；编辑器不解析或执行表达式。
- `components/condition-canvas-editor` 的 `ConditionCanvasEditor` 按字段目录编辑 `field/value/values/fieldRef/setRef` 条件，并按需加载 React Flow 与 Dagre。两种入口保留各自输入模式，不自动转换业务协议；调用方选择与服务端契约匹配的入口，并在懒加载边界提供 `Suspense`。
- `ConditionReferenceSetsProvider` 接收使用方已加载的 `{ code, label, fieldType }[]`，同时供树和画布的集合选择器使用。集合请求、缓存、加载与错误状态由使用方管理，不将业务集合 API 放进共享组件。
- 集合编辑从 JSON 原文读取数值，修改其他项不得重写大整数、精确小数或带前导零的文本。切换操作符时清理不再适用的字段引用或集合引用。
- 默认结构上限为 5 层、64 个节点、每组 32 个直接子节点、集合 100 项。`validateConditionTree` 仅做编辑期结构与常量校验；权限、表达式求值、业务校验和最终执行属于调用方或服务端。
- `recordConditionChange`、`undoConditionChange`、`redoConditionChange` 由调用方管理历史，连续输入按键合并；`disabled` 同时锁定输入和结构修改。

## 时长输入

`DurationInput` 位于 `src/components/duration-input.tsx`，使用 `{ value: string, unit: Unit }` 受控值，`units` 为单位编码到显示标签的映射。

```tsx
<DurationInput
  id='timeout'
  label='超时时长'
  value={duration}
  units={{ minute: { label: '分钟' }, hour: { label: '小时' } }}
  onChange={setDuration}
  onBlur={validateDuration}
/>
```

组件保留未完成的数值原文，切换单位不换算、不舍入；范围校验和秒数转换由使用方负责。通过 `invalid/describedBy/required/disabled` 关联表单状态，关闭单位菜单时调用 `onBlur`。

## 错误页与滚动条

`DefaultErrorPage` 在独立页面保持视口最小高度，在 `SidebarInset` 内使用后台可用高度。共用 ScrollArea 的拖拽热区为 16px，视觉滑块为 7px，悬停或拖拽时增至 9px；DataTable 通过同一个 CSS 变量避让滚动条交汇区域。样式、ScrollArea 和表格尺寸必须一起维护。

共享浏览器回归同时覆盖时长输入、条件编辑、画布全屏及浮层焦点、横纵滚动条透明热区拖拽、边缘行操作和错误页高度。
