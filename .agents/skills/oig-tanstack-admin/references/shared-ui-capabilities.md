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
